import { describe, it, expect } from 'vitest';
import { contrasteEntre, corLegivelSobre } from './personalizacao';

// O lojista escolhe cor da marca e cor de fundo livremente no painel, sem nenhuma
// trava. Quem paga a conta de uma combinação ruim é o cliente final tentando ler
// o PREÇO no cardápio. Estes testes fixam o piso: 4.5:1 (WCAG AA para texto).

describe('contrasteEntre', () => {
  it('dá 21 para preto sobre branco e 1 para cores iguais', () => {
    expect(contrasteEntre('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contrasteEntre('#ef4444', '#ef4444')).toBeCloseTo(1, 2);
  });

  it('reproduz o caso real que motivou a correção', () => {
    // Lanche do Paulista: preço vermelho sobre fundo marrom escuro.
    const razao = contrasteEntre('#ef4444', '#4e350a');
    expect(razao).toBeGreaterThan(3);
    expect(razao).toBeLessThan(4.5); // reprovado na WCAG AA
  });
});

describe('corLegivelSobre', () => {
  it('corrige o caso real para o mínimo da WCAG AA', () => {
    const corrigida = corLegivelSobre('#ef4444', '#4e350a');
    expect(contrasteEntre(corrigida, '#4e350a')).toBeGreaterThanOrEqual(4.5);
  });

  it('não mexe na cor quando o contraste já é suficiente', () => {
    // Âmbar sobre marrom escuro já passa; deve voltar idêntica.
    expect(corLegivelSobre('#f59e0b', '#4e350a')).toBe('#f59e0b');
  });

  it('clareia sobre fundo escuro e escurece sobre fundo claro', () => {
    const sobreEscuro = corLegivelSobre('#7f1d1d', '#111827');
    const sobreClaro = corLegivelSobre('#fca5a5', '#ffffff');
    expect(contrasteEntre(sobreEscuro, '#111827')).toBeGreaterThanOrEqual(4.5);
    expect(contrasteEntre(sobreClaro, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('preserva o matiz da marca — a cor continua reconhecível', () => {
    // Só a luminosidade muda; vermelho não pode virar azul.
    const corrigida = corLegivelSobre('#ef4444', '#4e350a');
    const r = parseInt(corrigida.slice(1, 3), 16);
    const g = parseInt(corrigida.slice(3, 5), 16);
    const b = parseInt(corrigida.slice(5, 7), 16);
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
  });

  it('aguenta combinações extremas sem quebrar', () => {
    expect(() => corLegivelSobre('#ffffff', '#ffffff')).not.toThrow();
    expect(corLegivelSobre('', '#000000')).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});
