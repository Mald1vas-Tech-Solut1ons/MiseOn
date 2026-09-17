import { describe, it, expect } from 'vitest';
import { calcularCmvPeriodo, calcularCmvPrato, calcularMarkup, calcularPrecoCanal, cenariosDoCanal, composicaoDoPreco, lerNumero, pontoDeCmv } from './ferramentas';

const valor = <T,>(r: { ok: true; valor: T } | { ok: false; motivo: string }): T => {
  if (!r.ok) throw new Error(r.motivo);
  return r.valor;
};

describe('CMV do período', () => {
  it('EI + compras − EF sobre o faturamento', () => {
    const r = valor(calcularCmvPeriodo({ estoqueInicial: 5000, compras: 20000, estoqueFinal: 4000, faturamento: 60000 }));
    expect(r.cmv).toBe(21000);
    expect(r.cmvPct).toBeCloseTo(35, 5);
    expect(r.margemBruta).toBe(39000);
  });
  it('recusa estoque final impossível em vez de devolver CMV negativo', () => {
    expect(calcularCmvPeriodo({ estoqueInicial: 100, compras: 100, estoqueFinal: 500, faturamento: 1000 }).ok).toBe(false);
  });
  it('sem faturamento não há percentual', () => {
    expect(calcularCmvPeriodo({ estoqueInicial: 1, compras: 1, estoqueFinal: 0, faturamento: 0 }).ok).toBe(false);
  });
});

describe('CMV do prato', () => {
  it('custo ÷ preço', () => {
    const r = valor(calcularCmvPrato(9, 30));
    expect(r.cmvPct).toBeCloseTo(30, 5);
    expect(r.sobraPorUnidade).toBe(21);
  });
});

describe('preço no canal', () => {
  it('bate com a fórmula do painel do iFood (27% + R$ 0,99 sobre R$ 28)', () => {
    const r = valor(calcularPrecoCanal({ precoBalcao: 28, comissaoPct: 27, taxaPagamentoPct: 0, taxaFixa: 0.99 }));
    expect(r.precoSugerido).toBeCloseTo(39.71, 2);
  });
  it('cobrando o preço sugerido, recebe-se exatamente o preço do balcão', () => {
    const e = { precoBalcao: 35, comissaoPct: 23, taxaPagamentoPct: 3.5, taxaFixa: 0 };
    const r = valor(calcularPrecoCanal(e));
    const deVolta = valor(calcularPrecoCanal({ ...e, precoBalcao: r.precoSugerido }));
    expect(deVolta.recebeMesmoPreco).toBeCloseTo(35, 6);
  });
  it('mesmo preço: R$ 100 com 23% + 3,5% vira R$ 73,50', () => {
    const r = valor(calcularPrecoCanal({ precoBalcao: 100, comissaoPct: 23, taxaPagamentoPct: 3.5, taxaFixa: 0 }));
    expect(r.recebeMesmoPreco).toBeCloseTo(73.5, 6);
    expect(r.perdaMesmoPreco).toBeCloseTo(26.5, 6);
  });
  it('taxas de 100% não têm preço', () => {
    expect(calcularPrecoCanal({ precoBalcao: 10, comissaoPct: 90, taxaPagamentoPct: 10, taxaFixa: 0 }).ok).toBe(false);
  });
});

describe('markup', () => {
  it('markup divisor', () => {
    const r = valor(calcularMarkup({ custo: 10, despesasFixasPct: 20, despesasVariaveisPct: 10, lucroPct: 20 }));
    expect(r.precoVenda).toBeCloseTo(20, 6);
    expect(r.markup).toBeCloseTo(2, 6);
    expect(r.cmvPct).toBeCloseTo(50, 6);
    expect(r.lucroPorUnidade).toBeCloseTo(4, 6);
  });
  it('despesas + lucro ≥ 100% é recusado', () => {
    expect(calcularMarkup({ custo: 10, despesasFixasPct: 50, despesasVariaveisPct: 30, lucroPct: 20 }).ok).toBe(false);
  });
});

describe('lerNumero', () => {
  it('entende o jeito brasileiro de digitar', () => {
    expect(lerNumero('1.234,56')).toBeCloseTo(1234.56, 6);
    expect(lerNumero('R$ 28,00')).toBe(28);
    expect(lerNumero('12%')).toBe(12);
    expect(lerNumero('3.5')).toBe(3.5);
    expect(Number.isNaN(lerNumero(''))).toBe(true);
  });
});

describe('leituras práticas', () => {
  it('um ponto de CMV é 1% do faturamento do mês', () => {
    expect(pontoDeCmv(60000)).toBe(600);
  });

  it('os três cenários do canal fecham a conta do mês', () => {
    const e = { precoBalcao: 30, comissaoPct: 23, taxaPagamentoPct: 3.5, taxaFixa: 0 };
    const c = valor(cenariosDoCanal(e, 400));
    const manter = c.find((x) => x.chave === 'manter')!;
    const repassar = c.find((x) => x.chave === 'repassar')!;
    const meio = c.find((x) => x.chave === 'meio')!;

    expect(manter.recebePorPedido).toBeCloseTo(22.05, 2);
    expect(manter.diferencaNoMes).toBeCloseTo(-3180, 2);
    // repassando tudo, o que sobra é exatamente o preço do balcão
    expect(repassar.diferencaPorPedido).toBeCloseTo(0, 6);
    expect(repassar.diferencaNoMes).toBeCloseTo(0, 6);
    // o meio-termo fica entre os dois
    expect(meio.precoApp).toBeGreaterThan(manter.precoApp);
    expect(meio.precoApp).toBeLessThan(repassar.precoApp);
  });

  it('recusa volume mensal inválido em vez de projetar o mês no escuro', () => {
    expect(cenariosDoCanal({ precoBalcao: 30, comissaoPct: 23, taxaPagamentoPct: 3.5, taxaFixa: 0 }, Number.NaN).ok).toBe(false);
  });

  it('as fatias do preço somam o preço inteiro', () => {
    const e = { custo: 10, despesasFixasPct: 20, despesasVariaveisPct: 10, lucroPct: 20 };
    const preco = valor(calcularMarkup(e)).precoVenda;
    const fatias = composicaoDoPreco(e, preco);
    const soma = fatias.reduce((a, f) => a + f.valor, 0);
    expect(soma).toBeCloseTo(preco, 6);
    expect(fatias.reduce((a, f) => a + f.pctDoPreco, 0)).toBeCloseTo(100, 6);
  });
});
