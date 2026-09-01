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

type ModoExibicao = 'MENU_BOARD' | 'SENHAS';

type SenhaTV = {
  numero: number;
  status: string;
  primeiro_nome: string | null;
  criado_em: string;
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
  const CHAVE_MODO = `miseon_tv_modo_${slug ?? ''}`;
  const [modo, setModo] = useState<ModoExibicao>(() => {
    const daUrl = (searchParams.get('modo') ?? '').toUpperCase();
    if (daUrl === 'SENHAS') return 'SENHAS';
    if (daUrl === 'CARDAPIO' || daUrl === 'MENU_BOARD') return 'MENU_BOARD';
    try {
      const salvo = localStorage.getItem(CHAVE_MODO);
      if (salvo === 'SENHAS' || salvo === 'MENU_BOARD') return salvo;
    } catch {
      // TV com storage bloqueado: cai no padrao, sem quebrar a tela.
    }
    return 'MENU_BOARD';
  });

  const trocarModo = useCallback((novo: ModoExibicao) => {
    setModo(novo);
    try { localStorage.setItem(CHAVE_MODO, novo); } catch { /* storage bloqueado */ }
  }, [CHAVE_MODO]);
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
  const prontosConhecidosRef = useRef<Set<number> | null>(null);

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
    setCarregando(false);
  }, [slug, painelToken]);

  useEffect(() => {
    carregarDados();
    // 10s, não 5s: a TV do balcão fica ligada o dia inteiro e o polling é o
    // único caminho aqui (sem sessão, o Realtime respeita RLS e nada chega).
    // Dobrar a frequência dobrava a carga sem melhorar nada para quem retira.
    const interval = setInterval(carregarDados, 10_000);
    return () => clearInterval(interval);
  }, [carregarDados]);

  // 2. Falar chamada sonora
  const falarPedido = useCallback((senha: SenhaTV) => {
    if (!somAtivo || !synthRef.current) return;

    synthRef.current.cancel();

    const nomeFormatado = senha.primeiro_nome ? `, ${senha.primeiro_nome}` : '';
    const texto = `${tDynamic('Senha')} ${senha.numero}${nomeFormatado}, ${tDynamic('por favor retirar no balcão')}`;

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
    const prontosAgora = new Set(
      pedidos.filter((p) => p.status === 'PRONTO').map((p) => p.numero),
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
      (p) => p.status === 'PRONTO' && !prontosConhecidosRef.current!.has(p.numero),
    );
    prontosConhecidosRef.current = prontosAgora;

    if (!novos.length) return;

    const chamado = novos[0];
    setUltimoChamado(chamado);
    setBannerChamadaVisivel(true);
    falarPedido(chamado);

    const t = setTimeout(() => setBannerChamadaVisivel(false), 9000);
    return () => clearTimeout(t);
  }, [pedidos, falarPedido]);

  // 4. Carrossel automático
  useEffect(() => {
    if (modo !== 'MENU_BOARD' || categorias.length <= 1) return;

    const timer = setInterval(() => {
      setCategoriaIndex((prev) => (prev + 1) % categorias.length);
    }, 12000);

    return () => clearInterval(timer);
  }, [modo, categorias.length]);

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
  const urlCardapio = `${window.location.origin}/loja/${loja.slug}`;
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
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> {tDynamic('AO VIVO')}
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">{tDynamic('Cardápio Digital & Chamada de Pedidos no Balcão')}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <LanguageToggle variant="minimal" />
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
            <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-bold text-amber-300">
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
                  🔔 PEDIDO PRONTO PARA RETIRADA
                </span>
                <h2 className="font-['Sora'] text-3xl font-black tracking-tight text-white">
                  {ultimoChamado.primeiro_nome || 'Cliente'}
                </h2>
                <p className="text-sm text-emerald-100 font-medium mt-0.5">{tDynamic('Por favor, retire seu pedido no balcão de atendimento.')}</p>
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
      {modo === 'MENU_BOARD' && (
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
                          <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-extrabold text-amber-300 border border-amber-500/30">
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
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">A partir de</span>
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

              <p className="text-[11px] font-mono text-slate-400 truncate">
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
                      key={p.numero}
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
      {modo === 'SENHAS' && (
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
                  key={p.numero}
                  className="rounded-2xl border border-amber-500/20 bg-black/40 p-4 text-center space-y-1"
                >
                  <span className="font-['Sora'] text-3xl font-black text-amber-400">#{p.numero}</span>
                  <p className="text-xs text-slate-300 font-bold truncate">{p.primeiro_nome || 'Cliente'}</p>
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
                  key={p.numero}
                  className="rounded-2xl border-2 border-emerald-400 bg-emerald-500/20 p-4 text-center space-y-1 shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-pulse"
                >
                  <span className="font-['Sora'] text-4xl font-black text-white">#{p.numero}</span>
                  <p className="text-xs text-emerald-100 font-extrabold truncate">{p.primeiro_nome || 'Cliente'}</p>
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
        <p className="text-[11px] text-slate-500">{tDynamic('Pressione F11 na Smart TV para alternar para modo Tela Cheia sem bordas.')}</p>
      </footer>
    </div>
  );
}
