/**
 * A existência de uma linha em `pedidos` não significa que a loja já recebeu
 * um pedido. No checkout online ela também representa a intenção de compra
 * enquanto o gateway ainda não confirmou o pagamento.
 */
export type PedidoComStatus = { status?: string | null };

export const pedidoEstaNaOperacao = (pedido: PedidoComStatus | null | undefined) =>
  !!pedido?.status && pedido.status !== 'AGUARDANDO_PAGAMENTO';

/**
 * Evento que deve soar e criar notificação para a loja. Para pagamento online
 * ele acontece no UPDATE AGUARDANDO_PAGAMENTO → ACEITO; para dinheiro/PDV,
 * que já nasce operacional, acontece no INSERT.
 */
export const pedidoAcabouDeEntrarNaOperacao = (
  anterior: PedidoComStatus | null | undefined,
  atual: PedidoComStatus | null | undefined,
) => !!atual?.status && ['NOVO', 'ACEITO', 'PREPARANDO'].includes(atual.status)
  && !pedidoEstaNaOperacao(anterior);
