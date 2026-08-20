import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../contexts/I18nContext';
import {
  Bell,
  CheckCheck,
  Trash2,
  X,
  ShoppingBag,
  MessageSquare,
  AlertTriangle,
  Flame,
  ChefHat,
  Plug,
  ExternalLink,
  Clock,
  Sparkles,
  Check,
} from 'lucide-react';
import {
  useNotificationStore,
  type AppNotification,
  type CategoriaNotificacao,
} from '../../hooks/useNotificationStore';

interface NotificationCenterProps {
  lojaId: string;
}

function tempoRelativo(iso: string): string {
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 45) return 'agora mesmo';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHoras = Math.floor(diffMin / 60);
  if (diffHoras < 24) return `há ${diffHoras}h`;
  const diffDias = Math.floor(diffHoras / 24);
  return `há ${diffDias}d`;
}

export function NotificationCenter({ lojaId }: NotificationCenterProps) {
  const { tDynamic } = useI18n();
  const nav = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [catAtiva, setCatAtiva] = useState<CategoriaNotificacao>('TODAS');
  const painelRef = useRef<HTMLDivElement>(null);

  const {
    notificacoes,
    naoLidas,
    novasContador,
    marcarComoLida,
    excluirNotificacao,
    marcarTodasComoLidas,
    limparLidas,
    verificarItensCriticos,
  } = useNotificationStore(lojaId);

  // Efeito visual de balanço do sino quando chega nova notificação
  const [animarSino, setAnimarSino] = useState(false);
  useEffect(() => {
    if (novasContador > 0) {
      setAnimarSino(true);
      const timer = setTimeout(() => setAnimarSino(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [novasContador]);

  // Ao abrir a central de notificações, realizar uma checagem ativa de insumos e produtos críticos
  useEffect(() => {
    if (aberto) {
      verificarItensCriticos();
    }
  }, [aberto, verificarItensCriticos]);

  // Fechar ao clicar fora do painel
  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (painelRef.current && !painelRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    if (aberto) {
      document.addEventListener('mousedown', handleClickFora);
    }
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, [aberto]);

  // Filtragem por categoria
  const notificacoesFiltradas = notificacoes.filter((n) => {
    if (catAtiva === 'TODAS') return true;
    return n.categoria === catAtiva;
  });

  const badgeFormatado = naoLidas > 99 ? '99+' : naoLidas;

  const renderIcone = (tipo: AppNotification['tipo']) => {
    switch (tipo) {
      case 'PEDIDO_NOVO':
        return <ShoppingBag size={18} className="text-orange-500" />;
      case 'PEDIDO_PRONTO':
        return <ChefHat size={18} className="text-emerald-500" />;
      case 'CHAT_MENSAGEM':
        return <MessageSquare size={18} className="text-blue-500" />;
      case 'CHAT_HANDOFF':
        return <AlertTriangle size={18} className="text-red-500 animate-pulse" />;
      case 'ESTOQUE_BAIXO':
      case 'CARDAPIO_ESGOTADO':
        return <Flame size={18} className="text-amber-500" />;
      case 'IFOOD_PEDIDO':
        return <Plug size={18} className="text-red-600" />;
      default:
        return <Sparkles size={18} className="text-indigo-500" />;
    }
  };

  const handleAcao = (n: AppNotification) => {
    marcarComoLida(n.id);
    if (n.acaoUrl) {
      nav(n.acaoUrl);
      setAberto(false);
    }
  };

  return (
    <div className="relative z-50" ref={painelRef}>
      <style>{`
        @keyframes bellRing {
          0% { transform: rotate(0); }
          15% { transform: rotate(18deg); }
          30% { transform: rotate(-16deg); }
          45% { transform: rotate(12deg); }
          60% { transform: rotate(-10deg); }
          75% { transform: rotate(6deg); }
          100% { transform: rotate(0); }
        }
        .bell-ring-active {
          animation: bellRing 0.8s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
        }
      `}</style>

      {/* ── BOTÃO DO SINO DE NOTIFICAÇÃO ── */}
      <button
        onClick={() => setAberto(!aberto)}
        aria-label="Central de Notificações"
        className={`group relative flex items-center justify-center h-11 w-11 rounded-2xl border transition-all duration-300 ${
          naoLidas > 0
            ? 'border-orange-500/50 bg-gradient-to-br from-orange-500/15 via-red-500/10 to-transparent shadow-[0_0_20px_rgba(252,91,36,0.35)] dark:shadow-[0_0_25px_rgba(252,91,36,0.45)] text-orange-500 hover:scale-105'
            : 'border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10'
        }`}
      >
        {/* Anel de Pulso Neon Vermelho quando há não lidas */}
        {naoLidas > 0 && (
          <span className="absolute inset-0 rounded-2xl bg-orange-500/20 animate-ping pointer-events-none" />
        )}

        <Bell
          size={22}
          className={`transition-transform duration-300 ${
            animarSino ? 'bell-ring-active text-orange-500 scale-125' : 'group-hover:scale-110'
          }`}
        />

        {/* BADGE VERMELHO Destaque 99+ */}
        {naoLidas > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-gradient-to-r from-red-600 to-orange-600 text-white font-['Sora'] text-[10px] font-black tracking-tight shadow-lg border-2 border-white dark:border-[#070C18] animate-in zoom-in-50 duration-300">
            {badgeFormatado}
          </span>
        )}
      </button>

      {/* ── PAINEL POPOVER CENTRAL DE NOTIFICAÇÕES ── */}
      {aberto && (
        <div className="absolute right-0 mt-3 w-96 max-w-[92vw] rounded-3xl border border-gray-200 dark:border-white/15 bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          
          {/* Cabeçalho do Painel */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
                <Bell size={16} />
              </div>
              <div>
                <h3 className="font-['Sora'] text-sm font-extrabold text-gray-900 dark:text-white">
                  {tDynamic('Central de Notificações')}
                </h3>
                <p className="text-[10px] text-gray-400">
                  {naoLidas > 0 ? `${naoLidas} não lida(s) • As notificações permanecem salvas até você decidir resolver` : 'Todas visualizadas • Clique na lixeira para excluir o alerta'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {naoLidas > 0 && (
                <button
                  onClick={marcarTodasComoLidas}
                  title="Marcar todas como lidas (Manter salvas)"
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-emerald-500 transition"
                >
                  <CheckCheck size={16} />
                </button>
              )}
              {notificacoes.length > 0 && (
                <button
                  onClick={limparLidas}
                  title="Limpar notificações lidas"
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-red-500 transition"
                >
                  <Trash2 size={16} />
                </button>
              )}
              <button
                onClick={() => setAberto(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-white transition"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Abas por Categoria */}
          <div className="flex items-center gap-1 overflow-x-auto px-4 py-2 border-b border-gray-100 dark:border-white/5 no-scrollbar bg-gray-50/30 dark:bg-black/20">
            {(['TODAS', 'ESTOQUE', 'PEDIDO', 'CHAT'] as CategoriaNotificacao[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setCatAtiva(cat)}
                className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold transition ${
                  catAtiva === cat
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-white/10'
                }`}
              >
                {cat === 'TODAS'
                  ? 'Todas'
                  : cat === 'ESTOQUE'
                  ? 'Estoque & Cardápio'
                  : cat === 'PEDIDO'
                  ? 'Pedidos'
                  : 'Atendimento'}
              </button>
            ))}
          </div>

          {/* Lista de Notificações */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-100 dark:divide-white/5 custom-scrollbar">
            {notificacoesFiltradas.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-white/5 text-gray-400">
                  <Bell size={24} />
                </div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
                  {tDynamic('Nenhuma notificação nesta categoria')}
                </p>
                <p className="text-[10px] text-gray-400 mt-1">
                  {tDynamic('Alertas de estoque crítico, novos pedidos e atendimento aparecem aqui.')}
                </p>
              </div>
            ) : (
              notificacoesFiltradas.map((n) => (
                <div
                  key={n.id}
                  className={`group relative p-4 transition-all duration-200 ${
                    !n.lida
                      ? 'bg-orange-500/[0.04] dark:bg-orange-500/[0.06] hover:bg-orange-500/[0.08]'
                      : 'hover:bg-gray-50 dark:hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Ícone por Tipo */}
                    <div className="shrink-0 mt-0.5 rounded-xl border border-gray-200/60 dark:border-white/10 bg-white dark:bg-white/5 p-2 shadow-sm">
                      {renderIcone(n.tipo)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-extrabold text-gray-900 dark:text-white truncate">
                          {n.titulo}
                        </h4>
                        <span className="shrink-0 flex items-center gap-1 text-[10px] font-medium text-gray-400">
                          <Clock size={10} /> {tempoRelativo(n.criadaEm)}
                        </span>
                      </div>

                      <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-300 line-clamp-2">
                        {n.mensagem}
                      </p>

                      {/* Botões de Ação Direta + Manter/Excluir */}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        {n.acaoUrl && (
                          <button
                            onClick={() => handleAcao(n)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 border border-orange-500/30 px-3 py-1 text-[11px] font-bold text-orange-600 dark:text-orange-400 hover:bg-orange-500 hover:text-white transition-all shadow-sm"
                          >
                            <span>{n.acaoRotulo || 'Visualizar'}</span>
                            <ExternalLink size={12} />
                          </button>
                        )}

                        <div className="flex items-center gap-1.5 ml-auto">
                          {!n.lida ? (
                            <button
                              onClick={() => marcarComoLida(n.id)}
                              title="Marcar como lida (manter salva)"
                              className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-white/10 px-2 py-1 text-[10px] font-semibold text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition"
                            >
                              <Check size={11} />
                              <span>Manter</span>
                            </button>
                          ) : (
                            <span className="text-[10px] font-semibold text-gray-400 flex items-center gap-0.5">
                              <CheckCheck size={12} className="text-emerald-500" /> Mantida
                            </span>
                          )}

                          {/* Botão de Exclusão Explícita ("Já resolvi") */}
                          <button
                            onClick={() => excluirNotificacao(n.id)}
                            title="Excluir notificação (já resolvi)"
                            className="flex items-center gap-1 rounded-lg border border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/20 px-2 py-1 text-[10px] font-bold text-red-500 hover:bg-red-500 hover:text-white transition"
                          >
                            <Trash2 size={11} />
                            <span>Excluir</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Ponto Vermelho Indicador de Não Lida */}
                    {!n.lida && (
                      <span className="shrink-0 h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_8px_#fc5b24]" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Rodapé do Painel */}
          {notificacoes.length > 0 && (
            <div className="p-3 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] text-center">
              <span className="text-[10px] font-semibold text-gray-400">
                {tDynamic('Notificações salvas permanentemente • Clique em "Excluir" quando resolver o problema')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
