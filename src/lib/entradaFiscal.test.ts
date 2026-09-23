// @vitest-environment jsdom
/**
 * Entrada fiscal ponta a ponta no cliente: XML → fatos → conversão com origem.
 *
 * A regra provada aqui: o MiseOn nunca transforma um dado fiscal correto em
 * dado de estoque semanticamente errado. O servidor tem a prova irmã em
 * supabase/tests/entrada_fiscal_com_origem.sql.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseNFeXml } from './parseNFeXml';
import { resolverFatorLinha } from './fatorImportacaoNota';
import { avaliarConferenciaNota } from './conferenciaNota';
import { sugerirDaNota } from './catalogoInsumos';
import { aplicarClassificacao } from './classificacaoIA';

const xml = readFileSync(resolve(__dirname, '__fixtures__/nfe-distribuidora.xml'), 'utf8');
const nota = parseNFeXml(xml);
const item = (n: number) => nota.itens[n - 1];

describe('parser de NF-e: extrai fatos, cada um no seu campo', () => {
  it('lê a nota inteira, com namespace da SEFAZ', () => {
    expect(nota.itens).toHaveLength(6);
    expect(nota.chave).toHaveLength(44);
    expect(nota.emitente.cnpj).toBe('12345678000190');
    expect(nota.valor_total).toBe(1245.57);
  });

  it('20 KG × 18,90 = 378: quantidade 20, nunca 378', () => {
    const a = item(1);
    expect(a.qtd).toBe(20);
    expect(a.unidade).toBe('KG');
    expect(a.valor_unitario).toBe(18.9);
    expect(a.valor_total).toBe(378);
    expect(a.qtd).not.toBe(a.valor_total);
  });

  it('10 CX × 50 = 500, com a unidade tributável que a nota declara', () => {
    const r = item(2);
    expect([r.qtd, r.unidade, r.valor_total]).toEqual([10, 'CX', 500]);
    expect([r.qtd_tributavel, r.unidade_tributavel]).toEqual([120, 'UN']);
    expect(r.gtin).toBe('7894900011517');
  });

  it('item pesável fracionado mantém as casas da balança', () => {
    expect(item(4).qtd).toBe(3.215);
    expect(item(4).valor_total).toBe(105.77);
  });

  it('lê lote, fabricação e validade do grupo rastro', () => {
    expect(item(4).lotes).toEqual([{ numero: 'L2309A', qtd: 3.215, fabricado_em: '2026-09-10', vence_em: '2026-10-10' }]);
    expect(item(1).lotes).toBeUndefined();
  });

  it('NCM vem de todas as linhas (é o classificador determinístico)', () => {
    expect(item(3).ncm).toBe('28289011'); // água sanitária: química, não alimento
    expect(item(1).ncm).toBe('02013000');
  });

  it('toda linha da nota confere a aritmética (qCom × vUnCom = vProd)', () => {
    for (const i of nota.itens) expect(i.conferencia?.coerente, i.descricao).toBe(true);
  });
});

describe('conversão para o estoque: sempre com origem', () => {
  it('KG na nota, KG no estoque: fator 1 por regra', () => {
    expect(resolverFatorLinha(item(1), 'kg')).toMatchObject({ fator: 1, origem: 'REGRA', requerConfirmacao: false });
  });

  it('KG na nota, g no estoque: 1000 por conversão física', () => {
    expect(resolverFatorLinha(item(1), 'g')).toMatchObject({ fator: 1000, origem: 'REGRA' });
  });

  it('CX → UN só pelo fato do XML: 120 UN / 10 CX = 12', () => {
    const r = resolverFatorLinha(item(2), 'un');
    expect(r).toMatchObject({ fator: 12, origem: 'NOTA_FISCAL', requerConfirmacao: false });
    expect(item(2).qtd * r.fator).toBe(120);
  });

  it('a mesma caixa SEM o dado tributável não vira unidade sozinha', () => {
    const semTrib = { ...item(2), unidade_tributavel: null, qtd_tributavel: null };
    expect(resolverFatorLinha(semTrib, 'un')).toMatchObject({ fator: 0, origem: 'NENHUMA', requerConfirmacao: true });
  });

  it('caixa de água sanitária 2L: 12 frascos × 2 L = 24 L por caixa (fato + regra)', () => {
    const r = resolverFatorLinha(item(3), 'L');
    expect(r).toMatchObject({ fator: 24, origem: 'NOTA_FISCAL', requerConfirmacao: false });
  });

  it('a mesma caixa 2L sem o XML dizer quantos frascos: sugere e pede confirmação', () => {
    const semTrib = { ...item(3), unidade_tributavel: null, qtd_tributavel: null };
    expect(resolverFatorLinha(semTrib, 'L')).toMatchObject({ origem: 'REGRA', requerConfirmacao: true });
  });

  it('com a conversão já confirmada antes para o fornecedor, não pergunta de novo', () => {
    const semTrib = { ...item(3), unidade_tributavel: null, qtd_tributavel: null };
    expect(resolverFatorLinha(semTrib, 'L', { fatorHistorico: 24 })).toMatchObject({ fator: 24, origem: 'HISTORICO', requerConfirmacao: false });
  });

  it('900ML na descrição: 1 UN = 900 ml por regra', () => {
    expect(resolverFatorLinha(item(6), 'ml')).toMatchObject({ fator: 900, origem: 'REGRA', requerConfirmacao: false });
  });

  it('pacote sem conteúdo conhecido: nunca 1 inventado', () => {
    expect(resolverFatorLinha(item(5), 'un')).toMatchObject({ fator: 0, origem: 'NENHUMA', requerConfirmacao: true });
  });

  it('conteúdo lido pela IA vira SUGESTÃO que exige confirmação', () => {
    const r = resolverFatorLinha(item(5), 'un', { conteudoIA: { qtd: 50, unidade: 'un' } });
    expect(r).toMatchObject({ fator: 50, origem: 'IA', requerConfirmacao: true });
  });

  it('a IA não passa por cima da conversão física nem do fato do XML', () => {
    expect(resolverFatorLinha(item(1), 'g', { conteudoIA: { qtd: 378, unidade: 'g' } })).toMatchObject({ fator: 1000, origem: 'REGRA' });
    expect(resolverFatorLinha(item(2), 'un', { conteudoIA: { qtd: 6, unidade: 'un' } })).toMatchObject({ fator: 12, origem: 'NOTA_FISCAL' });
  });
});

describe('sugestões não inventam número', () => {
  it('catálogo: agrupador sem conteúdo devolve 0, não 1', () => {
    expect(sugerirDaNota({ descricao: 'GUARDANAPO FOLHA SIMPLES', unidade: 'PCT', qtd: 5 }).fator).toBe(0);
  });

  it('IA: o conteúdo lido volta como dado, e o fator fica com a regra', () => {
    const s = aplicarClassificacao(
      { descricao: 'GUARDANAPO FOLHA SIMPLES', unidade: 'PCT', qtd: 5 },
      { indice: 0, genero_slug: null, nome: 'Guardanapo', unidade: 'un', variedade: null, marca: null,
        categoria: 'descartavel', conteudo_qtd: 50, conteudo_unidade: 'un', confianca: 'media' },
    );
    expect(s.fator).toBe(0);
    expect(s.conteudoIA).toEqual({ qtd: 50, unidade: 'un' });
  });
});

describe('conferência aritmética vale para toda rota', () => {
  const trocado = { qtd: 378, valor_unitario: 18.9, valor_total: 378 };

  it('XML com linha que não fecha pede confirmação, mas não deixa editar o documento', () => {
    const r = avaliarConferenciaNota(trocado, 'xml_nfe');
    expect(r).toMatchObject({ precisaConfirmacao: true, mostrar: true, podeEditar: false });
  });

  it('foto com leitura trocada pede confirmação e deixa corrigir', () => {
    const r = avaliarConferenciaNota(trocado, 'OCR_FOTO');
    expect(r).toMatchObject({ precisaConfirmacao: true, podeEditar: true });
  });

  it('linha coerente passa sem pedir nada', () => {
    expect(avaliarConferenciaNota({ qtd: 20, valor_unitario: 18.9, valor_total: 378 }, 'xml_nfe'))
      .toMatchObject({ precisaConfirmacao: false, mostrar: false });
  });

  it('bonificação (valor zero) no XML pede confirmação, não bloqueia', () => {
    const r = avaliarConferenciaNota({ qtd: 2, valor_unitario: 0, valor_total: 0 }, 'xml_nfe');
    expect(r.valoresInvalidos).toBe(false);
    expect(r.precisaConfirmacao).toBe(true);
  });
});
