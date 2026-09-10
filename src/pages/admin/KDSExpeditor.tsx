import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  AlertTriangle, Check, ChefHat, Clock3, Expand, GlassWater, Loader2,
  PackageCheck, RefreshCw, UtensilsCrossed, Wifi, WifiOff,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { EtapaKdsWorkflow, KdsEstacao, KdsTicket, KdsWorkflow } from '../../types';
import { tocarSom } from '../../lib/som';
import type { CtxLoja } from './AdminLayout';
import MiseOnLoader from '../../components/MiseOnLoader';
import { useI18n } from '../../contexts/I18nContext';

interface PedidoResumo {
  id: string;
  numero: number;
  mesa_numero: number | null;
  tipo_pedido: string;
  identificador_cliente: string | null;
  senha: number | null;
  status: string;
  origem?: string | null;
}

interface TicketComPedido extends KdsTicket {
  pedidos: PedidoResumo | null;
  kds_estacoes: { nome: string; cor: string } | null;
}

type EstadoConexao = 'CONECTANDO' | 'CONECTADO' | 'DESCONECTADO';
type Visao = 'EXPEDICAO' | string;

const SELECT =
  'id, pedido_id, loja_id, estacao_id, workflow_id, rodada_numero, workflow_snapshot, itens, etapa_atual_idx, status, iniciado_em, concluido_em, expedido_em, expedido_por, criado_em, ' +
  'pedidos(id, numero, mesa_numero, tipo_pedido, identificador_cliente, senha, status, origem), ' +
  'kds_estacoes(nome, cor)';

const CORES_ETAPA = ['#F97316', '#2563EB', '#7C3AED', '#059669', '#0F766E'];

function minutosDesde(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
}

function identificacaoPedido(p: PedidoResumo | null): string {
  if (!p) return 'Pedido';
  if (p.tipo_pedido === 'SALAO' && p.mesa_numero) return `Mesa ${p.mesa_numero}`;
  if (p.senha) return `Senha ${p.senha}`;
  return p.identificador_cliente || `Pedido #${p.numero}`;
}

function rotuloTipo(p: PedidoResumo | null): string {
  if (!p) return '';
  if (p.tipo_pedido === 'SALAO') return 'Salão';
  if (p.tipo_pedido === 'DELIVERY') return 'Delivery';
  if (p.tipo_pedido === 'RETIRADA_BALCAO') return 'Retirada';
  return p.tipo_pedido.replace(/_/g, ' ');
}

function etapasDoTicket(ticket: TicketComPedido | undefined, workflows: Record<string, KdsWorkflow>): EtapaKdsWorkflow[] {
  if (!ticket) return [];
  if (ticket.workflow_snapshot?.length) return ticket.workflow_snapshot;
  return workflows[ticket.workflow_id]?.etapas ?? [];
}

function IconeEstacao({ nome, size = 18 }: { nome: string; size?: number }) {
  return /bar|bebida|drink/i.test(nome) ? <GlassWater size={size} /> : <ChefHat size={size} />;
}

function InstrucaoItem({ item }: { item: KdsTicket['itens'][number] }) {
  const { tDynamic } = useI18n();
  const modificadores = item.modificadores?.length
    ? item.modificadores.map((m) => `${m.grupo_nome}: ${m.nome}`)
    : item.opcoes ?? [];
  if (!modificadores.length && !item.observacao) return null;

  return (
    <div className="mt-2 rounded-lg border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-amber-950 dark:bg-amber-950/35 dark:text-amber-100">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300">{tDynamic('Observações de preparo')}</p>
      {modificadores.map((texto) => <p key={texto} className="mt-0.5 text-sm font-black uppercase">{texto}</p>)}
      {item.observacao && <p className="mt-0.5 text-sm font-black uppercase text-red-700 dark:text-red-300">OBS: {item.observacao}</p>}
    </div>
  );
}

function TicketCard({ ticket, workflows, cor, avancando, onAvancar }: {
  ticket: TicketComPedido;
  workflows: Record<string, KdsWorkflow>;
  cor: string;
  avancando: boolean;
  onAvancar: (ticket: TicketComPedido) => void;
}) {
  const { tDynamic } = useI18n();
  const etapas = etapasDoTicket(ticket, workflows);
  const ultimaEtapa = ticket.etapa_atual_idx >= etapas.length - 1;
  const proxima = etapas[ticket.etapa_atual_idx + 1];
  const minutos = minutosDesde(ticket.iniciado_em || ticket.criado_em);
  const prioridade = minutos >= 20 ? 'ATRASADO' : minutos >= 10 ? 'ATENÇÃO' : null;

  return (
    <article className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-lg dark:bg-[#101827] ${minutos >= 20 ? 'border-red-500 ring-2 ring-red-500/15' : 'border-slate-200 dark:border-white/10'}`}>
      <div className="h-1.5" style={{ backgroundColor: minutos >= 20 ? '#EF4444' : cor }} />
      <div className="p-4">
        <header className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black text-slate-950 dark:text-white">{identificacaoPedido(ticket.pedidos)}</h3>
              {(ticket.rodada_numero ?? 1) > 1 && <span className="rounded-full bg-slate-950 px-2 py-0.5 text-[10px] font-black text-white">RODADA {ticket.rodada_numero}</span>}
            </div>
            <p className="mt-0.5 text-xs font-bold uppercase tracking-wide text-slate-400">{rotuloTipo(ticket.pedidos)} · #{ticket.pedidos?.numero ?? '—'}</p>
          </div>
          <div className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-sm font-black tabular-nums ${minutos >= 20 ? 'bg-red-600 text-white' : minutos >= 10 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-200'}`}>
            <Clock3 size={14} /> {minutos} min
          </div>
        </header>

        {prioridade && <p className={`mt-3 flex items-center gap-1 text-xs font-black ${minutos >= 20 ? 'text-red-600' : 'text-amber-600'}`}><AlertTriangle size={14} /> {prioridade}</p>}

        <div className="mt-3 space-y-3">
          {ticket.itens.map((item, index) => (
            <div key={item.item_pedido_id || `${ticket.id}-${index}`} className="border-t border-slate-100 pt-3 first:border-0 first:pt-0 dark:border-white/10">
              <p className="text-base font-black text-slate-900 dark:text-white"><span style={{ color: cor }}>{item.quantidade}×</span> {item.nome}</p>
              <InstrucaoItem item={item} />
            </div>
          ))}
        </div>

        <button type="button" onClick={() => onAvancar(ticket)} disabled={avancando} className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-black text-white shadow-lg transition-transform hover:scale-[1.01] disabled:opacity-60" style={{ backgroundColor: ultimaEtapa ? '#059669' : cor }}>
          {avancando ? <Loader2 size={18} className="animate-spin" /> : ultimaEtapa ? <><Check size={18} /> {tDynamic('Concluir e enviar à expedição')}</> : <>{tDynamic('Avançar para')} {proxima?.nome ?? tDynamic('próxima etapa')}</>}
        </button>
      </div>
    </article>
  );
}

export default function KDSExpeditor() {
  const { tDynamic } = useI18n();
  const { lojaId } = useOutletContext<CtxLoja>();
  const [estacoes, setEstacoes] = useState<KdsEstacao[]>([]);
  const [workflows, setWorkflows] = useState<Record<string, KdsWorkflow>>({});
  const [tickets, setTickets] = useState<TicketComPedido[]>([]);
  const [visao, setVisao] = useState<Visao>(() => localStorage.getItem(`miseon_kds_visao_${lojaId}`) || '');
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [avancando, setAvancando] = useState<string | null>(null);
  const [expedindo, setExpedindo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [conexao, setConexao] = useState<EstadoConexao>('CONECTANDO');
  const [, setTick] = useState(0);

  const carregar = useCallback(async () => {
    setAtualizando(true);
    const [resEstacoes, resWorkflows, resTickets] = await Promise.all([
      supabase.from('kds_estacoes').select('*').eq('loja_id', lojaId).eq('ativo', true).order('ordem'),
      supabase.from('kds_workflows').select('*').eq('loja_id', lojaId).order('criado_em'),
      supabase.from('kds_tickets').select(SELECT).eq('loja_id', lojaId).order('criado_em', { ascending: true }),
    ]);
    const falha = resEstacoes.error || resWorkflows.error || resTickets.error;
    if (falha) {
      setErro('Não foi possível sincronizar o KDS. Confira a conexão e tente novamente.');
    } else {
      const novasEstacoes = (resEstacoes.data as KdsEstacao[]) ?? [];
      setEstacoes(novasEstacoes);
      setWorkflows(Object.fromEntries(((resWorkflows.data as KdsWorkflow[]) ?? []).map((w) => [w.id, w])));
      setTickets((resTickets.data as unknown as TicketComPedido[]) ?? []);
      setErro(null);
      setVisao((atual) => atual === 'EXPEDICAO' || novasEstacoes.some((e) => e.id === atual) ? atual : novasEstacoes[0]?.id ?? 'EXPEDICAO');
    }
    setCarregando(false);
    setAtualizando(false);
  }, [lojaId]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    const canal = supabase.channel(`kds-console-${lojaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kds_tickets', filter: `loja_id=eq.${lojaId}` }, (payload) => {
        if (payload.eventType === 'INSERT' || (payload.eventType === 'UPDATE' && (payload.new as { status?: string }).status === 'PRONTO')) tocarSom();
        carregar();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setConexao('CONECTADO');
        else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) setConexao('DESCONECTADO');
        else setConexao('CONECTANDO');
      });
    const timer = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => { supabase.removeChannel(canal); window.clearInterval(timer); };
  }, [carregar, lojaId]);

  const trocarVisao = (nova: Visao) => {
    setVisao(nova);
    localStorage.setItem(`miseon_kds_visao_${lojaId}`, nova);
  };

  const estacaoAtual = estacoes.find((e) => e.id === visao) ?? null;
  const ticketsDaEstacao = useMemo(() => tickets.filter((t) => t.estacao_id === visao && !t.expedido_em && t.status !== 'PRONTO'), [tickets, visao]);

  const etapas = useMemo(() => {
    const workflowDaEstacao = Object.values(workflows).find((w) => w.estacao_id === visao);
    // Enquanto existe trabalho aberto, o quadro segue o snapshot daquele
    // trabalho. Editar o workflow configura tickets futuros, não renomeia a
    // bancada no meio do serviço.
    const snapshotEmOperacao = etapasDoTicket(ticketsDaEstacao[0], workflows);
    const base = snapshotEmOperacao.length ? snapshotEmOperacao : workflowDaEstacao?.etapas ?? [];
    return (base ?? []).map((etapa, index) => ({
      ...etapa,
      cor: (etapa as EtapaKdsWorkflow & { cor?: string }).cor || CORES_ETAPA[index % CORES_ETAPA.length],
    }));
  }, [ticketsDaEstacao, visao, workflows]);

  const pedidosParaExpedir = useMemo(() => {
    const grupos = new Map<string, TicketComPedido[]>();
    for (const ticket of tickets) {
      if (ticket.expedido_em || !ticket.pedidos || ['FINALIZADO', 'CANCELADO'].includes(ticket.pedidos.status)) continue;
      const lista = grupos.get(ticket.pedido_id) ?? [];
      lista.push(ticket);
      grupos.set(ticket.pedido_id, lista);
    }
    return [...grupos.entries()]
      .map(([pedidoId, lista]) => ({ pedidoId, pedido: lista[0].pedidos!, tickets: lista, pronto: lista.every((t) => t.status === 'PRONTO') }))
      .filter((grupo) => grupo.pronto)
      .sort((a, b) => a.tickets[0].criado_em.localeCompare(b.tickets[0].criado_em));
  }, [tickets]);

  const avancar = async (ticket: TicketComPedido) => {
    setAvancando(ticket.id);
    setErro(null);
    const { error } = await supabase.rpc('fn_avancar_kds_ticket', { p_ticket_id: ticket.id });
    if (error) setErro(error.message || 'Não foi possível avançar o ticket.');
    else await carregar();
    setAvancando(null);
  };

  const expedir = async (pedidoId: string) => {
    setExpedindo(pedidoId);
    setErro(null);
    const { error } = await supabase.rpc('fn_expedir_kds_pedido', { p_pedido_id: pedidoId });
    if (error) setErro(error.message || 'Não foi possível registrar a retirada.');
    else await carregar();
    setExpedindo(null);
  };

  const alternarTelaCheia = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  };

  if (carregando) return <div className="flex items-center justify-center py-24"><MiseOnLoader status={tDynamic('Sincronizando a produção...')} rows={3} /></div>;

  const atrasados = ticketsDaEstacao.filter((t) => minutosDesde(t.iniciado_em || t.criado_em) >= 20).length;

  return (
    <main className="min-h-[calc(100vh-5rem)] bg-slate-100 p-3 pb-24 dark:bg-[#070d18] sm:p-5">
      <section className="mx-auto max-w-[1800px]">
        <header className="overflow-hidden rounded-3xl bg-[#0b1423] text-white shadow-xl">
          <div className="flex flex-col gap-5 p-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-orange-500 p-3 shadow-lg shadow-orange-500/25"><UtensilsCrossed size={28} /></div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-orange-400">{tDynamic('Operação em tempo real')}</p>
                <h1 className="text-2xl font-black">{tDynamic('KDS · Central de produção')}</h1>
                <p className="text-sm font-medium text-slate-400">{tDynamic('Cada estação vê somente o trabalho, as etapas e as instruções que pertencem a ela.')}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-black ${conexao === 'CONECTADO' ? 'bg-emerald-500/15 text-emerald-300' : conexao === 'DESCONECTADO' ? 'bg-red-500/20 text-red-300' : 'bg-white/10 text-slate-300'}`}>
                {conexao === 'CONECTADO' ? <Wifi size={16} /> : <WifiOff size={16} />} {conexao === 'CONECTADO' ? 'AO VIVO' : conexao === 'DESCONECTADO' ? 'SEM CONEXÃO' : 'CONECTANDO'}
              </span>
              <button type="button" onClick={carregar} disabled={atualizando} className="flex min-h-11 items-center gap-2 rounded-xl bg-white/10 px-3 text-xs font-black hover:bg-white/15 disabled:opacity-50"><RefreshCw size={16} className={atualizando ? 'animate-spin' : ''} /> Atualizar</button>
              <button type="button" onClick={alternarTelaCheia} className="flex min-h-11 items-center gap-2 rounded-xl bg-white/10 px-3 text-xs font-black hover:bg-white/15"><Expand size={16} /> Tela cheia</button>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto border-t border-white/10 bg-black/15 p-2.5" aria-label="Estações do KDS">
            {estacoes.map((estacao) => {
              const ativo = visao === estacao.id;
              const quantidade = tickets.filter((t) => t.estacao_id === estacao.id && !t.expedido_em && t.status !== 'PRONTO').length;
              return (
                <button key={estacao.id} type="button" onClick={() => trocarVisao(estacao.id)} className={`flex min-h-12 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-black transition-all ${ativo ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-300 hover:bg-white/10'}`}>
                  <span style={{ color: ativo ? estacao.cor : undefined }}><IconeEstacao nome={estacao.nome} /></span>{estacao.nome}
                  <span className={`rounded-full px-2 py-0.5 text-xs ${ativo ? 'bg-slate-100' : 'bg-white/10'}`}>{quantidade}</span>
                </button>
              );
            })}
            <button type="button" onClick={() => trocarVisao('EXPEDICAO')} className={`ml-auto flex min-h-12 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-black transition-all ${visao === 'EXPEDICAO' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-300 hover:bg-white/10'}`}>
              <PackageCheck size={18} /> Expedição <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">{pedidosParaExpedir.length}</span>
            </button>
          </nav>
        </header>

        {erro && <div role="alert" className="mt-4 flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 font-bold text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"><AlertTriangle size={18} /> {erro}</div>}

        {visao !== 'EXPEDICAO' && estacaoAtual && (
          <>
            <div className="my-4 flex flex-wrap items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-300">
              <span className="rounded-full bg-white px-3 py-1.5 shadow-sm dark:bg-white/10"><strong className="text-slate-950 dark:text-white">{ticketsDaEstacao.length}</strong> tickets ativos</span>
              <span className={`rounded-full px-3 py-1.5 shadow-sm ${atrasados ? 'bg-red-600 text-white' : 'bg-white dark:bg-white/10'}`}><strong>{atrasados}</strong> atrasados</span>
              <span className="ml-auto text-xs uppercase tracking-wide">Fluxo de {estacaoAtual.nome}</span>
            </div>

            {etapas.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-white/15 dark:bg-[#101827]"><ChefHat className="mx-auto text-slate-300" size={40} /><p className="mt-3 font-black text-slate-700 dark:text-slate-200">{tDynamic('Esta estação ainda não possui um workflow configurado.')}</p></div>
            ) : (
              <div className="grid items-start gap-4 overflow-x-auto pb-4" style={{ gridTemplateColumns: `repeat(${etapas.length}, minmax(290px, 1fr))` }}>
                {etapas.map((etapa, index) => {
                  const daColuna = ticketsDaEstacao.filter((t) => t.etapa_atual_idx === index);
                  return (
                    <section key={etapa.id || index} className="min-h-[420px] rounded-2xl bg-slate-200/70 p-2.5 dark:bg-white/5">
                      <header className="mb-3 flex items-center justify-between rounded-xl bg-white px-3 py-3 shadow-sm dark:bg-[#101827]">
                        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: etapa.cor }} /><h2 className="font-black text-slate-900 dark:text-white">{etapa.nome}</h2></div>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600 dark:bg-white/10 dark:text-slate-200">{daColuna.length}</span>
                      </header>
                      <div className="space-y-3">
                        {daColuna.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} workflows={workflows} cor={etapa.cor} avancando={avancando === ticket.id} onAvancar={avancar} />)}
                        {daColuna.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-xs font-bold text-slate-400 dark:border-white/10">{tDynamic('Nenhum ticket nesta etapa')}</div>}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}

        {visao === 'EXPEDICAO' && (
          <section className="mt-4">
            <div className="mb-4"><h2 className="text-xl font-black text-slate-950 dark:text-white">{tDynamic('Pedidos prontos para retirada')}</h2><p className="text-sm font-medium text-slate-500">{tDynamic('Só aparecem aqui quando todas as estações terminaram. Entregar registra a retirada para todos os dispositivos.')}</p></div>
            {pedidosParaExpedir.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white py-20 text-center dark:border-white/10 dark:bg-[#101827]"><Check className="mx-auto text-emerald-500" size={44} /><p className="mt-3 font-black text-slate-700 dark:text-slate-200">{tDynamic('Nenhum pedido aguardando retirada.')}</p></div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {pedidosParaExpedir.map((grupo) => (
                  <article key={grupo.pedidoId} className="overflow-hidden rounded-2xl border-2 border-emerald-400 bg-white shadow-lg shadow-emerald-500/10 dark:bg-[#101827]">
                    <header className="flex items-center justify-between bg-emerald-500 px-4 py-3 text-white"><div><h3 className="text-xl font-black">{identificacaoPedido(grupo.pedido)}</h3><p className="text-xs font-bold uppercase text-emerald-100">{rotuloTipo(grupo.pedido)} · #{grupo.pedido.numero}</p></div><Check size={25} /></header>
                    <div className="p-4">
                      <div className="space-y-2">
                        {grupo.tickets.map((ticket) => (
                          <div key={ticket.id} className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                            <p className="flex items-center gap-2 text-sm font-black text-slate-700 dark:text-slate-100"><span style={{ color: ticket.kds_estacoes?.cor }}><IconeEstacao nome={ticket.kds_estacoes?.nome || ''} size={15} /></span>{ticket.kds_estacoes?.nome || 'Estação'} {(ticket.rodada_numero ?? 1) > 1 && <span className="text-xs text-slate-400">R{ticket.rodada_numero}</span>}</p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">{ticket.itens.map((item) => `${item.quantidade}× ${item.nome}`).join(' · ')}</p>
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={() => expedir(grupo.pedidoId)} disabled={expedindo === grupo.pedidoId} className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 font-black text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 disabled:opacity-60">
                        {expedindo === grupo.pedidoId ? <Loader2 size={18} className="animate-spin" /> : <PackageCheck size={19} />} Registrar entrega
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
