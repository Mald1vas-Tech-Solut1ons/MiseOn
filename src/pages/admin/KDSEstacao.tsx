import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ArrowLeft, Check, ChefHat, Clock, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { KdsEstacao, KdsTicket, KdsWorkflow } from '../../types';
import { etapaAtualDoTicket } from '../../lib/kdsEtapas';
import { tocarSom } from '../../lib/som';
import { traduzirErro, type ErroTraduzido } from '../../lib/erros';
import { ErroAmigavel } from '../../components/ui/ErroAmigavel';
import type { CtxLoja } from './AdminLayout';
import { useI18n } from '../../contexts/I18nContext';
import MiseOnLoader from '../../components/MiseOnLoader';

interface PedidoResumo {
  numero: number;
  mesa_numero: number | null;
  tipo_pedido: string;
  identificador_cliente: string | null;
  senha: number | null;
}

interface TicketComPedido extends KdsTicket {
  pedidos: PedidoResumo | null;
}

const SELECT_TICKETS =
  'id, pedido_id, loja_id, estacao_id, workflow_id, itens, etapa_atual_idx, status, iniciado_em, concluido_em, criado_em, ' +
  'pedidos(numero, mesa_numero, tipo_pedido, identificador_cliente, senha)';

function minutosDesde(iso: string) {
  return (Date.now() - new Date(iso).getTime()) / 60000;
}

function corDoTempo(min: number) {
  if (min >= 20) return { borda: '#EF4444', texto: '#DC2626', bg: 'rgba(239, 68, 68, 0.08)' };
  if (min >= 10) return { borda: '#F59E0B', texto: '#D97706', bg: 'rgba(245, 158, 11, 0.08)' };
  return { borda: 'rgba(0,0,0,0.08)', texto: '#6B7280', bg: 'transparent' };
}

function identificacaoPedido(p: PedidoResumo | null): string {
  if (!p) return '—';
  if (p.tipo_pedido === 'SALAO' && p.mesa_numero) return `Mesa ${p.mesa_numero}`;
  if (p.senha) return `Senha ${p.senha}`;
  return p.identificador_cliente || `Pedido #${p.numero}`;
}

export default function KDSEstacao() {
  const { tDynamic } = useI18n();
  const nav = useNavigate();
  const { estacaoId } = useParams<{ estacaoId: string }>();
  const { lojaId } = useOutletContext<CtxLoja>();

  const [estacao, setEstacao] = useState<KdsEstacao | null>(null);
  const [workflows, setWorkflows] = useState<Record<string, KdsWorkflow>>({});
  const [tickets, setTickets] = useState<TicketComPedido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [avancando, setAvancando] = useState<string | null>(null);
  const [erro, setErro] = useState<ErroTraduzido | null>(null);
  const [, setTick] = useState(0);

  const carregar = useCallback(async () => {
    if (!estacaoId) return;

    const [{ data: est }, { data: wfs }, { data: tks }] = await Promise.all([
      supabase.from('kds_estacoes').select('*').eq('id', estacaoId).single(),
      supabase.from('kds_workflows').select('*').eq('estacao_id', estacaoId),
      supabase
        .from('kds_tickets')
        .select(SELECT_TICKETS)
        .eq('estacao_id', estacaoId)
        .neq('status', 'PRONTO')
        .order('criado_em', { ascending: true }),
    ]);

    setEstacao((est as KdsEstacao) ?? null);
    setWorkflows(Object.fromEntries(((wfs as KdsWorkflow[]) ?? []).map((w) => [w.id, w])));
    setTickets((tks as unknown as TicketComPedido[]) ?? []);
    setCarregando(false);
  }, [estacaoId]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    if (!estacaoId) return;
    const canal = supabase
      .channel(`kds-estacao-${estacaoId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kds_tickets', filter: `estacao_id=eq.${estacaoId}` }, (payload) => {
        if (payload.eventType === 'INSERT') tocarSom();
        carregar();
      })
      .subscribe();
    const timer = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => { supabase.removeChannel(canal); clearInterval(timer); };
  }, [estacaoId, carregar]);

  const avancar = async (ticket: TicketComPedido) => {
    setAvancando(ticket.id);
    setErro(null);
    const { error } = await supabase.rpc('fn_avancar_kds_ticket', { p_ticket_id: ticket.id });
    setAvancando(null);
    if (error) { setErro(traduzirErro(error)); return; }
    carregar();
  };

  const cor = estacao?.cor || '#FC5B24';

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-24">
        <MiseOnLoader status={tDynamic('Carregando estação...')} rows={2} />
      </div>
    );
  }

  if (!estacao || estacao.loja_id !== lojaId) {
    return (
      <div className="p-6 text-center text-gray-400">
        <p className="font-semibold">{tDynamic('Estação não encontrada.')}</p>
        <button onClick={() => nav('/admin/kds')} className="mt-3 text-sm font-bold underline">
          {tDynamic('Voltar para o KDS')}
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 pb-24 max-w-7xl mx-auto">
      <div className="rounded-2xl p-6 text-white mb-6 shadow-lg flex items-center justify-between gap-4" style={{ background: `linear-gradient(135deg, ${cor}, ${cor}CC)` }}>
        <div className="flex items-center gap-4">
          <button onClick={() => nav('/admin/kds/expeditor')} className="bg-white/20 p-3 rounded-full hover:bg-white/30 transition-colors" aria-label={tDynamic('Voltar')}>
            <ArrowLeft size={22} />
          </button>
          <div className="bg-white/20 p-3 rounded-full"><ChefHat size={28} /></div>
          <div>
            <h1 className="text-2xl font-black">{estacao.nome}</h1>
            <p className="text-white/80 text-sm font-medium">{tickets.length} {tDynamic('ticket(s) na fila')}</p>
          </div>
        </div>
      </div>

      {erro && <div className="mb-4"><ErroAmigavel erro={erro} onFechar={() => setErro(null)} /></div>}

      {tickets.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
          <Check size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-semibold">{tDynamic('Nenhum ticket pendente nesta estação.')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {tickets.map((ticket) => {
            const workflow = workflows[ticket.workflow_id];
            const { atual, proxima, totalEtapas } = workflow
              ? etapaAtualDoTicket(ticket, workflow)
              : { atual: undefined, proxima: null, totalEtapas: 0 };
            const min = minutosDesde(ticket.criado_em);
            const c = corDoTempo(min);
            const ehUltima = proxima === null;

            return (
              <div key={ticket.id} className="rounded-2xl border overflow-hidden shadow-md bg-white dark:bg-gray-900" style={{ borderColor: c.borda }}>
                <div className="flex items-center justify-between px-5 py-3" style={{ backgroundColor: c.bg }}>
                  <span className="font-black text-lg dark:text-gray-100">{identificacaoPedido(ticket.pedidos)}</span>
                  <span className="flex items-center gap-1 font-bold text-sm" style={{ color: c.texto }}>
                    <Clock size={14} /> {Math.floor(min)} min
                  </span>
                </div>

                <div className="p-5">
                  {totalEtapas > 0 && (
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">
                      {tDynamic('Etapa')} {ticket.etapa_atual_idx + 1}/{totalEtapas} — {atual?.nome ?? '—'}
                    </p>
                  )}

                  <ul className="space-y-2 mb-4">
                    {ticket.itens.map((item, idx) => (
                      <li key={idx} className="text-sm">
                        <span className="font-bold dark:text-gray-100">{item.quantidade}x {item.nome}</span>
                        {item.opcoes.length > 0 && (
                          <span className="block text-xs text-gray-500 dark:text-gray-400 pl-4">{item.opcoes.join(', ')}</span>
                        )}
                        {item.observacao && (
                          <span className="block text-xs text-amber-600 dark:text-amber-400 pl-4 font-medium">{item.observacao}</span>
                        )}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => avancar(ticket)}
                    disabled={avancando === ticket.id}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-black text-sm text-white shadow-lg transition-all hover:scale-[1.02] disabled:opacity-50"
                    style={{ backgroundColor: ehUltima ? '#10B981' : cor }}
                  >
                    {avancando === ticket.id
                      ? <Loader2 size={18} className="animate-spin" />
                      : ehUltima
                        ? <><Check size={18} /> {tDynamic('Marcar Pronto')}</>
                        : <>{tDynamic('Avançar para')} {proxima?.nome}</>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
