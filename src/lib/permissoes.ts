// Fonte única do que cada papel enxerga no painel.
// Espelha as policies de RLS da migration 20260722040000_rbac_papeis.sql —
// aqui é usabilidade (não mostrar o que vai falhar); a segurança real é no banco.

export type Papel = 'admin' | 'operador' | 'garcom' | 'entregador';

const ROTAS_POR_PAPEL: Record<Exclude<Papel, 'admin'>, string[]> = {
  operador: ['pdv', 'kds', 'mesas', 'pedidos', 'entregas', 'estoque', 'producao', 'compras', 'cardapio', 'historico', 'chat', 'ajuda', 'conta'],
  garcom: ['mesas', 'pdv', 'pedidos', 'garcom-mobile', 'ajuda', 'conta'],
  entregador: ['entregas', 'ajuda', 'conta'],
};

export const HOME_POR_PAPEL: Record<Papel, string> = {
  admin: '/admin/inicio',
  operador: '/admin/pdv',
  garcom: '/admin/mesas',
  entregador: '/admin/entregas',
};

export function podeAcessar(papel: string, pathname: string): boolean {
  if (papel === 'admin') return true;
  const permitidas = ROTAS_POR_PAPEL[papel as Exclude<Papel, 'admin'>];
  if (!permitidas) return false;
  const secao = pathname.replace(/^\/admin\/?/, '').split('/')[0];
  if (!secao) return false;
  return permitidas.includes(secao);
}
