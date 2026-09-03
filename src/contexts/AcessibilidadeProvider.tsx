import React, { useCallback, useEffect, useState } from 'react';
import { AcessibilidadeContext, EscalaFonte } from './AcessibilidadeContext';

export const AcessibilidadeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [escalaFonte, setEscalaFonteState] = useState<EscalaFonte>('padrao');

  const aplicarEscala = useCallback((escala: EscalaFonte) => {
    const root = document.documentElement;
    if (escala === 'maximo') {
      root.style.fontSize = '120%';
    } else if (escala === 'grande') {
      root.style.fontSize = '110%';
    } else {
      root.style.fontSize = '100%';
    }
  }, []);

  const setEscalaFonte = useCallback((escala: EscalaFonte) => {
    setEscalaFonteState(escala);
    aplicarEscala(escala);
    localStorage.setItem('@MiseOn:escalaFonte', escala);
  }, [aplicarEscala]);

  useEffect(() => {
    const salva = localStorage.getItem('@MiseOn:escalaFonte') as EscalaFonte;
    if (salva && ['padrao', 'grande', 'maximo'].includes(salva)) {
      setEscalaFonte(salva);
    } else {
      aplicarEscala('padrao');
    }
  }, [setEscalaFonte, aplicarEscala]);

  const ciclarEscala = useCallback(() => {
    if (escalaFonte === 'padrao') setEscalaFonte('grande');
    else if (escalaFonte === 'grande') setEscalaFonte('maximo');
    else setEscalaFonte('padrao');
  }, [escalaFonte, setEscalaFonte]);

  return (
    <AcessibilidadeContext.Provider value={{ escalaFonte, setEscalaFonte, ciclarEscala }}>
      {children}
    </AcessibilidadeContext.Provider>
  );
};
