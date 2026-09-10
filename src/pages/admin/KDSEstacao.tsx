import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Check, ChefHat, Clock, Expand, Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-react';
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
  'id, pedido_id, loja_id, estacao_id, workflow_id, rodada_numero, workflow_snapshot, itens, etapa_atual_idx, status, iniciado_em, concluido_em, criado_em, ' +
  'pedidos(numero, mesa_numero, tipo_pedido, identificador_cliente, senha)';

function minutosDesde(iso: string) {
  return (Date.now() - new Date(iso).getTime()) / 60000;
}

function corDoTempo(min: number) {
  if (min >= 20) return { borda: '#EF4444', texto: '#DC2626', bg: 'rgba(239, 68, 68, 0.08)' };
  if (min >= 10) return { borda: '#F59E0B', texto: '#D97706', bg: 'rgba(245, 158, 11, 0.08)' };
  return { borda: 'rgba(0,0,0,0.08)', texto: '#6B7280', bg: 'transparent' };
}

type EstadoConexao = 'CONECTANDO' | 'CONECTADO' | 'DESCONECTADO';

function prioridadeDoTempo(min: number) {
  if (min >= 20) return { rotulo: 'Atrasado', classe: 'bg-red-600 text-white' };
  if (min >= 10) return { rotulo: 'Atenção', classe: 'bg-amber-500 text-white' };
  return null;
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
  const [estadoConexao, setEstadoConexao] = useState<EstadoConexao>('CONECTANDO');
  const [atualizando, setAtualizando] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const [, setTick] = useState(0);

  const carregar = useCallback(async () => {
    if (!estacaoId) return;

    const [{ data: est, error: erroEstacao }, { data: wfs, error: erroWorkflows }, { data: tks, error: erroTickets }] = await Promise.all([
      supabase.from('kds_estacoes').select('*').eq('id', estacaoId).single(),
      supabase.from('kds_workflows').select('*').eq('estacao_id', estacaoId),
      supabase
        .from('kds_tickets')
        .select(SELECT_TICKETS)
        .eq('estacao_id', estacaoId)
        .neq('status', 'PRONTO')
        .order('criado_em', { ascending: true }),
    ]);

    const falha = erroEstacao || erroWorkflows || erroTickets;
    if (falha) {
      setErro(traduzirErro(falha));
      setCarregando(false);
      return;
    }

    setEstacao((est as KdsEstacao) ?? null);
    setWorkflows(Object.fromEntries(((wfs as KdsWorkflow[]) ?? []).map((w) => [w.id, w])));
    setTickets((tks as unknown as TicketComPedido[]) ?? []);
    setUltimaAtualizacao(new Date());
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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setEstadoConexao('CONECTADO');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setEstadoConexao('DESCONECTADO');
        else setEstadoConexao('CONECTANDO');
      });
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

  const atualizarAgora = async () => {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  };

  const alternarTelaCheia = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  };

  const cor = estacao?.cor || '#FC5B24';
  const atrasados = tickets.filter((ticket) => minutosDesde(ticket.criado_em) >= 20).length;

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
          <button type="button" onClick={() => nav('/admin/kds')} className="mt-3 text-sm font-bold underline">
          {tDynamic('Voltar para o KDS')}
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 pb-24 max-w-7xl mx-auto">
      <div className="rounded-2xl p-4 sm:p-6 text-white mb-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ background: `linear-gradient(135deg, ${cor}, ${cor}CC)` }}>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => nav('/admin/kds')} className="bg-white/20 p-3 rounded-full hover:bg-white/30 transition-colors" aria-label={tDynamic('Voltar')}>
            <ArrowLeft size={22} />
          </button>
          <div className="bg-white/20 p-3 rounded-full"><ChefHat size={28} /></div>
          <div>
            <h1 className="text-2xl font-black">{estacao.nome}</h1>
            <p className="text-white/80 text-sm font-medium">
              {tickets.length} {tDynamic('ticket(s) na fila')}
              {atrasados > 0 && ` · ${atrasados} ${tDynamic('atrasado(s)')}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <span className={`inline-flex min-h-12 items-center gap-2 rounded-xl px-3 text-xs font-black ${estadoConexao === 'CONECTADO' ? 'bg-emerald-500/25' : estadoConexao === 'DESCONECTADO' ? 'bg-red-600/35' : 'bg-white/15'}`}>
            {estadoConexao === 'CONECTADO' ? <Wifi size={17} /> : <WifiOff size={17} />}
            {tDynamic(estadoConexao === 'CONECTADO' ? 'Ao vivo' : estadoConexao === 'DESCONECTADO' ? 'Sem conexão' : 'Conectando')}
          </span>
          <button type="button" onClick={atualizarAgora} disabled={atualizando} className="min-h-12 min-w-12 rounded-xl bg-white/20 p-3 hover:bg-white/30 disabled:opacity-60" aria-label={tDynamic('Atualizar agora')} title={ultimaAtualizacao ? `${tDynamic('Última atualização')}: ${ultimaAtualizacao.toLocaleTimeString('pt-BR')}` : undefined}>
            <RefreshCw size={20} className={atualizando ? 'animate-spin' : ''} />
          </button>
          <button type="button" onClick={alternarTelaCheia} className="min-h-12 min-w-12 rounded-xl bg-white/20 p-3 hover:bg-white/30" aria-label={tDynamic('Tela cheia')}>
            <Expand size={20} />
          </button>
        </div>
      </div>

      {estadoConexao === 'DESCONECTADO' && (
        <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <span className="flex items-center gap-2"><WifiOff size={18} /> {tDynamic('Atualização automática interrompida. Confira a rede antes de avançar tickets.')}</span>
          <button type="button" onClick={atualizarAgora} className="min-h-11 rounded-lg bg-red-700 px-4 text-white">{tDynamic('Tentar novamente')}</button>
        </div>
      )}

      {erro && <div className="mb-4"><ErroAmigavel erro={erro} onFechar={() => setErro(null)} /></div>}

      {tickets.length === 0 ? (
        <div className="text-center py-20 text-gray-400 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
          <Check size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-semibold">{tDynamic('Nenhum ticket pendente nesta estação.')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {tickets.map((ticket) => {
            const workflowPersistido = workflows[ticket.workflow_id];
            const workflow = ticket.workflow_snapshot?.length
              ? { ...workflowPersistido, etapas: ticket.workflow_snapshot } as KdsWorkflow
              : workflowPersistido;
            const { atual, proxima, totalEtapas } = workflow
              ? etapaAtualDoTicket(ticket, workflow)
              : { atual: undefined, proxima: null, totalEtapas: 0 };
            const min = minutosDesde(ticket.criado_em);
            const c = corDoTempo(min);
            const ehUltima = totalEtapas <= 1 || ticket.etapa_atual_idx >= totalEtapas - 1;
            const prioridade = prioridadeDoTempo(min);

            return (
              <div key={ticket.id} className="rounded-2xl border overflow-hidden shadow-md bg-white dark:bg-gray-900" style={{ borderColor: c.borda }}>
                <div className="flex items-center justify-between px-5 py-3" style={{ backgroundColor: c.bg }}>
                  <span className="font-black text-lg dark:text-gray-100">
                    {identificacaoPedido(ticket.pedidos)}
                    {(ticket.rodada_numero ?? 1) > 1 && <span className="ml-2 rounded-full bg-gray-900 px-2 py-1 text-[10px] uppercase text-white">{tDynamic('Rodada')} {ticket.rodada_numero}</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    {prioridade && <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black uppercase ${prioridade.classe}`}><AlertTriangle size={12} /> {tDynamic(prioridade.rotulo)}</span>}
                    <span className="flex items-center gap-1 font-bold text-sm" style={{ color: c.texto }}>
                      <Clock size={14} /> {Math.floor(min)} min
                    </span>
                  </span>
                </div>

                <div className="p-5">
                  {totalEtapas > 0 && (
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">
                      {tDynamic('Etapa')} {ticket.etapa_atual_idx + 1}/{totalEtapas} — {atual?.nome ?? '—'}
                    </p>
                  )}

                  <ul className="space-y-2 mb-4">
                    {ticket.itens.map((item) => (
                      <li key={item.item_pedido_id} className="rounded-xl border border-gray-100 p-3 text-sm dark:border-gray-800">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold dark:text-gray-100">{item.quantidade}x {item.nome}</span>
                          {item.perfil_preparo === 'DRINK' && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-black text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">DRINK</span>}
                          {item.teor_alcoolico_pct != null && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">{item.teor_alcoolico_pct}% ABV</span>}
                          {item.volume_porcao_ml != null && <span className="text-[10px] font-semibold text-gray-400">{item.volume_porcao_ml} ml</span>}
                          {item.calorias_porcao != null && <span className="text-[10px] font-semibold text-gray-400">{Math.round(item.calorias_porcao)} kcal</span>}
                        </div>
                        {(item.opcoes.length > 0 || item.observacao) && (
                          <div className="mt-2 rounded-lg border-2 border-amber-300 bg-amber-50 px-2.5 py-2 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100" aria-label={tDynamic('Instruções de preparo do item')}>
                            <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide"><AlertTriangle size={13} /> {tDynamic('Instruções do item')}</span>
                            {item.modificadores?.length
                              ? item.modificadores.map((modificador) => (
                                  <p key={modificador.opcao_id} className="mt-1 text-sm font-black uppercase">
                                    {modificador.grupo_nome}: {modificador.nome}
                                  </p>
                                ))
                              : item.opcoes.map((opcao) => <p key={opcao} className="mt-1 text-sm font-black uppercase">{opcao}</p>)}
                            {item.observacao && <p className="mt-1 text-xs font-bold uppercase">OBS: {item.observacao}</p>}
                          </div>
                        )}
                        {!!item.ingredientes?.length && (
                          <ol className="mt-1.5 space-y-1 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-white/5 dark:text-gray-300">
                            {item.ingredientes.map((ingrediente, ingredienteIdx) => (
                              <li key={`${ingrediente.nome}-${ingredienteIdx}`} className="flex justify-between gap-3">
                                <span>{ingredienteIdx + 1}. {ingrediente.nome}</span>
                                <strong className="whitespace-nowrap">{ingrediente.quantidade} {ingrediente.unidade}</strong>
                              </li>
                            ))}
                          </ol>
                        )}
                      </li>
                    ))}
                  </ul>

                  <button type="button"
                    onClick={() => avancar(ticket)}
                    disabled={avancando === ticket.id}
                    className="w-full min-h-14 flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-black text-base text-white shadow-lg transition-all hover:scale-[1.02] disabled:opacity-50"
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
