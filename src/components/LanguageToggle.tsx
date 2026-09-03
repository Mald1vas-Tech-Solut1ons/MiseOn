import React from 'react';
import { Globe, Check } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';

interface LanguageToggleProps {
  variant?: 'pill' | 'dropdown' | 'minimal';
  className?: string;
}

export default function LanguageToggle({ variant = 'pill', className = '' }: LanguageToggleProps) {
  const { idioma, setIdioma } = useI18n();
  const [open, setOpen] = React.useState(false);

  const toggleLanguage = () => {
    setIdioma(idioma === 'pt-BR' ? 'en-US' : 'pt-BR');
  };

  if (variant === 'minimal') {
    return (
      <button
        onClick={toggleLanguage}
        title={idioma === 'pt-BR' ? 'Switch to English' : 'Mudar para Português'}
        aria-label="Alternar Idioma"
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition hover:bg-gray-100 dark:hover:bg-white/10 ${className}`}
      >
        <Globe size={14} className="text-[#FC5B24]" />
        <span className="font-semibold">{idioma === 'pt-BR' ? 'PT' : 'EN'}</span>
      </button>
    );
  }

  if (variant === 'dropdown') {
    return (
      <div className="relative inline-block text-left">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`flex items-center gap-2 rounded-full border border-gray-200 bg-white/80 px-3 py-1.5 text-xs font-bold text-gray-700 shadow-sm backdrop-blur-md transition hover:border-[#FC5B24] dark:border-white/15 dark:bg-[#0B1120]/80 dark:text-slate-200 ${className}`}
        >
          <Globe size={14} className="text-[#FC5B24]" />
          <span>{idioma === 'pt-BR' ? 'Português (BR)' : 'English (US)'}</span>
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-44 rounded-2xl border border-gray-200 bg-white/95 p-1.5 shadow-2xl backdrop-blur-xl dark:border-white/15 dark:bg-[#0B1120]/95 z-50">
            <button
              onClick={() => { setIdioma('pt-BR'); setOpen(false); }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition ${
                idioma === 'pt-BR' ? 'bg-[#FC5B24]/10 text-[#FC5B24]' : 'text-gray-700 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-white/10'
              }`}
            >
              <span className="flex items-center gap-2">🇧🇷 Português</span>
              {idioma === 'pt-BR' && <Check size={14} />}
            </button>
            <button
              onClick={() => { setIdioma('en-US'); setOpen(false); }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition ${
                idioma === 'en-US' ? 'bg-[#FC5B24]/10 text-[#FC5B24]' : 'text-gray-700 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-white/10'
              }`}
            >
              <span className="flex items-center gap-2">🇺🇸 English</span>
              {idioma === 'en-US' && <Check size={14} />}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Pill por padrão
  return (
    <div className={`inline-flex items-center rounded-full border border-gray-200/80 bg-gray-100/80 p-0.5 backdrop-blur-md dark:border-white/15 dark:bg-white/5 ${className}`}>
      <button
        onClick={() => setIdioma('pt-BR')}
        className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs opacity-95 font-bold transition ${
          idioma === 'pt-BR'
            ? 'bg-[#FC5B24] text-white shadow-md'
            : 'text-gray-600 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white'
        }`}
      >
        <span>🇧🇷</span> PT
      </button>
      <button
        onClick={() => setIdioma('en-US')}
        className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs opacity-95 font-bold transition ${
          idioma === 'en-US'
            ? 'bg-[#FC5B24] text-white shadow-md'
            : 'text-gray-600 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white'
        }`}
      >
        <span>🇺🇸</span> EN
      </button>
    </div>
  );
}
