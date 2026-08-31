import { describe, it, expect } from 'vitest';
import { compararPreco, idadeDaNota } from './variacaoPreco';

const ultimo = (custo: number, quando = '2026-07-12T10:00:00Z') => ({
  insumo_id: 'i1', custo_unitario: custo, comprado_em: quando,
});

describe('variação de preço do fornecedor', () => {
  it('avisa a alta com o número que interessa ao lojista', () => {
    const v = compararPreco(7.99, ultimo(6.99), 'kg');
    expect(v?.direcao).toBe('alta');
    expect(v?.relevante).toBe(true);
    expect(Math.round(v!.percentual * 100)).toBe(14);
    expect(v?.texto).toMatch(/Subiu 14%/);
    expect(v?.texto).toMatch(/por kg/);
    expect(v?.texto).toMatch(/12\/07\/2026/);
  });

  it('mostra a queda sem alarme', () => {
    const v = compararPreco(5.0, ultimo(6.0), 'kg');
    expect(v?.direcao).toBe('baixa');
    expect(v?.texto).toMatch(/Caiu 17%/);
  });

  it('cala a oscilação normal de mercado', () => {
    // Hortifrúti varia todo dia. Avisar de 3% treina o lojista a ignorar o
    // aviso, e aí o aumento de 20% também passa batido.
    const v = compararPreco(7.2, ultimo(7.0), 'kg');
    expect(v?.direcao).toBe('estavel');
    expect(v?.relevante).toBe(false);
  });

  it('não compara o que não tem com o quê', () => {
    expect(compararPreco(10, null, 'kg')).toBeNull();
    expect(compararPreco(10, undefined, 'kg')).toBeNull();
    expect(compararPreco(10, ultimo(0), 'kg')).toBeNull();
    expect(compararPreco(0, ultimo(10), 'kg')).toBeNull();
  });

  it('aguenta preço anterior minúsculo sem estourar', () => {
    const v = compararPreco(1, ultimo(0.01), 'un');
    expect(Number.isFinite(v!.percentual)).toBe(true);
    expect(v?.direcao).toBe('alta');
  });
});

describe('idade da nota', () => {
  const agora = new Date('2026-08-31T12:00:00Z');

  it('avisa quando a compra é antiga, dizendo o que vai acontecer', () => {
    // O caso real: cupom de 04/08 lançado no fim do mês.
    const r = idadeDaNota('2026-08-04T18:43:08Z', agora);
    expect(r?.antiga).toBe(true);
    expect(r?.dias).toBe(26);
    expect(r?.texto).toMatch(/04\/08\/2026/);
    expect(r?.texto).toMatch(/registrada nessa data/);
  });

  it('não incomoda quando a compra é recente', () => {
    expect(idadeDaNota('2026-08-31T09:00:00Z', agora)?.antiga).toBe(false);
    expect(idadeDaNota('2026-08-30T09:00:00Z', agora)?.texto).toMatch(/ontem/);
    expect(idadeDaNota('2026-08-27T09:00:00Z', agora)?.antiga).toBe(false);
  });

  it('não quebra com data ausente ou torta', () => {
    expect(idadeDaNota(null)).toBeNull();
    expect(idadeDaNota('')).toBeNull();
    expect(idadeDaNota('data invalida')).toBeNull();
  });
});
