/**
 * Aba "Custo 3D" do Estoque: Painel de Observabilidade Físico-Financeira 3D.
 *
 * Funcionalidades Sênior:
 *  - Realtime: Atualiza automaticamente via WebSocket Supabase Postgres Changes.
 *  - Filtro por Categoria: Isola árvores de Ingredientes, Bebidas, Embalagens, etc.
 *  - Painel Executivo de KPIs: Exibe total investido, lotes ativos e itens críticos.
 *  - Legenda Físico-Mapeada: Traduz formas 3D em analogia de estoque real (Volume, Densidade, Dutos).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Boxes, AlertTriangle, RefreshCw, Info, ChevronDown, ChevronUp, Layers, Flame, DollarSign, Package } from 'lucide-react';
import { supabase } from '../supabase';
import { CostGraph3D } from './CostGraph3D';
import { carregarGrafoDaLoja } from './carregarGrafo';
import type { GrafoCusto, NoCusto } from './types';

import { useI18n } from '../../contexts/I18nContext';
/** Debounce em ms antes de remontar o grafo após um evento Realtime. */
const DEBOUNCE_REBUILD_MS = 800;

export function EstoqueCusto3D({ lojaId }: { lojaId: string }) {
  const { tDynamic } = useI18n();
  const [grafo, setGrafo]             = useState<GrafoCusto | null>(null);
  const [erro, setErro]               = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null);
  const [mostrarGuiaFisica, setMostrarGuiaFisica] = useState(false);
  const debounceRef                   = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Reconstrói o grafo a partir do banco. */
  const rebuild = useCallback(
    async (silencioso = false) => {
      if (!silencioso) { setGrafo(null); setErro(null); }
      else setAtualizando(true);
      try {
        const g = await carregarGrafoDaLoja(lojaId);
        setGrafo(g);
        setErro(null);
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e));
      } finally {
        setAtualizando(false);
      }
    },
    [lojaId],
  );

  /** Agenda um rebuild com debounce. */
  const agendarRebuild = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => rebuild(true), DEBOUNCE_REBUILD_MS);
  }, [rebuild]);

  // Carga inicial
  useEffect(() => {
    let vivo = true;
    setGrafo(null);
    setErro(null);
    carregarGrafoDaLoja(lojaId)
      .then((g) => { if (vivo) setGrafo(g); })
      .catch((e) => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); });
    return () => { vivo = false; };
  }, [lojaId]);

  // Supabase Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`custo3d-loja-${lojaId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'insumos', filter: `loja_id=eq.${lojaId}` },
        agendarRebuild,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lotes_estoque', filter: `loja_id=eq.${lojaId}` },
        agendarRebuild,
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [lojaId, agendarRebuild]);

  // Categorias únicas presentes no grafo
  const categoriasUnicas = useMemo(() => {
    if (!grafo) return [];
    const set = new Set<string>();
    for (const r of grafo.raizes) {
      if (r.categoria) set.add(r.categoria);
    }
    return Array.from(set);
  }, [grafo]);

  // Grafo filtrado pela categoria selecionada
  const grafoFiltrado = useMemo(() => {
    if (!grafo) return null;
    if (!filtroCategoria) return grafo;

    const raizesFiltradas = grafo.raizes.filter((r) => r.categoria === filtroCategoria);
    const nosFiltrados: NoCusto[] = [];
    const idsVisiveis = new Set<string>();

    function coletar(no: NoCusto) {
      idsVisiveis.add(no.id);
      nosFiltrados.push(no);
      no.filhos.forEach(coletar);
    }
    raizesFiltradas.forEach(coletar);

    const arestasFiltradas: Array<[number, number]> = [];

    for (const [a, b] of grafo.arestas) {
      const noA = grafo.nos[a];
      const noB = grafo.nos[b];
      if (noA && noB && idsVisiveis.has(noA.id) && idsVisiveis.has(noB.id)) {
        const novoA = nosFiltrados.indexOf(noA);
        const novoB = nosFiltrados.indexOf(noB);
        if (novoA !== -1 && novoB !== -1) {
          arestasFiltradas.push([novoA, novoB]);
        }
      }
    }

    return {
      raizes: raizesFiltradas,
      nos: nosFiltrados,
      arestas: arestasFiltradas,
    };
  }, [grafo, filtroCategoria]);

  // Cálculo dos KPIs Operacionais
  const kpis = useMemo(() => {
    if (!grafo) return null;
    const raizesAnalise = filtroCategoria ? grafo.raizes.filter((r) => r.categoria === filtroCategoria) : grafo.raizes;
    const nosAnalise = filtroCategoria && grafoFiltrado ? grafoFiltrado.nos : grafo.nos;

    const totalInvestido = raizesAnalise.reduce((acc, r) => acc + r.custoAlocado, 0);
    const totalLotes = raizesAnalise.length;

    let maiorCustoUnitarioItem: NoCusto | null = null;
    let maiorConcentracaoItem: NoCusto | null = null;

    for (const n of nosAnalise) {
      if (!maiorCustoUnitarioItem || n.custoUnitario > maiorCustoUnitarioItem.custoUnitario) {
        maiorCustoUnitarioItem = n;
      }
      if (!maiorConcentracaoItem || n.custoAlocado > maiorConcentracaoItem.custoAlocado) {
        maiorConcentracaoItem = n;
      }
    }

    return {
      totalInvestido,
      totalLotes,
      maiorCustoUnitarioItem,
      maiorConcentracaoItem,
    };
  }, [grafo, filtroCategoria, grafoFiltrado]);

  // Estados de erro / vazio
  if (erro) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:bg-red-900/20 dark:border-red-900/50 flex items-start gap-3">
        <AlertTriangle className="text-red-500 shrink-0" size={20} />
        <div>
          <p className="font-bold text-red-800 dark:text-red-300">{tDynamic('Não foi possível montar o grafo 3D')}</p>
          <p className="text-sm text-red-700 dark:text-red-400 mt-1">{erro}</p>
        </div>
      </div>
    );
  }

  if (!grafo || !kpis || !grafoFiltrado) {
    return (
      <div className="h-[520px] rounded-2xl bg-gray-100 dark:bg-gray-800/40 animate-pulse flex items-center justify-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">{tDynamic('Montando a árvore física de custos…')}</p>
      </div>
    );
  }

  if (grafo.nos.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-10 text-center">
        <Boxes className="mx-auto text-gray-400 mb-3" size={32} />
        <p className="font-bold dark:text-gray-200">{tDynamic('Nenhum lote de estoque com custo')}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
          {tDynamic('A árvore 3D ganha vida quando houver entradas de estoque com preço. Registre uma compra em &quot;+ Entrada&quot;.')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Header + Live Realtime Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-black text-xl text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Boxes size={22} className="text-blue-500" /> Observabilidade 3D de Estoque Físico
            {atualizando && (
              <span className="flex items-center gap-1 text-xs opacity-95 font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full animate-pulse">
                <RefreshCw size={11} className="animate-spin" /> {tDynamic('Atualizando ao vivo…')}
              </span>
            )}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {tDynamic('Mapeamento tridimensional dos lotes físicos em estoque e suas esteiras de conversão.')}
          </p>
        </div>

        <button
          data-tour="tour-estoque-3d-legenda"
          onClick={() => setMostrarGuiaFisica((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800/50 transition-colors"
        >
          <Info size={14} /> Analogia do Mundo Físico {mostrarGuiaFisica ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Painel Retrátil de Instruções & Analogia Físico-Mapeada */}
      {mostrarGuiaFisica && (
        <div className="bg-gradient-to-r from-gray-900 via-gray-900 to-slate-900 text-white rounded-2xl p-4 shadow-lg border border-gray-800 space-y-3 animate-in fade-in slide-in-from-top-2">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
            <Package size={14} /> Como Interpretar o Grafo Tridimensional:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
              <span className="font-bold text-blue-300 block mb-1">⚽ Tamanho da Esfera</span>
              <p className="text-gray-300 text-xs opacity-95">Representa a <b>quantidade física em depósito</b>. Esferas maiores retêm mais volume físico.</p>
            </div>
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
              <span className="font-bold text-emerald-300 block mb-1">🌡️ Escala de Temperatura</span>
              <p className="text-gray-300 text-xs opacity-95">🟢 Custo unitário econômico $\to$ 🟡 Moderado $\to$ 🔴 Alta densidade financeira/unidade.</p>
            </div>
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
              <span className="font-bold text-amber-300 block mb-1">🔗 Dutos de Conversão</span>
              <p className="text-gray-300 text-xs opacity-95">Conectam a <b>compra original</b> (raiz) às suas frações físicas (ex: Caixa $\to$ Unidade $\to$ Fatia).</p>
            </div>
            <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
              <span className="font-bold text-purple-300 block mb-1">✨ Brilho Pulsante</span>
              <p className="text-gray-300 text-xs opacity-95">Indica <b>compras recentes</b> (últimos 7 dias) que estão entrando na esteira de produção.</p>
            </div>
          </div>
        </div>
      )}

      {/* Painel Executivo de KPIs da Operação */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-900 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs opacity-90 font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <DollarSign size={12} className="text-green-500" /> Capital Investido
          </p>
          <p className="text-lg font-black text-green-700 dark:text-green-400 mt-1">
            {kpis.totalInvestido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
          <p className="text-xs opacity-90 text-gray-400 mt-0.5">{kpis.totalLotes} lotes ativos em estoque</p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs opacity-90 font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <Layers size={12} className="text-blue-500" /> Lotes Mapeados
          </p>
          <p className="text-lg font-black text-gray-900 dark:text-gray-100 mt-1">
            {kpis.totalLotes} <span className="text-xs font-normal text-gray-500">lotes</span>
          </p>
          <p className="text-xs opacity-90 text-gray-400 mt-0.5">Em {filtroCategoria ?? 'todas as categorias'}</p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs opacity-90 font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <Flame size={12} className="text-red-500" /> {tDynamic('Maior Custo Unitário')}
          </p>
          <p className="text-sm font-black text-red-600 dark:text-red-400 mt-1 truncate" title={kpis.maiorCustoUnitarioItem?.rotulo}>
            {kpis.maiorCustoUnitarioItem?.rotulo.split('(')[0] ?? 'N/A'}
          </p>
          <p className="text-xs opacity-95 font-bold text-gray-700 dark:text-gray-300">
            {kpis.maiorCustoUnitarioItem ? `${kpis.maiorCustoUnitarioItem.custoUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 })}/${kpis.maiorCustoUnitarioItem.unidade}` : '—'}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <p className="text-xs opacity-90 font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <Package size={12} className="text-amber-500" /> {tDynamic('Maior Alocação')}
          </p>
          <p className="text-sm font-black text-amber-600 dark:text-amber-400 mt-1 truncate" title={kpis.maiorConcentracaoItem?.rotulo}>
            {kpis.maiorConcentracaoItem?.rotulo.split('(')[0] ?? 'N/A'}
          </p>
          <p className="text-xs opacity-95 font-bold text-gray-700 dark:text-gray-300">
            {kpis.maiorConcentracaoItem ? kpis.maiorConcentracaoItem.custoAlocado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
          </p>
        </div>
      </div>

      {/* Barra de Filtros por Categoria */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 shrink-0">Filtrar Categoria:</span>
        <button
          onClick={() => setFiltroCategoria(null)}
          className={`shrink-0 px-3.5 py-1 rounded-full text-xs font-bold transition-all ${!filtroCategoria ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'}`}
        >
          Tudo ({grafo.raizes.length})
        </button>
        {categoriasUnicas.map((cat) => {
          const qtd = grafo.raizes.filter((r) => r.categoria === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setFiltroCategoria(cat)}
              className={`shrink-0 px-3.5 py-1 rounded-full text-xs font-bold transition-all ${filtroCategoria === cat ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'}`}
            >
              {cat} ({qtd})
            </button>
          );
        })}
      </div>

      {/* Renderizador Canvas WebGL 3D */}
      <div data-tour="tour-estoque-3d-canvas" className="relative rounded-2xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-800">
        <CostGraph3D grafo={grafoFiltrado} altura={520} />
      </div>
    </div>
  );
}

export default EstoqueCusto3D;


