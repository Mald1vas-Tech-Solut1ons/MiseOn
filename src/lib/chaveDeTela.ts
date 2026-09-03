/**
 * Chave de remontagem da animacao de troca de tela.
 *
 * Rotas com layout proprio e persistente (sidebar, cabecalho, sessao, canais
 * realtime) precisam de chave FIXA: se a chave mudar a cada rota, o React
 * destroi e recria o layout inteiro em toda navegacao. Foi exatamente o que
 * acontecia — a sidebar virava outro no DOM, o scroll voltava pro topo, o item
 * ativo do modulo sumia junto e a sessao era consultada de novo no banco.
 *
 * Cada um desses layouts anima o proprio <Outlet/> por rota, entao a transicao
 * continua acontecendo — sem levar o layout embora.
 */
export const RAIZES_COM_LAYOUT_PERSISTENTE = ['/admin', '/superadmin', '/entregador'];

export function chaveDeTela(pathname: string): string {
  const raiz = RAIZES_COM_LAYOUT_PERSISTENTE.find(
    (r) => pathname === r || pathname.startsWith(`${r}/`),
  );
  return raiz ?? pathname;
}
