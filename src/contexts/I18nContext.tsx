/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Idioma, DICIONARIO, ChaveDicionario, tDynamic } from '../data/i18nData';

export type { Idioma, ChaveDicionario };

interface I18nContextType {
  idioma: Idioma;
  setIdioma: (idioma: Idioma) => void;
  t: (chave: ChaveDicionario) => string;
  tDynamic: (texto: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  idioma: 'pt-BR',
  setIdioma: () => {},
  t: (chave) => DICIONARIO['pt-BR'][chave] || chave,
  tDynamic: (texto) => texto,
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [idioma, setIdiomaState] = useState<Idioma>(() => {
    const salvo = localStorage.getItem('miseon_idioma') as Idioma;
    if (salvo === 'pt-BR' || salvo === 'en-US') return salvo;
    if (navigator.language.startsWith('en')) return 'en-US';
    return 'pt-BR';
  });

  const setIdioma = (novoIdioma: Idioma) => {
    setIdiomaState(novoIdioma);
    localStorage.setItem('miseon_idioma', novoIdioma);
  };

  useEffect(() => {
    document.documentElement.lang = idioma;
  }, [idioma]);

  // `t` e `tDynamic` entram em array de dependência de useEffect/useCallback
  // pelas telas (PainelTV, por exemplo). Recriadas a cada render do provider,
  // mudavam de identidade toda vez e reexecutavam esses efeitos sem motivo —
  // no Painel de TV isso chega a repetir a chamada de voz da senha.
  // Com useCallback, só mudam quando o idioma muda de verdade.
  const t = useCallback(
    (chave: ChaveDicionario): string =>
      DICIONARIO[idioma]?.[chave] || DICIONARIO['pt-BR']?.[chave] || chave,
    [idioma],
  );

  const traduzirDinamico = useCallback(
    (texto: string): string => tDynamic(texto, idioma),
    [idioma],
  );

  // O value também precisa ser estável: um objeto novo a cada render faz todo
  // consumidor do contexto re-renderizar, mesmo sem troca de idioma.
  const valor = useMemo(
    () => ({ idioma, setIdioma, t, tDynamic: traduzirDinamico }),
    [idioma, t, traduzirDinamico],
  );

  return <I18nContext.Provider value={valor}>{children}</I18nContext.Provider>;
};

export const useI18n = () => useContext(I18nContext);
