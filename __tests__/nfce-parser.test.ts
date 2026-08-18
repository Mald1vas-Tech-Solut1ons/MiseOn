/**
 * Testes do parser da consulta pública de NFC-e.
 *
 * O HTML abaixo reproduz a página que a SEFAZ-SP realmente devolveu para o
 * cupom do TENDA ATACADO (chave 3526...3325), incluindo as pegadinhas que
 * derrubaram as versões anteriores do parser:
 *
 *   • os itens vêm em <tr id="Item + 1">, com espaços e sinal de mais, e não
 *     em <tr id="Item1"> como o código dividia;
 *   • a página escreve "Qtde.:" — o código procurava "Qtd.:";
 *   • descrição, código, quantidade e valores ficam em <span> separados, então
 *     o texto precisa ser lido com fronteira entre elementos.
 */
import { describe, it, expect } from 'vitest';
import { extrairChave, parseHtmlSefazSp } from '../supabase/functions/nfe-importar-qrcode/parser';

const CHAVE = '35260801157555004878651070001051029721313325';

const item = (n: number, nome: string, codigo: string, qtd: string, un: string, unit: string, total: string) => `
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

const HTML_REAL = `
<html><body>
<div id="avisos"></div>
<div class="txtTopo">TENDA ATACADO LTDA (VL GALVAO)</div>
<div class="text">CNPJ: 01.157.555/0048-78</div>
<div class="text">AVENIDA PEDRO DE SOUZA LOPES , 900 , , VILA GALVAO , GUARULHOS , SP</div>
<table id="tabResult">
${item(1, 'TOMATE SALADA kg', '2410', '1,022', 'kg', '6,99', '7,14')}
${item(2, 'SALSA un', '188891', '1', 'UN', '3,99', '3,99')}
${item(3, 'APP1 PEITO FGO CONG C OSSO Kg', '2717', '2,446', 'kg', '10,9', '26,66')}
${item(4, 'CARNE MOIDA SUINA CONG PAMPLONA 500g', '942469', '1', 'UN', '9,89', '9,89')}
${item(5, 'LING CALABRESA APIM RESF BRAGANCA Kg', '3036', '0,582', 'kg', '15,93', '9,27')}
${item(6, 'BISC REC TODDY CHOC 130g', '7891962057019', '3', 'UN', '2,49', '7,47')}
</table>
<div id="totalNota">
  <div><span class="totalNumb txtMax">Valor total R$</span><span class="totalNumb txtMax">457,49</span></div>
  <div><span>Emissão: </span><span>04/08/2026 18:43:08</span></div>
</div>
</body></html>`;

describe('extrairChave', () => {
  it('deve achar a chave dentro da URL do QR Code e reconhecer a UF', () => {
    const url = `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${CHAVE}|2|1|1|A1B2C3`;
    expect(extrairChave(url)).toEqual({ chave: CHAVE, uf: 'SP' });
  });

  it('deve aceitar a chave solta de 44 dígitos', () => {
    expect(extrairChave(CHAVE)?.chave).toBe(CHAVE);
  });

  it('deve recusar entrada sem 44 dígitos', () => {
    expect(extrairChave('https://www.nfce.fazenda.sp.gov.br/consulta')).toBeNull();
  });
});

describe('parseHtmlSefazSp — página real da SEFAZ-SP', () => {
  const dados = parseHtmlSefazSp(HTML_REAL, CHAVE);

  it('deve encontrar todos os itens da nota', () => {
    expect(dados.itens).toHaveLength(6);
  });

  it('deve ler o primeiro item exatamente como a SEFAZ mostra', () => {
    expect(dados.itens[0]).toMatchObject({
      descricao: 'TOMATE SALADA kg',
      codigo_fornecedor: '2410',
      qtd: 1.022,
      unidade: 'kg',
      valor_unitario: 6.99,
      valor_total: 7.14,
    });
  });

  it('deve ler item vendido por peso, com decimal de três casas', () => {
    expect(dados.itens[4]).toMatchObject({
      descricao: 'LING CALABRESA APIM RESF BRAGANCA Kg',
      qtd: 0.582,
      unidade: 'kg',
      valor_total: 9.27,
    });
  });

  it('deve manter a descrição sem misturar item vizinho', () => {
    expect(dados.itens[1].descricao).toBe('SALSA un');
    expect(dados.itens[3].descricao).toBe('CARNE MOIDA SUINA CONG PAMPLONA 500g');
  });

  it('não deve tratar código interno do mercado como EAN', () => {
    // 2410 e 942469 são códigos do Tenda, não GTIN. Se virassem gtin, o De-Para
    // casaria produtos de mercados diferentes que reusam o mesmo número.
    expect(dados.itens[0].gtin).toBeNull();
    expect(dados.itens[3].gtin).toBeNull();
  });

  it('deve reconhecer EAN de verdade quando o código for um GTIN válido', () => {
    expect(dados.itens[5].gtin).toBe('7891962057019');
  });

  it('deve ler emitente, CNPJ, total e data de emissão', () => {
    expect(dados.emitente.razao_social).toBe('TENDA ATACADO LTDA (VL GALVAO)');
    expect(dados.emitente.cnpj).toBe('01.157.555/0048-78');
    expect(dados.valor_total).toBe(457.49);
    expect(dados.data_emissao).toBe('2026-08-04T18:43:08Z');
  });
});

describe('parseHtmlSefazSp — página sem itens', () => {
  it('deve devolver lista vazia em vez de quebrar', () => {
    const dados = parseHtmlSefazSp('<html><body>QR Code inválido</body></html>', CHAVE);
    expect(dados.itens).toEqual([]);
  });
});
