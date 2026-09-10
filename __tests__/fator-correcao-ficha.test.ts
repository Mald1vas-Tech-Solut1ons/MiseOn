import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fatorParaEstoque, linhaVazia } from '../src/lib/producao/linhaFicha';
import { fatorCorrecao } from '../src/lib/producao/tecnicas';
import type { Insumo } from '../src/types';

const insumo = (over: Partial<Insumo>): Insumo => ({
  id: 'i1',
  loja_id: 'l1',
  nome: 'Tomate',
  unidade_medida: 'kg',
  quantidade_atual: 10,
  estoque_minimo: 0,
  preco_embalagem: 6.99,
  qtd_embalagem: 1,
  ativo: true,
  ...over,
} as Insumo);

describe('conversão da unidade informada para a unidade de estoque', () => {
  it('a unidade do próprio estoque tem fator 1', () => {
    expect(fatorParaEstoque(insumo({}), 'kg')).toBe(1);
  });

  it('submúltiplo dimensional sai da física, sem declaração humana', () => {
    // 1 g = 0,001 kg. O lojista digita em g, o estoque vive em kg.
    expect(fatorParaEstoque(insumo({}), 'g')).toBeCloseTo(0.001, 10);
  });

  it('unidade de contagem exige fator declarado — o sistema não inventa peso', () => {
    // "5 unidades de tomate" só vira kg se a loja declarou quanto pesa uma
    // unidade. Sem isso, retorna null e a tela recusa em vez de chutar.
    expect(fatorParaEstoque(insumo({}), 'un')).toBeNull();
  });

  it('com o peso médio declarado, contagem passa a converter', () => {
    const comRegra = insumo({
      detalhes_rendimento: {
        regras: [],
        equivalencias: [{ unidade: 'un', rende_qtd: 0.12, rende_unidade: 'kg' }],
      },
    } as Partial<Insumo>);
    // 1 tomate ≈ 120 g ⇒ 5 un = 0,6 kg.
    const fator = fatorParaEstoque(comRegra, 'un');
    expect(fator).not.toBeNull();
    expect(5 * fator!).toBeCloseTo(0.6, 10);
  });

  it('insumo ausente não converte nada', () => {
    expect(fatorParaEstoque(undefined, 'kg')).toBeNull();
  });
});

describe('fator de correção do food service', () => {
  it('FC é o inverso do rendimento', () => {
    // Rendimento 78% (tomate sem pele e sem semente) ⇒ FC ≈ 1,282.
    expect(fatorCorrecao(0.78)).toBeCloseTo(1.2821, 4);
  });

  it('rendimento inválido não gera divisão por zero', () => {
    expect(fatorCorrecao(0)).toBe(0);
  });

  it('bruto e líquido do exemplo real fecham', () => {
    const brutoKg = 0.6; // 5 tomates
    const rendimento = 0.78;
    expect(brutoKg * rendimento).toBeCloseTo(0.468, 6);
    // O caminho inverso: preciso de 468 g limpos ⇒ 600 g brutos.
    expect(0.468 * fatorCorrecao(rendimento)).toBeCloseTo(brutoKg, 6);
  });
});

describe('linha de ficha nasce sem promessa nenhuma', () => {
  it('sem técnica e sem rendimento até o usuário escolher', () => {
    const l = linhaVazia();
    expect(l.tecnica_codigo).toBe('');
    expect(l.rendimento_pct).toBe('');
    expect(l.rendimento_origem).toBeNull();
    expect(l.rendimento_sistema_pct).toBeNull();
  });
});

describe('invariantes do domínio culinário na migration', () => {
  const sql = readFileSync(
    new URL('../supabase/migrations/20260909250000_tecnicas_culinarias_fator_correcao.sql', import.meta.url),
    'utf8',
  );

  it('rendimento é uma fração válida, nunca acima de 1', () => {
    // Limpar não cria matéria: o CHECK impede rendimento > 100%.
    expect(sql).toMatch(/rendimento_pct > 0 and rendimento_pct <= 1/);
  });

  it('o medido da loja tem precedência sobre a referência de mercado', () => {
    const medido = sql.indexOf("'MEDIDO_LOJA'");
    const refIngrediente = sql.indexOf("'REFERENCIA_INGREDIENTE'");
    const refCategoria = sql.indexOf("'REFERENCIA_CATEGORIA'");
    expect(medido).toBeGreaterThan(-1);
    expect(medido).toBeLessThan(refIngrediente);
    expect(refIngrediente).toBeLessThan(refCategoria);
  });

  it('o líquido nunca pode exceder o bruto na ficha', () => {
    expect(sql).toContain('fichas_preparos_liquida_nao_excede_bruto');
  });

  it('a pesagem recusa líquido maior que bruto', () => {
    expect(sql).toContain('limpar nao cria materia');
  });

  it('a nutrição passa a contar o líquido', () => {
    expect(sql).toContain('coalesce(fp.quantidade_liquida, fp.quantidade)');
  });

  it('o tomate sem pele e semente rende 78% por referência', () => {
    expect(sql).toMatch(/\('PELE_E_SEMENTE',\s+'tomate',\s+0\.7800/);
  });
});
