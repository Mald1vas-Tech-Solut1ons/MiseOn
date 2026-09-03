import React, { createContext, useContext, useEffect, useState } from 'react';

type EscalaFonte = 'padrao' | 'grande' | 'maximo';

interface AcessibilidadeContextData {
  escalaFonte: EscalaFonte;
  setEscalaFonte: (escala: EscalaFonte) => void;
  ciclarEscala: () => void;
}

const AcessibilidadeContext = createContext<AcessibilidadeContextData>({} as AcessibilidadeContextData);

export const useAcessibilidade = () => useContext(AcessibilidadeContext);

export const AcessibilidadeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [escalaFonte, setEscalaFonteState] = useState<EscalaFonte>('padrao');

  useEffect(() => {
    // Carregar preferência salva
    const salva = localStorage.getItem('@MiseOn:escalaFonte') as EscalaFonte;
    if (salva && ['padrao', 'grande', 'maximo'].includes(salva)) {
      setEscalaFonte(salva);
    } else {
      aplicarEscala('padrao');
    }
  }, []);

  const aplicarEscala = (escala: EscalaFonte) => {
    const root = document.documentElement;
    if (escala === 'maximo') {
      root.style.fontSize = '120%'; // Tudo cresce 20%
    } else if (escala === 'grande') {
      root.style.fontSize = '110%'; // Tudo cresce 10%
    } else {
      root.style.fontSize = '100%'; // Base padrao do navegador (16px)
    }
  };

  const setEscalaFonte = (escala: EscalaFonte) => {
    setEscalaFonteState(escala);
    aplicarEscala(escala);
    localStorage.setItem('@MiseOn:escalaFonte', escala);
  };

  const ciclarEscala = () => {
    if (escalaFonte === 'padrao') setEscalaFonte('grande');
    else if (escalaFonte === 'grande') setEscalaFonte('maximo');
    else setEscalaFonte('padrao');
  };

  return (
    <AcessibilidadeContext.Provider value={{ escalaFonte, setEscalaFonte, ciclarEscala }}>
      {children}
    </AcessibilidadeContext.Provider>
  );
};
