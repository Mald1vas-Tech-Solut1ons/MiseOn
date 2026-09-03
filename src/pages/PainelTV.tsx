import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Tv, Volume2, VolumeX, Maximize2, Sparkles,
  CheckCircle2, Clock, QrCode as QrIcon
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { gerarQrDataUrl } from '../lib/qr';
import { FotoProduto, obterFotoFallback, obterFotoProduto } from '../lib/fotoProduto';
import { Loja, Categoria, Produto, fmt } from '../types';
import MiseOnLoader from '../components/MiseOnLoader';
import { getOptimizedImageUrl } from '../lib/cdn';
import LanguageToggle from '../components/LanguageToggle';
import { useI18n } from '../contexts/I18nContext';

/** `AUTO` nao e uma terceira tela: e quem decide, a cada segundo, entre as
 *  outras duas. Ver `modoEfetivo`. */
type ModoExibicao = 'MENU_BOARD' | 'SENHAS' | 'AUTO';
/** O que o AUTO pode colocar na tela. `BANNER` e a passagem so do banner. */
type TelaAuto = 'MENU_BOARD' | 'SENHAS' | 'BANNER';

type SenhaTV = {
  numero: number;
  status: string;
  primeiro_nome: string | null;
  criado_em: string;
  /** Ausente em TV que ainda roda com a RPC antiga: tratar como balcao. */
  tipo_pedido?: string | null;
};

/** Pedido de entrega quem retira e o entregador, nao o cliente. A chamada, o
 *  rotulo e ate a cor mudam por causa disso — misturar os dois no mesmo card
 *  fazia o motoboy do iFood e quem espera o proprio lanche olharem para a
 *  mesma coluna sem saber qual senha e de quem. */
const ehEntrega = (p: SenhaTV) => p.tipo_pedido === 'DELIVERY';

type PromoTV = {
  tipo_item: 'BANNER' | 'CUPOM' | 'CASHBACK';
  titulo: string | null;
  imagem_url: string | null;
  codigo: string | null;
  desconto_tipo: string | null;
  desconto_valor: number | null;
  pedido_minimo: number | null;
  validade: string | null;
};

export default function PainelTV() {
  const { tDynamic, idioma } = useI18n();
  const { slug } = useParams<{ slug: string }>();
  // Token do painel: a TV do balcao roda sem login, entao o controle de
  // acesso vai na URL. Loja sem token configurado continua abrindo so pelo
  // slug (compatibilidade com TV ja instalada).
  const [searchParams] = useSearchParams();
  const painelToken = searchParams.get('token');
  const [loja, setLoja] = useState<Loja | null>(null);
  const [categorias, setCategorias] = useState<(Categoria & { produtos: Produto[] })[]>([]);
  const [pedidos, setPedidos] = useState<SenhaTV[]>([]);
  const [carregando, setCarregando] = useState(true);
  /** Quando os dados foram atualizados com sucesso pela ultima vez.
   *
   *  Sem isto a TV mentia: se a internet da loja caisse, a busca falhava em
   *  silencio, as senhas antigas ficavam congeladas na tela e o selo verde
   *  'AO VIVO' continuava piscando. O cliente olha o painel, nao ve a senha
   *  dele, e ninguem descobre que a TV parou. Painel de balcao que mente e
   *  pior que painel desligado — desligado, alguem vai conferir no balcao. */
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);
  // Motivo pelo qual as senhas nao vem. Sem isso o painel mostrava (0) e o
  // lojista concluia que o sistema nao chama ninguem — quando o que faltava
  // era o token na URL da TV.
  const [erroSenhas, setErroSenhas] = useState<string | null>(null);
  // Banner, cupom e cashback cadastrados no Marketing. A TV do balcao e tela de
  // venda: quem esta na fila precisa saber da promocao da casa.
  const [promocoes, setPromocoes] = useState<PromoTV[]>([]);
  // QR gerado no proprio aparelho. Antes vinha de api.qrserver.com: medido em
  // 03/09 na TV, a imagem nao carregou (naturalWidth 0) e sobrou um quadrado
  // branco. Uma TV de balcao fica ligada o dia inteiro — depender de servico
  // de terceiro para o cliente conseguir pedir e frágil demais, basta a
  // internet da loja bloquear o dominio ou o servico cair.
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  // Banner tem tela propria; cupom e cashback sao texto curto e vivem na faixa
  // acima do cardapio. Um nao entra no espaco do outro.
  const banners = useMemo(
    () => promocoes.filter((x) => x.tipo_item === 'BANNER' && !!x.imagem_url),
    [promocoes],
  );
  const promosDeTexto = useMemo(
    () => promocoes.filter((x) => x.tipo_item !== 'BANNER'),
    [promocoes],
  );
  const [bannerIndex, setBannerIndex] = useState(0);

  // ── Modo de exibicao: sobrevive a reboot da TV ────────────────────────────
  //
  // Era `useState('MENU_BOARD')` puro. A TV do balcao fica ligada o dia
  // inteiro e reinicia por queda de energia, atualizacao do sistema ou
  // screensaver que recarrega a pagina — e voltava SEMPRE para o cardapio.
  // Quem escolheu o painel de senhas descobria pelo cliente reclamando que
  // ninguem chamou, e tinha que ir la trocar o toggle de novo.
  //
  // Duas fontes, nesta ordem:
  //   1. `?modo=` na URL — a TV do balcao abre direto no painel de senhas e a
  //      do salao no cardapio, cada uma com o proprio link, sem ninguem tocar.
  //   2. localStorage por loja — lembra a ultima escolha manual naquele
  //      aparelho, entao reboot volta para onde estava.
  //   3. `AUTO` (padrao): ninguem escolhe. Ver `modoEfetivo`.
  const CHAVE_MODO = `miseon_tv_modo_${slug ?? ''}`;
  const [modo, setModo] = useState<ModoExibicao>(() => {
    const daUrl = (searchParams.get('modo') ?? '').toUpperCase();
    if (daUrl === 'SENHAS') return 'SENHAS';
    if (daUrl === 'CARDAPIO' || daUrl === 'MENU_BOARD') return 'MENU_BOARD';
    if (daUrl === 'AUTO') return 'AUTO';
    try {
      const salvo = localStorage.getItem(CHAVE_MODO);
      if (salvo === 'SENHAS' || salvo === 'MENU_BOARD' || salvo === 'AUTO') return salvo;
    } catch {
      // TV com storage bloqueado: cai no padrao, sem quebrar a tela.
    }
    return 'AUTO';
  });

  const trocarModo = useCallback((novo: ModoExibicao) => {
    setModo(novo);
    try { localStorage.setItem(CHAVE_MODO, novo); } catch { /* storage bloqueado */ }
  }, [CHAVE_MODO]);

  // ── Modo AUTO: a TV decide, e decide pelo BALCAO ──────────────────────────
  //
  // Rodizio cego de N em N segundos e a solucao obvia e a errada: ele mostra
  // cardapio exatamente na hora em que alguem precisa ver a propria senha. A
  // regra aqui olha a fila antes do relogio, nesta ordem:
  //
  //   1. Tem pedido PRONTO      -> painel de senhas, sem negociar. Ha gente
  //                                para chamar, e chamar ganha de vender.
  //   2. Balcao vazio           -> cardapio. Nao existe senha para mostrar, e
  //                                painel vazio nao vende nada.
  //   3. So gente esperando     -> ai sim intercala: o cardapio trabalha a
  //                                maior parte do tempo e o painel entra em
  //                                janelas curtas, para quem espera conferir
  //                                que o pedido dele esta na fila.
  //
  // O relogio so manda no caso 3. Nos outros dois a fila manda.
  // A passagem do banner e uma tela INTEIRA, propria. Banner e arte que o
  // lojista pagou para fazer: espremido numa faixa junto com cupom vira ruido.
  // Ele entra entre uma volta e outra do cardapio, curto, e sai.
  const AUTO_CARDAPIO_MS = 24_000;
  const AUTO_SENHAS_MS = 12_000;
  const AUTO_BANNER_MS = 9_000;
  const [autoTela, setAutoTela] = useState<TelaAuto>('MENU_BOARD');
  const autoTelaRef = useRef<TelaAuto>('MENU_BOARD');
  const autoDesdeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (modo !== 'AUTO') return;

    const aplicar = (nova: TelaAuto) => {
      if (autoTelaRef.current === nova) return;
      autoTelaRef.current = nova;
      autoDesdeRef.current = Date.now();
      setAutoTela(nova);
    };

    const decidir = () => {
      const prontos = pedidos.filter((p) => ['PRONTO', 'EM_ROTA'].includes(p.status)).length;
      const esperando = pedidos.filter((p) => ['NOVO', 'ACEITO', 'PREPARANDO'].includes(p.status)).length;
      const temBanner = banners.length > 0;

      // Chamar ganha de qualquer coisa: ha gente esperando para ser atendida.
      if (prontos > 0) return aplicar('SENHAS');

      const atual = autoTelaRef.current;
      const limite =
        atual === 'SENHAS' ? AUTO_SENHAS_MS : atual === 'BANNER' ? AUTO_BANNER_MS : AUTO_CARDAPIO_MS;
      if (Date.now() - autoDesdeRef.current < limite) return;

      // Balcao vazio: cardapio, com a passagem do banner entre as voltas.
      if (esperando === 0) {
        if (atual === 'BANNER') return aplicar('MENU_BOARD');
        return aplicar(temBanner ? 'BANNER' : 'MENU_BOARD');
      }

      // Gente esperando: cardapio -> senhas -> banner -> cardapio.
      if (atual === 'MENU_BOARD') return aplicar('SENHAS');
      if (atual === 'SENHAS') return aplicar(temBanner ? 'BANNER' : 'MENU_BOARD');
      return aplicar('MENU_BOARD');
    };

    decidir();
    const t = setInterval(decidir, 1_000);
    return () => clearInterval(t);
  }, [modo, pedidos, banners.length, AUTO_CARDAPIO_MS, AUTO_SENHAS_MS, AUTO_BANNER_MS]);

  /** O que esta na tela AGORA. Fora do AUTO, e a escolha manual. */
  const modoEfetivo: TelaAuto = modo === 'AUTO' ? autoTela : modo;
  const modoEfetivoRef = useRef<TelaAuto>(modoEfetivo);
  useEffect(() => { modoEfetivoRef.current = modoEfetivo; }, [modoEfetivo]);
  const [categoriaIndex, setCategoriaIndex] = useState(0);
  // Numa TV nada pode aparecer pela metade — nao ha barra de rolagem para
  // resgatar o que sobrou. Em vez de cortar o card no meio (era o que o
  // `overflow-hidden` fazia), medimos a area util e mostramos so as linhas que
  // cabem INTEIRAS; o resto vira proxima pagina da mesma categoria.
  // O card em si nao muda: mexer na altura dele espremia a foto ate sumir.
  const ALTURA_CARD = 300;
  const ALTURA_CARD_COMPACTO = 170;
  const gradeRef = useRef<HTMLDivElement>(null);
  const [linhasGrade, setLinhasGrade] = useState(2);
  // Tela baixa (monitor, janela do navegador) nao comporta o card cheio. Em vez
  // de corta-lo pela metade, ele encolhe: foto menor e sem a descricao. O preco
  // e o nome, que sao o que vende, ficam.
  const [cardCompacto, setCardCompacto] = useState(false);
  const [paginaIndex, setPaginaIndex] = useState(0);
  const [somAtivo, setSomAtivo] = useState(true);
  const [ultimoChamado, setUltimoChamado] = useState<SenhaTV | null>(null);
  const [bannerChamadaVisivel, setBannerChamadaVisivel] = useState(false);

  const synthRef = useRef<SpeechSynthesis | null>(null);
  // `null` = ainda medindo. A TV do balcao pode simplesmente nao ter sintese de
  // voz (varia entre Tizen, webOS e Android TV) ou nao ter voz instalada.
  // Antes isso falhava em silencio: o banner de chamada aparecia, o icone de
  // som ficava verde como se estivesse falando, e ninguem era chamado. O
  // lojista descobriria pelo cliente reclamando.
  const [vozDisponivel, setVozDisponivel] = useState<boolean | null>(null);
  const prontosConhecidosRef = useRef<Set<string> | null>(null);
  const ultimaAtualizacaoRef = useRef<number | null>(null);

  useEffect(() => { ultimaAtualizacaoRef.current = ultimaAtualizacao; }, [ultimaAtualizacao]);

  // Cada passagem mostra o proximo banner: com dois ou tres cadastrados, todos
  // aparecem ao longo do turno em vez de so o primeiro.
  useEffect(() => {
    if (modoEfetivoRef.current !== 'BANNER') return;
    setBannerIndex((i) => (banners.length ? (i + 1) % banners.length : 0));
  }, [autoTela, banners.length]);

  // QR do cardapio, gerado localmente a partir do slug da loja.
  useEffect(() => {
    const slugLoja = loja?.slug;
    if (!slugLoja) return;
    let vivo = true;
    gerarQrDataUrl(`${window.location.origin}/${slugLoja}`, 320)
      .then((url) => { if (vivo) setQrCodeUrl(url); })
      .catch(() => { if (vivo) setQrCodeUrl(''); });
    return () => { vivo = false; };
  }, [loja?.slug]);

  useEffect(() => {
    const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
    synthRef.current = synth;

    if (!synth) {
      setVozDisponivel(false);
      return;
    }

    // `getVoices()` costuma vir vazio na primeira chamada e so popular depois
    // do evento — medir uma vez so daria "sem voz" em aparelho que tem voz.
    const medir = () => setVozDisponivel(synth.getVoices().length > 0);
    medir();
    synth.addEventListener?.('voiceschanged', medir);
    // Rede lenta de TV: da um ultimo veredito depois de 3s para o indicador
    // nao ficar eternamente em "medindo".
    const t = setTimeout(medir, 3000);
    return () => {
      synth.removeEventListener?.('voiceschanged', medir);
      clearTimeout(t);
    };
  }, []);

  // 1. Carregar dados da Loja e Cardápio
  const carregarDados = useCallback(async () => {
    if (!slug) return;

    const { data: lojaData } = await supabase
      .from('lojas_publicas')
      .select('*')
      .eq('slug', slug)
      .single();

    if (!lojaData) {
      setCarregando(false);
      return;
    }

    setLoja(lojaData as Loja);

    const { data: cats } = await supabase
      .from('categorias')
      .select('*, produtos(*)')
      .eq('loja_id', lojaData.id)
      .order('ordem');

    if (cats) {
      const ativas = (cats as any[]).map((c) => ({
        ...c,
        produtos: (c.produtos || [])
          .filter((p: Produto) => p.disponivel)
          .sort((a: Produto, b: Produto) => (a.ordem ?? 0) - (b.ordem ?? 0)),
      })).filter((c) => c.produtos.length > 0);

      setCategorias(ativas);
    }

    // Senhas do dia via RPC. A TV do balcão não loga, e `pedidos` não tem
    // (nem deve ter) policy de SELECT público — a RPC devolve só número,
    // status e primeiro nome. Ver migration 20260815202000.
    const { data: peds, error: erroSenhas } = await supabase.rpc('fn_painel_tv_senhas', {
      p_slug: slug,
      p_token: painelToken,
    });
    if (erroSenhas) {
      // Token ausente ou errado: a TV segue mostrando o cardapio, mas isso
      // precisa APARECER. Antes so ia pro console e a tela exibia "(0)", que
      // se confunde com "nao ha pedidos" — o lojista liga a TV no balcao,
      // ve zero senha e acha que o produto nao funciona.
      console.error('Painel de senhas:', erroSenhas.message);
      setErroSenhas(
        /token/i.test(erroSenhas.message)
          ? 'Esta TV precisa do link com token. Copie o endereço em Configurações da Loja › Painel de TV.'
          : 'Não foi possível carregar as senhas agora.',
      );
      setPedidos([]);
    } else {
      setErroSenhas(null);
    }

    if (peds) setPedidos(peds as SenhaTV[]);

    // Promocoes usam a mesma porta do painel de senhas: `cupons` nao e legivel
    // por anon (codigo exposto vira abuso), entao vem por RPC com token.
    const { data: promos } = await supabase.rpc('fn_painel_tv_promocoes', {
      p_slug: slug,
      p_token: painelToken,
    });
    setPromocoes((promos as PromoTV[]) ?? []);
    setUltimaAtualizacao(Date.now());
    setOffline(false);
    setCarregando(false);
  }, [slug, painelToken]);

  /** Envolve a carga para que falha de rede vire ESTADO VISIVEL, nao silencio.
   *  A promessa rejeitada tambem parava o `setInterval` de ter efeito util. */
  const carregarComGuarda = useCallback(async () => {
    try {
      await carregarDados();
    } catch {
      setOffline(true);
      setCarregando(false);
    }
  }, [carregarDados]);

  useEffect(() => {
    carregarComGuarda();
    // 10s, não 5s: a TV do balcão fica ligada o dia inteiro e o polling é o
    // único caminho aqui (sem sessão, o Realtime respeita RLS e nada chega).
    // Dobrar a frequência dobrava a carga sem melhorar nada para quem retira.
    // A cadencia acompanha o que a TV esta mostrando. No painel de senhas, o
    // intervalo e o atraso entre a cozinha marcar PRONTO e o cliente ser
    // chamado — 10s ali e tempo de mais alguem desistir de esperar. No modo
    // cardapio ninguem esta esperando chamada, entao nao ha motivo para dobrar
    // a carga: o cardapio nao muda a cada 4 segundos.
    const intervaloMs = modo === 'MENU_BOARD' ? 15_000 : 4_000;
    const interval = setInterval(carregarComGuarda, intervaloMs);

    // Vigia independente do resultado da busca: mesmo que a chamada trave sem
    // rejeitar (rede da loja caindo devagar e o pedido ficando pendurado), o
    // relogio continua andando e o selo deixa de dizer AO VIVO.
    const vigia = setInterval(() => {
      setOffline((antes) => {
        const ref = ultimaAtualizacaoRef.current;
        if (ref === null) return antes;
        return Date.now() - ref > 60_000 ? true : antes;
      });
    }, 10_000);

    return () => { clearInterval(interval); clearInterval(vigia); };
  }, [carregarComGuarda, modo]);

  /** Gongo curto antes da chamada.
   *
   *  Existe porque sintese de voz e o recurso MENOS suportado da pilha: varia
   *  entre Tizen, webOS e Android TV, e depende de voz instalada no aparelho.
   *  Um tom gerado pelo Web Audio nao depende de voz nem de arquivo, tem
   *  suporte muito mais amplo, e resolve o essencial — virar a cabeca de quem
   *  esta esperando na direcao da TV. Se ate o Web Audio faltar, sobra o
   *  banner visual, que sempre funciona.
   *
   *  Dois tons curtos, sem estridencia: a TV fica ligada o dia inteiro e um
   *  alerta agressivo vira algo que o balcao desliga na primeira hora. */
  const tocarGongo = useCallback(() => {
    if (!somAtivo) return;
    try {
      const Ctx = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const agora = ctx.currentTime;
      [880, 1174].forEach((hz, i) => {
        const osc = ctx.createOscillator();
        const vol = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = hz;
        const inicio = agora + i * 0.18;
        vol.gain.setValueAtTime(0.0001, inicio);
        vol.gain.exponentialRampToValueAtTime(0.25, inicio + 0.02);
        vol.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.16);
        osc.connect(vol).connect(ctx.destination);
        osc.start(inicio);
        osc.stop(inicio + 0.18);
      });
      // Fecha o contexto depois de tocar: a TV fica ligada o dia inteiro e um
      // AudioContext por chamada acabaria estourando o limite do navegador.
      window.setTimeout(() => ctx.close().catch(() => {}), 900);
    } catch {
      // Sem Web Audio: a chamada segue visual, sem quebrar a tela.
    }
  }, [somAtivo]);

  // 2. Falar chamada sonora
  const falarPedido = useCallback((senha: SenhaTV) => {
    if (!somAtivo || !synthRef.current) return;

    synthRef.current.cancel();

    const nomeFormatado = senha.primeiro_nome ? `, ${senha.primeiro_nome}` : '';
    // Entrega chama o ENTREGADOR. Anunciar "por favor retirar no balcao" para
    // um pedido de delivery mandava recado para quem esta em casa, enquanto o
    // motoboy parado na frente da TV nao sabia que era a coleta dele.
    const texto = ehEntrega(senha)
      ? `${tDynamic('Entrega')} ${senha.numero}${nomeFormatado}, ${tDynamic('pedido pronto para coleta')}`
      : `${tDynamic('Senha')} ${senha.numero}${nomeFormatado}, ${tDynamic('por favor retirar no balcão')}`;

    const utterance = new SpeechSynthesisUtterance(texto);
    // O texto vem do `tDynamic`, entao acompanha o idioma da tela. Fixar
    // `pt-BR` aqui fazia a TV em ingles ler texto ingles com fonetica
    // brasileira.
    utterance.lang = idioma;
    const vozDoIdioma = synthRef.current
      .getVoices()
      .find((v) => v.lang?.replace('_', '-').toLowerCase().startsWith(idioma.slice(0, 2)));
    if (vozDoIdioma) utterance.voice = vozDoIdioma;
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    synthRef.current.speak(utterance);
  }, [somAtivo, tDynamic, idioma]);

  // 4. Detecta transição para PRONTO comparando com o retrato anterior e
  // dispara a chamada por voz. `prontosConhecidosRef === null` significa
  // "ainda não carregou": a primeira carga só registra o estado, para a TV não
  // sair gritando senha antiga assim que é ligada.
  useEffect(() => {
    // Identidade do pedido, nao a senha: a senha zera as 4h e o painel guarda
    // 12h de historico, entao a senha 1 da manha bate com a senha 1 da
    // madrugada anterior — e a chamada nova era engolida como "ja conhecida".
    const chave = (p: SenhaTV) => `${p.criado_em}-${p.numero}`;
    const prontosAgora = new Set(
      pedidos.filter((p) => p.status === 'PRONTO').map(chave),
    );

    // A inicialização do retrato vem ANTES de qualquer saída antecipada: com o
    // `if (!pedidos.length) return` no topo, uma loja que abre sem pedido
    // nenhum deixava o ref em null, e o primeiro lote a chegar já pronto era
    // anunciado como se tivesse acabado de sair da cozinha.
    if (prontosConhecidosRef.current === null) {
      prontosConhecidosRef.current = prontosAgora;
      return;
    }

    const novos = pedidos.filter(
      (p) => p.status === 'PRONTO' && !prontosConhecidosRef.current!.has(chave(p)),
    );
    prontosConhecidosRef.current = prontosAgora;

    if (!novos.length) return;

    const chamado = novos[0];
    setUltimoChamado(chamado);
    setBannerChamadaVisivel(true);
    tocarGongo();
    // Fala depois do gongo para nao sobrepor os dois.
    window.setTimeout(() => falarPedido(chamado), 500);

  }, [pedidos, falarPedido, tocarGongo]);

  // O timer que esconde a tarja precisa viver FORA do efeito acima.
  // Ele estava la dentro, num efeito que depende de `pedidos`: como o painel
  // recarrega a fila a cada poucos segundos, o cleanup matava o setTimeout e a
  // passagem seguinte saia antes em `if (!novos.length) return`, sem agendar
  // outro. Resultado visto na TV: a tarja "#2 PEDIDO PRONTO" ficava presa para
  // sempre, chamando um cliente que ja tinha ido embora, com a coluna ao lado
  // dizendo "PRONTO PARA RETIRADA (0)".
  useEffect(() => {
    if (!bannerChamadaVisivel) return;
    const t = window.setTimeout(() => setBannerChamadaVisivel(false), 9000);
    return () => window.clearTimeout(t);
  }, [bannerChamadaVisivel, ultimoChamado]);

  // E se o pedido chamado sair da fila antes dos 9s (foi retirado, finalizado
  // ou cancelado), a chamada cai na hora: continuar chamando quem ja foi
  // embora e pior do que nao chamar.
  useEffect(() => {
    if (!bannerChamadaVisivel || !ultimoChamado) return;
    const aindaNaFila = pedidos.some(
      (p) => p.numero === ultimoChamado.numero && ['PRONTO', 'EM_ROTA'].includes(p.status),
    );
    if (!aindaNaFila) setBannerChamadaVisivel(false);
  }, [pedidos, bannerChamadaVisivel, ultimoChamado]);

  // 4. Carrossel: vira a pagina dentro da categoria antes de trocar de categoria.
  useEffect(() => {
    if (modoEfetivo !== 'MENU_BOARD' || categorias.length === 0) return;

    const timer = setInterval(() => {
      setPaginaIndex((atual) => {
        const cat = categorias[categoriaIndex] ?? categorias[0];
        const porPagina = Math.max(1, linhasGrade * 3);
        const paginas = Math.max(1, Math.ceil((cat?.produtos.length ?? 0) / porPagina));
        if (atual + 1 < paginas) return atual + 1;
        if (categorias.length > 1) setCategoriaIndex((c) => (c + 1) % categorias.length);
        return 0;
      });
    }, 12000);

    return () => clearInterval(timer);
  }, [modoEfetivo, categorias, categoriaIndex, linhasGrade]);

  useEffect(() => { setPaginaIndex(0); }, [categoriaIndex]);

  // Mede a area da grade e decide quantas linhas cabem inteiras.
  useEffect(() => {
    const alvo = gradeRef.current;
    if (!alvo) return;
    const medir = () => {
      const h = alvo.getBoundingClientRect().height;
      const compacto = h < ALTURA_CARD;
      setCardCompacto(compacto);
      const alturaUnidade = compacto ? ALTURA_CARD_COMPACTO : ALTURA_CARD;
      setLinhasGrade(Math.max(1, Math.min(2, Math.floor(h / alturaUnidade))));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(alvo);
    return () => ro.disconnect();
  }, [modoEfetivo, categoriaIndex]);

  const alternarTelaCheia = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  if (carregando) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#070C18] text-white">
        <MiseOnLoader status={tDynamic("Iniciando Cardápio Digital para TV...")} rows={2} />
      </div>
    );
  }

  if (!loja) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#070C18] text-white p-6 text-center">
        <Tv size={48} className="text-orange-500 mb-4" />
        <h1 className="text-2xl font-bold">{tDynamic('Loja não encontrada')}</h1>
        <p className="text-sm text-slate-400 mt-2">{tDynamic('Verifique o endereço digitado no navegador da TV.')}</p>
      </div>
    );
  }

  const pedidosEmPreparo = pedidos.filter((p) => ['NOVO', 'ACEITO', 'PREPARANDO'].includes(p.status));
  const pedidosProntos = pedidos.filter((p) => ['PRONTO', 'EM_ROTA'].includes(p.status));
  const catAtual = categorias[categoriaIndex] || categorias[0];
  // A rota do cardapio e `/:slug`, NAO `/loja/:slug` (ver main.tsx). Com o
  // prefixo errado a URL nao casa com rota nenhuma e o cliente cai na landing
  // page do MiseOn — o QR da TV, que diz "escaneie para pedir na mesa sem
  // pegar fila", mandava todo mundo para a pagina errada. Medido em producao
  // em 01/09/2026.

  const urlCardapio = `${window.location.origin}/${loja.slug}`;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#050811] text-white font-['Inter'] select-none flex flex-col justify-between p-4 sm:p-5">
      <header className="flex items-center justify-between border-b border-white/10 pb-4 z-20">
        <div className="flex items-center gap-4">
          {loja.logo_url ? (
            <img src={getOptimizedImageUrl(loja.logo_url)} alt={loja.nome} className="h-10 w-10 rounded-xl object-cover border border-white/20 shadow-lg" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FC5B24] font-black text-white text-xl shadow-lg">
              {loja.nome.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="font-['Sora'] text-2xl font-black tracking-tight text-white flex items-center gap-2">
              {loja.nome}
              {offline ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs opacity-95 font-bold text-red-300 border border-red-500/40">
                  <span className="w-2 h-2 rounded-full bg-red-400" /> {tDynamic('SEM CONEXÃO — senhas podem estar desatualizadas')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs opacity-95 font-bold text-emerald-400 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> {tDynamic('AO VIVO')}
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400 font-medium">{tDynamic('Cardápio Digital & Chamada de Pedidos no Balcão')}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <LanguageToggle variant="minimal" />
          {/* Tres posicoes, e AUTO no meio de proposito: e o padrao, e quem
              chega na TV para "arrumar" acha o caminho de volta olhando para
              o centro. Fixar em Cardapio ou Senhas continua valendo para
              quem tem duas TVs, uma em cada papel. */}
          <div className="flex items-center rounded-xl bg-white/5 border border-white/10 p-1">
            <button
              onClick={() => trocarModo('MENU_BOARD')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                modo === 'MENU_BOARD' ? 'bg-[#FC5B24] text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              {tDynamic('Cardápio 4K')}
            </button>
            <button
              onClick={() => trocarModo('AUTO')}
              title="A TV alterna sozinha: chama a senha quando alguém fica pronto e volta ao cardápio quando o balcão esvazia."
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                modo === 'AUTO' ? 'bg-[#FC5B24] text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              {tDynamic('Automático')}
              {modo === 'AUTO' && (
                <span className="ml-1.5 text-xs opacity-90 font-extrabold text-white/70">
                  {modoEfetivo === 'SENHAS' ? tDynamic('· senhas') : tDynamic('· cardápio')}
                </span>
              )}
            </button>
            <button
              onClick={() => trocarModo('SENHAS')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                modo === 'SENHAS' ? 'bg-[#FC5B24] text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              {tDynamic('Painel de Senhas')} ({pedidosProntos.length})
            </button>
          </div>

          <button
            onClick={() => setSomAtivo(!somAtivo)}
            className={`p-2.5 rounded-xl border transition-all ${
              somAtivo ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-slate-500'
            }`}
            title={
              vozDisponivel === false
                ? 'Este aparelho nao tem sintese de voz — a chamada aparece na tela, sem audio.'
                : somAtivo ? 'Voz ativada' : 'Voz desativada'
            }
          >
            {somAtivo && vozDisponivel !== false ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>

          {/* Dizer a verdade sobre o audio vale mais que um icone verde
              mentindo: sem voz, a chamada e visual e o lojista precisa saber
              disso ANTES do cliente reclamar que nao foi chamado. */}
          {vozDisponivel === false && (
            <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs opacity-95 font-bold text-amber-300">
              {tDynamic('Chamada apenas visual neste aparelho')}
            </span>
          )}

          <button
            onClick={alternarTelaCheia}
            className="p-2.5 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 transition-all"
            title="Alternar Tela Cheia (F11)"
          >
            <Maximize2 size={18} />
          </button>
        </div>
      </header>

      {/* ══════════ POP-UP DE CHAMADA SONORA EM DESTAQUE ══════════ */}
      {bannerChamadaVisivel && ultimoChamado && (
        <div className="absolute inset-x-6 top-24 z-50 animate-in slide-in-from-top-6 duration-500">
          <div className="rounded-3xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 p-6 text-white shadow-[0_0_50px_rgba(16,185,129,0.5)] border-2 border-emerald-300/40 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md font-['Sora'] text-4xl font-black text-white shadow-inner animate-bounce">
                #{ultimoChamado.numero}
              </div>
              <div>
                <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-100 mb-1">
                  {ehEntrega(ultimoChamado)
                    ? tDynamic('🛵 ENTREGA PRONTA PARA COLETA')
                    : tDynamic('🔔 PEDIDO PRONTO PARA RETIRADA')}
                </span>
                <h2 className="font-['Sora'] text-3xl font-black tracking-tight text-white">
                  {ultimoChamado.primeiro_nome || 'Cliente'}
                </h2>
                <p className="text-sm text-emerald-100 font-medium mt-0.5">
                  {ehEntrega(ultimoChamado)
                    ? tDynamic('Entregador: retire este pedido no balcão para sair.')
                    : tDynamic('Por favor, retire seu pedido no balcão de atendimento.')}
                </p>
              </div>
            </div>
            <div className="text-right flex flex-col items-end">
              <Sparkles className="text-amber-300 animate-spin mb-2" size={32} />
              <span className="text-xs font-bold text-emerald-200">Chamada Sonora Ativa</span>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ PASSAGEM SÓ DO BANNER (TELA INTEIRA) ══════════ */}
      {modoEfetivo === 'BANNER' && banners.length > 0 && (
        <main className="flex-1 min-h-0 py-4 z-10">
          {(() => {
            const b = banners[bannerIndex % banners.length];
            return (
              <div className="relative h-full w-full overflow-hidden rounded-3xl border border-white/10 animate-in fade-in duration-700">
                <img
                  src={getOptimizedImageUrl(b.imagem_url!) || b.imagem_url!}
                  alt={b.titulo ?? ''}
                  className="h-full w-full object-cover"
                />
                {b.titulo?.trim() && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-12 pb-12 pt-24">
                    <h2 className="font-['Sora'] text-6xl font-black tracking-tight text-white drop-shadow-2xl">
                      {b.titulo}
                    </h2>
                  </div>
                )}
              </div>
            );
          })()}
        </main>
      )}

      {/* ══════════ CONTEÚDO PRINCIPAL (MODO MENU BOARD) ══════════ */}
      {modoEfetivo === 'MENU_BOARD' && (
        <main className="flex-1 min-h-0 grid grid-cols-12 grid-rows-[auto_minmax(0,1fr)] gap-x-8 gap-y-4 py-4 z-10">
          {/* Faixa de promocoes da casa. Fica no topo das duas colunas porque a
              fila do balcao olha a tela inteira, nao so o cardapio. */}
          {promosDeTexto.length > 0 && (
            <div className="col-span-12 flex flex-wrap items-center gap-3">
              {promosDeTexto.map((promo: PromoTV, i: number) => {
                if (promo.tipo_item === 'CASHBACK') {
                  return (
                    <span key={`p${i}`} className="flex items-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-5 py-2.5 font-['Sora'] text-xl font-black text-emerald-300">
                      <Sparkles size={20} className="text-emerald-300" />
                      {tDynamic('Ganhe')} {Number(promo.desconto_valor ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% {tDynamic('de volta em cada pedido')}
                    </span>
                  );
                }
                if (promo.tipo_item === 'CUPOM') {
                  const vale = promo.desconto_tipo === 'PERCENTUAL'
                    ? `${Number(promo.desconto_valor ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% OFF`
                    : `R$ ${Number(promo.desconto_valor ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} OFF`;
                  return (
                    <span key={`p${i}`} className="flex items-center gap-3 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-5 py-2.5">
                      <span className="font-['Sora'] text-xl font-black text-amber-300">{vale}</span>
                      <span className="rounded-lg bg-amber-400/20 px-3 py-1 font-mono text-lg font-black tracking-widest text-amber-200">
                        {promo.codigo}
                      </span>
                      {Number(promo.pedido_minimo ?? 0) > 0 && (
                        <span className="text-xs font-semibold text-amber-200/70">
                          {tDynamic('acima de')} R$ {Number(promo.pedido_minimo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </span>
                  );
                }
                return (
                  <span key={`p${i}`} className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-2.5 font-['Sora'] text-xl font-bold text-white">
                    {promo.titulo}
                  </span>
                );
              })}
            </div>
          )}

          {/* Lado Esquerdo: Carrossel do Cardápio */}
          <div className="col-span-9 min-h-0 flex flex-col gap-3 overflow-hidden">
            {/* Header da Categoria Ativa */}
            {catAtual && (
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full bg-[#FC5B24] shadow-[0_0_12px_#FC5B24]" />
                  <h2 className="font-['Sora'] text-2xl font-black tracking-tight text-white uppercase">
                    {catAtual.nome}
                  </h2>
                </div>

                {categorias.length > 1 && (
                  <div className="flex gap-1.5">
                    {categorias.map((c, i) => (
                      <button
                        key={c.id}
                        onClick={() => setCategoriaIndex(i)}
                        className={`h-2 rounded-full transition-all ${
                          i === categoriaIndex ? 'w-8 bg-[#FC5B24]' : 'w-2 bg-white/20'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Grid de Pratos/Itens da Categoria */}
            {catAtual?.produtos && (
              <div ref={gradeRef} className="grid min-h-0 flex-1 grid-cols-2 lg:grid-cols-3 gap-4 overflow-hidden content-start">
                {catAtual.produtos
                  .slice(paginaIndex * linhasGrade * 3, paginaIndex * linhasGrade * 3 + linhasGrade * 3)
                  .map((produto) => (
                  <div
                    key={produto.id}
                    className={`group relative flex flex-col justify-between rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md transition-all hover:border-white/20 hover:bg-white/10 ${cardCompacto ? 'p-3' : 'p-5'}`}
                  >
                    <div>
                      {/* Produto sem foto mostrava um icone cinza numa TV de 50
                          polegadas — cardapio inteiro sem comida. Agora usa a
                          mesma regra da vitrine: foto do lojista quando existe e
                          carrega, foto gastronomica curada quando nao. */}
                      <FotoProduto
                        src={obterFotoProduto(produto as never)}
                        fallback={obterFotoFallback(produto.nome)}
                        alt={produto.nome}
                        className={`w-full rounded-2xl object-cover border border-white/10 shadow-md group-hover:scale-[1.02] transition-transform ${cardCompacto ? 'h-20 mb-2' : 'h-36 mb-4'}`}
                      />

                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-['Sora'] text-lg font-bold text-white line-clamp-1">
                          {produto.nome}
                        </h3>
                        {produto.destaque && (
                          <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs opacity-90 font-extrabold text-amber-300 border border-amber-500/30">
                            ★ POPULAR
                          </span>
                        )}
                      </div>

                      {produto.descricao && !cardCompacto && (
                        <p className="mt-1.5 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {produto.descricao}
                        </p>
                      )}
                    </div>

                    <div className={`flex items-center justify-between border-t border-white/10 ${cardCompacto ? 'mt-2 pt-2' : 'mt-4 pt-3'}`}>
                      <span className="text-xs opacity-95 font-bold text-slate-400 uppercase tracking-wider">A partir de</span>
                      <span className="font-['Sora'] text-xl font-black text-[#FC5B24]">
                        {fmt(Number(produto.preco))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lado Direito: QR Code Peça no Celular + Resumo de Senhas Chamadas */}
          <div className="col-span-3 min-h-0 flex flex-col justify-between gap-6 overflow-hidden border-l border-white/10 pl-8">
            {/* Card QR Code de Autoatendimento */}
            <div className="rounded-3xl border border-orange-500/30 bg-gradient-to-b from-orange-500/10 to-transparent p-6 text-center shadow-xl space-y-4">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FC5B24]/20 px-3 py-1 text-xs font-extrabold text-[#FC5B24] border border-[#FC5B24]/30">
                <QrIcon size={14} /> {tDynamic('PEÇA PELO CELULAR')}
              </div>
              <p className="text-xs text-slate-300 font-medium">{tDynamic('Escaneie o QR Code abaixo para ver o cardápio e fazer seu pedido na mesa sem pegar fila:')}</p>
              
              <div className="bg-white p-3 rounded-2xl inline-block shadow-2xl border-4 border-white/10">
                {qrCodeUrl
                  ? <img src={qrCodeUrl} alt="QR Code do Cardápio" className="w-40 h-40" />
                  : <div className="w-40 h-40 animate-pulse rounded-xl bg-white/10" />}
              </div>

              <p className="text-xs opacity-95 font-mono text-slate-400 truncate">
                {urlCardapio.replace('https://', '')}
              </p>
            </div>

            {/* Quadro Lateral de ÚLTIMAS SENHAS PRONTAS */}
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>{tDynamic('Últimas Senhas Prontas')}</span>
                <CheckCircle2 size={14} className="text-emerald-400" />
              </h4>

              {pedidosProntos.length === 0 ? (
                <p className="text-xs text-slate-500 py-3 text-center">{tDynamic('Nenhuma senha pronta no momento.')}</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-hidden">
                  {pedidosProntos.slice(0, 4).map((p) => (
                    <div
                      key={`${p.criado_em}-${p.numero}`}
                      className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs font-bold text-emerald-400"
                    >
                      <span className="font-['Sora'] text-base">#{p.numero}</span>
                      <span className="truncate max-w-[110px] text-white">{p.primeiro_nome}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {/* ══════════ MODO EXCLUSIVO DE SENHAS (DUAS COLUNAS GIGANTES) ══════════ */}
      {modoEfetivo === 'SENHAS' && (
        <main className="my-auto flex flex-col gap-6 py-4 z-10">
          {erroSenhas && (
            <div className="rounded-3xl border-2 border-amber-400/60 bg-amber-500/10 p-6 text-center">
              <p className="font-['Sora'] text-2xl font-black uppercase tracking-wider text-amber-300">
                {tDynamic('Painel de senhas indisponível')}
              </p>
              <p className="mt-2 text-base text-amber-100/80">{tDynamic(erroSenhas)}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-8">
          {/* Coluna 1: Em Preparação */}
          <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-8 flex flex-col h-[70vh]">
            <div className="flex items-center gap-3 border-b border-amber-500/20 pb-4 mb-6">
              <Clock size={32} className="text-amber-400 animate-spin" />
              <div>
                <h2 className="font-['Sora'] text-3xl font-black text-amber-400 uppercase tracking-wider">
                  EM PREPARAÇÃO ({pedidosEmPreparo.length})
                </h2>
                <p className="text-xs text-amber-200/60 font-medium">{tDynamic('Sua refeição está sendo preparada na cozinha')}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 overflow-y-auto pr-2">
              {pedidosEmPreparo.map((p) => (
                <div
                  key={`${p.criado_em}-${p.numero}`}
                  className="rounded-2xl border border-amber-500/20 bg-black/40 p-4 text-center space-y-1"
                >
                  <span className="font-['Sora'] text-3xl font-black text-amber-400">#{p.numero}</span>
                  <p className="text-xs text-slate-300 font-bold truncate">{p.primeiro_nome || 'Cliente'}</p>
                  {ehEntrega(p) && (
                    <span className="inline-block rounded-full bg-sky-500/20 px-2 py-0.5 text-xs opacity-90 font-extrabold text-sky-300 border border-sky-500/30">
                      🛵 {tDynamic('ENTREGA')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Coluna 2: Prontos para Retirada */}
          <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-8 flex flex-col h-[70vh]">
            <div className="flex items-center gap-3 border-b border-emerald-500/20 pb-4 mb-6">
              <CheckCircle2 size={32} className="text-emerald-400" />
              <div>
                <h2 className="font-['Sora'] text-3xl font-black text-emerald-400 uppercase tracking-wider">
                  PRONTO PARA RETIRADA ({pedidosProntos.length})
                </h2>
                <p className="text-xs text-emerald-200/60 font-medium">{tDynamic('Dirija-se ao balcão com sua comanda')}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 overflow-y-auto pr-2">
              {pedidosProntos.map((p) => (
                <div
                  key={`${p.criado_em}-${p.numero}`}
                  className={`rounded-2xl border-2 p-4 text-center space-y-1 animate-pulse ${
                    ehEntrega(p)
                      ? 'border-sky-400 bg-sky-500/20 shadow-[0_0_20px_rgba(56,189,248,0.3)]'
                      : 'border-emerald-400 bg-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                  }`}
                >
                  <span className="font-['Sora'] text-4xl font-black text-white">#{p.numero}</span>
                  <p className="text-xs text-emerald-100 font-extrabold truncate">{p.primeiro_nome || 'Cliente'}</p>
                  {ehEntrega(p) && (
                    <span className="inline-block rounded-full bg-sky-500/30 px-2 py-0.5 text-xs opacity-90 font-extrabold text-sky-100 border border-sky-300/40">
                      🛵 {tDynamic('COLETA')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
          </div>
        </main>
      )}

      {/* ══════════ FOOTER INSTITUCIONAL DA TV ══════════ */}
      <footer className="flex shrink-0 items-center justify-between border-t border-white/10 pt-2 text-[11px] text-slate-400 z-20">
        <div className="flex items-center gap-2 font-mono">
          <span className="h-2 w-2 rounded-full bg-[#FC5B24]" />
          <span>MiseOn Smart TV Engine v2.4</span>
        </div>
        <p className="text-xs opacity-95 text-slate-500">{tDynamic('Pressione F11 na Smart TV para alternar para modo Tela Cheia sem bordas.')}</p>
      </footer>
    </div>
  );
}
