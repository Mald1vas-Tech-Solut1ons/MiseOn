import { supabase } from './supabase';

export interface CancelamentoPedidoPendente {
  pedido_id: string;
  status: 'CANCELADO';
  ja_cancelado?: boolean;
  cashback_devolvido?: number;
}

/**
 * Cancela o carrinho online do próprio cliente pela autoridade transacional
 * do servidor. Não tenta escrever diretamente em pedidos/pagamentos porque o
 * navegador não tem autorização nem consegue serializar a disputa com o
 * webhook do meio de pagamento.
 */
export async function cancelarMeuPedidoPendente(pedidoId: string): Promise<CancelamentoPedidoPendente> {
  const { data, error } = await supabase.rpc('fn_cancelar_meu_pedido_pendente', {
    p_pedido_id: pedidoId,
  });
  if (error) throw error;
  return data as CancelamentoPedidoPendente;
}
