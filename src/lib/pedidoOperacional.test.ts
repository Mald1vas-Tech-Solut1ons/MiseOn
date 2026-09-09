import { describe, expect, it } from 'vitest';
import { pedidoAcabouDeEntrarNaOperacao, pedidoEstaNaOperacao } from './pedidoOperacional';

describe('pedido operacional', () => {
  it('checkout aguardando gateway ainda é carrinho, não pedido da loja', () => {
    expect(pedidoEstaNaOperacao({ status: 'AGUARDANDO_PAGAMENTO' })).toBe(false);
  });

  it('pagamento aprovado é o momento em que o pedido entra na operação', () => {
    expect(pedidoAcabouDeEntrarNaOperacao(
      { status: 'AGUARDANDO_PAGAMENTO' },
      { status: 'ACEITO' },
    )).toBe(true);
  });

  it('insert de pedido que paga na entrega continua notificando imediatamente', () => {
    expect(pedidoAcabouDeEntrarNaOperacao(null, { status: 'NOVO' })).toBe(true);
  });

  it('updates normais do preparo não recriam notificação de pedido novo', () => {
    expect(pedidoAcabouDeEntrarNaOperacao(
      { status: 'ACEITO' },
      { status: 'PREPARANDO' },
    )).toBe(false);
  });

  it.each(['CANCELADO', 'FINALIZADO', 'PRONTO', 'EM_ROTA', 'DESCONHECIDO']) (
    'checkout que termina em %s não soa como pedido novo', (status) => {
      expect(pedidoAcabouDeEntrarNaOperacao(
        { status: 'AGUARDANDO_PAGAMENTO' }, { status },
      )).toBe(false);
    },
  );
});
