import { describe, it, expect } from 'vitest';
import { casarCatalogo } from './catalogoInsumos';
import { qualidadeToken, tokensUteis } from './casarTermos';
import { CORPUS_CUPOM } from './corpusCupom';

/**
 * A régua do reconhecimento.
 *
 * Enquanto a taxa era medida item a item, "melhorar" significava adicionar a
 * abreviação da nota que acabou de falhar — e a mesma classe de erro voltava no
 * mercado seguinte com outra sigla. Aqui existe número: quem mexer na regra vê
 * na hora se subiu ou se derrubou algo que funcionava.
 */
// Medida em 100% sobre o corpus. A régua fica logo abaixo para não quebrar
// por uma descrição nova difícil, mas apertada o bastante para que qualquer
// regressão de verdade apareça no mesmo commit que a causou.
const TAXA_MINIMA = 0.97;

describe('reconhecimento sobre o corpus de cupom', () => {
  const resultados = CORPUS_CUPOM.map(([descricao, esperado]) => ({
    descricao,
    esperado,
    obtido: casarCatalogo(descricao)?.nome ?? null,
  }));

  const acertos = resultados.filter((r) => r.obtido === r.esperado);
  const erros = resultados.filter((r) => r.obtido !== r.esperado);

  it(`acerta ao menos ${Math.round(TAXA_MINIMA * 100)}% das descrições`, () => {
    const taxa = acertos.length / resultados.length;
    expect(
      taxa,
      `\nTaxa: ${(taxa * 100).toFixed(1)}% (${acertos.length}/${resultados.length})\n` +
        erros.map((e) => `  ${e.descricao}\n     esperado: ${e.esperado} | obtido: ${e.obtido}`).join('\n') +
        '\n',
    ).toBeGreaterThanOrEqual(TAXA_MINIMA);
  });

  it('nunca inventa gênero para o que é da cauda longa', () => {
    // Falso positivo é o erro caro: o item entra com ar de certeza na unidade
    // errada e ninguém confere. Não reconhecer é seguro — a IA assume dali.
    const falsosPositivos = resultados.filter((r) => r.esperado === null && r.obtido !== null);
    expect(
      falsosPositivos.map((f) => `${f.descricao} → ${f.obtido}`),
    ).toEqual([]);
  });

  it('reconhece o truncamento sem que a abreviação esteja cadastrada', () => {
    // Nenhum destes existe como termo no catálogo: são resolvidos pela regra
    // morfológica, que vale para qualquer palavra truncada.
    expect(casarCatalogo('DETERG LIQ MINUANO')?.nome).toBe('Detergente');
    expect(casarCatalogo('REQ CREM TIROLEZ')?.nome).toBe('Requeijão');
    expect(casarCatalogo('MARG QUALY 500G')?.nome).toBe('Margarina');
    expect(casarCatalogo('ACUC CRISTAL 1KG')?.nome).toBe('Açúcar');
    // E vale para truncamento que ninguém previu:
    expect(casarCatalogo('MANTEIG EXTRA 200G')?.nome).toBe('Manteiga');
    expect(casarCatalogo('VINAGR MACA 750ML')?.nome).toBe('Vinagre');
    expect(casarCatalogo('CENOUR NACIONAL KG')?.nome).toBe('Cenoura');
  });
});

describe('a regra morfológica, isolada', () => {
  it('palavra igual vale mais que qualquer aproximação', () => {
    expect(qualidadeToken('tomate', 'tomate')).toBe(1);
  });

  it('aceita flexão curta, recusa palavra diferente que começa igual', () => {
    expect(qualidadeToken('tomates', 'tomate')).toBeGreaterThan(0.9);
    // "salada" não pode ser aceita como flexão de "sal": três letras a mais é
    // outra palavra, e sal chegando no lugar de alface é erro de estoque.
    expect(qualidadeToken('salada', 'sal')).toBe(0);
    expect(qualidadeToken('salsicha', 'sal')).toBe(0);
  });

  it('aceita truncamento, e confia mais em quem escreveu mais', () => {
    const curto = qualidadeToken('det', 'detergente');
    const longo = qualidadeToken('deterg', 'detergente');
    expect(longo).toBeGreaterThan(curto);
    expect(curto).toBeGreaterThan(0.7);
  });

  it('não deixa duas letras casarem com meio catálogo', () => {
    expect(qualidadeToken('de', 'detergente')).toBe(0);
    expect(qualidadeToken('ma', 'macarrao')).toBe(0);
  });

  it('tolera uma letra trocada em palavra longa', () => {
    expect(qualidadeToken('mucarela', 'mussarela')).toBeGreaterThan(0.7);
    expect(qualidadeToken('abobora', 'abobrinha')).toBe(0);
  });
});

describe('limpeza do que não é o produto', () => {
  it('joga fora código interno, sigla de embalagem e medida', () => {
    expect(tokensUteis('app1 ovos extra branco pvc 20un')).toEqual(['ovos', 'extra', 'branco']);
    expect(tokensUteis('cx molho shoyu sakura 5l')).toEqual(['molho', 'shoyu', 'sakura']);
    expect(tokensUteis('arroz tio joao 5kg')).toEqual(['arroz', 'tio', 'joao']);
  });

  it('não descarta palavra que define o produto', () => {
    expect(tokensUteis('leite condensado')).toEqual(['leite', 'condensado']);
    expect(tokensUteis('agua sanitaria')).toEqual(['agua', 'sanitaria']);
  });
});
