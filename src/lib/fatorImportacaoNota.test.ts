import { describe, expect, it } from 'vitest';
import { resolverFatorImportacao } from './fatorImportacaoNota';

describe('resolverFatorImportacao', () => {
  it('converte kg da nota para gramas do estoque', () => {
    const r = resolverFatorImportacao(
      { descricao: 'CENOURA KG', unidade: 'kg', qtd: 1 },
      'g',
    );
    expect(r).toMatchObject({ fator: 1000, origem: 'CONVERSAO_NOTA', requerConfirmacao: false });
  });

  it('converte litro da nota para mililitros do estoque', () => {
    const r = resolverFatorImportacao(
      { descricao: 'OLEO DE SOJA', unidade: 'L', qtd: 1 },
      'ml',
    );
    expect(r.fator).toBe(1000);
  });

  it('lê o conteúdo escrito na embalagem', () => {
    const r = resolverFatorImportacao(
      { descricao: 'OVOS EXTRA BRANCO PVC 20UN', unidade: 'bd', qtd: 2 },
      'un',
    );
    expect(r.fator).toBe(20);
  });

  it('preserva o histórico quando a nota não prova a conversão', () => {
    const r = resolverFatorImportacao(
      { descricao: 'PRODUTO ARTESANAL CX', unidade: 'cx', qtd: 1 },
      'un',
      24,
    );
    expect(r).toMatchObject({ fator: 24, origem: 'HISTORICO', requerConfirmacao: false });
  });

  it('bloqueia fator inventado quando não há evidência nem histórico', () => {
    const r = resolverFatorImportacao(
      { descricao: 'PRODUTO ARTESANAL CX', unidade: 'cx', qtd: 1 },
      'kg',
    );
    expect(r).toMatchObject({ fator: 0, origem: 'CONFIRMACAO', requerConfirmacao: true });
  });

  // Regressão do dano medido em produção (21/09/2026): o lote de Cenoura de
  // 18/09 entrou a R$ 5,48 POR GRAMA porque um de-para antigo guardava
  // `fator_conversao = 1` e o histórico vencia a conversão física. A conversão
  // que a nota prova (kg → g, L → ml) tem de vencer o de-para, sempre.
  it('a conversão física ganha do de-para histórico errado (kg → g)', () => {
    const r = resolverFatorImportacao(
      { descricao: 'APP1 CENOURA kg', unidade: 'kg', qtd: 1.1 },
      'g',
      1, // de-para envenenado: guardou 1 para uma nota em kg
    );
    expect(r).toMatchObject({ fator: 1000, origem: 'CONVERSAO_NOTA' });
  });

  it('a conversão física ganha do de-para histórico errado (L → ml)', () => {
    const r = resolverFatorImportacao(
      { descricao: 'OLEO SOJA 900ml', unidade: 'L', qtd: 1 },
      'ml',
      1,
    );
    expect(r.fator).toBe(1000);
  });
});
