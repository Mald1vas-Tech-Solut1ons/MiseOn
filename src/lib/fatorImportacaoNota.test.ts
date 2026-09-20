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
});
