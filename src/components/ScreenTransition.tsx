import { useInRouterContext, useLocation } from 'react-router-dom';
import { chaveDeTela } from '../lib/chaveDeTela';

/**
 * Envolve a tela e refaz a animacao de entrada a cada troca de rota.
 *
 * A chave vem de `routeKey` quando informada; senao, de `chaveDeTela`.
 * `useLocation` so pode ser chamado dentro de um Router, entao a leitura fica
 * num subcomponente proprio: chamar o hook condicionalmente (dentro de if/try)
 * muda a ordem dos hooks entre renders e quebra o React.
 */

function TelaPorRota({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return <div key={chaveDeTela(pathname)} className="mo-screen">{children}</div>;
}

export function ScreenTransition({
  children,
  routeKey,
}: {
  children: React.ReactNode;
  routeKey?: string;
}) {
  // Hook incondicional: seguro de chamar dentro ou fora do Router.
  const dentroDoRouter = useInRouterContext();

  if (routeKey !== undefined) {
    return <div key={routeKey} className="mo-screen">{children}</div>;
  }
  if (dentroDoRouter) {
    return <TelaPorRota>{children}</TelaPorRota>;
  }
  return <div key="default" className="mo-screen">{children}</div>;
}

export default ScreenTransition;
