/**
 * O caminho inteiro de uma nota de atacado, do HTML da SEFAZ ao que seria
 * gravado no estoque.
 *
 * Os testes de unidade provam cada peça. Este prova a junta entre elas, que é
 * onde erro de importação realmente mora: o parser lê 53 itens, o catálogo
 * decide 53 destinos e a RPC recebe 53 linhas — e qualquer uma delas com
 * unidade fora do catálogo derrubaria a nota inteira, que foi o bug original.
 */
import { describe, it, expect } from 'vitest';
import { parseHtmlSefazSp } from '../supabase/functions/nfe-importar-qrcode/parser';
import { sugerirDaNota, unidadeSegura, GRUPOS_UNIDADE_COMPRA } from '../src/lib/catalogoInsumos';
import { interpretarEntradaNota } from '../src/lib/entradaNota';
import { UNIDADES } from '../src/lib/unidades';

const CHAVE = '35260801157555004878651070001051029721313325';
const HASH = 'A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0';

/** Itens reais de um cupom de atacado, com as siglas que o mercado imprime. */
const ITENS: [string, string, string, string, string][] = [
  ['TOMATE SALADA kg', '2410', '1,022', 'kg', '7,14'],
  ['SALSA un', '188891', '1', 'UN', '3,99'],
  ['APP1 PEITO FGO CONG C OSSO Kg', '2717', '2,446', 'kg', '26,66'],
  ['CARNE MOIDA SUINA CONG PAMPLONA 500g', '942469', '1', 'UN', '9,89'],
  ['LING CALABRESA APIM RESF BRAGANCA Kg', '3036', '0,582', 'kg', '9,27'],
  ['BISC REC TODDY CHOC 130g', '7891962057019', '3', 'UN', '7,47'],
  ['AGUA SANIT SELECT 2L', '223344', '1', 'UN', '4,89'],
  ['APP1 OVOS EXTRA BRANCO PVC 20UN', '956228', '2', 'BD', '19,80'],
  ['ARROZ TIO JOAO T1 5KG', '556677', '2', 'PC', '49,80'],
  ['LEITE ITALAC INTEGRAL 1L', '889900', '12', 'UN', '51,48'],
  ['OLEO SOJA LIZA 900ML', '131415', '6', 'LT', '38,94'],
  ['CEBOLA BRANCA NACIONAL', '445566', '1,2', 'KG', '5,39'],
  ['ACUCAR REFINADO UNIAO 1KG', '667788', '5', 'PT', '24,50'],
  ['MUC FATIADA TIROLEZ 500G', '778899', '2', 'UN', '39,80'],
  ['DET LIQ YPE CLEAR 500ML', '990011', '12', 'PC', '29,88'],
  ['BATATA LAVADA', '112200', '3,455', 'kg', '20,73'],
  ['REFRI COCA COLA PET 2L', '334455', '6', 'GF', '53,40'],
];

const linha = (n: number, [nome, cod, qtd, un, total]: typeof ITENS[number]) => `
<tr id="Item + ${n}">
  <td class="txtTit2">
    <span class="txtTit2">${nome}</span>
    <span class="RCod">(Código:  ${cod} )</span><br>
    <span class="Rqtd"><strong>Qtde.:</strong>${qtd}</span>
    <span class="RUN"><strong>UN: </strong>${un}</span>
    <span class="RvlUnit"><strong>Vl. Unit.:</strong>&nbsp;&nbsp;1,00</span>
  </td>
  <td class="txtTit noWrap"><span class="txtTit">Vl. Total</span><span class="valor">${total}</span></td>
</tr>`;

// 53 itens: a lista real repetida até fechar o tamanho do cupom da foto.
const HTML = `
<html><body>
<div class="txtTopo">TENDA ATACADO LTDA (VL GALVAO)</div>
<div class="text">CNPJ: 01.157.555/0048-78</div>
<table id="tabResult">
${Array.from({ length: 53 }, (_, i) => linha(i + 1, ITENS[i % ITENS.length])).join('')}
</table>
<div id="totalNota">
  <div><span class="totalNumb txtMax">Valor total R$</span><span class="totalNumb txtMax">457,49</span></div>
  <div><span>Emissão: </span><span>04/08/2026 18:43:08</span></div>
</div>
</body></html>`;

describe('do QR Code até a lista pronta para o estoque', () => {
  it('a URL do QR é aceita e leva a chave certa', () => {
    const entrada = interpretarEntradaNota(`https://www.nfce.fazenda.sp.gov.br/qrcode?p=${CHAVE}|2|1|1|${HASH}`);
    expect(entrada.podeConsultar).toBe(true);
    expect(entrada.chave).toBe(CHAVE);
  });

  const nota = parseHtmlSefazSp(HTML, CHAVE);

  it('os 53 itens chegam inteiros do HTML da SEFAZ', () => {
    expect(nota.itens).toHaveLength(53);
    expect(nota.emitente.razao_social).toContain('TENDA ATACADO');
    expect(nota.emitente.cnpj).toBe('01.157.555/0048-78');
  });

  const sugestoes = nota.itens.map((i) =>
    sugerirDaNota({ descricao: i.descricao, unidade: i.unidade, qtd: i.qtd }));

  it('TODA linha recebe uma unidade que o banco aceita', () => {
    // Este é o teste que o bug original teria reprovado: a sigla "BD" da
    // bandeja de ovos ia crua para insumos.unidade_medida e a FK derrubava as
    // 53 linhas de uma vez.
    const validas = new Set(UNIDADES.map((u) => u.codigo));
    for (const [i, s] of sugestoes.entries()) {
      expect(validas.has(unidadeSegura(s.unidade)), `${nota.itens[i].descricao} → ${s.unidade}`).toBe(true);
    }
  });

  it('nenhum item nasce numa unidade de preparo', () => {
    const semanticas = new Set(UNIDADES.filter((u) => u.grandeza === 'semantico').map((u) => u.codigo));
    for (const s of sugestoes) expect(semanticas.has(s.unidade)).toBe(false);
  });

  it('nenhum item nasce numa unidade que a tela não oferece', () => {
    const oferecidas = new Set(GRUPOS_UNIDADE_COMPRA.flatMap((g) => g.unidades).map((u) => u.codigo));
    for (const [i, s] of sugestoes.entries()) {
      expect(oferecidas.has(s.unidade), `${nota.itens[i].descricao} → ${s.unidade}`).toBe(true);
    }
  });

  it('toda linha rende quantidade positiva no estoque', () => {
    for (const [i, s] of sugestoes.entries()) {
      const qtdFinal = nota.itens[i].qtd * s.fator;
      expect(qtdFinal, nota.itens[i].descricao).toBeGreaterThan(0);
      expect(Number.isFinite(qtdFinal)).toBe(true);
    }
  });

  it('o custo unitário nunca vira infinito nem NaN', () => {
    for (const [i, s] of sugestoes.entries()) {
      const qtdFinal = nota.itens[i].qtd * s.fator;
      const custo = nota.itens[i].valor_total / qtdFinal;
      expect(Number.isFinite(custo), nota.itens[i].descricao).toBe(true);
    }
  });

  it('a maioria esmagadora é reconhecida sem precisar de IA', () => {
    const comGenero = sugestoes.filter((s) => s.slug).length;
    // A IA existe para a cauda longa, não para carregar o fluxo: se este número
    // cair, o catálogo regrediu e o custo por nota sobe junto.
    expect(comGenero / sugestoes.length).toBeGreaterThan(0.8);
  });

  it('os itens do cupom da foto saem exatamente como se espera', () => {
    const porDescricao = (t: string) =>
      sugestoes[nota.itens.findIndex((i) => i.descricao.includes(t))];

    expect(porDescricao('OVOS')).toMatchObject({ nome: 'Ovos', unidade: 'un', fator: 20 });
    expect(porDescricao('AGUA SANIT')).toMatchObject({ nome: 'Água sanitária', unidade: 'L', fator: 2 });
    expect(porDescricao('TOMATE')).toMatchObject({ nome: 'Tomate', unidade: 'kg', fator: 1 });
    expect(porDescricao('ARROZ')).toMatchObject({ nome: 'Arroz', unidade: 'kg', fator: 5 });
    expect(porDescricao('LEITE')).toMatchObject({ nome: 'Leite', unidade: 'L' });
    expect(porDescricao('BATATA LAVADA')).toMatchObject({ nome: 'Batata', unidade: 'kg' });
  });

  it('o payload da RPC sai completo, com uma linha por item marcado', () => {
    const payload = nota.itens.map((item, i) => ({
      criar_novo: true,
      nome: sugestoes[i].nome,
      unidade: unidadeSegura(sugestoes[i].unidade),
      catalogo_ref: sugestoes[i].slug,
      qtd_nota: item.qtd,
      fator: sugestoes[i].fator,
      custo_total: item.valor_total,
    })).filter((p) => p.qtd_nota * p.fator > 0);

    expect(payload).toHaveLength(53);
    // O filtro da tela descarta linha com quantidade zero; nenhuma pode cair
    // aqui, senão a nota entra pela metade sem ninguém perceber.
    expect(payload.every((p) => p.custo_total > 0)).toBe(true);
  });
});
