import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Tv, Volume2, VolumeX, Maximize2, Sparkles, ShoppingBag,
  CheckCircle2, Clock, QrCode as QrIcon
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Loja, Categoria, Produto, fmt } from '../types';
import MiseOnLoader from '../components/MiseOnLoader';
import { getOptimizedImageUrl } from '../lib/cdn';
import LanguageToggle from '../components/LanguageToggle';
import { useI18n } from '../contexts/I18nContext';

/** `AUTO` nao e uma terceira tela: e quem decide, a cada segundo, entre as
 *  outras duas. Ver `modoEfetivo`. */
type ModoExibicao = 'MENU_BOARD' | 'SENHAS' | 'AUTO';

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
  const AUTO_CARDAPIO_MS = 24_000;
  const AUTO_SENHAS_MS = 12_000;
  const [autoTela, setAutoTela] = useState<'MENU_BOARD' | 'SENHAS'>('MENU_BOARD');
  const autoTelaRef = useRef<'MENU_BOARD' | 'SENHAS'>('MENU_BOARD');
  const autoDesdeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (modo !== 'AUTO') return;

    const aplicar = (nova: 'MENU_BOARD' | 'SENHAS') => {
      if (autoTelaRef.current === nova) return;
      autoTelaRef.current = nova;
      autoDesdeRef.current = Date.now();
      setAutoTela(nova);
    };

    const decidir = () => {
      const prontos = pedidos.filter((p) => ['PRONTO', 'EM_ROTA'].includes(p.status)).length;
      const esperando = pedidos.filter((p) => ['NOVO', 'ACEITO', 'PREPARANDO'].includes(p.status)).length;

      if (prontos > 0) return aplicar('SENHAS');
      if (esperando === 0) return aplicar('MENU_BOARD');

      const atual = autoTelaRef.current;
      const limite = atual === 'SENHAS' ? AUTO_SENHAS_MS : AUTO_CARDAPIO_MS;
      if (Date.now() - autoDesdeRef.current < limite) return;
      aplicar(atual === 'SENHAS' ? 'MENU_BOARD' : 'SENHAS');
    };

    decidir();
    const t = setInterval(decidir, 1_000);
    return () => clearInterval(t);
  }, [modo, pedidos, AUTO_CARDAPIO_MS, AUTO_SENHAS_MS]);

  /** O que esta na tela AGORA. Fora do AUTO, e a escolha manual. */
  const modoEfetivo: 'MENU_BOARD' | 'SENHAS' = modo === 'AUTO' ? autoTela : modo;
  const [categoriaIndex, setCategoriaIndex] = useState(0);
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
      // Token ausente ou errado: a TV mostra o cardapio, mas sem senhas.
      console.error('Painel de senhas:', erroSenhas.message);
    }

    if (peds) setPedidos(peds as SenhaTV[]);
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

    const t = setTimeout(() => setBannerChamadaVisivel(false), 9000);
    return () => clearTimeout(t);
  }, [pedidos, falarPedido, tocarGongo]);

  // 4. Carrossel automático
  useEffect(() => {
    if (modoEfetivo !== 'MENU_BOARD' || categorias.length <= 1) return;

    const timer = setInterval(() => {
      setCategoriaIndex((prev) => (prev + 1) % categorias.length);
    }, 12000);

    return () => clearInterval(timer);
  }, [modoEfetivo, categorias.length]);

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
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(urlCardapio)}`;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#050811] text-white font-['Inter'] select-none flex flex-col justify-between p-6 sm:p-8">
      <header className="flex items-center justify-between border-b border-white/10 pb-4 z-20">
        <div className="flex items-center gap-4">
          {loja.logo_url ? (
            <img src={getOptimizedImageUrl(loja.logo_url)} alt={loja.nome} className="h-12 w-12 rounded-2xl object-cover border border-white/20 shadow-lg" />
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

      {/* ══════════ CONTEÚDO PRINCIPAL (MODO MENU BOARD) ══════════ */}
      {modoEfetivo === 'MENU_BOARD' && (
        <main className="my-auto grid grid-cols-12 gap-8 py-4 z-10">
          {/* Lado Esquerdo: Carrossel do Cardápio */}
          <div className="col-span-9 space-y-6">
            {/* Header da Categoria Ativa */}
            {catAtual && (
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full bg-[#FC5B24] shadow-[0_0_12px_#FC5B24]" />
                  <h2 className="font-['Sora'] text-3xl font-black tracking-tight text-white uppercase">
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
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
                {catAtual.produtos.slice(0, 6).map((produto) => (
                  <div
                    key={produto.id}
                    className="group relative flex flex-col justify-between rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-md transition-all hover:border-white/20 hover:bg-white/10"
                  >
                    <div>
                      {produto.imagem_url ? (
                        <img
                          src={getOptimizedImageUrl(produto.imagem_url)}
                          alt={produto.nome}
                          className="h-36 w-full rounded-2xl object-cover mb-4 border border-white/10 shadow-md group-hover:scale-[1.02] transition-transform"
                        />
                      ) : (
                        <div className="h-28 w-full rounded-2xl bg-white/5 flex items-center justify-center text-slate-600 mb-4">
                          <ShoppingBag size={32} />
                        </div>
                      )}

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

                      {produto.descricao && (
                        <p className="mt-1.5 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {produto.descricao}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
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
          <div className="col-span-3 flex flex-col justify-between gap-6 border-l border-white/10 pl-8">
            {/* Card QR Code de Autoatendimento */}
            <div className="rounded-3xl border border-orange-500/30 bg-gradient-to-b from-orange-500/10 to-transparent p-6 text-center shadow-xl space-y-4">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FC5B24]/20 px-3 py-1 text-xs font-extrabold text-[#FC5B24] border border-[#FC5B24]/30">
                <QrIcon size={14} /> {tDynamic('PEÇA PELO CELULAR')}
              </div>
              <p className="text-xs text-slate-300 font-medium">{tDynamic('Escaneie o QR Code abaixo para ver o cardápio e fazer seu pedido na mesa sem pegar fila:')}</p>
              
              <div className="bg-white p-3 rounded-2xl inline-block shadow-2xl border-4 border-white/10">
                <img src={qrCodeUrl} alt="QR Code do Cardápio" className="w-40 h-40" />
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
        <main className="my-auto grid grid-cols-2 gap-8 py-4 z-10">
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
        </main>
      )}

      {/* ══════════ FOOTER INSTITUCIONAL DA TV ══════════ */}
      <footer className="flex items-center justify-between border-t border-white/10 pt-4 text-xs text-slate-400 z-20">
        <div className="flex items-center gap-2 font-mono">
          <span className="h-2 w-2 rounded-full bg-[#FC5B24]" />
          <span>MiseOn Smart TV Engine v2.4</span>
        </div>
        <p className="text-xs opacity-95 text-slate-500">{tDynamic('Pressione F11 na Smart TV para alternar para modo Tela Cheia sem bordas.')}</p>
      </footer>
    </div>
  );
}
