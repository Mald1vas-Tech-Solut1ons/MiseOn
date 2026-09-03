import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, ChevronDown, LifeBuoy, X } from 'lucide-react';
import type { ErroTraduzido } from '../../lib/erros';

import { useI18n } from '../../contexts/I18nContext';
/**
 * Cartão de erro para usuário leigo: título humano, explicação do que
 * aconteceu, o que fazer (com link quando existir) e o detalhe técnico
 * recolhido para repassar ao suporte.
 */
export function ErroAmigavel({ erro, onFechar }: { erro: ErroTraduzido; onFechar: () => void }) {
  const { tDynamic } = useI18n();
  const [tecnicoAberto, setTecnicoAberto] = useState(false);

  return (
    <div
      role="alert"
      className="overflow-hidden rounded-2xl border border-red-200 bg-red-50 shadow-sm dark:border-red-900/40 dark:bg-red-900/10"
      style={{ animation: 'mo-screen-in .3s cubic-bezier(.2,.8,.2,1) both' }}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
          <AlertTriangle size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-['Sora'] text-sm font-black text-red-800 dark:text-red-300">{erro.titulo}</h3>
            <button
              onClick={onFechar}
              aria-label="Fechar aviso"
              className="shrink-0 rounded-lg p-1 text-red-400 transition hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40"
            >
              <X size={16} />
            </button>
          </div>

          <p className="mt-1 text-[13px] leading-relaxed text-red-700/90 dark:text-red-300/80">
            {erro.explicacao}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-xl bg-white/70 px-3 py-2.5 dark:bg-white/5">
            <span className="text-xs opacity-95 font-black uppercase tracking-wide text-red-500 dark:text-red-400">
              O que fazer
            </span>
            <p className="w-full text-[13px] font-semibold leading-relaxed text-gray-700 dark:text-gray-200">
              {erro.acao}
            </p>
            {erro.link && (
              <Link
                to={erro.link.para}
                className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-black text-white shadow-sm transition hover:bg-red-700"
              >
                {erro.link.rotulo} <ArrowRight size={13} />
              </Link>
            )}
          </div>

          <button
            onClick={() => setTecnicoAberto((v) => !v)}
            className="mt-2 flex items-center gap-1 text-xs opacity-95 font-semibold text-red-400 transition hover:text-red-600 dark:hover:text-red-300"
          >
            <LifeBuoy size={12} />
            {tDynamic('Detalhe técnico para o suporte')}
            <ChevronDown size={12} className={`transition-transform ${tecnicoAberto ? 'rotate-180' : ''}`} />
          </button>
          {tecnicoAberto && (
            <p className="mt-1.5 select-all break-all rounded-lg bg-white/70 px-2.5 py-2 font-['JetBrains_Mono'] text-xs opacity-95 text-gray-500 dark:bg-white/5 dark:text-gray-400">
              {erro.tecnico}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
