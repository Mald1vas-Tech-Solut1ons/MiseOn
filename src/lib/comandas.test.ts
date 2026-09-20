import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock('./supabase', () => ({
  supabase: { rpc },
}));

import {
  definirDivisaoItensComanda,
  lancarItemDivididoComanda,
  receberComandaMesa,
} from './comandas';

describe('autoridades transacionais de comanda', () => {
  beforeEach(() => rpc.mockReset());

  it('lança um único item com participantes sem fracionar o preço no navegador', async () => {
    rpc.mockResolvedValue({
      data: { comanda_id: 'c-1', pedido_id: 'p-1', item_id: 'i-1', valor_total: 40, participantes_assentos: [1, 2, 3, 4] },
      error: null,
    });

    const resultado = await lancarItemDivididoComanda({
      lojaId: 'l-1',
      comandaId: 'c-1',
      produtoId: 'produto-1',
      quantidade: 1,
      observacao: 'ao ponto',
      participantes: [1, 2, 3, 4],
    });

    expect(resultado.valor_total).toBe(40);
    expect(rpc).toHaveBeenCalledWith('fn_lancar_item_dividido_comanda', {
      p_loja_id: 'l-1',
      p_comanda_id: 'c-1',
      p_produto_id: 'produto-1',
      p_quantidade: 1,
      p_observacao: 'ao ponto',
      p_participantes: [1, 2, 3, 4],
      p_opcoes: [],
    });
  });

  it('persiste o mapa de divisão por item', async () => {
    rpc.mockResolvedValue({ data: { comanda_id: 'c-1', itens_atualizados: 2, valor_total: 80 }, error: null });

    await definirDivisaoItensComanda('c-1', { 'i-1': [1, 2], 'i-2': [2, 3] });

    expect(rpc).toHaveBeenCalledWith('fn_definir_divisao_itens_comanda', {
      p_comanda_id: 'c-1',
      p_divisoes: [
        { item_id: 'i-1', assentos: [1, 2] },
        { item_id: 'i-2', assentos: [2, 3] },
      ],
    });
  });

  it('repassa a chave idempotente ao recebimento atômico', async () => {
    rpc.mockResolvedValue({
      data: { comanda_id: 'c-1', pagamento_id: 'pg-1', valor_pago: 40, troco: 0, saldo_restante: 0, status: 'FECHADA', idempotente: false },
      error: null,
    });

    await receberComandaMesa({
      comandaId: 'c-1',
      metodoPagamento: 'PIX',
      valorRecebido: 40,
      taxaServicoPct: 10,
      idempotenciaChave: 'tentativa-1',
    });

    expect(rpc).toHaveBeenCalledWith('fn_receber_comanda_mesa', {
      p_comanda_id: 'c-1',
      p_metodo_pagamento: 'PIX',
      p_valor_recebido: 40,
      p_taxa_servico_pct: 10,
      p_idempotencia_chave: 'tentativa-1',
    });
  });
});
