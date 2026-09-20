import { AlertTriangle, RefreshCw, Search } from 'lucide-react';
import { fmt } from '../../types';
import type { ProductGridProps } from '../../types';
import { HorizontalScrollContainer } from '../ui';
import { useI18n } from '../../contexts/I18nContext';

export function ProductGrid({ busca, setBusca, categorias, catAtiva, setCatAtiva, produtosVisiveis, tocarProduto, carregando, erro, onTentarNovamente }: ProductGridProps) {
  const { tDynamic } = useI18n();
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-[#0B1120]">
      <div className="flex items-center gap-2 p-3 pb-0">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto…"
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[var(--cor-primaria)] dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100" />
        </div>
      </div>
      <HorizontalScrollContainer className="p-3 pb-2">
        <button type="button" 
          onClick={() => setCatAtiva('TODAS')} 
          className={`shrink-0 rounded-full px-5 py-2 text-xs font-bold transition-all duration-300 border ${
            catAtiva === 'TODAS' 
              ? 'bg-[var(--cor-primaria)] text-white border-[var(--cor-primaria)] shadow-[0_4px_12px_rgba(252,91,36,0.3)]' 
              : 'bg-white/80 dark:bg-white/5 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 hover:bg-gray-50 dark:hover:bg-white/10 shadow-sm backdrop-blur-md'
          }`}
        >
          TODAS
        </button>
        {categorias.map((c) => (
          <button type="button" 
            key={c.id} 
            onClick={() => setCatAtiva(c.id)} 
            className={`shrink-0 rounded-full px-5 py-2 text-xs font-bold uppercase transition-all duration-300 border ${
              catAtiva === c.id 
                ? 'bg-[var(--cor-primaria)] text-white border-[var(--cor-primaria)] shadow-[0_4px_12px_rgba(252,91,36,0.3)]' 
                : 'bg-white/80 dark:bg-white/5 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 hover:bg-gray-50 dark:hover:bg-white/10 shadow-sm backdrop-blur-md'
            }`}
          >
            {c.nome}
          </button>
        ))}
      </HorizontalScrollContainer>
      <div className="grid flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto p-4 pb-28 pt-2 sm:grid-cols-3 lg:pb-4 xl:grid-cols-4 custom-scrollbar">
        {carregando && (
          <div className="col-span-full flex items-center justify-center gap-2 py-14 text-sm font-semibold text-gray-500 dark:text-gray-400">
            <RefreshCw size={17} className="animate-spin" /> {tDynamic('Carregando catálogo do PDV…')}
          </div>
        )}
        {!carregando && erro && (
          <div role="alert" className="col-span-full rounded-2xl border border-red-300 bg-red-50 p-5 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-black">{tDynamic('O catálogo do PDV não pôde ser carregado')}</p>
                <p className="mt-1 text-sm leading-relaxed">{erro}</p>
                {onTentarNovamente && (
                  <button type="button" onClick={onTentarNovamente} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-red-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-red-800">
                    <RefreshCw size={14} /> {tDynamic('Tentar novamente')}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        {!carregando && !erro && produtosVisiveis.map((p) => (
          <button type="button" 
            key={p.id} 
            onClick={() => tocarProduto(p)}
            className="group relative flex min-h-[110px] flex-col items-start justify-between rounded-2xl border border-gray-200/50 bg-white/70 p-4 text-left shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[var(--cor-primaria)]/10 hover:border-[var(--cor-primaria)]/30 active:scale-[0.97] active:shadow-md dark:border-white/10 dark:bg-[#070C18]/40 dark:hover:border-[var(--cor-primaria)]/50 overflow-hidden"
          >
            {/* Brilho interno no hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--cor-primaria)]/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />
            
            <div className="flex items-center gap-1.5 z-10">
              <span className="text-[13px] font-bold leading-snug text-gray-800 dark:text-gray-100 group-hover:text-[var(--cor-primaria)] transition-colors duration-300">
                {p.nome.toUpperCase()}
              </span>
              {p.tipo_venda === 'POR_PESO' && (
                <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-xs opacity-80 font-black text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                  R$/KG
                </span>
              )}
            </div>
            <span className="mt-3 text-[15px] font-black text-[var(--cor-primaria)] drop-shadow-sm z-10">
              {p.tipo_venda === 'POR_PESO' ? `${fmt(Number(p.preco_por_quilo || 0))}/kg` : fmt(Number(p.preco))}
            </span>
          </button>
        ))}
        {!carregando && !erro && produtosVisiveis.length === 0 && <p className="col-span-full py-10 text-center text-sm font-medium text-gray-400">{tDynamic('Nenhum produto encontrado para esta categoria ou busca.')}</p>}
      </div>
    </div>
  );
}
