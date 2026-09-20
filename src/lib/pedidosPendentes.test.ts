import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('./supabase', () => ({
  supabase: { rpc },
}));

import { cancelarMeuPedidoPendente } from './pedidosPendentes';

describe('cancelarMeuPedidoPendente', () => {
  beforeEach(() => rpc.mockReset());

  it('usa a RPC transacional e devolve o resultado do servidor', async () => {
    rpc.mockResolvedValue({ data: { pedido_id: 'p-1', status: 'CANCELADO' }, error: null });

    await expect(cancelarMeuPedidoPendente('p-1')).resolves.toEqual({
      pedido_id: 'p-1',
      status: 'CANCELADO',
    });
    expect(rpc).toHaveBeenCalledWith('fn_cancelar_meu_pedido_pendente', { p_pedido_id: 'p-1' });
  });

  it('propaga a recusa do servidor em vez de fingir cancelamento', async () => {
    const error = new Error('pagamento já confirmado');
    rpc.mockResolvedValue({ data: null, error });

    await expect(cancelarMeuPedidoPendente('p-2')).rejects.toBe(error);
  });
});
