/**
 * MISEON KIOSK — a tela que roda NO TOTEM.
 *
 * Isto é produto, não a maquete de marketing que vive em
 * `components/kiosk/KioskSimulator.tsx` (aquela tem MENU_MOCK no código e nunca
 * falou com o banco). Aqui o cardápio é o da loja, o preço vem do servidor e o
 * pedido cai no KDS.
 *
 * ─── AS REGRAS QUE GOVERNAM ESTA TELA ──────────────────────────────────────
 * Levantadas do que o mercado de QSR já aprendeu (teardowns de McDonald's e
 * Taco Bell, e o estudo de dark patterns de 2026 sobre o fluxo deles):
 *
 *  1. UMA TAREFA POR TELA. Quem está na fila decide sob pressão social. Tela
 *     que pede duas decisões ao mesmo tempo trava a fila inteira.
 *  2. FOTO GRANDE E PREÇO VISÍVEL. A decisão é visual; texto pequeno é o que
 *     faz a pessoa desistir e ir para o caixa.
 *  3. ALVO DE TOQUE GRANDE (≥ 72px). Dedo não é cursor, e a tela fica em pé,
 *     longe, às vezes com a mão ocupada.
 *  4. O CARRINHO NUNCA SOME. Posição fixa, total sempre à vista — a pessoa
 *     precisa saber quanto já gastou antes de continuar.
 *  5. ADICIONAL SE OFERECE UMA VEZ E ACEITA "NÃO". O estudo de dark patterns
 *     mostra que insistir aumenta o abandono; aqui o "pular" é do mesmo
 *     tamanho do "adicionar".
 *  6. SAÍDA SEMPRE VISÍVEL. Cancelar o pedido é um toque, sem labirinto de
 *     confirmação.
 *  7. NINGUÉM DIGITA VALOR. Nunca. O total é do servidor
 *     (`fn_recalcular_pedido`), e o preço de cada item também — o aparelho
 *     fica na rua e o que ele manda não é confiável.
 *  8. INATIVIDADE LIMPA TUDO. Sem isso, o carrinho de quem desistiu vira o
 *     pedido de quem chegou depois. É o erro mais caro de quiosque e o mais
 *     esquecido.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Plus, Minus, Trash2, ArrowLeft, ShoppingBag, Check, X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useI18n } from '../contexts/I18nContext';
import { getOptimizedImageUrl } from '../lib/cdn';
import { imprimir } from '../lib/print';
import type { Produto, Categoria, GrupoOpcoes, Opcao } from '../types';

/** Volta ao repouso e ESQUECE o carrinho. Ver regra 8. */
const SEGUNDOS_ATE_ESQUECER = 75;
/** Na tela do Pix a espera e menor: se ninguem pagou, a fila nao pode parar. */
const SEGUNDOS_ATE_ESQUECER_NO_PIX = 180;
/** Aviso antes de esquecer: quem só parou para pensar merece a chance de ficar. */
const SEGUNDOS_DE_AVISO = 15;

type ProdutoComOpcoes = Produto & { grupos_opcoes?: (GrupoOpcoes & { opcoes: Opcao[] })[] };

type LinhaCarrinho = {
  linhaId: string;
  produto: ProdutoComOpcoes;
  quantidade: number;
  opcoes: Opcao[];
};

/**
 * A ordem importa e é a do mercado: escolher → conferir → SUGERIR → identificar
 * → pagar. A sugestão vem depois do carrinho, quando a pessoa já decidiu a
 * refeição, e a identificação vem por último — pedir e-mail antes de a pessoa
 * saber o que quer é o jeito mais rápido de perder o pedido na fila.
 */
type Tela = 'repouso' | 'cardapio' | 'item' | 'carrinho' | 'sugestao' | 'identificacao' | 'pagamento' | 'pix' | 'pronto';

/** Categorias que valem como sobremesa para a sugestão do fim do fluxo. */
const PALAVRAS_SOBREMESA = /sobremesa|doce|sorvete|açaí|acai|milk\s?shake|torta|pudim/i;

const dinheiro = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Totem() {
  const { tDynamic } = useI18n();
  const { slug } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const token = params.get('k') ?? '';

  const [loja, setLoja] = useState<{ id: string; nome: string; logo_url?: string | null } | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<ProdutoComOpcoes[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroFatal, setErroFatal] = useState('');

  const [tela, setTela] = useState<Tela>('repouso');
  const [catAtiva, setCatAtiva] = useState<string>('');
  const [itemAberto, setItemAberto] = useState<ProdutoComOpcoes | null>(null);
  const [escolhas, setEscolhas] = useState<Record<string, Opcao[]>>({});
  const [qtdItem, setQtdItem] = useState(1);
  const [carrinho, setCarrinho] = useState<LinhaCarrinho[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState<
    { pedidoId: string; senha: number | null; numero: number; total: number; identificado: boolean; cashbackPct: number } | null
  >(null);
  const [segundosRestantes, setSegundosRestantes] = useState<number | null>(null);
  const [contato, setContato] = useState('');
  const [pix, setPix] = useState<{ pedidoId: string; qr: string; copiaECola: string } | null>(null);
  const [aguardandoPix, setAguardandoPix] = useState(false);

  // ── Cardápio real da loja ────────────────────────────────────────────────
  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data: l } = await supabase
        .from('lojas_publicas').select('id, nome, logo_url').eq('slug', slug).maybeSingle();
      if (!vivo) return;
      if (!l) { setErroFatal('Loja não encontrada.'); setCarregando(false); return; }
      setLoja(l as typeof loja);

      const [{ data: cats }, { data: prods }] = await Promise.all([
        supabase.from('categorias').select('*').eq('loja_id', l.id).order('ordem'),
        supabase.from('produtos').select('*, grupos_opcoes(*, opcoes(*))')
          .eq('loja_id', l.id).eq('disponivel', true).order('ordem'),
      ]);
      if (!vivo) return;
      const listaCats = (cats ?? []) as Categoria[];
      setCategorias(listaCats);
      setProdutos((prods ?? []) as ProdutoComOpcoes[]);
      setCatAtiva(listaCats[0]?.id ?? '');
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [slug]);

  // ── Regra 8: inatividade limpa tudo ──────────────────────────────────────
  /**
   * Desistir de um pedido que ainda não foi pago.
   *
   * Situação real de fila: a pessoa chega no Pix e descobre que não tem saldo.
   * Sem isto o pedido fica AGUARDANDO_PAGAMENTO para sempre — lixo no painel
   * do lojista — e o totem continua preso na tela dela.
   *
   * Não espera resposta de propósito: quem está atrás precisa da tela AGORA, e
   * o servidor recusa sozinho se o pagamento tiver entrado nesse instante.
   */
  const desistirDoPedido = useCallback((pedidoId: string | undefined) => {
    if (!pedidoId) return;
    void supabase.rpc('fn_totem_cancelar_pedido', { p_token: token, p_pedido_id: pedidoId });
  }, [token]);

  const zerar = useCallback(() => {
    setCarrinho([]); setItemAberto(null); setEscolhas({}); setQtdItem(1);
    // Se havia pedido esperando pagamento, ele morre junto com a sessão.
    if (aguardandoPix) desistirDoPedido(resultado?.pedidoId);
    setErro(''); setResultado(null); setSegundosRestantes(null); setContato('');
    setPix(null); setAguardandoPix(false);
    setTela('repouso');
  }, [aguardandoPix, resultado, desistirDoPedido]);

  const ultimoToque = useRef(Date.now());
  useEffect(() => {
    const marcar = () => { ultimoToque.current = Date.now(); setSegundosRestantes(null); };
    for (const ev of ['pointerdown', 'keydown'] as const) window.addEventListener(ev, marcar);
    return () => { for (const ev of ['pointerdown', 'keydown'] as const) window.removeEventListener(ev, marcar); };
  }, []);

  useEffect(() => {
    // Em repouso ou na tela final não há o que esquecer.
    if (tela === 'repouso' || tela === 'pronto') return;
    const t = setInterval(() => {
      const parado = Math.floor((Date.now() - ultimoToque.current) / 1000);
      const limite = tela === 'pix' ? SEGUNDOS_ATE_ESQUECER_NO_PIX : SEGUNDOS_ATE_ESQUECER;
      const falta = limite - parado;
      if (falta <= 0) { zerar(); return; }
      setSegundosRestantes(falta <= SEGUNDOS_DE_AVISO ? falta : null);
    }, 1000);
    return () => clearInterval(t);
  }, [tela, zerar]);

  // ── Carrinho ─────────────────────────────────────────────────────────────
  const precoDaLinha = (l: LinhaCarrinho) =>
    (Number(l.produto.preco) + l.opcoes.reduce((s, o) => s + Number(o.preco_adicional ?? 0), 0)) * l.quantidade;

  // Total APENAS para exibição. O valor que vale é o que o servidor devolve.
  const totalVisual = useMemo(
    () => carrinho.reduce((s, l) => s + precoDaLinha(l), 0),
    [carrinho],
  );
  const itensNoCarrinho = carrinho.reduce((s, l) => s + l.quantidade, 0);

  const abrirItem = (p: ProdutoComOpcoes) => {
    setItemAberto(p); setEscolhas({}); setQtdItem(1); setErro(''); setTela('item');
  };

  const alternarOpcao = (grupo: GrupoOpcoes & { opcoes: Opcao[] }, opcao: Opcao) => {
    setEscolhas((atual) => {
      const jaEscolhidas = atual[grupo.id] ?? [];
      const marcada = jaEscolhidas.some((o) => o.id === opcao.id);
      if (marcada) return { ...atual, [grupo.id]: jaEscolhidas.filter((o) => o.id !== opcao.id) };
      // Grupo de escolha única troca em vez de acumular: é o que a pessoa
      // espera ao tocar noutra opção, e evita erro silencioso de cobrança.
      if (grupo.max_escolhas === 1) return { ...atual, [grupo.id]: [opcao] };
      if (jaEscolhidas.length >= grupo.max_escolhas && grupo.max_escolhas > 0) return atual;
      return { ...atual, [grupo.id]: [...jaEscolhidas, opcao] };
    });
  };

  const faltamObrigatorias = useMemo(() => {
    if (!itemAberto) return [];
    return (itemAberto.grupos_opcoes ?? [])
      .filter((g) => (g.min_escolhas ?? 0) > 0 && (escolhas[g.id]?.length ?? 0) < g.min_escolhas)
      .map((g) => g.nome);
  }, [itemAberto, escolhas]);

  const adicionarAoCarrinho = () => {
    if (!itemAberto) return;
    if (faltamObrigatorias.length) {
      setErro(`Escolha: ${faltamObrigatorias.join(', ')}`);
      return;
    }
    const opcoes = Object.values(escolhas).flat();
    setCarrinho((c) => [...c, {
      linhaId: crypto.randomUUID(), produto: itemAberto, quantidade: qtdItem, opcoes,
    }]);
    setItemAberto(null); setEscolhas({}); setQtdItem(1); setErro(''); setTela('cardapio');
  };

  const mudarQuantidade = (linhaId: string, delta: number) =>
    setCarrinho((c) => c.flatMap((l) => {
      if (l.linhaId !== linhaId) return [l];
      const q = l.quantidade + delta;
      return q <= 0 ? [] : [{ ...l, quantidade: q }];
    }));

  const removerLinha = (linhaId: string) =>
    setCarrinho((c) => c.filter((l) => l.linhaId !== linhaId));

  // ── Sugestão de sobremesa (padrão QSR) ───────────────────────────────────
  // Só existe se a loja TIVER sobremesa cadastrada, e só aparece se ainda não
  // houver uma no carrinho. Oferecer o que a pessoa já pegou é o tipo de
  // insistência que o estudo de dark patterns associa a abandono.
  const categoriasSobremesa = useMemo(
    () => categorias.filter((c) => PALAVRAS_SOBREMESA.test(c.nome)).map((c) => c.id),
    [categorias],
  );
  const sobremesas = useMemo(
    () => produtos.filter((p) => categoriasSobremesa.includes(p.categoria_id ?? '')),
    [produtos, categoriasSobremesa],
  );
  const jaTemSobremesa = carrinho.some((l) => categoriasSobremesa.includes(l.produto.categoria_id ?? ''));
  const valeSugerir = sobremesas.length > 0 && !jaTemSobremesa;

  /** Do carrinho, vai para a sugestão quando ela existe; senão, direto. */
  const seguirDoCarrinho = () => setTela(valeSugerir ? 'sugestao' : 'identificacao');

  // ── Fechamento ───────────────────────────────────────────────────────────
  const finalizar = async () => {
    if (!carrinho.length) return;
    setEnviando(true); setErro('');

    // SÓ TELEFONE, e é decisão de fila, não de simplicidade de código: e-mail
    // obriga teclado alfabético, e digitar "@" e domínio em pé, com gente
    // esperando atrás, é o que faz a pessoa desistir de se identificar — e aí
    // o cashback não acontece para ninguém.
    //
    // Telefone é o que `clientes` já usa como chave (coluna obrigatória), então
    // também é o que reconhece quem já comprou antes.
    //
    // CPF fica de fora: `clientes` não tem essa coluna, logo ele não
    // identificaria ninguém nem acumularia saldo. O lugar dele é a nota
    // fiscal — backlog.
    const soDigitos = contato.replace(/\D/g, '');
    const ehTelefone = soDigitos.length >= 10;

    const { data, error } = await supabase.rpc('fn_totem_criar_pedido', {
      p_token: token,
      p_payload: {
        metodo: 'PIX',
        telefone: ehTelefone ? soDigitos : undefined,
        itens: carrinho.map((l) => ({
          produto_id: l.produto.id,
          quantidade: l.quantidade,
          opcoes: l.opcoes.map((o) => ({ id: o.id })),
        })),
      },
    });
    setEnviando(false);
    if (error) { setErro(error.message); return; }

    const r = data as {
      pedido_id: string; senha: number | null; numero: number; valor_total: number;
      identificado: boolean; cashback_pct: number;
    };
    const fechado = {
      pedidoId: r.pedido_id,
      senha: r.senha, numero: r.numero, total: Number(r.valor_total),
      identificado: !!r.identificado, cashbackPct: Number(r.cashback_pct ?? 0),
    };
    setResultado(fechado);

    // ── O PIX, QUE É O QUE FALTAVA ─────────────────────────────────────────
    // Sem esta etapa o pedido nascia AGUARDANDO_PAGAMENTO e ficava lá para
    // sempre: nunca chegava na cozinha, e a tela ainda dizia que o QR
    // apareceria "na tela ao lado" — coisa que não existe.
    //
    // A cobrança é criada AGORA, com o pedido já gravado, e o valor vem do
    // servidor (a função recalcula a partir dos preços reais).
    const { data: cob, error: erroPix } = await supabase.functions.invoke('pix-criar-cobranca', {
      body: { pedido_id: fechado.pedidoId },
    });
    if (erroPix || !cob?.qr_imagem) {
      // O pedido existe, mas sem cobrança não há como pagar: melhor mandar a
      // pessoa ao balcão do que deixá-la olhando para um QR que não veio.
      setErro('Não consegui gerar o Pix. Finalize no balcão informando o número do pedido.');
      setTela('pronto');
      return;
    }
    setPix({ pedidoId: fechado.pedidoId, qr: cob.qr_imagem, copiaECola: cob.copia_e_cola ?? '' });
    setAguardandoPix(true);
    setTela('pix');
  };

  /** Imprime o recibo com a senha. Só depois do pagamento confirmado. */
  const concluirPago = useCallback((fechado: NonNullable<typeof resultado>, linhas: LinhaCarrinho[]) => {
    // Recibo em bobina, com a senha impressa. Sai do que está em memória: o
    // totem é anônimo e não consegue reler o pedido pelo RLS.
    try {
      imprimir({
        template: 'RECIBO_CLIENTE',
        lojaNome: loja?.nome ?? '',
        pedido: {
          numero: fechado.numero,
          senha: fechado.senha,
          criado_em: new Date().toISOString(),
          identificador_cliente: `Senha ${fechado.senha ?? fechado.numero}`,
          valor_total: fechado.total,
          tipo_pedido: 'RETIRADA_BALCAO',
        } as unknown as Parameters<typeof imprimir>[0]['pedido'],
        itens: linhas.map((l) => ({
          nome_produto: l.produto.nome,
          quantidade: l.quantidade,
          preco_unitario: Number(l.produto.preco),
          itens_pedido_opcoes: l.opcoes.map((o) => ({
            nome_opcao: o.nome, preco_adicional: Number(o.preco_adicional ?? 0),
          })),
        })) as unknown as Parameters<typeof imprimir>[0]['itens'],
      });
    } catch {
      // Impressora ausente ou sem permissão NÃO pode derrubar o pedido: ele já
      // está gravado, e a senha está na tela em tamanho grande.
    }

    setCarrinho([]);
    setAguardandoPix(false);
    setTela('pronto');
  }, [loja]);

  // ── Conferência do Pix ───────────────────────────────────────────────────
  // O webhook da Efí é o caminho principal, mas o totem não pode DEPENDER dele:
  // se ele atrasar, a pessoa fica parada na frente da máquina sem saber se
  // pagou. Pergunta a cada 3s — é o mesmo par "webhook + consulta" que o
  // checkout online já usa.
  useEffect(() => {
    if (!aguardandoPix || !pix || !resultado) return;
    let vivo = true;
    const t = setInterval(async () => {
      const { data } = await supabase.functions.invoke('pix-criar-cobranca', {
        body: { pedido_id: pix.pedidoId, acao: 'status' },
      });
      if (!vivo || !data?.pago) return;
      clearInterval(t);
      concluirPago(resultado, carrinho);
    }, 3000);
    return () => { vivo = false; clearInterval(t); };
  }, [aguardandoPix, pix, resultado, carrinho, concluirPago]);

  // ── Telas ────────────────────────────────────────────────────────────────
  if (carregando) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#070C18] text-white">
        <Loader2 size={56} className="animate-spin text-[#FC5B24]" />
      </div>
    );
  }

  if (erroFatal || !token) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[#070C18] p-10 text-center text-white">
        <X size={64} className="text-red-500" />
        <p className="text-3xl font-black">{erroFatal || 'Totem não vinculado'}</p>
        <p className="max-w-xl text-lg text-slate-400">
          {erroFatal
            ? 'Confira o endereço configurado neste aparelho.'
            : 'Este aparelho precisa do link com a credencial do totem, gerado no painel da loja.'}
        </p>
      </div>
    );
  }

  const produtosDaCategoria = produtos.filter((p) => p.categoria_id === catAtiva);

  return (
    <div className="relative flex min-h-[100dvh] select-none flex-col overflow-hidden bg-[#070C18] text-white [touch-action:manipulation]">
      {/* ── MARCA AO FUNDO ──────────────────────────────────────────────────
          O totem fica em pé no salão, visto de longe e por muita gente: é a
          peça de marca mais exposta que o restaurante tem. Fundo chapado
          entrega ar de protótipo.

          `mix-blend-screen` dispensa editar o arquivo — sobre fundo escuro o
          preto do PNG some e só o símbolo fica. As duas auras coloridas dão
          profundidade sem competir com a foto do produto, que é quem tem de
          chamar atenção. `aria-hidden` porque é decoração. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[42rem] w-[42rem] rounded-full bg-[#FC5B24]/12 blur-[160px]" />
        <div className="absolute -bottom-52 -right-40 h-[46rem] w-[46rem] rounded-full bg-sky-500/10 blur-[170px]" />
        {/* PADRÃO de marca, não um selo no meio da tela.
            Um símbolo gigante centralizado compete com a foto do produto e
            parece marca d'água de documento. Repetido pequeno e na diagonal
            vira textura: lê como papel de parede de marca, preenche a tela
            inteira e não disputa atenção com nada.

            A diagonal é o que separa padrão de grade — alinhado ortogonal
            fica com cara de fundo de planilha. `scale` cobre os cantos que a
            rotação descobriria. */}
        <div
          className="absolute -inset-[25%] opacity-[0.05] mix-blend-screen"
          style={{
            backgroundImage: "url('/Mfavicon.png')",
            backgroundSize: '132px',
            backgroundRepeat: 'repeat',
            transform: 'rotate(-14deg)',
          }}
        />
      </div>

      {/* Tudo que é conteúdo vive acima da marca. */}
      <div className="relative z-10 flex min-h-[100dvh] flex-col">

      {/* ── SAÍDA SEMPRE À MÃO (regra 6) ─────────────────────────────────
          O "Cancelar" só existia em duas telas. Quem desistia no meio do
          caminho deixava o totem preso na tela dele, e o PRÓXIMO DA FILA
          tinha de esperar os 75 segundos de inatividade para poder começar —
          numa fila, isso é uma eternidade e manda a pessoa para o caixa.

          Agora é um toque, de qualquer tela, e o carrinho é esquecido junto.
          Fica no alto e à direita, longe do polegar que está escolhendo: sair
          tem de ser fácil de achar e difícil de tocar sem querer. */}
      {tela !== 'repouso' && tela !== 'pronto' && (
        <button
          type="button"
          onClick={zerar}
          className="fixed right-5 top-5 z-40 flex min-h-[64px] items-center gap-2 rounded-2xl border-2 border-white/25 bg-black/50 px-6 text-xl font-black text-white backdrop-blur-sm active:bg-white/15"
        >
          <X size={22} /> {tDynamic('Recomeçar')}
        </button>
      )}

      {/* Aviso de inatividade — regra 8. Aparece com tempo de reagir. */}
      {segundosRestantes !== null && tela !== 'repouso' && tela !== 'pronto' && (
        <button
          type="button"
          onClick={() => { ultimoToque.current = Date.now(); setSegundosRestantes(null); }}
          className="fixed inset-x-0 top-0 z-50 bg-amber-500 px-6 py-5 text-center text-2xl font-black text-black"
        >
          Ainda está aí? Toque para continuar · {segundosRestantes}s
        </button>
      )}

      {/* ══════════ REPOUSO ══════════ */}
      {tela === 'repouso' && (
        <button
          type="button"
          onClick={() => setTela('cardapio')}
          className="flex flex-1 flex-col items-center justify-center gap-10 p-12"
        >
          {loja?.logo_url
            ? <img src={getOptimizedImageUrl(loja.logo_url)} alt="" className="h-40 w-auto object-contain" />
            : <ShoppingBag size={120} className="text-[#FC5B24]" />}
          <div className="text-center">
            <p className="font-['Sora'] text-6xl font-black leading-tight">{loja?.nome}</p>
            <p className="mt-6 text-4xl font-bold text-[#FC5B24]">{tDynamic('Toque para pedir')}</p>
          </div>
          <span className="mt-4 animate-pulse rounded-full bg-[#FC5B24] px-14 py-7 text-3xl font-black">{tDynamic('Começar pedido')}</span>
        </button>
      )}

      {/* ══════════ CARDÁPIO ══════════ */}
      {tela === 'cardapio' && (
        <>
          <header className="flex items-center justify-between gap-4 border-b border-white/10 p-5">
            <p className="font-['Sora'] text-3xl font-black">{loja?.nome}</p>
            <button type="button" onClick={zerar}
              className="rounded-2xl border-2 border-white/20 px-6 py-4 text-xl font-bold text-slate-300">{tDynamic('Cancelar')}</button>
          </header>

          {/* Categorias — trilho horizontal, alvo grande */}
          <nav className="flex gap-3 overflow-x-auto border-b border-white/10 p-4">
            {categorias.map((c) => (
              <button key={c.id} type="button" onClick={() => setCatAtiva(c.id)}
                className={`min-h-[72px] shrink-0 rounded-2xl px-8 text-2xl font-black transition ${
                  catAtiva === c.id ? 'bg-[#FC5B24] text-white' : 'bg-white/5 text-slate-300'
                }`}>
                {c.nome}
              </button>
            ))}
          </nav>

          <div className="flex-1 overflow-y-auto p-4 pb-40">
            <div className="grid grid-cols-2 gap-4">
              {produtosDaCategoria.map((p) => (
                <button key={p.id} type="button" onClick={() => abrirItem(p)}
                  className="overflow-hidden rounded-3xl bg-white/5 text-left ring-1 ring-white/10 active:scale-[0.98]">
                  {p.imagem_url && (
                    <img src={getOptimizedImageUrl(p.imagem_url)} alt=""
                      className="h-56 w-full object-cover" />
                  )}
                  <div className="p-5">
                    <p className="line-clamp-2 text-2xl font-black leading-tight">{p.nome}</p>
                    <p className="mt-2 text-3xl font-black text-[#FC5B24]">{dinheiro(Number(p.preco))}</p>
                  </div>
                </button>
              ))}
            </div>
            {produtosDaCategoria.length === 0 && (
              <p className="p-10 text-center text-2xl text-slate-400">{tDynamic('Nada nesta categoria agora.')}</p>
            )}
          </div>
        </>
      )}

      {/* ══════════ ITEM ══════════ */}
      {tela === 'item' && itemAberto && (
        <>
          <header className="flex items-center gap-4 border-b border-white/10 p-5">
            <button type="button" onClick={() => setTela('cardapio')}
              className="flex min-h-[72px] items-center gap-3 rounded-2xl bg-white/5 px-6 text-2xl font-black">
              <ArrowLeft size={28} />{tDynamic('Voltar')}</button>
          </header>

          <div className="flex-1 overflow-y-auto p-5 pb-44">
            {itemAberto.imagem_url && (
              <img src={getOptimizedImageUrl(itemAberto.imagem_url)} alt=""
                className="mb-5 h-72 w-full rounded-3xl object-cover" />
            )}
            <h2 className="font-['Sora'] text-4xl font-black leading-tight">{itemAberto.nome}</h2>
            {itemAberto.descricao && (
              <p className="mt-2 text-xl leading-relaxed text-slate-400">{itemAberto.descricao}</p>
            )}
            <p className="mt-3 text-4xl font-black text-[#FC5B24]">{dinheiro(Number(itemAberto.preco))}</p>

            {(itemAberto.grupos_opcoes ?? []).map((g) => {
              const obrigatorio = (g.min_escolhas ?? 0) > 0;
              const marcadas = escolhas[g.id] ?? [];
              return (
                <section key={g.id} className="mt-8">
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <h3 className="text-3xl font-black">{g.nome}</h3>
                    <span className={`rounded-full px-4 py-1.5 text-lg font-black ${
                      obrigatorio && marcadas.length === 0
                        ? 'animate-pulse bg-red-500 text-white'
                        : obrigatorio ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-slate-400'
                    }`}>
                      {obrigatorio
                        ? (marcadas.length === 0 ? tDynamic('Escolha uma opção') : tDynamic('Pronto'))
                        : tDynamic('Opcional')}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {g.opcoes.filter((o) => o.disponivel !== false).map((o) => {
                      const marcada = marcadas.some((x) => x.id === o.id);
                      return (
                        <button key={o.id} type="button" onClick={() => alternarOpcao(g, o)}
                          className={`flex min-h-[84px] w-full items-center justify-between gap-4 rounded-2xl px-6 text-left text-2xl font-bold ring-2 transition ${
                            marcada ? 'bg-[#FC5B24]/15 ring-[#FC5B24]' : 'bg-white/5 ring-white/10'
                          }`}>
                          <span className="flex items-center gap-4">
                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-2 ${
                              marcada ? 'bg-[#FC5B24] ring-[#FC5B24]' : 'ring-white/25'
                            }`}>
                              {marcada && <Check size={24} />}
                            </span>
                            {o.nome}
                          </span>
                          {Number(o.preco_adicional) > 0 && (
                            <span className="shrink-0 text-[#FC5B24]">+ {dinheiro(Number(o.preco_adicional))}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          <footer className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-[#0B1120] p-5">
            {erro && <p className="mb-3 text-center text-2xl font-black text-red-400">{erro}</p>}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 rounded-2xl bg-white/5 p-2">
                <button type="button" onClick={() => setQtdItem((q) => Math.max(1, q - 1))}
                  aria-label="Menos um" className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/10">
                  <Minus size={30} />
                </button>
                <span className="w-14 text-center text-3xl font-black">{qtdItem}</span>
                <button type="button" onClick={() => setQtdItem((q) => q + 1)}
                  aria-label="Mais um" className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/10">
                  <Plus size={30} />
                </button>
              </div>
              {/* O botao DIZ o que falta, em vez de recusar em silencio.
                  Antes ele aceitava o toque, escrevia "Escolha: Ponto da
                  carne" no rodape de uma tela de 1080 e parecia quebrado —
                  foi assim que o dono concluiu que "adicionar nao funciona".
                  Padrao de quiosque: o obrigatorio bloqueia a acao, e a
                  propria acao explica o porque. */}
              <button type="button" onClick={adicionarAoCarrinho}
                disabled={faltamObrigatorias.length > 0}
                className={`flex min-h-[80px] flex-1 items-center justify-center rounded-2xl px-6 text-center text-3xl font-black transition ${
                  faltamObrigatorias.length
                    ? 'cursor-not-allowed bg-white/10 text-slate-400'
                    : 'bg-[#FC5B24] text-white shadow-lg shadow-[#FC5B24]/30'
                }`}>
                {faltamObrigatorias.length ? `Escolha ${faltamObrigatorias[0]}` : tDynamic('Adicionar')}
              </button>
            </div>
          </footer>
        </>
      )}

      {/* ══════════ CARRINHO ══════════ */}
      {tela === 'carrinho' && (
        <>
          <header className="flex items-center justify-between gap-4 border-b border-white/10 p-5">
            <button type="button" onClick={() => setTela('cardapio')}
              className="flex min-h-[72px] items-center gap-3 rounded-2xl bg-white/5 px-6 text-2xl font-black">
              <ArrowLeft size={28} />{tDynamic('Continuar pedindo')}</button>
            <button type="button" onClick={zerar}
              className="rounded-2xl border-2 border-white/20 px-6 py-4 text-xl font-bold text-slate-300">{tDynamic('Cancelar')}</button>
          </header>

          <div className="flex-1 overflow-y-auto p-5 pb-56">
            <h2 className="mb-5 font-['Sora'] text-4xl font-black">{tDynamic('Seu pedido')}</h2>
            {carrinho.map((l) => (
              <div key={l.linhaId} className="mb-4 rounded-3xl bg-white/5 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-2xl font-black leading-tight">{l.produto.nome}</p>
                    {l.opcoes.length > 0 && (
                      <p className="mt-1 text-lg text-slate-400">
                        {l.opcoes.map((o) => o.nome).join(' · ')}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 text-2xl font-black text-[#FC5B24]">{dinheiro(precoDaLinha(l))}</p>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <button type="button" onClick={() => mudarQuantidade(l.linhaId, -1)}
                    aria-label="Menos um" className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/10">
                    <Minus size={28} />
                  </button>
                  <span className="w-14 text-center text-3xl font-black">{l.quantidade}</span>
                  <button type="button" onClick={() => mudarQuantidade(l.linhaId, 1)}
                    aria-label="Mais um" className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/10">
                    <Plus size={28} />
                  </button>
                  <button type="button" onClick={() => removerLinha(l.linhaId)}
                    className="ml-auto flex h-16 items-center gap-2 rounded-xl bg-red-500/15 px-5 text-xl font-black text-red-300">
                    <Trash2 size={24} />{tDynamic('Tirar')}</button>
                </div>
              </div>
            ))}
            {carrinho.length === 0 && (
              <p className="p-10 text-center text-2xl text-slate-400">{tDynamic('Seu pedido está vazio.')}</p>
            )}
          </div>

          <footer className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-[#0B1120] p-5">
            <div className="mb-4 flex items-center justify-between text-4xl font-black">
              <span>{tDynamic('Total')}</span><span className="text-[#FC5B24]">{dinheiro(totalVisual)}</span>
            </div>
            <button type="button" disabled={!carrinho.length} onClick={seguirDoCarrinho}
              className="flex min-h-[88px] w-full items-center justify-center rounded-2xl bg-[#FC5B24] text-3xl font-black disabled:opacity-40">{tDynamic('Continuar')}</button>
          </footer>
        </>
      )}

      {/* ══════════ SUGESTÃO DE SOBREMESA ══════════
          Padrão QSR: oferecer UMA vez, no momento certo, e aceitar o "não".
          "Agora não" tem o mesmo peso visual de adicionar — insistência aqui
          é o que o estudo de dark patterns liga a abandono de pedido. */}
      {tela === 'sugestao' && (
        <>
          <header className="flex items-center gap-4 border-b border-white/10 p-5">
            <button type="button" onClick={() => setTela('carrinho')}
              className="flex min-h-[72px] items-center gap-3 rounded-2xl bg-white/5 px-6 text-2xl font-black">
              <ArrowLeft size={28} />{tDynamic('Voltar')}</button>
          </header>
          <div className="flex-1 overflow-y-auto p-5 pb-44">
            <h2 className="mb-1 font-['Sora'] text-4xl font-black leading-tight">{tDynamic('Vai uma sobremesa?')}</h2>
            <p className="mb-5 text-xl text-slate-400">{tDynamic('Toque para adicionar ao seu pedido.')}</p>
            <div className="grid grid-cols-2 gap-4">
              {sobremesas.slice(0, 6).map((p) => (
                <button key={p.id} type="button" onClick={() => abrirItem(p)}
                  className="overflow-hidden rounded-3xl bg-white/5 text-left ring-1 ring-white/10 active:scale-[0.98]">
                  {p.imagem_url && (
                    <img src={getOptimizedImageUrl(p.imagem_url)} alt="" className="h-52 w-full object-cover" />
                  )}
                  <div className="p-5">
                    <p className="line-clamp-2 text-2xl font-black leading-tight">{p.nome}</p>
                    <p className="mt-2 text-3xl font-black text-[#FC5B24]">{dinheiro(Number(p.preco))}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <footer className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-[#0B1120] p-5">
            <button type="button" onClick={() => setTela('identificacao')}
              className="flex min-h-[88px] w-full items-center justify-center rounded-2xl bg-white/10 text-3xl font-black">{tDynamic('Agora não, continuar')}</button>
          </footer>
        </>
      )}

      {/* ══════════ IDENTIFICAÇÃO ══════════
          Só telefone, e com teclado NUMÉRICO na tela: totem não tem teclado
          físico, e e-mail obrigaria digitar "@" e domínio em pé, com fila
          atrás. Pular é do mesmo tamanho de continuar. */}
      {tela === 'identificacao' && (
        <>
          <header className="flex items-center gap-4 border-b border-white/10 p-5">
            <button type="button" onClick={() => setTela(valeSugerir ? 'sugestao' : 'carrinho')}
              className="flex min-h-[72px] items-center gap-3 rounded-2xl bg-white/5 px-6 text-2xl font-black">
              <ArrowLeft size={28} />{tDynamic('Voltar')}</button>
          </header>
          <div className="flex flex-1 flex-col items-center justify-center gap-5 p-6">
            <p className="text-center font-['Sora'] text-4xl font-black leading-tight">
              Quer acumular <span className="text-emerald-400">cashback</span>?
            </p>
            <p className="max-w-xl text-center text-xl text-slate-400">{tDynamic('Informe seu telefone e o valor volta como crédito para a próxima compra.')}</p>

            <div className="mt-2 flex min-h-[96px] w-full max-w-lg items-center justify-center rounded-3xl bg-white/5 text-5xl font-black tracking-widest ring-2 ring-white/10">
              {contato || <span className="text-slate-600">(00) 00000-0000</span>}
            </div>

            <div className="grid w-full max-w-lg grid-cols-3 gap-3">
              {['1','2','3','4','5','6','7','8','9','','0','apagar'].map((t, i) => (
                t === '' ? <span key={`vazio-${i}`} /> : (
                  <button key={t} type="button"
                    onClick={() => setContato((c) => (t === 'apagar' ? c.slice(0, -1) : (c.length < 11 ? c + t : c)))}
                    className="flex min-h-[88px] items-center justify-center rounded-2xl bg-white/10 text-4xl font-black active:bg-white/20">
                    {t === 'apagar' ? '⌫' : t}
                  </button>
                )
              ))}
            </div>
            {erro && <p className="text-center text-2xl font-black text-red-400">{erro}</p>}
          </div>
          <footer className="fixed inset-x-0 bottom-0 grid grid-cols-2 gap-3 border-t border-white/10 bg-[#0B1120] p-5">
            <button type="button" disabled={enviando}
              onClick={() => { setContato(''); setTela('pagamento'); }}
              className="flex min-h-[88px] items-center justify-center rounded-2xl bg-white/10 text-2xl font-black disabled:opacity-50">{tDynamic('Pular')}</button>
            <button type="button" disabled={enviando || contato.replace(/\D/g, '').length < 10}
              onClick={() => setTela('pagamento')}
              className="flex min-h-[88px] items-center justify-center rounded-2xl bg-emerald-500 text-2xl font-black disabled:opacity-40">{tDynamic('Continuar')}</button>
          </footer>
        </>
      )}

      {/* ══════════ PAGAMENTO ══════════
          Só Pix por enquanto — decisão do dono. Uma opção só dispensa a tela
          de escolha virar mais uma decisão na fila. */}
      {tela === 'pagamento' && (
        <>
          <header className="flex items-center gap-4 border-b border-white/10 p-5">
            <button type="button" onClick={() => setTela('identificacao')}
              className="flex min-h-[72px] items-center gap-3 rounded-2xl bg-white/5 px-6 text-2xl font-black">
              <ArrowLeft size={28} />{tDynamic('Voltar')}</button>
          </header>
          <div className="flex flex-1 flex-col justify-center gap-6 p-6">
            <p className="text-center text-3xl font-bold text-slate-300">{tDynamic('Total a pagar')}</p>
            <p className="text-center font-['Sora'] text-7xl font-black text-[#FC5B24]">{dinheiro(totalVisual)}</p>
            {contato && (
              <p className="text-center text-2xl font-bold text-emerald-400">
                Cashback será creditado para {contato}
              </p>
            )}
            {erro && <p className="text-center text-2xl font-black text-red-400">{erro}</p>}
            <button type="button" disabled={enviando} onClick={finalizar}
              className="flex min-h-[120px] items-center justify-center gap-4 rounded-3xl bg-[#FC5B24] text-4xl font-black disabled:opacity-50">
              {enviando ? <Loader2 size={40} className="animate-spin" /> : 'Pagar com Pix'}
            </button>
            <p className="text-center text-xl text-slate-500">{tDynamic('O QR aparece na tela ao lado do totem para você pagar pelo celular.')}</p>
          </div>
        </>
      )}

      {/* ══════════ PIX ══════════
          A tela que faltava. Sem ela o pedido nascia AGUARDANDO_PAGAMENTO e
          morria ali: nunca chegava na cozinha. O QR é grande porque a pessoa
          lê de longe, com o celular na mão, em pé. */}
      {tela === 'pix' && pix && resultado && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
          <p className="font-['Sora'] text-4xl font-black">{tDynamic('Pague com Pix para a cozinha começar')}</p>
          <p className="text-6xl font-black text-[#FC5B24]">{dinheiro(resultado.total)}</p>

          <div className="rounded-3xl bg-white p-5">
            <img src={pix.qr} alt="QR Code do Pix" className="h-[360px] w-[360px]" />
          </div>

          <p className="max-w-2xl text-2xl text-slate-300">
            {tDynamic('Abra o app do banco, aponte a câmera para o código e confirme.')}
          </p>

          <div className="flex items-center gap-3 rounded-2xl bg-white/5 px-6 py-4 text-2xl font-black text-emerald-300">
            <Loader2 size={28} className="animate-spin" /> {tDynamic('Aguardando o pagamento…')}
          </div>

          <p className="text-xl text-slate-500">
            {tDynamic('Pedido')} #{resultado.numero}
          </p>

          {/* A saída honesta. Sem ela, quem descobre no Pix que não tem saldo
              fica encurralado: ou espera o tempo de inatividade, ou o próximo
              da fila espera por ela. Um toque cancela o pedido e libera a tela. */}
          <button type="button" onClick={zerar}
            className="mt-2 min-h-[80px] rounded-2xl border-2 border-white/25 px-10 text-2xl font-black text-slate-300 active:bg-white/10">
            {tDynamic('Não consegui pagar — cancelar pedido')}
          </button>
        </div>
      )}

      {/* ══════════ PRONTO ══════════ */}
      {tela === 'pronto' && resultado && (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 p-10 text-center">
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-emerald-500">
            <Check size={72} />
          </div>
          <p className="font-['Sora'] text-5xl font-black">{tDynamic('Pedido enviado!')}</p>
          <div className="rounded-3xl bg-white/5 px-16 py-10">
            <p className="text-3xl font-bold text-slate-400">{tDynamic('Sua senha')}</p>
            <p className="font-['Sora'] text-9xl font-black text-[#FC5B24]">{resultado.senha ?? resultado.numero}</p>
          </div>
          {resultado.identificado && resultado.cashbackPct > 0 && (
            <div className="rounded-3xl bg-emerald-500/15 px-10 py-6 ring-2 ring-emerald-500/40">
              <p className="text-3xl font-black text-emerald-300">
                Você acumulou {dinheiro(resultado.total * resultado.cashbackPct / 100)} de cashback
              </p>
              <p className="mt-1 text-xl text-emerald-200/80">{tDynamic('Use na próxima compra informando o mesmo telefone.')}</p>
            </div>
          )}
          <p className="max-w-xl text-2xl text-slate-300">
            Acompanhe o painel e retire no balcão quando sua senha for chamada.
            <span className="mt-2 block text-slate-400">{tDynamic('Seu comprovante está sendo impresso.')}</span>
          </p>
          <button type="button" onClick={zerar}
            className="mt-4 min-h-[88px] rounded-2xl bg-[#FC5B24] px-16 text-3xl font-black">{tDynamic('Concluir')}</button>
        </div>
      )}

      {/* Barra do carrinho — regra 4: nunca some, posição fixa. */}
      {(tela === 'cardapio' || tela === 'item') && itensNoCarrinho > 0 && tela === 'cardapio' && (
        <button type="button" onClick={() => setTela('carrinho')}
          className="fixed inset-x-0 bottom-0 flex min-h-[96px] items-center justify-between gap-4 bg-[#FC5B24] px-6 text-3xl font-black">
          <span className="flex items-center gap-3">
            <ShoppingBag size={34} /> {itensNoCarrinho} {itensNoCarrinho === 1 ? 'item' : 'itens'}
          </span>
          <span>{dinheiro(totalVisual)} · {tDynamic('Ver pedido')}</span>
        </button>
      )}
      </div>
    </div>
  );
}
