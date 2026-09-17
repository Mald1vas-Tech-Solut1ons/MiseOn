import { useCallback } from 'react';
import { useI18n } from '../../contexts/I18nContext';
import type { Txt } from '../../data/ferramentasData';

/** Escolhe o idioma de um texto bilíngue de ferramentasData.ts. */
export function useTxt() {
  const { idioma } = useI18n();
  return useCallback((t: Txt) => (idioma === 'en-US' ? t.en : t.pt), [idioma]);
}
