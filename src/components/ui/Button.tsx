import { Loader2 } from 'lucide-react';
import { forwardRef } from 'react';

type Variant = 'primario' | 'secundario' | 'fantasma' | 'perigo' | 'sucesso';
type Size = 'sm' | 'md' | 'lg';

const variantes: Record<Variant, string> = {
  primario:
    'text-white shadow-lg bg-[linear-gradient(135deg,var(--cor-primaria),color-mix(in_srgb,var(--cor-primaria)_78%,black))] hover:brightness-110 shadow-[color-mix(in_srgb,var(--cor-primaria)_35%,transparent)]',
  secundario:
    'text-[var(--cor-texto)] dark:text-[var(--cor-texto-claro)] border border-[var(--cor-borda)] bg-[var(--cor-surface)] hover:border-[var(--cor-primaria)]',
  fantasma:
    'text-[var(--cor-texto-suave)] hover:text-[var(--cor-primaria)] hover:bg-[var(--cor-destaque)]',
  perigo: 'text-white bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/30',
  sucesso: 'text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/30',
};

const tamanhos: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-4 py-2.5 text-sm rounded-xl gap-2',
  lg: 'px-6 py-3.5 text-base rounded-2xl gap-2.5',
};

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    size?: Size;
    carregando?: boolean;
    icone?: React.ReactNode;
  }
>(function Button(
  { variant = 'primario', size = 'md', carregando, icone, className = '', children, disabled, ...rest },
  ref,
) {
  return (
    <button type="button"
      ref={ref}
      disabled={disabled || carregando}
      className={`inline-flex items-center justify-center font-semibold transition-all duration-150 active:scale-[.97] disabled:opacity-50 disabled:pointer-events-none ${variantes[variant]} ${tamanhos[size]} ${className}`}
      {...rest}
    >
      {carregando ? <Loader2 className="animate-spin" size={size === 'lg' ? 20 : 16} /> : icone}
      {children}
    </button>
  );
});
