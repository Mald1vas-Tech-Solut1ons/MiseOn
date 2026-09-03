import { Type as TypeIcon } from 'lucide-react';
import { useAcessibilidade } from '../../contexts/AcessibilidadeContext';

export function AcessibilidadeToggle() {
  const { escalaFonte, ciclarEscala } = useAcessibilidade();

  return (
    <button
      onClick={ciclarEscala}
      title={`Tamanho da fonte: ${escalaFonte === 'padrao' ? 'Padrão' : escalaFonte === 'grande' ? 'Grande' : 'Máximo'}`}
      className={`relative rounded-full p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${
        escalaFonte !== 'padrao' ? 'text-amber-500' : 'text-gray-600 dark:text-gray-300'
      }`}
    >
      <TypeIcon size={20} strokeWidth={2.5} />
      {escalaFonte !== 'padrao' && (
        <span className="absolute right-1 top-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-amber-500 text-xs opacity-80 font-bold text-white shadow-sm ring-2 ring-white dark:ring-gray-900">
          +
        </span>
      )}
    </button>
  );
}
