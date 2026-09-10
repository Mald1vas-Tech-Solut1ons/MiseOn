import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { aplicarTemaSalvo, alternarTema } from '../lib/tema';

export default function ThemeToggle({ className }: { className?: string }) {
  const [escuro, setEscuro] = useState(false);
  useEffect(() => { setEscuro(aplicarTemaSalvo()); }, []);

  return (
    <button type="button"
      onClick={() => setEscuro(alternarTema())}
      title="Alternar tema claro/escuro"
      aria-label="Alternar tema claro ou escuro"
      className={className ?? 'rounded-full border border-gray-200 dark:border-gray-800 p-2 text-gray-500 dark:text-gray-400 dark:border-gray-700 dark:text-gray-300'}
    >
      {escuro ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
