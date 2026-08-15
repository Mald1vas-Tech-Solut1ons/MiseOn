import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, DollarSign, Calculator, Save, Receipt,
  ShoppingBag, Ticket, Bike, Store, XCircle, Banknote, CreditCard, QrCode,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { supabase } from '../../lib/supabase';
import { fmt, ProdutoCusto, ConfiguracoesCusto, Pedido, MetodoPgto } from '../../types';
import DreGerencial from '../../components/admin/DreGerencial';
import type { CtxLoja } from './AdminLayout';
import MiseOnLoader from '../../components/MiseOnLoader';

const defaultCustos: ConfiguracoesCusto = {
  loja_id: '',
  custo_aluguel: 0,
  custo_energia: 0,
  custo_agua: 0,
  custo_internet: 0,
  custo_gas: 0,
  outros_custos_fixos: 0,
  expectativa_vendas_mes: 1000,
  tipo_remuneracao_entregador: 'DESLIGADO',
  valor_remuneracao_entregador: 0,
  // Padrão sugerido pela plataforma para entregador freelancer (POR_KM):
  // R$5 cobre até 5km, R$1,20 por km rodado além disso. A loja pode ajustar.
  entregador_taxa_minima: 5,
  entregador_raio_minimo_km: 5,
  entregador_taxa_km_excedente: 1.2,
};

const REMUNERACAO_LABEL: Record<string, string> = {
  DESLIGADO: 'Não remunero pelo sistema',
  FIXO: 'Valor fixo mensal',
  POR_ENTREGA: 'Valor fixo por entrega',
  POR_KM: 'Por km rodado (freelancer)',
};

type Periodo = 'HOJE' | 'ONTEM' | '7D' | '30D' | 'MES';

const PERIODOS: { id: Periodo; label: string }[] = [
  { id: 'HOJE', label: 'Hoje' },
  { id: 'ONTEM', label: 'Ontem' },
  { id: '7D', label: '7 dias' },
  { id: '30D', label: '30 dias' },
  { id: 'MES', label: 'Este mês' },
];

function intervaloPeriodo(p: Periodo): { inicio: Date; fim: Date } {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const amanha = new Date(hoje.getTime() + 24 * 3600e3);
  if (p === 'HOJE') return { inicio: hoje, fim: amanha };
  if (p === 'ONTEM') return { inicio: new Date(hoje.getTime() - 24 * 3600e3), fim: hoje };
  if (p === '7D') return { inicio: new Date(hoje.getTime() - 6 * 24 * 3600e3), fim: amanha };
  if (p === '30D') return { inicio: new Date(hoje.getTime() - 29 * 24 * 3600e3), fim: amanha };
  return { inicio: new Date(hoje.getFullYear(), hoje.getMonth(), 1), fim: amanha };
}

const METODO_INFO: Record<MetodoPgto, { label: string; icon: typeof QrCode }> = {
  PIX: { label: 'Pix', icon: QrCode },
  CREDITO: { label: 'Crédito', icon: CreditCard },
  DEBITO: { label: 'Débito', icon: CreditCard },
  DINHEIRO: { label: 'Dinheiro', icon: Banknote },
  IFOOD: { label: 'iFood', icon: Store },
};

const STATUS_BADGE: Record<string, string> = {
  NOVO: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  ACEITO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PREPARANDO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PRONTO: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  EM_ROTA: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  FINALIZADO: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  CANCELADO: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
};

const STATUS_LABEL: Record<string, string> = {
  NOVO: 'Novo', ACEITO: 'Aceito', PREPARANDO: 'Preparando', PRONTO: 'Pronto',
  EM_ROTA: 'Em rota', FINALIZADO: 'Finalizado', CANCELADO: 'Cancelado',
};

export default function Financeiro() {
  const { lojaId } = useOutletContext<CtxLoja>();
  const [aba, setAba] = useState<'EXTRATO' | 'MARGENS' | 'DRE' | 'CUSTOS_FIXOS'>('EXTRATO');
  const [periodo, setPeriodo] = useState<Periodo>('HOJE');

  const [produtos, setProdutos] = useState<ProdutoCusto[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Custos Fixos State
  const [configCusto, setConfigCusto] = useState<ConfiguracoesCusto>({ ...defaultCustos, loja_id: lojaId });
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  const carregarDados = async () => {
    const { inicio, fim } = intervaloPeriodo(periodo);

    const [{ data: custos }, { data: dataPedidos }, { data: config }] = await Promise.all([
      supabase.from('vw_custo_produto').select('*').eq('loja_id', lojaId).order('margem_pct', { ascending: true }),
      supabase.from('pedidos')
        .select('id, numero, status, tipo_pedido, identificador_cliente, valor_total, subtotal, taxa_entrega, desconto, criado_em, itens_pedido(quantidade, produto_id, nome_produto), pagamentos(metodo, status, valor_pago)')
        .eq('loja_id', lojaId)
        .gte('criado_em', inicio.toISOString())
        .lt('criado_em', fim.toISOString())
        .order('criado_em', { ascending: false }),
      supabase.from('configuracoes_custo').select('*').eq('loja_id', lojaId).maybeSingle()
    ]);

    if (config) setConfigCusto(config as ConfiguracoesCusto);
    setProdutos((custos as ProdutoCusto[]) ?? []);
    setPedidos((dataPedidos as unknown as Pedido[]) ?? []);
    setCarregando(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setTimeout(() => { setCarregando(true); carregarDados(); }, 0); }, [lojaId, periodo]);

  // Extrato ao vivo: qualquer mudança em pedidos da loja recarrega o painel
  useEffect(() => {
    const canal = supabase
      .channel(`financeiro-${lojaId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos', filter: `loja_id=eq.${lojaId}` },
        () => carregarDados())
      .subscribe();
    return () => { supabase.removeChannel(canal); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lojaId, periodo]);

  // ── KPIs calculados a partir dos pedidos do período ──
  const resumo = useMemo(() => {
    const validos = pedidos.filter((p) => p.status !== 'CANCELADO');
    const cancelados = pedidos.filter((p) => p.status === 'CANCELADO');

    const faturamento = validos.reduce((s, p) => s + Number(p.valor_total), 0);
    const totalTaxasEntrega = validos.reduce((s, p) => s + Number(p.taxa_entrega || 0), 0);
    const ticketMedio = validos.length > 0 ? faturamento / validos.length : 0;

    const custoInsumo = new Map(produtos.map((c) => [c.produto_id, Number(c.custo_insumos)]));
    const rateio = new Map(produtos.map((c) => [c.produto_id, Number(c.taxa_rateio)]));
    const custoTotal = validos.reduce((s, p) =>
      s + (p.itens_pedido ?? []).reduce((si, it: any) =>
        si + ((custoInsumo.get(it.produto_id) ?? 0) + (rateio.get(it.produto_id) ?? 0)) * it.quantidade, 0), 0);

    const porMetodo = new Map<string, { total: number; qtd: number }>();
    for (const p of validos) {
      const metodo = p.pagamentos?.[0]?.metodo ?? 'DINHEIRO';
      const atual = porMetodo.get(metodo) ?? { total: 0, qtd: 0 };
      atual.total += Number(p.valor_total);
      atual.qtd += 1;
      porMetodo.set(metodo, atual);
    }

    return {
      faturamento,
      totalTaxasEntrega,
      lucro: faturamento - custoTotal,
      qtdPedidos: validos.length,
      ticketMedio,
      qtdCancelados: cancelados.length,
      valorCancelado: cancelados.reduce((s, p) => s + Number(p.valor_total), 0),
      porMetodo: [...porMetodo.entries()].sort((a, b) => b[1].total - a[1].total),
    };
  }, [pedidos, produtos]);

  // ── Série do gráfico: por hora (Hoje/Ontem) ou por dia ──
  const serieGrafico = useMemo(() => {
    const validos = pedidos.filter((p) => p.status !== 'CANCELADO');
    const porHora = periodo === 'HOJE' || periodo === 'ONTEM';
    const mapa = new Map<string, number>();

    if (porHora) {
      for (let h = 8; h <= 23; h++) mapa.set(`${String(h).padStart(2, '0')}h`, 0);
      for (const p of validos) {
        const chave = `${String(new Date(p.criado_em).getHours()).padStart(2, '0')}h`;
        mapa.set(chave, (mapa.get(chave) ?? 0) + Number(p.valor_total));
      }
      return [...mapa.entries()]
        .sort((a, b) => Number(a[0].replace('h', '')) - Number(b[0].replace('h', '')))
        .map(([nome, total]) => ({ nome, total: Number(total.toFixed(2)) }));
    } else {
      const { inicio, fim } = intervaloPeriodo(periodo);
      for (let d = new Date(inicio); d < fim; d = new Date(d.getTime() + 24 * 3600e3)) {
        mapa.set(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), 0);
      }
      for (const p of validos) {
        const chave = new Date(p.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        mapa.set(chave, (mapa.get(chave) ?? 0) + Number(p.valor_total));
      }
    }
    return [...mapa.entries()].map(([nome, total]) => ({ nome, total: Number(total.toFixed(2)) }));
  }, [pedidos, periodo]);

  const salvarCustos = async () => {
    setSalvando(true);
    setMensagem('');
    const { error } = await supabase.from('configuracoes_custo').upsert({
      ...configCusto,
      loja_id: lojaId,
      atualizado_em: new Date().toISOString()
    }, { onConflict: 'loja_id' });

    if (error) setMensagem('Erro ao salvar custos.');
    else {
      setMensagem('Custos atualizados com sucesso!');
      await carregarDados(); // Recarrega a view de produtos com o novo rateio
    }
    setSalvando(false);
    setTimeout(() => setMensagem(''), 3000);
  };

  if (carregando) {
    return (
      <div className="flex h-64 items-center justify-center">
        <MiseOnLoader status="Carregando inteligência financeira..." rows={2} />
      </div>
    );
  }

  const totalFixoMensal = Number(configCusto.custo_aluguel) + Number(configCusto.custo_energia) + Number(configCusto.custo_agua) + Number(configCusto.custo_internet) + Number(configCusto.custo_gas) + Number(configCusto.outros_custos_fixos);
  const rateioSimulado = Number(configCusto.expectativa_vendas_mes) > 0 ? totalFixoMensal / Number(configCusto.expectativa_vendas_mes) : 0;

  const abaBtn = (id: typeof aba, rotulo: string) => (
    <button onClick={() => setAba(id)} className={`px-4 py-2 text-sm font-semibold rounded-t-xl transition-colors ${aba === id ? 'bg-white dark:bg-gray-900 border-t border-x border-gray-100 dark:border-gray-800 text-[var(--cor-primaria)] -mb-[9px] shadow-[0_-2px_4px_rgba(0,0,0,0.02)]' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
      {rotulo}
    </button>
  );

  return (
    <div data-tour="tour-financeiro-header" className="p-4 max-w-3xl mx-auto">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-bold text-xl dark:text-gray-100">Financeiro</h2>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Ao vivo
        </span>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">
        {abaBtn('EXTRATO', '💰 Extrato de Vendas')}
        {abaBtn('MARGENS', '📈 Margens')}
        {abaBtn('DRE', '📊 DRE Gerencial')}
        {abaBtn('CUSTOS_FIXOS', '🏢 Custos Operacionais')}
      </div>

      {aba === 'DRE' && <DreGerencial />}

      {aba === 'EXTRATO' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* ── Seletor de período ── */}
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {PERIODOS.map((p) => (
              <button key={p.id} onClick={() => setPeriodo(p.id)}
                className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-bold transition ${periodo === p.id
                  ? 'border-[var(--cor-primaria)] bg-[var(--cor-primaria)] text-white shadow-md'
                  : 'border-gray-200 bg-white text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300'}`}>
                {p.label}
              </button>
            ))}
          </div>

          {/* ── KPIs ── */}
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <div className="rounded-2xl bg-white p-3 shadow-sm dark:border dark:border-gray-800 dark:bg-gray-900">
              <p className="flex items-center gap-1 text-[10px] font-semibold text-gray-400"><DollarSign size={11} /> Faturamento</p>
              <p className="mt-1 text-lg font-bold dark:text-gray-100">{fmt(resumo.faturamento)}</p>
            </div>
            <div className="rounded-2xl bg-white p-3 shadow-sm dark:border dark:border-gray-800 dark:bg-gray-900">
              <p className="flex items-center gap-1 text-[10px] font-semibold text-gray-400"><Bike size={11} /> Taxas Entrega</p>
              <p className="mt-1 text-lg font-bold text-blue-500">{fmt(resumo.totalTaxasEntrega)}</p>
            </div>
            <div className="rounded-2xl bg-white p-3 shadow-sm dark:border dark:border-gray-800 dark:bg-gray-900">
              <p className="flex items-center gap-1 text-[10px] font-semibold text-gray-400"><TrendingUp size={11} /> Lucro estimado</p>
              <p className={`mt-1 text-lg font-bold ${resumo.lucro < 0 ? 'text-red-500' : 'text-green-600'}`}>{fmt(resumo.lucro)}</p>
            </div>
            <div className="rounded-2xl bg-white p-3 shadow-sm dark:border dark:border-gray-800 dark:bg-gray-900">
              <p className="flex items-center gap-1 text-[10px] font-semibold text-gray-400"><ShoppingBag size={11} /> Pedidos</p>
              <p className="mt-1 text-lg font-bold dark:text-gray-100">{resumo.qtdPedidos}</p>
            </div>
            <div className="rounded-2xl bg-white p-3 shadow-sm dark:border dark:border-gray-800 dark:bg-gray-900 col-span-2 sm:col-span-1">
              <p className="flex items-center gap-1 text-[10px] font-semibold text-gray-400"><Ticket size={11} /> Ticket médio</p>
              <p className="mt-1 text-lg font-bold dark:text-gray-100">{fmt(resumo.ticketMedio)}</p>
            </div>
          </div>

          {resumo.qtdCancelados > 0 && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
              <XCircle size={14} /> {resumo.qtdCancelados} pedido(s) cancelado(s) no período — {fmt(resumo.valorCancelado)} fora do caixa.
            </div>
          )}

          {/* ── Gráfico de vendas ── */}
          <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="mb-3 text-sm font-bold dark:text-gray-200">
              Vendas {periodo === 'HOJE' || periodo === 'ONTEM' ? 'por horário' : 'por dia'}
            </p>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serieGrafico} margin={{ top: 4, right: 4, bottom: 0, left: -14 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" vertical={false} />
                  <XAxis dataKey="nome" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
                  <Tooltip formatter={(v) => [fmt(Number(v ?? 0)), 'Vendas']} cursor={{ fill: 'rgba(128,128,128,0.08)' }}
                    contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid rgba(128,128,128,0.2)' }} />
                  <Bar dataKey="total" fill="var(--cor-primaria)" radius={[6, 6, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Por método de pagamento ── */}
          <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="mb-3 text-sm font-bold dark:text-gray-200">Recebimentos por forma de pagamento</p>
            {resumo.porMetodo.length === 0 ? (
              <p className="py-3 text-center text-xs text-gray-400">Nenhuma venda no período.</p>
            ) : (
              <div className="space-y-2">
                {resumo.porMetodo.map(([metodo, info]) => {
                  const conf = METODO_INFO[metodo as MetodoPgto] ?? { label: metodo, icon: Banknote };
                  const Icone = conf.icon;
                  const pct = resumo.faturamento > 0 ? (info.total / resumo.faturamento) * 100 : 0;
                  return (
                    <div key={metodo}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 font-semibold text-gray-600 dark:text-gray-300"><Icone size={13} /> {conf.label} <span className="text-gray-400">({info.qtd})</span></span>
                        <span className="font-bold dark:text-gray-100">{fmt(info.total)} <span className="text-[10px] font-semibold text-gray-400">{pct.toFixed(0)}%</span></span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
                        <div className="h-1.5 rounded-full bg-[var(--cor-primaria)]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Extrato pedido a pedido ── */}
          <p className="mb-2 flex items-center gap-1.5 text-sm font-bold dark:text-gray-200"><Receipt size={15} /> Extrato do período</p>
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            {pedidos.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Nenhum pedido no período.</p>}
            {pedidos.map((p, idx) => {
              const dt = new Date(p.criado_em);
              const metodo = p.pagamentos?.[0]?.metodo;
              const cancelado = p.status === 'CANCELADO';
              return (
                <div key={p.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${idx > 0 ? 'border-t border-gray-50 dark:border-gray-800/60' : ''}`}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-gray-500 dark:text-gray-400">#{p.numero}</span>
                      <span className="truncate text-sm font-semibold dark:text-gray-100">{p.identificador_cliente}</span>
                      {p.tipo_pedido === 'DELIVERY'
                        ? <Bike size={12} className="shrink-0 text-blue-400" />
                        : <Store size={12} className="shrink-0 text-emerald-500" />}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                      <span>{dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} {dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      {metodo && <span>· {METODO_INFO[metodo]?.label ?? metodo}</span>}
                      <span>· {(p.itens_pedido ?? []).reduce((s, i) => s + i.quantidade, 0)} item(ns)</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-sm font-bold ${cancelado ? 'text-gray-400 line-through' : 'dark:text-gray-100'}`}>{fmt(Number(p.valor_total))}</p>
                    <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_BADGE[p.status] ?? ''}`}>{STATUS_LABEL[p.status] ?? p.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {aba === 'MARGENS' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <p className="mb-2 text-sm font-semibold dark:text-gray-200">Lucro Líquido por Produto (Após rateio)</p>
          <div className="space-y-3">
            {produtos.map((p) => {
              const margemBaixa = p.margem_pct !== null && p.margem_pct < 30;
              const prejuizo = Number(p.lucro_liquido) < 0;
              return (
                <div key={p.produto_id} className={`rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm border ${prejuizo ? 'border-red-300 dark:border-red-900' : 'border-gray-100 dark:border-gray-800'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-base font-bold dark:text-gray-100">{p.nome}</p>
                    <span className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${prejuizo ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : (margemBaixa ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400')}`}>
                      {prejuizo || margemBaixa ? <TrendingDown size={12} /> : <TrendingUp size={12} />} {p.margem_pct ?? '0'}%
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2">
                      <p className="text-[9px] uppercase tracking-wide text-gray-400 mb-1">Venda</p>
                      <p className="font-semibold dark:text-gray-200">{fmt(Number(p.preco_venda))}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2">
                      <p className="text-[9px] uppercase tracking-wide text-gray-400 mb-1">Insumos (CMV)</p>
                      <p className="font-semibold text-orange-600 dark:text-orange-400">-{fmt(Number(p.custo_insumos))}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2">
                      <p className="text-[9px] uppercase tracking-wide text-gray-400 mb-1">Custos Fixos</p>
                      <p className="font-semibold text-orange-600 dark:text-orange-400">-{fmt(Number(p.taxa_rateio))}</p>
                    </div>
                    <div className={`${prejuizo ? 'bg-red-50 dark:bg-red-900/10' : 'bg-green-50 dark:bg-green-900/10'} rounded-lg p-2`}>
                      <p className="text-[9px] uppercase tracking-wide text-gray-400 mb-1">Líq. Real</p>
                      <p className={`font-bold ${prejuizo ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>{fmt(Number(p.lucro_liquido))}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {produtos.length === 0 && (
              <p className="py-10 text-center text-sm text-gray-400">
                Nenhum produto com ficha técnica ainda.
              </p>
            )}
          </div>
        </div>
      )}

      {aba === 'CUSTOS_FIXOS' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300">
            <p className="font-semibold mb-1 flex items-center gap-2"><Calculator size={16} /> Rateio de Custos</p>
            <p>O sistema pega o total dos seus gastos mensais e divide pela expectativa de vendas. Esse valor é cobrado no custo de cada lanche para garantir que a sua operação se pague.</p>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-sm">
             <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">Despesas Mensais (R$)</h3>

             <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Aluguel</span>
                  <input type="number" className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100"
                    value={configCusto.custo_aluguel} onChange={e => setConfigCusto({...configCusto, custo_aluguel: e.target.valueAsNumber || 0})} />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Energia Elétrica</span>
                  <input type="number" className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100"
                    value={configCusto.custo_energia} onChange={e => setConfigCusto({...configCusto, custo_energia: e.target.valueAsNumber || 0})} />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Água</span>
                  <input type="number" className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100"
                    value={configCusto.custo_agua} onChange={e => setConfigCusto({...configCusto, custo_agua: e.target.valueAsNumber || 0})} />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Gás</span>
                  <input type="number" className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100"
                    value={configCusto.custo_gas} onChange={e => setConfigCusto({...configCusto, custo_gas: e.target.valueAsNumber || 0})} />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Internet / Fone</span>
                  <input type="number" className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100"
                    value={configCusto.custo_internet} onChange={e => setConfigCusto({...configCusto, custo_internet: e.target.valueAsNumber || 0})} />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Outros Gastos Fixos</span>
                  <input type="number" className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100"
                    value={configCusto.outros_custos_fixos} onChange={e => setConfigCusto({...configCusto, outros_custos_fixos: e.target.valueAsNumber || 0})} />
                </label>
             </div>

             <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
               <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                 <div className="w-full sm:w-1/2">
                   <label className="block">
                    <span className="text-xs font-bold text-gray-900 dark:text-gray-100 mb-1 block">Expectativa de Vendas / Mês (Qtd)</span>
                    <input type="number" className="w-full rounded-xl border-2 border-[var(--cor-primaria)] bg-green-50 dark:bg-green-900/10 p-3 text-lg font-bold text-[var(--cor-primaria)] focus:outline-none"
                      value={configCusto.expectativa_vendas_mes} onChange={e => setConfigCusto({...configCusto, expectativa_vendas_mes: e.target.valueAsNumber || 0})} />
                    <p className="text-[10px] text-gray-500 mt-1">Quantos itens principais você estima vender por mês?</p>
                   </label>
                 </div>

                 <div className="w-full sm:w-1/2 rounded-xl bg-gray-900 text-white p-4 text-center">
                   <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total Despesas</p>
                   <p className="text-lg font-bold mb-2">{fmt(totalFixoMensal)}</p>
                   <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--cor-primaria)]">Rateio por Produto</p>
                   <p className="text-2xl font-black">{fmt(rateioSimulado)}</p>
                 </div>
               </div>
             </div>

             <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
               <p className="mb-3 flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-gray-100"><Bike size={16} /> Remuneração do Entregador</p>
               <label className="block mb-3">
                 <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Como você paga seu(s) entregador(es)?</span>
                 <select className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100"
                   value={configCusto.tipo_remuneracao_entregador ?? 'DESLIGADO'}
                   onChange={e => setConfigCusto({ ...configCusto, tipo_remuneracao_entregador: e.target.value as ConfiguracoesCusto['tipo_remuneracao_entregador'] })}>
                   {Object.entries(REMUNERACAO_LABEL).map(([valor, label]) => <option key={valor} value={valor}>{label}</option>)}
                 </select>
               </label>

               {(configCusto.tipo_remuneracao_entregador === 'FIXO' || configCusto.tipo_remuneracao_entregador === 'POR_ENTREGA') && (
                 <label className="block">
                   <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                     {configCusto.tipo_remuneracao_entregador === 'FIXO' ? 'Valor fixo mensal' : 'Valor por entrega'}
                   </span>
                   <input type="number" className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100"
                     value={configCusto.valor_remuneracao_entregador ?? 0}
                     onChange={e => setConfigCusto({ ...configCusto, valor_remuneracao_entregador: e.target.valueAsNumber || 0 })} />
                 </label>
               )}

               {configCusto.tipo_remuneracao_entregador === 'POR_KM' && (
                 <div className="grid gap-3 sm:grid-cols-3">
                   <label className="block">
                     <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Taxa mínima (R$)</span>
                     <input type="number" step="0.01" className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100"
                       value={configCusto.entregador_taxa_minima ?? 5}
                       onChange={e => setConfigCusto({ ...configCusto, entregador_taxa_minima: e.target.valueAsNumber || 0 })} />
                   </label>
                   <label className="block">
                     <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Raio coberto (km)</span>
                     <input type="number" step="0.5" className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100"
                       value={configCusto.entregador_raio_minimo_km ?? 5}
                       onChange={e => setConfigCusto({ ...configCusto, entregador_raio_minimo_km: e.target.valueAsNumber || 0 })} />
                   </label>
                   <label className="block">
                     <span className="text-xs font-medium text-gray-700 dark:text-gray-300">R$/km excedente</span>
                     <input type="number" step="0.01" className="mt-1 w-full rounded-xl border border-gray-300 p-2.5 text-sm dark:bg-gray-950 dark:border-gray-700 dark:text-gray-100"
                       value={configCusto.entregador_taxa_km_excedente ?? 1.2}
                       onChange={e => setConfigCusto({ ...configCusto, entregador_taxa_km_excedente: e.target.valueAsNumber || 0 })} />
                   </label>
                   <p className="col-span-full text-[10px] text-gray-500">
                     Ex: entrega de 8km com os valores acima = R$5 + (8 − 5) × R$1,20 = R$8,60. Sem endereço geolocalizado, cai na taxa mínima.
                   </p>
                 </div>
               )}
             </div>

             {mensagem && <p className={`mt-4 text-center text-sm font-semibold ${mensagem.includes('Erro') ? 'text-red-500' : 'text-green-600'}`}>{mensagem}</p>}

             <button onClick={salvarCustos} disabled={salvando} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] py-3.5 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.02] disabled:opacity-50">
               <Save size={18} /> {salvando ? 'Salvando...' : 'Salvar Motor de Custos'}
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
