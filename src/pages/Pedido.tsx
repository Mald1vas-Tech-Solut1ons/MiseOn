import { useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'sonner';
import { Bike, Check, ChefHat, Clock, Compass, Download, MapPin, Package, PartyPopper, ShieldCheck, Sparkles, XCircle, MessageSquareWarning, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fmt, type Loja, type Pedido, type StatusPedido } from '../types';
import { tocarSom } from '../lib/som';
import { aplicarTema, obterTemaPreferido, type PreferenciaTema } from '../lib/tema';
import { fonteFamilia, obterFundoLojaPorTema, obterTokensLoja, corLegivelSobre } from '../lib/personalizacao';
import ThemeToggle from '../components/ThemeToggle';
import LanguageToggle from '../components/LanguageToggle';
import MiseOnLoader from '../components/MiseOnLoader';
import { useI18n } from '../contexts/I18nContext';

const ETAPAS_DELIVERY: { status: StatusPedido; label: string; icon: ReactNode }[] = [
  { status: 'NOVO', label: 'Recebido', icon: <Clock size={16} /> },
  { status: 'ACEITO', label: 'Aceito', icon: <Check size={16} /> },
  { status: 'PREPARANDO', label: 'Preparando', icon: <ChefHat size={16} /> },
  { status: 'PRONTO', label: 'Pronto para sair', icon: <Package size={16} /> },
  { status: 'EM_ROTA', label: 'Em rota', icon: <Bike size={16} /> },
  { status: 'FINALIZADO', label: 'Entregue', icon: <PartyPopper size={16} /> },
];

const ETAPAS_RETIRADA: { status: StatusPedido; label: string; icon: ReactNode }[] = [
  { status: 'NOVO', label: 'Recebido', icon: <Clock size={16} /> },
  { status: 'ACEITO', label: 'Aceito', icon: <Check size={16} /> },
  { status: 'PREPARANDO', label: 'Preparando', icon: <ChefHat size={16} /> },
  { status: 'PRONTO', label: 'Pronto para retirada', icon: <Package size={16} /> },
  { status: 'FINALIZADO', label: 'Finalizado', icon: <PartyPopper size={16} /> },
];

const STATUS_LABEL: Record<StatusPedido, string> = {
  NOVO: 'Recebido',
  ACEITO: 'Aceito',
  PREPARANDO: 'Em preparo',
  PRONTO: 'Pronto',
  EM_ROTA: 'Em rota',
  FINALIZADO: 'Entregue',
  CANCELADO: 'Cancelado',
};

function mensagemPrincipal(pedido: Pedido, temRota?: boolean) {
  const { status, tipo_pedido, agendado_para, mesa_numero } = pedido;
  const contextoAgendamento = agendado_para ? ' agendado' : '';

  if (status === 'NOVO') return `Recebemos seu pedido${contextoAgendamento} e já estamos organizando a operação.`;
  if (status === 'ACEITO') return `Seu pedido${contextoAgendamento} foi aceito e entrou oficialmente na fila da cozinha.`;
  if (status === 'PREPARANDO') return 'A cozinha está preparando tudo agora.';
  if (status === 'PRONTO') {
    if (tipo_pedido === 'SALAO') return `Tudo pronto! Seu pedido já será servido na Mesa ${mesa_numero || ''}.`;
    if (tipo_pedido === 'DELIVERY') {
      return temRota
        ? 'Seu pedido já está embalado e aguardando o início da sua entrega.'
        : 'Seu pedido está pronto e aguardando o despacho da entrega.';
    }
    return `Seu pedido${contextoAgendamento} está pronto para retirada no balcão.`;
  }
  if (status === 'EM_ROTA') return 'Seu entregador já iniciou a sua entrega.';
  if (status === 'FINALIZADO') {
    if (tipo_pedido === 'SALAO') return 'Pedido servido com sucesso. Bom apetite!';
    return tipo_pedido === 'DELIVERY' ? 'Pedido entregue com sucesso. Bom apetite!' : 'Pedido concluído. Obrigado pela preferência!';
  }
  return 'Seu pedido foi cancelado.';
}

function mensagemToast(pedido: Pedido, temRota?: boolean) {
  const { status, tipo_pedido, agendado_para, mesa_numero } = pedido;
  
  if (status === 'ACEITO') return agendado_para ? '✅ Seu pedido agendado foi aceito!' : '✅ Seu pedido foi aceito pela loja!';
  if (status === 'PREPARANDO') return '👨‍🍳 Seu pedido está sendo preparado com muito carinho!';
  if (status === 'PRONTO') {
    if (tipo_pedido === 'SALAO') return `🍽️ Seu pedido da Mesa ${mesa_numero || ''} está pronto para servir!`;
    if (tipo_pedido === 'DELIVERY') {
      return temRota ? '📦 Seu pedido está pronto e aguardando o início da sua entrega!' : '📦 Seu pedido está pronto e aguardando despacho!';
    }
    return agendado_para ? '🛍️ Seu agendamento está pronto para retirada!' : '🛍️ Seu pedido está pronto para retirada!';
  }
  if (status === 'EM_ROTA') return '🛵 O entregador já está a caminho com seu pedido!';
  if (status === 'FINALIZADO') {
    if (tipo_pedido === 'SALAO') return '🎉 Pedido servido! Bom apetite!';
    return tipo_pedido === 'DELIVERY' ? '🎉 Pedido entregue! Bom apetite!' : '🎉 Pedido finalizado! Bom apetite!';
  }
  if (status === 'CANCELADO') return '❌ Seu pedido infelizmente foi cancelado.';
  return undefined;
}

const iconeMoto = L.divIcon({
  html: '<div style="font-size:26px;line-height:1">🛵</div>',
  className: '', iconSize: [26, 26], iconAnchor: [13, 13],
});

function MapUpdater({ posicao }: { posicao: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([posicao.lat, posicao.lng], map.getZoom(), { animate: true, duration: 1.4 });
  }, [map, posicao.lat, posicao.lng]);
  return null;
}

export default function AcompanharPedido() {
  const { tDynamic } = useI18n();
  const { id } = useParams();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [loja, setLoja] = useState<Partial<Loja> | null>(null);
  const [posicao, setPosicao] = useState<{ lat: number; lng: number } | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const statusAnterior = useRef<StatusPedido | null>(null);
  const [temaCliente, setTemaCliente] = useState<PreferenciaTema>(() => obterTemaPreferido());
  const [confirmando, setConfirmando] = useState(false);

  const handleConfirmarRecebimento = async () => {
    if (!id || confirmando) return;
    setConfirmando(true);
    try {
      const { error } = await supabase.rpc('fn_cliente_confirmar_recebimento', { p_pedido_id: id });
      if (error) throw error;
      toast.success('Recebimento confirmado! Muito obrigado.');
      // O realtime fará o reload sozinho
    } catch (err: any) {
      toast.error('Erro ao confirmar recebimento: ' + err.message);
    } finally {
      setConfirmando(false);
    }
  };

  const handleAbrirChat = () => {
    // Dispara evento para o ChatInterface abrir
    window.dispatchEvent(new CustomEvent('miseon:abrir_chat_problema', { detail: { pedidoId: id } }));
  };

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const carregar = useCallback(async () => {
    // Leitura por link (uuid = token) via RPC: a tabela pedidos não é mais
    // legível em massa (RLS). fn_acompanhar_pedido devolve só este pedido.
    const { data } = await supabase.rpc('fn_acompanhar_pedido', { p_id: id });

    const atual = (data as Pedido) ?? null;
    setPedido(atual);
    if (atual && statusAnterior.current === null) statusAnterior.current = atual.status;

    if (atual?.loja_id) {
      const { data: lojaData } = await supabase
        .from('lojas_publicas')
        .select('slug, nome, logo_url, cor_primaria, cor_secundaria, cor_texto, cor_fundo_claro, cor_fundo_escuro, fonte, tema_cardapio')
        .eq('id', atual.loja_id)
        .maybeSingle();
      setLoja(lojaData ?? null);
    }
  }, [id]);

  useEffect(() => {
    if (!loja) return;
    const padrao = loja.tema_cardapio === 'escuro' ? 'escuro' : 'claro';
    
    // Utilizando queueMicrotask para evitar renderização em cascata (aviso do React/ESLint)
    queueMicrotask(() => {
      setTemaCliente(obterTemaPreferido(padrao));
    });

    const sincronizarTema = (event: Event) => {
      const tema = (event as CustomEvent<{ tema: PreferenciaTema }>).detail?.tema;
      if (tema === 'claro' || tema === 'escuro') setTemaCliente(tema);
    };
    window.addEventListener('miseon:tema', sincronizarTema as EventListener);
    return () => window.removeEventListener('miseon:tema', sincronizarTema as EventListener);
  }, [loja]);

  useEffect(() => {
    if (!loja) return;
    const raiz = document.documentElement;
    const fundo = obterFundoLojaPorTema(temaCliente, loja);
    const tokens = obterTokensLoja(fundo, temaCliente, loja.cor_texto || loja.cor_primaria || '#FC5B24');
    raiz.style.setProperty('--cor-fundo', fundo);
    raiz.style.setProperty('--cor-primaria', loja.cor_primaria || '#FC5B24');
    // Mesma cor da marca, mas corrigida para ser LEGIVEL como texto sobre
    // este fundo. O lojista escolhe primaria e fundo sem nenhuma trava, e
    // combinacoes como vermelho sobre marrom deixavam o PRECO em 3.04:1 —
    // abaixo do minimo 4.5:1 da WCAG AA. Botao continua usando --cor-primaria
    // (texto branco por cima); isto vale para texto sobre o fundo da loja.
    raiz.style.setProperty(
      '--cor-primaria-texto',
      corLegivelSobre(loja.cor_primaria || '#FC5B24', fundo),
    );
    raiz.style.setProperty('--cor-secundaria', loja.cor_secundaria || '#0A5CC4');
    raiz.style.setProperty('--fonte-loja', fonteFamilia(loja.fonte));
    raiz.style.setProperty('--cor-texto', tokens.texto);
    raiz.style.setProperty('--cor-texto-suave', tokens.textoSuave);
    raiz.style.setProperty('--cor-texto-fraco', tokens.textoFraco);
    raiz.style.setProperty('--cor-surface', tokens.surface);
    raiz.style.setProperty('--cor-surface-muted', tokens.surfaceMuted);
    raiz.style.setProperty('--cor-card', tokens.card);
    raiz.style.setProperty('--cor-borda', tokens.border);
    raiz.style.setProperty('--cor-borda-forte', tokens.borderStrong);
    raiz.style.setProperty('--cor-destaque', tokens.destaque);
    aplicarTema(temaCliente);
  }, [loja, temaCliente]);

  // Notifica quando o status muda (usado tanto pelo realtime quanto pelo polling de segurança)
  const notificarMudanca = (novo: Pedido) => {
    const msg = mensagemToast(novo, !!novo.rota_id);
    if (statusAnterior.current && statusAnterior.current !== novo.status && msg) {
      tocarSom();
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(msg, { body: `Pedido #${novo.numero}` });
      }
      toast.success(msg);
    }
    statusAnterior.current = novo.status;
  };

  useEffect(() => {
    if (!id) return;
    
    // Evita chamada síncrona dentro do efeito para não gerar cascading renders
    queueMicrotask(() => {
      carregar();
    });

    // 1) Realtime com reconexão automática: se o websocket cair (celular bloqueado,
    // rede instável), o canal é recriado sozinho em alguns segundos.
    let canal: ReturnType<typeof supabase.channel> | null = null;
    let tentativaReconexao: ReturnType<typeof setTimeout> | null = null;
    let ativo = true;

    const assinar = () => {
      if (!ativo) return;
      if (canal) supabase.removeChannel(canal);
      canal = supabase
        .channel(`pedido-${id}-${Date.now()}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `id=eq.${id}` }, (payload) => {
          notificarMudanca(payload.new as Pedido);
          carregar();
        })
        .subscribe((status) => {
          if (!ativo) return;
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            if (tentativaReconexao) clearTimeout(tentativaReconexao);
            tentativaReconexao = setTimeout(assinar, 4000);
          }
        });
    };
    assinar();

    // 2) Polling de segurança: mesmo se o realtime falhar por completo,
    // o pedido é reconsultado a cada 12s enquanto estiver em andamento.
    const verificarAgora = async () => {
      const { data } = await supabase.rpc('fn_acompanhar_pedido', { p_id: id });
      if (!data) return;
      const novo = data as Pedido;
      if (statusAnterior.current !== novo.status) {
        notificarMudanca(novo);
        carregar();
      }
    };
    const poll = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (statusAnterior.current && ['FINALIZADO', 'CANCELADO'].includes(statusAnterior.current)) return;
      verificarAgora();
    }, 12000);

    // 3) Ao voltar para a aba/app ou recuperar internet, sincroniza na hora.
    const aoVoltar = () => { if (document.visibilityState === 'visible') { verificarAgora(); assinar(); } };
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('online', aoVoltar);
    window.addEventListener('focus', aoVoltar);

    if ('Notification' in window) Notification.requestPermission?.();
    return () => {
      ativo = false;
      if (tentativaReconexao) clearTimeout(tentativaReconexao);
      clearInterval(poll);
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('online', aoVoltar);
      window.removeEventListener('focus', aoVoltar);
      if (canal) supabase.removeChannel(canal);
    };
  }, [id, carregar]);

  useEffect(() => {
    if (!id || pedido?.status !== 'EM_ROTA') return;
    const buscarPosicao = async () => {
      const { data } = await supabase.from('localizacao_entregador').select('lat, lng').eq('pedido_id', id).maybeSingle();
      if (data?.lat && data?.lng) setPosicao({ lat: Number(data.lat), lng: Number(data.lng) });
    };
    buscarPosicao();
    const canal = supabase
      .channel(`entrega-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'localizacao_entregador', filter: `pedido_id=eq.${id}` }, (payload) => {
        const atual = payload.new as { lat?: number; lng?: number };
        if (atual?.lat && atual?.lng) setPosicao({ lat: Number(atual.lat), lng: Number(atual.lng) });
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [id, pedido?.status]);

  // Pedido só de revenda direta (requer_cozinha=false) nunca passa por "Preparando"
  // — pula direto de Aceito para Pronto (fluxo passa-bastão, docs/PLANO-FLUXO-PEDIDOS.md).
  const etapasAtuais = useMemo(() => {
    const base = pedido?.tipo_pedido === 'DELIVERY' ? ETAPAS_DELIVERY : ETAPAS_RETIRADA;
    return pedido?.requer_cozinha === false ? base.filter((e) => e.status !== 'PREPARANDO') : base;
  }, [pedido?.tipo_pedido, pedido?.requer_cozinha]);

  if (!pedido) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F4F7FA] dark:bg-[#070C18]">
        <MiseOnLoader status={tDynamic('Carregando acompanhamento do pedido...')} rows={2} />
      </div>
    );
  }

  const idxAtual = etapasAtuais.findIndex((e) => e.status === pedido.status);
  const cancelado = pedido.status === 'CANCELADO';
  const progresso = cancelado ? 0 : Math.max(18, Math.round(((idxAtual + 1) / etapasAtuais.length) * 100));
  const temTrackingAoVivo = pedido.tipo_pedido === 'DELIVERY' && pedido.status === 'EM_ROTA';

  return (
    <div className="loja-marca min-h-screen pb-12">
      <header className="relative overflow-hidden px-4 pb-6 pt-6 text-white" style={{ background: `linear-gradient(135deg, ${loja?.cor_primaria || 'var(--cor-primaria)'}, ${loja?.cor_secundaria || 'var(--cor-secundaria)'})` }}>
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/75">{tDynamic('Acompanhamento em tempo real')}</p>
              {/* Com senha, ela é o título: é o número que a TV do balcão
                  chama e o que está impresso no papel. Mostrar só o `#numero`
                  aqui fazia o cliente esperar um número que nunca aparece no
                  painel — e ir perguntar no balcão. */}
              {pedido.senha != null ? (
                <>
                  <h1 className="mt-2 text-4xl font-black leading-none">{tDynamic('Senha')} {pedido.senha}</h1>
                  <p className="mt-1 text-xs font-semibold text-white/70">{tDynamic('Pedido')} #{pedido.numero}</p>
                </>
              ) : (
                <h1 className="mt-2 text-3xl font-black">{tDynamic('Pedido')} #{pedido.numero}</h1>
              )}
              <p className="mt-1 text-sm text-white/85">{pedido.identificador_cliente}</p>
            </div>
            <div className="flex items-center gap-2">
              <LanguageToggle variant="minimal" />
              <Link
                to="/lojas"
                className="rounded-full border border-white/20 bg-black/10 px-4 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-black/20"
              >
                <span className="inline-flex items-center gap-2"><Compass size={14} /> {tDynamic('Hall de lojas')}</span>
              </Link>
              <ThemeToggle className="rounded-full border border-white/20 bg-black/10 p-2 text-white backdrop-blur-sm transition hover:bg-black/20" />
              {loja?.slug && (
                <Link
                  to={`/${loja.slug}/meus-pedidos`}
                  className="rounded-full border border-white/20 bg-black/10 px-4 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-black/20"
                >
                  {tDynamic('Meus pedidos')}
                </Link>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-white/15 bg-black/10 p-5 backdrop-blur-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/70">{tDynamic('Status atual')}</p>
                <p className="mt-1 text-xl font-black">{tDynamic(STATUS_LABEL[pedido.status])}</p>
                <p className="mt-2 max-w-2xl text-sm text-white/80">{tDynamic(mensagemPrincipal(pedido, !!pedido.rota_id))}</p>
              </div>
              {!cancelado && (
                <div className="min-w-[120px] rounded-2xl bg-white/10 px-4 py-3 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/65">{tDynamic('Progresso')}</p>
                  <p className="mt-1 text-2xl font-black">{progresso}%</p>
                </div>
              )}
            </div>
            {!cancelado && (
              <div className="mt-4 h-2 rounded-full bg-white/15">
                <div className="h-2 rounded-full bg-white transition-all" style={{ width: `${progresso}%` }} />
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto mt-4 max-w-4xl px-4">
        <div className="rounded-3xl border p-4 shadow-sm" style={{ background: 'var(--cor-surface)', borderColor: 'var(--cor-borda)' }}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-2xl p-2.5" style={{ background: 'var(--cor-destaque)', color: 'var(--cor-primaria-texto)' }}>
                <Sparkles size={18} />
              </div>
              <div>
                <p className="font-semibold" style={{ color: 'var(--cor-texto)' }}>{tDynamic('Seu pedido continua salvo mesmo se você sair desta tela.')}</p>
                <p className="mt-1 text-sm" style={{ color: 'var(--cor-texto-suave)' }}>
                  {tDynamic('As atualizações continuam aparecendo em tempo real em')} <b>Meus pedidos</b> e aqui no link direto do pedido.
                </p>
              </div>
            </div>
            {deferredPrompt && (
              <button onClick={handleInstallClick} className="flex items-center gap-2 rounded-2xl bg-[var(--cor-primaria)] px-4 py-3 text-sm font-bold text-white transition hover:brightness-110">
                <Download size={16} /> Instalar app
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Ações do Cliente (Self-Service) */}
      {!cancelado && pedido.status !== 'FINALIZADO' && (pedido.status === 'PRONTO' || pedido.status === 'EM_ROTA') && (
        <div className="mx-auto mt-4 max-w-4xl px-4">
          <div className="rounded-3xl border p-5 shadow-sm bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-900/20 border-green-200 dark:border-green-900/50">
            <h3 className="font-bold text-green-900 dark:text-green-300 text-lg mb-1">
              {tDynamic('Já está com o seu pedido?')}
            </h3>
            <p className="text-sm text-green-700 dark:text-green-400/80 mb-4">
              {tDynamic('Para nos ajudar, confirme que você já retirou ou recebeu sua encomenda.')}
            </p>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={handleConfirmarRecebimento}
                disabled={confirmando}
                className="flex items-center gap-2 rounded-2xl bg-green-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-green-600/20 transition hover:bg-green-700 disabled:opacity-50"
              >
                {confirmando ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                Confirmar Recebimento
              </button>
              <button 
                onClick={handleAbrirChat}
                className="flex items-center gap-2 rounded-2xl border-2 border-red-200 bg-white dark:bg-gray-900 px-5 py-3 text-sm font-bold text-red-600 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-950/30 dark:border-red-900/30"
              >
                <MessageSquareWarning size={18} />
                {tDynamic('Tive um problema')}
              </button>
            </div>
          </div>
        </div>
      )}

      {pedido.status === 'FINALIZADO' && (
        <div className="mx-auto mt-4 max-w-4xl px-4">
          <div className="flex items-center gap-3 rounded-3xl border p-4 shadow-sm bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30">
            <CheckCircle2 size={24} className="text-emerald-500 shrink-0" />
            <div>
              <p className="font-bold text-emerald-900 dark:text-emerald-300">Pedido Entregue</p>
              <p className="text-sm text-emerald-700 dark:text-emerald-400/80">{tDynamic('O recebimento foi confirmado. Agradecemos a preferência!')}</p>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto mt-4 grid max-w-4xl gap-4 px-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border p-5 shadow-sm" style={{ background: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
          {cancelado ? (
            <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
              <XCircle size={20} />
              <div>
                <p className="font-bold">Pedido cancelado</p>
                <p className="text-sm opacity-80">A loja marcou este pedido como cancelado.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {etapasAtuais.map((etapa, index) => {
                const concluida = index <= idxAtual;
                const atual = index === idxAtual;
                return (
                  <div key={etapa.status} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border transition-all ${concluida ? 'border-transparent text-white shadow-md' : ''}`} style={concluida ? { background: 'var(--cor-primaria)' } : { borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-fraco)', background: 'var(--cor-surface-muted)' }}>
                        {etapa.icon}
                      </div>
                      {index < etapasAtuais.length - 1 && (
                        <div className="mt-2 h-8 w-0.5 rounded-full" style={{ background: index < idxAtual ? 'var(--cor-primaria)' : 'var(--cor-borda)' }} />
                      )}
                    </div>
                    <div className="pt-1">
                      <p className="font-bold" style={{ color: concluida ? 'var(--cor-texto)' : 'var(--cor-texto-fraco)' }}>{tDynamic(etapa.label)}</p>
                      {atual && <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--cor-primaria-texto)' }}>{tDynamic('Etapa atual')}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="space-y-4">
          {temTrackingAoVivo && posicao && (
            <section className="overflow-hidden rounded-3xl border shadow-sm" style={{ borderColor: 'var(--cor-borda)' }}>
              <div className="flex items-center justify-between border-b px-4 py-3" style={{ background: 'var(--cor-surface)', borderColor: 'var(--cor-borda)' }}>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--cor-texto-fraco)' }}>Live tracking</p>
                  <p className="font-bold" style={{ color: 'var(--cor-texto)' }}>{tDynamic('Seu entregador está em rota')}</p>
                </div>
                <span className="rounded-full px-2.5 py-1 text-[11px] font-bold text-white" style={{ background: 'var(--cor-primaria)' }}>Ao vivo</span>
              </div>
              <MapContainer center={[posicao.lat, posicao.lng]} zoom={15} style={{ height: 280, width: '100%' }}>
                <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapUpdater posicao={posicao} />
                <Marker position={[posicao.lat, posicao.lng]} icon={iconeMoto}>
                  <Popup>{tDynamic('Seu entregador está aqui.')}</Popup>
                </Marker>
              </MapContainer>
            </section>
          )}

          {temTrackingAoVivo && !posicao && (
            <section className="rounded-3xl border p-4 shadow-sm" style={{ background: 'var(--cor-surface)', borderColor: 'var(--cor-borda)' }}>
              <p className="font-semibold" style={{ color: 'var(--cor-texto)' }}>{tDynamic('A entrega do seu pedido já começou.')}</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--cor-texto-suave)' }}>
                {tDynamic('O mapa aparece assim que o app do entregador enviar a primeira localização deste pedido.')}
              </p>
            </section>
          )}

          {pedido.tipo_pedido === 'DELIVERY' && pedido.status === 'PRONTO' && !!pedido.rota_id && (
            <section className="rounded-3xl border p-4 shadow-sm" style={{ background: 'var(--cor-surface)', borderColor: 'var(--cor-borda)' }}>
              <p className="font-semibold" style={{ color: 'var(--cor-texto)' }}>{tDynamic('Sua entrega está na fila do entregador.')}</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--cor-texto-suave)' }}>
                {tDynamic('O rastreio só começa quando a sua entrega for iniciada. Isso evita mostrar um trajeto que ainda está atendendo outro cliente.')}
              </p>
            </section>
          )}

          <section className="rounded-3xl border p-5 shadow-sm" style={{ background: 'var(--cor-card)', borderColor: 'var(--cor-borda)' }}>
            <p className="mb-3 text-sm font-bold" style={{ color: 'var(--cor-texto)' }}>{tDynamic('Resumo do pedido')}</p>
            <ul className="space-y-2 text-sm">
              {pedido.itens_pedido?.map((item) => (
                <li key={item.id}>
                  <span className="font-medium" style={{ color: 'var(--cor-texto)' }}>{item.quantidade}x {item.nome_produto}</span>
                  {item.itens_pedido_opcoes?.map((opcao, idx) => (
                    <span key={idx} className="block pl-4 text-xs" style={{ color: 'var(--cor-texto-suave)' }}>+ {opcao.nome_opcao}</span>
                  ))}
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-2 border-t pt-3 text-sm" style={{ borderColor: 'var(--cor-borda)' }}>
              <div className="flex items-center justify-between" style={{ color: 'var(--cor-texto-suave)' }}>
                <span>Subtotal</span>
                <span>{fmt(Number(pedido.subtotal))}</span>
              </div>
              {Number(pedido.taxa_entrega) > 0 && (
                <div className="flex items-center justify-between" style={{ color: 'var(--cor-texto-suave)' }}>
                  <span>{tDynamic('Taxa de entrega')}</span>
                  <span>{fmt(Number(pedido.taxa_entrega))}</span>
                </div>
              )}
              {Number(pedido.desconto) > 0 && (
                <div className="flex items-center justify-between text-green-600 dark:text-green-400">
                  <span>Desconto</span>
                  <span>-{fmt(Number(pedido.desconto))}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1 text-base font-black" style={{ color: 'var(--cor-texto)' }}>
                <span>Total</span>
                <span style={{ color: 'var(--cor-primaria-texto)' }}>{fmt(Number(pedido.valor_total))}</span>
              </div>
            </div>

            {pedido.tipo_pedido === 'DELIVERY' && (
              <div className="mt-4 rounded-2xl p-4" style={{ background: 'var(--cor-surface-muted)' }}>
                <p className="mb-1 flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--cor-texto)' }}>
                  <MapPin size={14} />
                  {tDynamic('Endereço de entrega')}
                </p>
                <p className="text-sm" style={{ color: 'var(--cor-texto-suave)' }}>
                  {pedido.endereco_entrega}
                  {pedido.numero_endereco ? `, ${pedido.numero_endereco}` : ''}
                  {pedido.bairro ? ` - ${pedido.bairro}` : ''}
                  {pedido.complemento ? ` · ${pedido.complemento}` : ''}
                </p>
              </div>
            )}
          </section>

          <section className="rounded-3xl border p-4 shadow-sm" style={{ background: 'var(--cor-surface)', borderColor: 'var(--cor-borda)' }}>
            <div className="flex items-start gap-3">
              <div className="rounded-2xl p-2.5" style={{ background: 'var(--cor-destaque)', color: 'var(--cor-primaria-texto)' }}>
                <ShieldCheck size={18} />
              </div>
              <div>
                <p className="font-semibold" style={{ color: 'var(--cor-texto)' }}>{tDynamic('Atualizações protegidas e em tempo real')}</p>
                <p className="mt-1 text-sm" style={{ color: 'var(--cor-texto-suave)' }}>
                  {tDynamic('Quando a loja muda o status ou o entregador inicia sua entrega, esta tela é atualizada automaticamente.')}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {loja?.slug && (
                    <Link to={`/${loja.slug}`} className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold" style={{ background: 'var(--cor-destaque)', color: 'var(--cor-texto)' }}>
                      <Package size={14} /> {tDynamic('Voltar ao cardápio')}
                    </Link>
                  )}
                  <Link to="/lojas" className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold" style={{ background: 'var(--cor-surface-muted)', color: 'var(--cor-texto)' }}>
                    <Compass size={14} /> Trocar restaurante
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
