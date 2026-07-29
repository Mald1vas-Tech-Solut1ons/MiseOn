/**
 * Central de Compras.
 *
 * Três perguntas, três abas:
 *   Repor       — o que preciso comprar, e por quê
 *   Pedidos     — o que encomendei, o que chegou, o que ainda falta
 *   Fornecedores— de quem eu compro, e quanto cada um cobra
 *
 * A sugestão não olha só o `estoque_minimo` (número digitado uma vez e
 * esquecido): olha o GIRO real dos últimos 30 dias e projeta a cobertura em
 * dias. Um item que zera em 2 dias e outro que dura 3 semanas não podem gritar
 * com a mesma intensidade.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  ShoppingCart, CheckCircle2, Circle, PackageCheck, Loader2, AlertTriangle,
  Truck, Plus, Pencil, Archive, FileText, Clock, Zap, TrendingDown, CalendarClock,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Insumo, fmt } from '../../types';
import type { CtxLoja } from './AdminLayout';
import MiseOnLoader from '../../components/MiseOnLoader';
import ModalFornecedor from '../../components/compras/ModalFornecedor';
import ModalRecebimento from '../../components/compras/ModalRecebimento';
import {
  CompraResumo, Fornecedor, InsumoGiro, LoteValidade, ROTULO_STATUS,
  SugestaoCompra, arquivarFornecedor, cancelarCompra, carregarGiro,
  carregarValidades, criarCompra, listarCompras, listarFornecedores, sugerirCompra,
} from '../../lib/compras';

type Aba = 'repor' | 'pedidos' | 'fornecedores';

const COR_STATUS: Record<string, string> = {
  RASCUNHO: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  ENVIADO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  RECEBIDO_PARCIAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  RECEBIDO: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  CANCELADO: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function Compras() {
  const { lojaId } = useOutletContext<CtxLoja>();
  const [aba, setAba] = useState<Aba>('repor');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [giro, setGiro] = useState<InsumoGiro[]>([]);
  const [validades, setValidades] = useState<LoteValidade[]>([]);
  const [compras, setCompras] = useState<CompraResumo[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);

  // Quantos dias de operação o pedido deve cobrir. É a única alavanca que o
  // lojista precisa girar: "quero comprar para a semana" vira uma lista.
  const [diasAlvo, setDiasAlvo] = useState(7);
  const [selecao, setSelecao] = useState<Record<string, number>>({});
  const [fornecedorPedido, setFornecedorPedido] = useState('');
  const [filtroFornecedor, setFiltroFornecedor] = useState('');

  const [editandoFornecedor, setEditandoFornecedor] = useState<Fornecedor | null | undefined>(undefined);
  const [recebendo, setRecebendo] = useState<CompraResumo | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [resInsumos, g, v, c, f] = await Promise.all([
      supabase.from('insumos').select('*').eq('loja_id', lojaId).eq('ativo', true).order('nome'),
      carregarGiro(lojaId).catch(() => []),
      carregarValidades(lojaId).catch(() => []),
      listarCompras(lojaId).catch(() => []),
      listarFornecedores(lojaId).catch(() => []),
    ]);
    setInsumos(((resInsumos.data as Insumo[]) ?? []).filter(i => !i.is_preparo));
    setGiro(g); setValidades(v); setCompras(c); setFornecedores(f);
    setCarregando(false);
  }, [lojaId]);

  useEffect(() => { carregar(); }, [carregar]);

  const giroPorId = useMemo(() => new Map(giro.map(g => [g.insumo_id, g])), [giro]);

  const todasSugestoes = useMemo(() => {
    const lista: SugestaoCompra[] = [];
    for (const i of insumos) {
      const s = sugerirCompra(i, giroPorId.get(i.id), diasAlvo);
      if (s) lista.push(s);
    }
    // Quem acaba primeiro aparece primeiro: zerado, depois menor cobertura.
    const peso = { ZERADO: 0, CRITICO: 1, COBERTURA: 2 };
    return lista.sort((a, b) =>
      peso[a.urgencia] - peso[b.urgencia] ||
      (a.diasCobertura ?? 999) - (b.diasCobertura ?? 999));
  }, [insumos, giroPorId, diasAlvo]);

  // Compra-se POR FORNECEDOR, não por lista geral: filtrar aqui é o que
  // transforma a sugestão num pedido que dá para mandar no WhatsApp do Zé.
  const sugestoes = useMemo(
    () => filtroFornecedor
      ? todasSugestoes.filter(s => (s.fornecedorId ?? '') === filtroFornecedor)
      : todasSugestoes,
    [todasSugestoes, filtroFornecedor],
  );

  // Toda sugestão nasce marcada com a quantidade sugerida — desmarcar é mais
  // rápido que marcar quando a lista é a operação inteira da semana.
  useEffect(() => {
    setSelecao(atual => {
      const novo: Record<string, number> = {};
      for (const s of sugestoes) novo[s.insumo.id] = atual[s.insumo.id] ?? s.qtdSugerida;
      return novo;
    });
  }, [sugestoes]);

  const rupturas = sugestoes.filter(s => s.rupturaAntesDaEntrega);
  const marcados = sugestoes.filter(s => (selecao[s.insumo.id] ?? 0) > 0);
  const totalEstimado = marcados.reduce((acc, s) => acc + (selecao[s.insumo.id] ?? 0) * s.precoUnitario, 0);
  const valorEmRisco = validades.reduce((acc, v) => acc + Number(v.valor_em_risco), 0);

  const gerarPedido = async (receberAgora: boolean) => {
    if (marcados.length === 0 || salvando) return;
    setSalvando(true);
    try {
      const compraId = await criarCompra(
        lojaId,
        marcados.map(s => ({
          insumo_id: s.insumo.id,
          qtd_pedida: selecao[s.insumo.id],
          unidade_pedida: s.unidadeCompra,
          fator_pedida: s.fator,
          preco_unitario_previsto: s.precoUnitario || null,
        })),
        { fornecedor_id: fornecedorPedido || null, status: 'ENVIADO' },
      );
      setSelecao({});
      await carregar();
      if (receberAgora) {
        const nova = (await listarCompras(lojaId)).find(c => c.id === compraId);
        if (nova) setRecebendo(nova);
      } else {
        setAviso(`Pedido criado com ${marcados.length} ${marcados.length === 1 ? 'item' : 'itens'}. Confira quando a mercadoria chegar.`);
        setAba('pedidos');
      }
    } catch (e) {
      setAviso(`Não foi possível criar o pedido: ${e instanceof Error ? e.message : e}`);
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return <div className="flex h-64 items-center justify-center"><MiseOnLoader status="Lendo a despensa..." rows={2} /></div>;
  }

  return (
    <div className="mx-auto max-w-5xl p-4 pb-32">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-[var(--cor-primaria)]/10 p-3 text-[var(--cor-primaria)]">
            <ShoppingCart size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black dark:text-gray-100">Central de Compras</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Do que falta ao que chegou — com preço, marca e fornecedor.</p>
          </div>
        </div>
        <div className="flex rounded-xl bg-gray-100 p-1 shadow-inner dark:bg-gray-800">
          {([['repor', 'Repor'], ['pedidos', 'Pedidos'], ['fornecedores', 'Fornecedores']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setAba(k)}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition-all ${
                aba === k ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}>
              {label}
              {k === 'pedidos' && compras.some(c => c.status === 'ENVIADO' || c.status === 'RECEBIDO_PARCIAL') && (
                <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-blue-500 align-middle" />
              )}
            </button>
          ))}
        </div>
      </div>

      {aviso && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-900/10">
          <p className="flex items-start gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-400">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> {aviso}
          </p>
          <button onClick={() => setAviso(null)} className="shrink-0 text-xs font-bold text-emerald-700 hover:underline dark:text-emerald-500">Fechar</button>
        </div>
      )}

      {/* ─── REPOR ─────────────────────────────────────────────────────── */}
      {aba === 'repor' && (
        <>
          {validades.length > 0 && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
              <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-amber-800 dark:text-amber-500">
                <CalendarClock size={16} /> {fmt(valorEmRisco)} vencendo no estoque
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {validades.slice(0, 4).map(v => `${v.insumo_nome} (${v.dias_para_vencer < 0 ? 'vencido' : `${v.dias_para_vencer}d`})`).join(' · ')}
                {validades.length > 4 && ` · +${validades.length - 4}`}
                {' — '}use antes de comprar mais.
              </p>
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Comprar para cobrir</span>
            <div className="flex gap-1">
              {[3, 7, 15, 30].map(d => (
                <button key={d} onClick={() => setDiasAlvo(d)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                    diasAlvo === d ? 'bg-[var(--cor-primaria)] text-white shadow-sm'
                                   : 'border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400'}`}>
                  {d} dias
                </button>
              ))}
            </div>
            {fornecedores.length > 0 && (
              <select value={filtroFornecedor} onChange={e => { setFiltroFornecedor(e.target.value); setFornecedorPedido(e.target.value); }}
                className="rounded-lg border border-gray-300 p-2 text-xs font-bold focus:border-[var(--cor-primaria)] focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                <option value="">Todos os fornecedores</option>
                {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            )}
            <span className="text-xs text-gray-400">
              O alvo soma o consumo real do período ao prazo de entrega do fornecedor.
            </span>
          </div>

          {rupturas.length > 0 && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20">
              <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-red-800 dark:text-red-400">
                <AlertTriangle size={16} /> {rupturas.length} {rupturas.length === 1 ? 'item acaba' : 'itens acabam'} antes da entrega chegar
              </p>
              <p className="text-xs text-red-700 dark:text-red-400/80">
                {rupturas.slice(0, 4).map(s =>
                  `${s.insumo.nome} (dura ${(s.diasCobertura ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}d, entrega em ${s.prazoEntrega}d)`
                ).join(' · ')}
                {rupturas.length > 4 && ` · +${rupturas.length - 4}`}
                {' — '}peça hoje ou procure outro fornecedor.
              </p>
            </div>
          )}

          {sugestoes.length === 0 ? (
            <div className="rounded-3xl border border-green-200 bg-green-50 p-8 text-center dark:border-green-900/30 dark:bg-green-900/10">
              <PackageCheck size={48} className="mx-auto mb-4 text-green-500 opacity-50" />
              <h3 className="mb-1 text-lg font-bold text-green-800 dark:text-green-500">Despensa coberta</h3>
              <p className="text-sm text-green-700 dark:text-green-600/80">
                Nenhum insumo fica sem estoque nos próximos {diasAlvo} dias no ritmo atual de consumo.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
              {sugestoes.map(s => {
                const qtd = selecao[s.insumo.id] ?? 0;
                const ativo = qtd > 0;
                return (
                  <div key={s.insumo.id} className={`flex flex-col gap-4 p-4 transition-colors sm:flex-row sm:items-center sm:p-5 ${ativo ? '' : 'bg-gray-50/50 opacity-60 dark:bg-gray-950/50'}`}>
                    <div className="flex flex-1 items-center gap-4">
                      <button onClick={() => setSelecao(v => ({ ...v, [s.insumo.id]: ativo ? 0 : s.qtdSugerida }))}
                        className={`shrink-0 transition-colors ${ativo ? 'text-[var(--cor-primaria)]' : 'text-gray-300 dark:text-gray-600'}`}>
                        {ativo ? <CheckCircle2 size={26} /> : <Circle size={26} strokeWidth={1.5} />}
                      </button>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-bold text-gray-900 dark:text-gray-100">
                          {s.insumo.nome}
                          {s.urgencia === 'ZERADO' && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-red-700 dark:bg-red-900/30 dark:text-red-400">acabou</span>
                          )}
                          {s.urgencia === 'CRITICO' && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">crítico</span>
                          )}
                          {s.rupturaAntesDaEntrega && (
                            <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              <AlertTriangle size={9} /> acaba antes de chegar
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          Tem <b>{Number(s.insumo.quantidade_atual).toLocaleString('pt-BR')} {s.insumo.unidade_medida}</b>
                          {s.giro && s.giro.consumo_diario > 0 && (
                            <> · sai <b>{s.giro.consumo_diario.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} {s.insumo.unidade_medida}/dia</b></>
                          )}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-3 text-[10px] font-medium text-gray-400">
                          {s.diasCobertura != null ? (
                            <span className={`flex items-center gap-1 ${s.diasCobertura <= 2 ? 'text-red-500' : s.diasCobertura <= 5 ? 'text-amber-500' : ''}`}>
                              <Clock size={10} /> dura {s.diasCobertura.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} dias
                            </span>
                          ) : (
                            <span className="flex items-center gap-1"><Clock size={10} /> sem giro nos últimos 30 dias</span>
                          )}
                          {s.fornecedorNome && (
                            <span className="flex items-center gap-1">
                              <Truck size={10} /> {s.fornecedorNome}
                              {s.prazoEntrega > 0 && ` · chega em ${s.prazoEntrega}d`}
                            </span>
                          )}
                          {s.giro && s.giro.perda_30d > 0 && (
                            <span className="flex items-center gap-1 text-red-400">
                              <TrendingDown size={10} /> perdeu {s.giro.perda_30d.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} {s.insumo.unidade_medida} no mês
                            </span>
                          )}
                          <span>1 {s.unidadeCompra} = {s.fator.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {s.insumo.unidade_medida}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-6 sm:w-auto sm:justify-end">
                      <div className="flex flex-col items-center">
                        <div className="flex items-center rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
                          <button onClick={() => setSelecao(v => ({ ...v, [s.insumo.id]: Math.max(0, qtd - 1) }))}
                            className="flex h-8 w-8 items-center justify-center rounded-lg font-black text-gray-500 transition-colors hover:bg-white dark:hover:bg-gray-700">-</button>
                          <input type="number" min="0" value={qtd}
                            onChange={e => setSelecao(v => ({ ...v, [s.insumo.id]: Math.max(0, e.target.valueAsNumber || 0) }))}
                            className="w-14 bg-transparent text-center text-lg font-bold focus:outline-none dark:text-gray-100" />
                          <button onClick={() => setSelecao(v => ({ ...v, [s.insumo.id]: qtd + 1 }))}
                            className="flex h-8 w-8 items-center justify-center rounded-lg font-black text-gray-500 transition-colors hover:bg-white dark:hover:bg-gray-700">+</button>
                        </div>
                        <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">{s.unidadeCompra}</p>
                      </div>
                      <div className="min-w-[80px] text-right">
                        <p className="text-sm font-black text-gray-900 dark:text-gray-100">{fmt(qtd * s.precoUnitario)}</p>
                        <p className="mt-1 text-[10px] text-gray-400">{fmt(s.precoUnitario)}/{s.unidadeCompra}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {marcados.length > 0 && (
            <div className="fixed bottom-16 left-0 z-30 w-full border-t border-gray-200 bg-white p-4 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] dark:border-gray-800 dark:bg-gray-900 lg:bottom-0 lg:pl-[280px]">
              <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-xl font-black text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {marcados.length}
                  </div>
                  <div>
                    <p className="text-3xl font-black text-gray-900 dark:text-gray-100">{fmt(totalEstimado)}</p>
                    <p className="text-xs text-gray-400">estimado pelo último preço pago</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select value={fornecedorPedido} onChange={e => setFornecedorPedido(e.target.value)}
                    className="rounded-xl border border-gray-300 p-2.5 text-sm focus:border-[var(--cor-primaria)] focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100">
                    <option value="">Sem fornecedor</option>
                    {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                  <button onClick={() => gerarPedido(false)} disabled={salvando}
                    className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-5 py-3 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                    <FileText size={16} /> Gerar pedido
                  </button>
                  <button onClick={() => gerarPedido(true)} disabled={salvando}
                    className="flex items-center justify-center gap-2 rounded-xl bg-[var(--cor-primaria)] px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100">
                    {salvando ? <><Loader2 size={16} className="animate-spin" /> Criando...</> : <><Zap size={16} /> Já comprei — conferir</>}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── PEDIDOS ───────────────────────────────────────────────────── */}
      {aba === 'pedidos' && (
        compras.length === 0 ? (
          <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
            <FileText size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-700" />
            <h3 className="mb-1 text-lg font-bold text-gray-700 dark:text-gray-300">Nenhum pedido ainda</h3>
            <p className="text-sm text-gray-500">Monte a lista na aba <b>Repor</b> e gere seu primeiro pedido.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {compras.map(c => {
              const aberto = c.status === 'ENVIADO' || c.status === 'RECEBIDO_PARCIAL';
              return (
                <div key={c.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${COR_STATUS[c.status]}`}>
                          {ROTULO_STATUS[c.status]}
                        </span>
                        <p className="font-bold text-gray-900 dark:text-gray-100">
                          {c.fornecedor_nome ?? 'Sem fornecedor'}
                        </p>
                        {c.numero_nota && <span className="text-[11px] text-gray-400">NF {c.numero_nota}</span>}
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Pedido em {new Date(c.data_pedido + 'T12:00:00').toLocaleDateString('pt-BR')}
                        {' · '}{c.itens_conferidos}/{c.itens_total} itens conferidos
                        {c.recebido_em && ` · recebido em ${new Date(c.recebido_em).toLocaleDateString('pt-BR')}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-black text-gray-900 dark:text-gray-100">
                          {fmt(Number(c.total_pago) > 0 ? Number(c.total_pago) : Number(c.total_previsto))}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {Number(c.total_pago) > 0 ? 'pago' : 'previsto'}
                        </p>
                      </div>
                      {aberto && (
                        <>
                          <button onClick={() => setRecebendo(c)}
                            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700">
                            <PackageCheck size={14} /> Conferir
                          </button>
                          <button onClick={async () => {
                            if (!window.confirm('Cancelar este pedido? O estoque já recebido não é desfeito.')) return;
                            await cancelarCompra(c.id); carregar();
                          }} className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20" title="Cancelar pedido">
                            <Archive size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ─── FORNECEDORES ──────────────────────────────────────────────── */}
      {aba === 'fornecedores' && (
        <>
          <button onClick={() => setEditandoFornecedor(null)}
            className="mb-4 flex items-center gap-2 rounded-xl bg-[var(--cor-primaria)] px-5 py-3 text-sm font-bold text-white shadow-md transition-transform hover:scale-[1.02]">
            <Plus size={16} /> Novo fornecedor
          </button>

          {fornecedores.length === 0 ? (
            <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
              <Truck size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-700" />
              <h3 className="mb-1 text-lg font-bold text-gray-700 dark:text-gray-300">Nenhum fornecedor cadastrado</h3>
              <p className="text-sm text-gray-500">Com fornecedor cadastrado, o sistema passa a comparar preço por marca e por origem.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {fornecedores.map(f => (
                <div key={f.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 dark:text-gray-100">{f.nome}</p>
                      {f.contato_nome && <p className="text-xs text-gray-500">{f.contato_nome}</p>}
                      {f.telefone && <p className="mt-1 text-xs text-gray-400">{f.telefone}</p>}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {f.prazo_entrega_dias != null && (
                          <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                            entrega em {f.prazo_entrega_dias}d
                          </span>
                        )}
                        {f.pedido_minimo != null && f.pedido_minimo > 0 && (
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            mín. {fmt(Number(f.pedido_minimo))}
                          </span>
                        )}
                        {f.condicao_pagamento && (
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            {f.condicao_pagamento}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => setEditandoFornecedor(f)}
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-500 dark:hover:bg-blue-900/20" title="Editar">
                        <Pencil size={15} />
                      </button>
                      <button onClick={async () => {
                        if (!window.confirm(`Arquivar ${f.nome}? O histórico de compras dele continua no sistema.`)) return;
                        await arquivarFornecedor(f.id); carregar();
                      }} className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20" title="Arquivar">
                        <Archive size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {editandoFornecedor !== undefined && (
        <ModalFornecedor
          lojaId={lojaId}
          fornecedor={editandoFornecedor}
          onFechar={() => setEditandoFornecedor(undefined)}
          onSalvo={() => { setEditandoFornecedor(undefined); carregar(); }}
        />
      )}

      {recebendo && (
        <ModalRecebimento
          compra={recebendo}
          insumos={insumos}
          onFechar={() => setRecebendo(null)}
          onSucesso={(msg) => { setRecebendo(null); setAviso(msg); setAba('pedidos'); carregar(); }}
        />
      )}
    </div>
  );
}
