import { createContext, useContext } from 'react';

export type EscalaFonte = 'padrao' | 'grande' | 'maximo';

export interface AcessibilidadeContextData {
  escalaFonte: EscalaFonte;
  setEscalaFonte: (escala: EscalaFonte) => void;
  ciclarEscala: () => void;
}

export const AcessibilidadeContext = createContext<AcessibilidadeContextData>({} as AcessibilidadeContextData);

export const useAcessibilidade = () => useContext(AcessibilidadeContext);
