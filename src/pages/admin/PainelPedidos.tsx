import { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Loja, Pedido, StatusPedido, fmt, Via } from '../../types';
import { imprimir } from '../../lib/print';
import { tocarSom } from '../../lib/som';
import type { CtxLoja } from './AdminLayout';
import { MiseOnLoader } from '../../components/MiseOnLoader';
import { traduzirErro, type ErroTraduzido } from '../../lib/erros';
import { ErroAmigavel } from '../../components/ui/ErroAmigavel';
import { FLUXO } from '../../components/pedidos/constants';
import { PedidoHeader } from '../../components/pedidos/PedidoHeader';
import { PedidoItens } from '../../components/pedidos/PedidoItens';
import { PedidoFooter } from '../../components/pedidos/PedidoFooter';
import { PedidoActions } from '../../components/pedidos/PedidoActions';
import { ModalCancelamento } from '../../components/pedidos/ModalCancelamento';
import { ModalCodigoEntrega } from '../../components/pedidos/ModalCodigoEntrega';
import { despacharNoIfood, ehPedidoIfood, entregaEhDaLoja } from '../../lib/ifood';

import { useI18n } from '../../contexts/I18nContext';
const SELECT = '*, itens_pedido(*, itens_pedido_opcoes(*)), pagamentos(metodo, status, valor_pago)';

/* ── Card de pedido com visual oficial MiseOn ── */
function CardPedido({
  p, papel, avisaIfood, onEnviarCozinha, onAvancar, onCancelar, onValidarCodigo, onImprimir, onErro,
}: {
  p: Pedido;
  papel: string;
  /**
   * A loja quer que o MiseOn avise o iFood do andamento?
   *
   * Vem de `ifood_addon_ativo && ifood_sync_status_pedido`. Com isso desligado,
   * o lojista escolheu tocar o iFood pelo Portal do Parceiro — e a tela tem que
   * respeitar ANTES de agir: nada de despachar lá, e nada de abrir a conferência
   * de código para depois dizer que não podia. A Edge Function recusa de
   * qualquer jeito; aqui é para não oferecer o que não vai acontecer.
   */
  avisaIfood: boolean;
  onEnviarCozinha: () => Promise<void>;
  onAvancar: (status: StatusPedido) => Promise<void>;
  onCancelar: () => void;
  /** Abre a conferência de código do iFood (coleta pelo entregador ou entrega ao cliente). */
  onValidarCodigo: (tipo: 'coleta' | 'entrega') => void;
  onImprimir: (via: Via) => void;
  onErro: (e: unknown) => void;
}) {
  const semAvancoSalao = p.tipo_pedido === 'SALAO' && p.status === 'PRONTO';
  const naCozinha = p.estacao_atual === 'COZINHA';
  const precisaConferir = p.status === 'PRONTO' && p.estacao_atual === 'BALCAO' && !semAvancoSalao;
  const fluxo = semAvancoSalao ? { ...FLUXO[p.status], prox: undefined } : (FLUXO[p.status] ?? FLUXO.CANCELADO);
  const isDelivery = p.tipo_pedido === 'DELIVERY';
  const [conferidos, setConferidos] = useState<Set<string>>(new Set());
  const [processando, setProcessando] = useState(false);

  const itens = p.itens_pedido ?? [];
  const todosConferidos = precisaConferir && itens.length > 0 && itens.every((i) => conferidos.has(i.id));
  const toggleConferido = (id: string) => setConferidos((s) => {
    const novo = new Set(s);
    if (novo.has(id)) { novo.delete(id); } else { novo.add(id); }
    return novo;
  });

  const destinoLabel = p.tipo_pedido === 'DELIVERY' ? 'Saiu p/ entrega' : 'Entregar ao cliente';
  const destinoStatus: StatusPedido = p.tipo_pedido === 'DELIVERY' ? 'EM_ROTA' : 'FINALIZADO';

  const executar = async (fn: () => Promise<void>) => {
    setProcessando(true);
    try {
      await fn();
    } catch (e: any) {
      onErro(e);
    }
    setProcessando(false);
  };

  /**
   * O avanço de status de um pedido do iFood não é só nosso.
   *
   * Dois pontos do fluxo têm contrapartida obrigatória do outro lado, e em
   * ambos o certo é falar com o iFood ANTES de mexer no status daqui:
   *
   *   → EM_ROTA     precisa de /dispatch. Se o iFood recusar e a gente já
   *                 tivesse marcado "saiu para entrega", o cliente veria o
   *                 pedido parado na cozinha enquanto a moto está na rua.
   *   → FINALIZADO  precisa do código de entrega (verifyDeliveryCode), que é o
   *                 que conclui o pedido lá. Vai por modal, então aqui só
   *                 interrompe: quem chama `onAvancar` de verdade é o modal,
   *                 depois do iFood confirmar.
   */
  const avancar = async (status: StatusPedido) => {
    const doIfood = ehPedidoIfood(p) && avisaIfood;

    if (doIfood && status === 'EM_ROTA' && entregaEhDaLoja(p)) {
      const r = await despacharNoIfood(p.id);
      // Ver Entregas.tsx: preferência desligada não trava o despacho local.
      if (!r.ok && !r.desligado) {
        onErro(new Error(r.erro ?? 'O iFood recusou o despacho.'));
        return;
      }
    }

    if (doIfood && status === 'FINALIZADO') {
      onValidarCodigo('entrega');
      return;
    }

    await onAvancar(status);
  };

  // O código de coleta só existe quando quem entrega é o iFood — e só faz
  // sentido conferir quando a sacola já está pronta para sair.
  const conferirColeta =
    ehPedidoIfood(p) && avisaIfood && !entregaEhDaLoja(p) && p.status === 'PRONTO'
      ? () => onValidarCodigo('coleta')
      : undefined;

  return (
    <div
      className="flex flex-col overflow-hidden rounded-[20px] border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0B1120]"
      style={{ animation: 'mo-screen-in .45s cubic-bezier(.2,.8,.2,1) both' }}
    >
      <PedidoHeader pedido={p} />
      <PedidoItens pedido={p} precisaConferir={precisaConferir} conferidos={conferidos} toggleConferido={toggleConferido} />
      <PedidoFooter pedido={p} />
      <PedidoActions
        pedido={p} papel={papel} naCozinha={naCozinha} precisaConferir={precisaConferir}
        todosConferidos={todosConferidos} semAvancoSalao={semAvancoSalao} destinoStatus={destinoStatus}
        destinoLabel={destinoLabel} isDelivery={isDelivery} processando={processando}
        fluxoProx={fluxo.prox} fluxoLabel={fluxo.label} onAvancar={avancar}
        onEnviarCozinha={onEnviarCozinha} onCancelar={onCancelar} onConferirColeta={conferirColeta}
        onImprimir={onImprimir} executar={executar}
      />
    </div>
  );
}

/* ── Filtros rápidos por status/bastão ── */
// O filtro "iFood" NÃO é fixo: entra na lista só quando faz sentido para a
// loja (integração vinculada ou pedidos iFood existentes no painel) — ver
// `filtros` no componente. Mostrar filtro de um canal inexistente é ruído.
const FILTROS: { id: string; label: string; pred: (p: Pedido) => boolean }[] = [
  { id: 'TODOS',      label: 'Todos',       pred: () => true },
  { id: 'WHATSAPP',   label: 'WhatsApp',    pred: (p) => p.origem === 'whatsapp' },
  { id: 'IFOOD',      label: 'iFood',       pred: (p) => p.origem === 'ifood' },
  { id: 'ABERTOS',    label: 'Abertos',     pred: (p) => ['NOVO', 'ACEITO'].includes(p.status) && p.estacao_atual !== 'COZINHA' },
  { id: 'NA_COZINHA', label: 'Na cozinha',  pred: (p) => p.estacao_atual === 'COZINHA' },
  { id: 'CONFERIR',   label: 'Conferir',    pred: (p) => p.status === 'PRONTO' && p.estacao_atual === 'BALCAO' && p.tipo_pedido !== 'SALAO' },
  { id: 'EM_ROTA',    label: 'Em rota',     pred: (p) => p.status === 'EM_ROTA' },
  { id: 'FINALIZADOS',label: 'Finalizados', pred: (p) => p.status === 'FINALIZADO' },
  { id: 'CANCELADOS', label: 'Cancelados',  pred: (p) => p.status === 'CANCELADO' },
];

export default function PainelPedidos() {
  const { tDynamic } = useI18n();
  const { lojaId, papel } = useOutletContext<CtxLoja>();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [loja, setLoja] = useState<Loja | null>(null);
  const [filtro, setFiltro] = useState('TODOS');
  const [erroAcao, setErroAcao] = useState<ErroTraduzido | null>(null);
  const [limiteRender, setLimiteRender] = useState(20);
  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => setLimiteRender(20), 0);
  }, [filtro]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setLimiteRender((prev) => prev + 20);
        }
      },
      { rootMargin: '300px' } // Load when 300px away from bottom
    );
    if (observerRef.current) observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [pedidos, filtro]);

  useEffect(() => {
    supabase.from('lojas').select('*').eq('id', lojaId).single()
      .then(({ data }) => setLoja((data as Loja) ?? null));
  }, [lojaId]);

  useEffect(() => {
    if (!erroAcao) return;
    const t = setTimeout(() => setErroAcao(null), 12000);
    return () => clearTimeout(t);
  }, [erroAcao]);

  const carregar = async () => {
    const cutoff24h = new Date(Date.now() - 24 * 3600e3).toISOString();
    const { data } = await supabase
      .from('pedidos').select(SELECT)
      .eq('loja_id', lojaId)
      // recentes OU agendados (não importa há quanto foram marcados — senão um
      // agendamento pra daqui a 3 dias sumiria do painel antes mesmo de chegar a hora)
      .or(`criado_em.gte.${cutoff24h},agendado_para.not.is.null`)
      .order('criado_em', { ascending: false });
    setPedidos((data as Pedido[]) ?? []);
    setCarregando(false);
  };

  useEffect(() => {
    setTimeout(carregar, 0);
    if ('Notification' in window) Notification.requestPermission?.();
    const canal = supabase
      .channel('pedidos-loja')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos', filter: `loja_id=eq.${lojaId}` },
        (payload) => {
          carregar();
          if (payload.eventType === 'INSERT') {
            tocarSom();
            const p = payload.new as Pedido;
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(`🛎 Novo pedido #${p.numero}`, {
                body: `${p.identificador_cliente} · ${fmt(Number(p.valor_total))}`,
              });
            }
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [lojaId]);

  // Toda mudança de status passa pela RPC fn_avancar_status_pedido — o banco
  // valida a transição (trigger) e devolve o erro em PT, traduzido para o
  // usuário leigo pelo ErroAmigavel (lib/erros).
  const avancarStatus = async (p: Pedido, status: StatusPedido) => {
    const statusAntigo = p.status;
    const { error } = await supabase.rpc('fn_avancar_status_pedido', { p_pedido_id: p.id, p_novo_status: status });
    if (error) throw error;
    
    // Notificação real no WhatsApp com o link de rastreio em tempo real
    if (statusAntigo === 'NOVO' && status === 'ACEITO' && p.origem === 'whatsapp' && p.chat_conversation_id) {
      const trackingLink = loja?.slug ? `https://miseon.app.br/${loja.slug}` : `https://miseon.app.br`;
      const texto = `✅ Seu pedido #${p.numero} foi aceito e já está em preparação!\n\nAcompanhe o status em tempo real pelo link:\n${trackingLink}`;
      
      supabase.from('chat_conversations').select('telefone').eq('id', p.chat_conversation_id).single()
        .then(({ data }) => {
          if (data?.telefone) {
            supabase.functions.invoke('whatsapp-send', {
              body: { loja_id: lojaId, telefone: data.telefone, texto, conversation_id: p.chat_conversation_id }
            }).catch(e => console.error('Erro ao enviar tracking WA:', e));
          }
        });
    }
    carregar();
  };

  const enviarParaCozinha = async (p: Pedido) => {
    const { error } = await supabase.rpc('fn_enviar_pedido_cozinha', { p_pedido_id: p.id });
    if (error) throw error;
    carregar();
  };

  // Cancelamento não é um `confirm()`: precisa de motivo, e num pedido do iFood
  // o motivo tem que sair da lista que o próprio iFood devolve para aquele
  // pedido. Todo o fluxo (consultar motivos, cancelar lá, baixar aqui) vive no
  // ModalCancelamento — aqui só guardamos QUAL pedido está sendo cancelado.
  //
  // Guardado fora da lista de propósito: `carregar()` roda no fim do
  // cancelamento e trocaria o objeto embaixo do modal ainda aberto.
  const [cancelando, setCancelando] = useState<Pedido | null>(null);

  // Mesma ideia para a conferência de código: o pedido é guardado à parte,
  // junto do momento do fluxo que está sendo conferido.
  const [validando, setValidando] = useState<{ pedido: Pedido; tipo: 'coleta' | 'entrega' } | null>(null);

  // Agendado "futuro" = ainda fora da janela de antecedência da loja — fica numa
  // seção separada pra não misturar com o que está de fato acontecendo agora.
  const antecedenciaMs = (loja?.agendamento_antecedencia_min ?? 30) * 60000;

  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const cutoffProducao = new Date(agora + antecedenciaMs);
  const ehAgendadoFuturo = (p: Pedido) => !!p.agendado_para && new Date(p.agendado_para) > cutoffProducao;

  const ativos = pedidos.filter((p) => !['FINALIZADO', 'CANCELADO'].includes(p.status) && !ehAgendadoFuturo(p));
  const agendadosFuturos = pedidos
    .filter((p) => !['FINALIZADO', 'CANCELADO'].includes(p.status) && ehAgendadoFuturo(p))
    .sort((a, b) => (a.agendado_para ?? '').localeCompare(b.agendado_para ?? ''));
  const encerrados = pedidos.filter((p) => ['FINALIZADO', 'CANCELADO'].includes(p.status));

  const contagem = (f: (typeof FILTROS)[number]) => pedidos.filter(f.pred).length;

  // Filtros de canais condicionais: entram na lista apenas se fizer sentido para a loja
  const temIfood = !!loja?.ifood_merchant_id || pedidos.some((p) => p.origem === 'ifood');
  const temWhatsapp = pedidos.some((p) => p.origem === 'whatsapp');
  const filtros = FILTROS.filter((f) => {
    if (f.id === 'IFOOD') return temIfood;
    if (f.id === 'WHATSAPP') return temWhatsapp;
    return true;
  });

  const filtroAtivo = filtros.find((f) => f.id === filtro) ?? filtros[0];
  const visiveis = [...ativos, ...encerrados].filter(filtroAtivo.pred);
  const visiveisLimitados = visiveis.slice(0, limiteRender);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-5 dark:bg-[#070C18]">
      <div className="print:hidden mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-['JetBrains_Mono'] text-[11px] tracking-[0.28em] text-orange-500 uppercase">{tDynamic('PAINEL · AO VIVO')}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#22c55e]" />
        </div>
        <h2 data-tour="tour-pedidos-header" className="m-0 font-['Sora'] text-[26px] font-extrabold text-gray-900 dark:text-white">Balcão</h2>
        <p className="mt-1 font-['JetBrains_Mono'] text-xs text-gray-500 dark:text-gray-400">
          {pedidos.length} pedidos hoje · {ativos.length} em andamento
        </p>

        {erroAcao && (
          <div className="mt-3 max-w-2xl">
            <ErroAmigavel erro={erroAcao} onFechar={() => setErroAcao(null)} />
          </div>
        )}

        {/* ── Filtro por status ── */}
        <div data-tour="tour-pedidos-filtros" className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {filtros.map((f) => {
            const qtd = contagem(f);
            const ativo = filtro === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFiltro(f.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-['Sora'] text-xs font-bold transition ${
                  ativo
                    ? 'border-orange-500 bg-orange-500 text-white shadow-md shadow-orange-500/25'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-orange-300 dark:border-white/10 dark:bg-white/5 dark:text-gray-300'
                }`}
              >
                {f.label}
                <span className={`rounded-full px-1.5 py-px font-['JetBrains_Mono'] text-[10px] ${ativo ? 'bg-white/25' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'}`}>
                  {qtd}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {carregando && (
        <div className="flex justify-center pt-16">
          <MiseOnLoader status="Sincronizando pedidos" rows={3} />
        </div>
      )}

      {!carregando && agendadosFuturos.length > 0 && (
        <div className="print:hidden mb-6">
          <div className="mb-2 flex items-center gap-2">
            <CalendarClock size={16} className="text-purple-500" />
            <h3 className="font-['Sora'] text-sm font-bold text-gray-700 dark:text-gray-200">Agendados ({agendadosFuturos.length})</h3>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {agendadosFuturos.map((p) => (
              <div key={p.id} className="w-64 shrink-0 rounded-2xl border border-purple-200 bg-purple-50 p-3 dark:border-purple-900/40 dark:bg-purple-900/10">
                <div className="flex items-center justify-between">
                  <span className="font-['Sora'] text-sm font-black text-purple-700 dark:text-purple-400">#{p.numero}</span>
                  <span className="rounded-full bg-purple-600 px-2 py-0.5 text-[10px] font-black text-white">
                    {new Date(p.agendado_para!).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · {new Date(p.agendado_para!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs font-semibold text-gray-700 dark:text-gray-300">{p.identificador_cliente}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{fmt(Number(p.valor_total))} · {p.tipo_pedido === 'DELIVERY' ? 'Entrega' : p.tipo_pedido === 'SALAO' ? `Mesa ${p.mesa_numero ?? '—'}` : 'Retirada'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!carregando && (
        <div className="print:hidden grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visiveisLimitados.map((p) => (
            <CardPedido
              key={p.id}
              p={p}
              papel={papel}
              onEnviarCozinha={() => enviarParaCozinha(p)}
              onAvancar={(status) => avancarStatus(p, status)}
              avisaIfood={!!loja?.ifood_addon_ativo && !!loja?.ifood_sync_status_pedido}
              onCancelar={() => setCancelando(p)}
              onValidarCodigo={(tipo) => setValidando({ pedido: p, tipo })}
              onImprimir={(v) => {
                const map: Record<Via, any> = { cozinha: 'COMANDA_COZINHA', romaneio: 'VIA_ENTREGADOR', nota: 'RECIBO_CLIENTE' };
                imprimir({ template: map[v], lojaNome: loja?.nome || 'MiseOn', loja, pedido: p, itens: p.itens_pedido });
              }}
              onErro={(e) => setErroAcao(traduzirErro(e))}
            />
          ))}
          {visiveis.length === 0 && (
            <div className="col-span-full pt-16 text-center">
              <img src="/icon.png" alt="" className="mx-auto mb-4 w-14 opacity-30 dark:opacity-20" />
              <p className="font-['JetBrains_Mono'] text-[13px] tracking-wider text-gray-500 dark:text-[#6C7A96]">
                {pedidos.length === 0 ? 'NENHUM PEDIDO AINDA.' : `NENHUM PEDIDO EM "${filtroAtivo.label.toUpperCase()}".`}
              </p>
            </div>
          )}
          {visiveis.length > limiteRender && (
            <div ref={observerRef} className="col-span-full h-16 flex items-center justify-center">
              <MiseOnLoader status="Renderizando mais pedidos..." rows={1} />
            </div>
          )}
        </div>
      )}

      <ModalCancelamento
        pedido={cancelando}
        onFechar={() => setCancelando(null)}
        onCancelado={carregar}
      />

      <ModalCodigoEntrega
        pedido={validando?.pedido ?? null}
        tipo={validando?.tipo ?? 'entrega'}
        onFechar={() => setValidando(null)}
        onValidado={async () => {
          // Coleta é só conferência: a sacola sai com o entregador do iFood e o
          // pedido segue vivo até eles concluírem. Entrega, sim, encerra aqui.
          if (validando?.tipo === 'entrega' && validando.pedido) {
            try {
              await avancarStatus(validando.pedido, 'FINALIZADO');
            } catch (e) {
              setErroAcao(traduzirErro(e));
            }
          }
          carregar();
        }}
      />
    </div>
  );
}
