type Tom = 'neutro' | 'primario' | 'sucesso' | 'alerta' | 'perigo' | 'info';

const tons: Record<Tom, string> = {
  neutro: 'bg-[var(--cor-destaque)] text-[var(--cor-texto-suave)]',
  primario: 'bg-[color-mix(in_srgb,var(--cor-primaria)_14%,transparent)] text-[var(--cor-primaria)]',
  sucesso: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
  alerta: 'bg-amber-500/12 text-amber-600 dark:text-amber-400',
  perigo: 'bg-red-500/12 text-red-600 dark:text-red-400',
  info: 'bg-sky-500/12 text-sky-600 dark:text-sky-400',
};

export function Badge({
  children,
  tom = 'neutro',
  className = '',
  pulsar = false,
}: {
  children: React.ReactNode;
  tom?: Tom;
  className?: string;
  pulsar?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs opacity-95 font-bold uppercase tracking-wide ${tons[tom]} ${
        pulsar ? 'animate-pulse' : ''
      } ${className}`}
    >
      {children}
    </span>
  );
}
