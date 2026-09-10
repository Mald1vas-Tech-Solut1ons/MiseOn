/**
 * A arte não pode prometer o que o cupom não cumpre.
 *
 * Cada caso aqui é um motivo real pelo qual o cliente vê "cupom não aplicado"
 * e conclui que o sistema está quebrado. Aconteceu de verdade em 10/09/2026:
 * pedido de R$ 7,00 contra cupons que exigiam R$ 30 e R$ 10, mais um vencido
 * em julho — e nada na tela contava isso.
 */
import { describe, it, expect } from 'vitest';
import { chamadaDoCupom, condicoesDoCupom, cupomInvalidoHoje } from './arteBanner';

const HOJE = new Date('2026-09-10T12:00:00Z');

describe('chamada do cupom', () => {
  it('percentual vira "10% OFF"', () => {
    expect(chamadaDoCupom({ codigo: 'X', tipo: 'PERCENTUAL', valor: 10 })).toBe('10% OFF');
  });

  it('valor fixo sai em reais', () => {
    expect(chamadaDoCupom({ codigo: 'X', tipo: 'FIXO', valor: 7 })).toMatch(/R\$\s?7,00 OFF/);
  });

  it('frete grátis vence o desconto: é a chamada mais forte', () => {
    expect(chamadaDoCupom({ codigo: 'X', tipo: 'PERCENTUAL', valor: 10, frete_gratis: true })).toBe('FRETE GRÁTIS');
  });
});

describe('condições do cupom', () => {
  it('cupom sem regra nenhuma não inventa condição', () => {
    expect(condicoesDoCupom({ codigo: 'X', tipo: 'PERCENTUAL', valor: 10 }, HOJE)).toEqual([]);
  });

  it('pedido mínimo aparece em reais — foi o que barrou o teste de R$ 7', () => {
    const c = condicoesDoCupom({ codigo: 'BALCAO15', tipo: 'PERCENTUAL', valor: 15, pedido_minimo: 30 }, HOJE);
    expect(c[0]).toMatch(/Pedido a partir de R\$\s?30,00/);
  });

  it('método exigido sai com nome de gente, não com o enum', () => {
    const c = condicoesDoCupom({ codigo: 'P10', tipo: 'PERCENTUAL', valor: 10, metodo_exigido: 'PIX' }, HOJE);
    expect(c).toContain('Somente no Pix');
  });

  it('cupom vencido diz que venceu, em vez de fingir validade', () => {
    const c = condicoesDoCupom({ codigo: 'VOLTA4611', tipo: 'PERCENTUAL', valor: 10, validade: '2026-07-26' }, HOJE);
    expect(c.some((f) => /Venceu em 26\/07\/2026/.test(f))).toBe(true);
  });

  it('cupom no prazo mostra a data limite', () => {
    const c = condicoesDoCupom({ codigo: 'X', tipo: 'PERCENTUAL', valor: 10, validade: '2026-12-31' }, HOJE);
    expect(c.some((f) => /Válido até 31\/12\/2026/.test(f))).toBe(true);
  });

  it('limite de uso vira quantidade restante, e esgotado vira "Esgotado"', () => {
    expect(condicoesDoCupom({ codigo: 'X', tipo: 'PERCENTUAL', valor: 10, limite_usos: 5, usos: 2 }, HOJE))
      .toContain('Restam 3 usos');
    expect(condicoesDoCupom({ codigo: 'X', tipo: 'PERCENTUAL', valor: 10, limite_usos: 5, usos: 5 }, HOJE))
      .toContain('Esgotado');
  });

  it('junta todas as regras do mesmo cupom', () => {
    const c = condicoesDoCupom(
      { codigo: 'PAULISTA10', tipo: 'PERCENTUAL', valor: 10, pedido_minimo: 10, metodo_exigido: 'PIX', limite_usos: 5, usos: 0 },
      HOJE,
    );
    expect(c).toHaveLength(3);
  });
});

describe('cupom que não vai funcionar hoje', () => {
  it('vencido, desativado e esgotado são todos inválidos', () => {
    expect(cupomInvalidoHoje({ codigo: 'X', tipo: 'PERCENTUAL', valor: 10, validade: '2026-07-26' }, HOJE)).toBe(true);
    expect(cupomInvalidoHoje({ codigo: 'X', tipo: 'PERCENTUAL', valor: 10, ativo: false }, HOJE)).toBe(true);
    expect(cupomInvalidoHoje({ codigo: 'X', tipo: 'PERCENTUAL', valor: 10, limite_usos: 1, usos: 1 }, HOJE)).toBe(true);
  });

  it('cupom bom não e marcado como invalido', () => {
    expect(cupomInvalidoHoje({ codigo: 'X', tipo: 'PERCENTUAL', valor: 10, validade: '2026-12-31', limite_usos: 5, usos: 1 }, HOJE)).toBe(false);
  });

  it('pedido minimo NAO invalida o cupom: e condicao, nao defeito', () => {
    expect(cupomInvalidoHoje({ codigo: 'X', tipo: 'PERCENTUAL', valor: 10, pedido_minimo: 30 }, HOJE)).toBe(false);
  });
});
