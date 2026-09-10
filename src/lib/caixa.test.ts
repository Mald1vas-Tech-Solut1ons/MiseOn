/**
 * Conferência de caixa — os três erros de dinheiro que a regra anterior fazia.
 *
 * Cada teste aqui descreve uma cena real de salão, não uma linha de código. Se
 * algum deles voltar a falhar, o lojista vai contar a gaveta no fim do dia e o
 * sistema vai apontar sobra ou falta que não existe.
 */
import { describe, it, expect } from 'vitest';
import {
  somarRecebidoEmDinheiro,
  somarMovimentacoes,
  calcularDinheiroGaveta,
  diferencaDeFechamento,
} from './caixa';

describe('conferência de caixa', () => {
  it('conta dividida: só a parte paga em dinheiro entra na gaveta', () => {
    // Mesa de R$ 200: um cliente paga R$ 50 em dinheiro, o outro R$ 150 no
    // cartão. A consulta já filtra método DINHEIRO, então só a linha de R$ 50
    // chega aqui. A regra antiga somava o valor_total do pedido (R$ 200) por
    // existir "algum" pagamento em dinheiro — e mandava procurar R$ 150 que
    // nunca estiveram na gaveta.
    const recebido = somarRecebidoEmDinheiro([{ valor_pago: '50.00' }]);
    expect(recebido).toBe(50);

    const gaveta = calcularDinheiroGaveta({
      fundoTroco: 100,
      recebidoEmDinheiro: recebido,
      reforcos: 0,
      sangrias: 0,
    });
    expect(gaveta).toBe(150);
  });

  it('pagamento parcial em duas cédulas soma os dois recebimentos', () => {
    // O cliente deixa R$ 30 agora e volta pra pagar R$ 45 depois: são duas
    // linhas de pagamento no MESMO pedido. A regra antiga contava o pedido uma
    // vez só (e pelo total, não pelo pago).
    expect(somarRecebidoEmDinheiro([{ valor_pago: 30 }, { valor_pago: 45 }])).toBe(75);
  });

  it('numeric do Postgres chega como string e não pode virar NaN', () => {
    expect(somarRecebidoEmDinheiro([{ valor_pago: '12.34' }, { valor_pago: null }])).toBeCloseTo(12.34, 2);
  });

  it('reforço entra e sangria sai da gaveta', () => {
    const { reforcos, sangrias } = somarMovimentacoes([
      { tipo: 'REFORCO', valor: '80' },
      { tipo: 'SANGRIA', valor: 200 },
      { tipo: 'REFORCO', valor: 20 },
      { tipo: 'OUTRO_TIPO_QUALQUER', valor: 999 },
    ]);
    expect(reforcos).toBe(100);
    expect(sangrias).toBe(200);

    expect(
      calcularDinheiroGaveta({ fundoTroco: 150, recebidoEmDinheiro: 400, reforcos, sangrias }),
    ).toBe(450);
  });

  it('turno inteiro: fundo + dinheiro do balcão e do salão + reforço - sangria', () => {
    // Cena completa: abre com R$ 200 de troco, recebe R$ 320 em dinheiro
    // (balcão e mesas), busca R$ 100 de troco no banco (reforço) e leva
    // R$ 500 pro cofre (sangria).
    const recebido = somarRecebidoEmDinheiro([
      { valor_pago: 120 }, { valor_pago: 80 }, { valor_pago: '120.00' },
    ]);
    const { reforcos, sangrias } = somarMovimentacoes([
      { tipo: 'REFORCO', valor: 100 },
      { tipo: 'SANGRIA', valor: 500 },
    ]);
    const esperado = calcularDinheiroGaveta({
      fundoTroco: 200, recebidoEmDinheiro: recebido, reforcos, sangrias,
    });
    expect(esperado).toBe(120);
  });

  it('fechamento certo não pinta diferença por causa de float', () => {
    // 0.1 + 0.2 = 0.30000000000000004: sem a tolerância de meio centavo o
    // lojista via "diferença" num caixa que fechou exato.
    const esperado = calcularDinheiroGaveta({
      fundoTroco: 0.1, recebidoEmDinheiro: 0.2, reforcos: 0, sangrias: 0,
    });
    expect(diferencaDeFechamento(0.3, esperado)).toBe(0);
  });

  it('sobra e falta continuam sendo apontadas', () => {
    expect(diferencaDeFechamento(310, 300)).toBeCloseTo(10, 2);
    expect(diferencaDeFechamento(290, 300)).toBeCloseTo(-10, 2);
  });
});
