import { Store, UtensilsCrossed, Unlock, Lock, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { fmt } from '../../types';
import type { HeaderBarProps } from '../../types';
import { useI18n } from '../../contexts/I18nContext';

export function HeaderBar({ modo, setModo, turno, dinheiroGaveta, setModalCaixa, setValorCaixa }: HeaderBarProps) {
  const { tDynamic } = useI18n();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-2.5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-black dark:text-gray-100">PDV</h2>
        <div className="flex rounded-xl bg-gray-100 p-0.5 dark:bg-gray-800">
          <button onClick={() => setModo('BALCAO')} className={`flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-bold transition ${modo === 'BALCAO' ? 'bg-white text-[var(--cor-primaria)] shadow-sm dark:bg-gray-900' : 'text-gray-500'}`}>
            <Store size={13} /> {tDynamic('Balcão')}
          </button>
          <button onClick={() => setModo('MESA')} className={`flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-xs font-bold transition ${modo === 'MESA' ? 'bg-white text-[var(--cor-primaria)] shadow-sm dark:bg-gray-900' : 'text-gray-500'}`}>
            <UtensilsCrossed size={13} /> {tDynamic('Mesa')}
          </button>
        </div>
        {turno ? (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs opacity-95 font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            <Unlock size={11} /> {tDynamic('Caixa aberto')} · {tDynamic('gaveta')} {fmt(dinheiroGaveta)}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs opacity-95 font-bold text-red-600 dark:bg-red-900/30 dark:text-red-400">
            <Lock size={11} /> {tDynamic('Caixa fechado')}
          </span>
        )}
      </div>
      <div className="flex gap-1.5">
        {turno ? (
          <>
            <button onClick={() => setModalCaixa('SANGRIA')} className="flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 dark:border-gray-700 dark:text-gray-300"><ArrowDownCircle size={13} /> {tDynamic('Sangria')}</button>
            <button onClick={() => setModalCaixa('REFORCO')} className="flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 dark:border-gray-700 dark:text-gray-300"><ArrowUpCircle size={13} /> {tDynamic('Reforço')}</button>
            <button onClick={() => { setValorCaixa(''); setModalCaixa('FECHAR'); }} className="flex items-center gap-1 rounded-xl bg-gray-900 px-3 py-1.5 text-xs font-bold text-white dark:bg-gray-700"><Lock size={13} /> {tDynamic('Fechar caixa')}</button>
          </>
        ) : (
          <button onClick={() => setModalCaixa('ABRIR')} className="flex items-center gap-1 rounded-xl bg-[var(--cor-primaria)] px-4 py-1.5 text-xs font-bold text-white"><Unlock size={13} /> {tDynamic('Abrir caixa')}</button>
        )}
      </div>
    </div>
  );
}
