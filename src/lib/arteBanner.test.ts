/**
 * A arte não pode prometer o que o cupom não cumpre.
 *
 * Cada caso aqui é um motivo real pelo qual o cliente vê "cupom não aplicado"
 * e conclui que o sistema está quebrado. Aconteceu de verdade em 10/09/2026:
 * pedido de R$ 7,00 contra cupons que exigiam R$ 30 e R$ 10, mais um vencido
 * em julho — e nada na tela contava isso.
 */
import { describe, it, expect } from 'vitest';
import { chamadaDoCupom, condicoesDoCupom, cupomForaDaJanelaAgora, cupomInvalidoHoje, janelaDoCupom } from './arteBanner';

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

describe('janela de horário do cupom', () => {
  // Datas com fuso explícito: o runner de CI roda em en-US e a janela é
  // decidida na hora de São Paulo, não na do runner.
  const sp = (iso: string) => new Date(iso);

  it('descreve a janela como o lojista fala', () => {
    expect(janelaDoCupom({ codigo: 'X', tipo: 'PERCENTUAL', valor: 10, hora_inicio: '13:40:00' }))
      .toBe('A partir das 13h40');
    expect(janelaDoCupom({ codigo: 'X', tipo: 'PERCENTUAL', valor: 10, hora_inicio: '11:00:00', hora_fim: '14:00:00' }))
      .toBe('Das 11h às 14h');
    expect(janelaDoCupom({ codigo: 'X', tipo: 'PERCENTUAL', valor: 10, hora_fim: '10:00:00' }))
      .toBe('Até as 10h');
    expect(janelaDoCupom({ codigo: 'X', tipo: 'PERCENTUAL', valor: 10, hora_inicio: '18:00:00', hora_fim: '20:00:00', dias_semana: [4] }))
      .toBe('Qui, das 18h às 20h');
    expect(janelaDoCupom({ codigo: 'X', tipo: 'PERCENTUAL', valor: 10, dias_semana: [1, 2, 3, 4, 5] }))
      .toBe('Só seg, ter, qua, qui, sex');
  });

  it('cupom sem janela nunca é "fora da janela"', () => {
    expect(janelaDoCupom({ codigo: 'X', tipo: 'PERCENTUAL', valor: 10 })).toBeNull();
    expect(cupomForaDaJanelaAgora({ codigo: 'X', tipo: 'PERCENTUAL', valor: 10 }, sp('2026-09-15T03:00:00Z'))).toBe(false);
  });

  it('"depois da 1h40": 13h39 fora, 13h41 dentro — na hora de São Paulo', () => {
    const c = { codigo: 'X', tipo: 'PERCENTUAL' as const, valor: 10, hora_inicio: '13:40:00' };
    expect(cupomForaDaJanelaAgora(c, sp('2026-09-15T16:39:00Z'))).toBe(true);  // 13h39 SP
    expect(cupomForaDaJanelaAgora(c, sp('2026-09-15T16:41:00Z'))).toBe(false); // 13h41 SP
  });

  it('a hora que vale é a da loja, não a do banco', () => {
    // 13h41 UTC é 10h41 em São Paulo: tem de ficar FORA de um cupom das 13h40.
    const c = { codigo: 'X', tipo: 'PERCENTUAL' as const, valor: 10, hora_inicio: '13:40:00' };
    expect(cupomForaDaJanelaAgora(c, sp('2026-09-15T13:41:00Z'))).toBe(true);
  });

  it('janela fechada de almoço', () => {
    const c = { codigo: 'X', tipo: 'PERCENTUAL' as const, valor: 10, hora_inicio: '11:00:00', hora_fim: '14:00:00' };
    expect(cupomForaDaJanelaAgora(c, sp('2026-09-15T13:59:00Z'))).toBe(true);  // 10h59 SP
    expect(cupomForaDaJanelaAgora(c, sp('2026-09-15T15:00:00Z'))).toBe(false); // 12h00 SP
    expect(cupomForaDaJanelaAgora(c, sp('2026-09-15T17:01:00Z'))).toBe(true);  // 14h01 SP
  });

  it('dia da semana: 2026-09-15 é terça', () => {
    const uteis = { codigo: 'X', tipo: 'PERCENTUAL' as const, valor: 10, dias_semana: [1, 2, 3, 4, 5] };
    expect(cupomForaDaJanelaAgora(uteis, sp('2026-09-15T15:00:00Z'))).toBe(false); // terça
    expect(cupomForaDaJanelaAgora(uteis, sp('2026-09-13T15:00:00Z'))).toBe(true);  // domingo
  });

  it('madrugada de sexta pega o cliente de 1h de sábado, e solta o de domingo', () => {
    const c = { codigo: 'X', tipo: 'PERCENTUAL' as const, valor: 10, hora_inicio: '22:00:00', hora_fim: '02:00:00', dias_semana: [5] };
    expect(cupomForaDaJanelaAgora(c, sp('2026-09-19T02:00:00Z'))).toBe(false); // sex 23h SP
    expect(cupomForaDaJanelaAgora(c, sp('2026-09-19T04:00:00Z'))).toBe(false); // sáb 01h SP
    expect(cupomForaDaJanelaAgora(c, sp('2026-09-20T02:00:00Z'))).toBe(true);  // sáb 23h SP
    expect(cupomForaDaJanelaAgora(c, sp('2026-09-20T04:00:00Z'))).toBe(true);  // dom 01h SP
  });

  it('a janela aparece nas condições da arte', () => {
    expect(condicoesDoCupom({ codigo: 'X', tipo: 'PERCENTUAL', valor: 10, hora_inicio: '13:40:00' }, HOJE))
      .toContain('A partir das 13h40');
  });

  it('estar fora da janela agora NAO deixa o cupom invalido', () => {
    expect(cupomInvalidoHoje({ codigo: 'X', tipo: 'PERCENTUAL', valor: 10, hora_inicio: '23:00:00', hora_fim: '23:30:00' }, HOJE))
      .toBe(false);
  });
});
