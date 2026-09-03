import { createContext, useContext } from 'react';

export type Tom = 'sucesso' | 'erro' | 'info' | 'alerta';

export const ToastContext = createContext<(msg: string, tom?: Tom) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}
