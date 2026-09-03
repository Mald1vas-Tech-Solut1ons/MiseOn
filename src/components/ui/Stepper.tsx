import { Check } from 'lucide-react';

export type Etapa = { id: string; rotulo: string; descricao?: string };

export function Stepper({
  etapas,
  atual,
  className = '',
}: {
  etapas: Etapa[];
  /** índice da etapa corrente (0-based); anteriores aparecem concluídas */
  atual: number;
  className?: string;
}) {
  return (
    <ol className={`flex items-center w-full ${className}`}>
      {etapas.map((e, i) => {
        const concluida = i < atual;
        const corrente = i === atual;
        return (
          <li key={e.id} className={`flex items-center ${i < etapas.length - 1 ? 'flex-1' : ''}`}>
            <div className="flex flex-col items-center gap-1.5 min-w-0">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 font-bold text-sm transition-all duration-500 ${
                  concluida
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : corrente
                      ? 'border-[var(--cor-primaria)] bg-[color-mix(in_srgb,var(--cor-primaria)_12%,transparent)] text-[var(--cor-primaria)] scale-110 shadow-[0_0_0_5px_color-mix(in_srgb,var(--cor-primaria)_14%,transparent)]'
                      : 'border-[var(--cor-borda-forte)] text-[var(--cor-texto-fraco)]'
                }`}
              >
                {concluida ? <Check size={16} strokeWidth={3} /> : i + 1}
              </div>
              <span
                className={`text-xs opacity-95 font-semibold text-center leading-tight ${
                  corrente
                    ? 'text-[var(--cor-primaria)]'
                    : concluida
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-[var(--cor-texto-fraco)]'
                }`}
              >
                {e.rotulo}
              </span>
            </div>
            {i < etapas.length - 1 && (
              <div className="relative mx-1 mb-5 h-0.5 flex-1 rounded bg-[var(--cor-borda)] overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-emerald-500 transition-all duration-700"
                  style={{ width: concluida ? '100%' : '0%' }}
                />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
