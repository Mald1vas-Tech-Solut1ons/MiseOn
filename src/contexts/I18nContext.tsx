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

    // Idioma padrao fixado no build, quando houver. Vence o `navigator` mas
    // NAO vence a escolha do usuario (o `salvo` acima), entao o seletor de
    // idioma continua mandando.
    //
    // Existe porque o E2E precisa ser deterministico: o runner do GitHub
    // Actions e en-US e a maquina de desenvolvimento e pt-BR, e a suite
    // inteira afirma texto em portugues. As tentativas de fixar isso pelo
    // Cypress (`window:before:load` gravando no localStorage e sobrescrevendo
    // `navigator.language`) funcionavam na maquina local e NAO chegavam na
    // janela do app no runner Linux — medido no proprio CI:
    // `nav=en-US ls=null html=en-US`, com os dois pins no lugar.
    //
    // O build e o unico ponto que as duas maquinas enxergam igual.
    // Em producao a variavel nao e definida e o comportamento fica identico
    // ao de antes.
    const padraoDoBuild = import.meta.env.VITE_IDIOMA_PADRAO as Idioma | undefined;
    if (padraoDoBuild === 'pt-BR' || padraoDoBuild === 'en-US') return padraoDoBuild;

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
      (DICIONARIO[idioma] as Record<string, string>)?.[chave] ||
      (DICIONARIO['pt-BR'] as Record<string, string>)?.[chave] ||
      chave,
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
