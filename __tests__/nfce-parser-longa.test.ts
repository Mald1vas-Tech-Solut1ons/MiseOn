/**
 * O parser sob carga real: cupom de atacado.
 *
 * O cupom que motivou tudo isto tem 53 itens. Parser de nota fiscal não pode
 * "quase" funcionar: item perdido em silêncio é estoque que não bate, e o
 * lojista só descobre semanas depois, no CMV torto. Aqui a régua é 100% dos
 * itens, com as variações que a página da SEFAZ realmente produz.
 */
import { describe, it, expect } from 'vitest';
import { parseHtmlSefazSp, parseItens } from '../supabase/functions/nfe-importar-qrcode/parser';

const CHAVE = '35260801157555004878651070001051029721313325';

/** Linha de item no formato exato da consulta pública da SEFAZ-SP. */
const item = (
  n: number, nome: string, codigo: string, qtd: string, un: string, unit: string, total: string,
) => `
<tr id="Item + ${n}">
  <td class="txtTit2">
    <span class="txtTit2">${nome}</span>
    <span class="RCod">(Código:  ${codigo} )</span><br>
    <span class="Rqtd"><strong>Qtde.:</strong>${qtd}</span>
    <span class="RUN"><strong>UN: </strong>${un}</span>
    <span class="RvlUnit"><strong>Vl. Unit.:</strong>&nbsp;&nbsp;${unit}</span>
  </td>
  <td class="txtTit noWrap"><span class="txtTit">Vl. Total</span><span class="valor">${total}</span></td>
</tr>`;

const pagina = (linhas: string) => `
<html><body>
<div class="txtTopo">TENDA ATACADO LTDA (VL GALVAO)</div>
<div class="text">CNPJ: 01.157.555/0048-78</div>
<table id="tabResult">${linhas}</table>
<div id="totalNota">
  <div><span class="totalNumb txtMax">Valor total R$</span><span class="totalNumb txtMax">457,49</span></div>
  <div><span>Emissão: </span><span>04/08/2026 18:43:08</span></div>
</div>
</body></html>`;

describe('cupom de atacado com 53 itens', () => {
  const nomes = [
    'TOMATE SALADA kg', 'SALSA un', 'APP1 PEITO FGO CONG C OSSO Kg',
    'CARNE MOIDA SUINA CONG PAMPLONA 500g', 'LING CALABRESA APIM RESF BRAGANCA Kg',
    'BISC REC TODDY CHOC 130g', 'AGUA SANIT SELECT 2L', 'APP1 OVOS EXTRA BRANCO PVC 20UN',
  ];
  const linhas = Array.from({ length: 53 }, (_, i) =>
    item(i + 1, `${nomes[i % nomes.length]} ${i + 1}`, String(1000 + i),
      i % 3 === 0 ? '1,022' : String(i + 1), i % 3 === 0 ? 'kg' : 'UN',
      '6,99', '7,14'),
  ).join('');

  const dados = parseHtmlSefazSp(pagina(linhas), CHAVE);

  it('lê os 53 itens, sem perder nenhum no meio', () => {
    expect(dados.itens).toHaveLength(53);
  });

  it('numera os itens em sequência, do primeiro ao último', () => {
    expect(dados.itens.map((i) => i.num_item)).toEqual(
      Array.from({ length: 53 }, (_, i) => i + 1),
    );
  });

  it('não deixa a descrição de um item vazar para o seguinte', () => {
    expect(dados.itens[0].descricao).toBe('TOMATE SALADA kg 1');
    expect(dados.itens[52].descricao).toBe(`${nomes[52 % nomes.length]} 53`);
    for (const i of dados.itens) {
      expect(i.descricao).not.toMatch(/Vl\.|Qtde|Código/i);
    }
  });

  it('mantém quantidade e valores de cada linha', () => {
    expect(dados.itens[0]).toMatchObject({ qtd: 1.022, unidade: 'kg', valor_total: 7.14 });
    expect(dados.itens[1]).toMatchObject({ qtd: 2, unidade: 'un' });
  });
});

describe('variações que a página da SEFAZ produz', () => {
  it('lê item cujo valor unitário tem separador de milhar', () => {
    const itens = parseItens(pagina(item(1, 'PERNIL SUINO PECA', '9911', '1', 'UN', '1.234,56', '1.234,56')));
    expect(itens[0].valor_unitario).toBe(1234.56);
    expect(itens[0].valor_total).toBe(1234.56);
  });

  it('lê quantidade com quatro casas decimais', () => {
    const itens = parseItens(pagina(item(1, 'QUEIJO MUSSARELA FATIADO', '7788', '0,3255', 'kg', '44,90', '14,61')));
    expect(itens[0].qtd).toBeCloseTo(0.3255);
  });

  it('aguenta acento, & e símbolo na descrição', () => {
    const itens = parseItens(pagina(item(1, 'PÃO & CIA INTEGRAL 500g 12% FIBRA', '5511', '2', 'UN', '8,90', '17,80')));
    expect(itens[0].descricao).toContain('PÃO & CIA INTEGRAL');
    expect(itens).toHaveLength(1);
  });

  it('lê descrição longa de atacado sem truncar o item', () => {
    const longa = 'APP1 FILE DE PEITO DE FRANGO CONGELADO SEM OSSO SEM PELE EMBALAGEM ECONOMICA FAMILIA GRANDE 2KG';
    const itens = parseItens(pagina(item(1, longa, '3344', '1', 'UN', '29,90', '29,90')));
    expect(itens).toHaveLength(1);
    expect(itens[0].descricao).toBe(longa);
  });

  it('não perde o item seguinte quando um deles vem sem código', () => {
    // Item de balança do próprio mercado às vezes sai sem "(Código: N)".
    const semCodigo = `
<tr id="Item + 1">
  <td class="txtTit2">
    <span class="txtTit2">PAO FRANCES kg</span><br>
    <span class="Rqtd"><strong>Qtde.:</strong>0,450</span>
    <span class="RUN"><strong>UN: </strong>kg</span>
    <span class="RvlUnit"><strong>Vl. Unit.:</strong>&nbsp;&nbsp;18,90</span>
  </td>
  <td class="txtTit noWrap"><span class="txtTit">Vl. Total</span><span class="valor">8,51</span></td>
</tr>`;
    const itens = parseItens(pagina(semCodigo + item(2, 'LEITE INTEGRAL 1L', '2233', '12', 'UN', '4,29', '51,48')));
    // O item com código nunca pode ser engolido pelo vizinho sem código.
    expect(itens.some((i) => i.descricao.includes('LEITE INTEGRAL'))).toBe(true);
  });

  it('não repete item nem inventa linha', () => {
    const dados = parseHtmlSefazSp(pagina(
      item(1, 'ARROZ TIO JOAO 5KG', '1111', '2', 'UN', '24,90', '49,80') +
      item(2, 'FEIJAO CARIOCA 1KG', '2222', '3', 'UN', '8,49', '25,47'),
    ), CHAVE);
    expect(dados.itens).toHaveLength(2);
    expect(new Set(dados.itens.map((i) => i.descricao)).size).toBe(2);
  });

  it('soma dos itens fecha com o total quando a página traz o total', () => {
    const dados = parseHtmlSefazSp(pagina(
      item(1, 'ITEM A', '1', '1', 'UN', '100,00', '100,00') +
      item(2, 'ITEM B', '2', '1', 'UN', '357,49', '357,49'),
    ), CHAVE);
    const soma = dados.itens.reduce((a, i) => a + i.valor_total, 0);
    expect(soma).toBeCloseTo(dados.valor_total, 2);
  });
});
