import { useLocation } from 'react-router-dom';
import './brand.css';

/**
 * Transição de telas MiseOn — anima a entrada de cada rota (fade + slide).
 * Como você usa react-router, envolva o conteúdo que troca por rota.
 *
 * Uso com react-router:
 *   <ScreenTransition>
 *     <Routes> ... </Routes>
 *   </ScreenTransition>
 *
 * A `key` no location faz o React remontar e reanimar a cada mudança de URL.
 * Sem react-router, passe uma `routeKey` própria (ex.: aba ativa).
 */
export function ScreenTransition({
  children,
  routeKey,
}: {
  children: React.ReactNode;
  routeKey?: string;
}) {
  let key = routeKey;
  try {
    // se estiver dentro de um <Router>, usa o pathname
    // (envolto em try para não quebrar fora de contexto de rota)
    // eslint-disable-next-line react-hooks/rules-of-hooks
    key = key ?? useLocation().pathname;
  } catch {
    key = key ?? 'default';
  }
  return (
    <div key={key} className="mo-screen">
      {children}
    </div>
  );
}

export default ScreenTransition;
