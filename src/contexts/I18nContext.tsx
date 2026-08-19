/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
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

  const t = (chave: ChaveDicionario): string => {
    return DICIONARIO[idioma]?.[chave] || DICIONARIO['pt-BR']?.[chave] || chave;
  };

  const traduzirDinamico = (texto: string): string => {
    return tDynamic(texto, idioma);
  };

  return (
    <I18nContext.Provider value={{ idioma, setIdioma, t, tDynamic: traduzirDinamico }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);
