/**
 * O desconto da nota, com os números do cupom real do Tenda.
 *
 * O papel fecha assim:
 *     total de itens        53
 *     produtos       R$ 472,37
 *     Desconto       R$  14,88
 *     Valor total    R$ 457,49
 *
 * Sem ler a linha do desconto, o estoque entra pelos 472,37 e todo cálculo de
 * preço feito depois parte de um custo 3,2% maior do que a compra custou.
 * Ninguém percebe: cada item isolado bate com o papel, só o total é que não.
 */
import { describe, it, expect } from 'vitest';
import { parseHtmlSefazSp } from '../supabase/functions/nfe-importar-qrcode/parser';

const CHAVE = '35260801157555004878651070001051029721313325';

const item = (n: number, nome: string, total: string) => `
<tr id="Item + ${n}">
  <td class="txtTit2">
    <span class="txtTit2">${nome}</span>
    <span class="RCod">(Código:  ${1000 + n} )</span><br>
    <span class="Rqtd"><strong>Qtde.:</strong>1</span>
    <span class="RUN"><strong>UN: </strong>UN</span>
    <span class="RvlUnit"><strong>Vl. Unit.:</strong>&nbsp;&nbsp;${total}</span>
  </td>
  <td class="txtTit noWrap"><span class="txtTit">Vl. Total</span><span class="valor">${total}</span></td>
</tr>`;

/** Rodapé exatamente como a consulta pública escreve. */
const pagina = (linhas: string, rodape: string) => `
<html><body>
<div class="txtTopo">TENDA ATACADO LTDA (VL GALVAO)</div>
<table id="tabResult">${linhas}</table>
<div id="totalNota">${rodape}</div>
</body></html>`;

const RODAPE_REAL = `
  <div><span>Qtd. total de itens</span><span>53</span></div>
  <div><span class="totalNumb">Valor total R$</span><span class="totalNumb">472,37</span></div>
  <div><span>Descontos R$</span><span>14,88</span></div>
  <div><span class="totalNumb txtMax">Valor a pagar R$</span><span class="totalNumb txtMax">457,49</span></div>
  <div><span>Emissão: </span><span>04/08/2026 18:43:08</span></div>`;

/** Mesmo rateio proporcional que o modal aplica antes de gravar o custo. */
function custoComDesconto(valorItem: number, somaItens: number, desconto: number): number {
  if (desconto <= 0 || somaItens <= 0) return valorItem;
  const p = valorItem - desconto * (valorItem / somaItens);
  return p > 0 ? Number(p.toFixed(4)) : valorItem;
}

describe('desconto da nota', () => {
  const dados = parseHtmlSefazSp(
    pagina(item(1, 'TOMATE SALADA kg', '272,37') + item(2, 'AGUA SANIT SELECT 2L', '200,00'), RODAPE_REAL),
    CHAVE,
  );

  it('lê a linha de desconto que o cupom imprime', () => {
    expect(dados.desconto).toBe(14.88);
  });

  it('rateia o desconto na proporção do valor de cada item', () => {
    const soma = dados.itens.reduce((a, i) => a + i.valor_total, 0);
    const custos = dados.itens.map((i) => custoComDesconto(i.valor_total, soma, dados.desconto!));

    // A soma dos custos rateados tem que ser o que saiu do caixa.
    expect(custos.reduce((a, c) => a + c, 0)).toBeCloseTo(soma - 14.88, 2);
    // E cada item leva a fatia proporcional ao próprio valor, não uma fatia igual.
    expect(custos[0]).toBeGreaterThan(custos[1]);
  });

  it('o custo por item cai, e é isso que corrige o CMV', () => {
    const soma = dados.itens.reduce((a, i) => a + i.valor_total, 0);
    for (const i of dados.itens) {
      expect(custoComDesconto(i.valor_total, soma, dados.desconto!)).toBeLessThan(i.valor_total);
    }
  });

  it('nota sem desconto não muda nada', () => {
    const semDesconto = parseHtmlSefazSp(
      pagina(item(1, 'ARROZ 5KG', '49,80'), '<div><span class="totalNumb txtMax">Valor total R$</span><span class="totalNumb txtMax">49,80</span></div>'),
      CHAVE,
    );
    expect(semDesconto.desconto).toBeUndefined();
    expect(custoComDesconto(49.8, 49.8, 0)).toBe(49.8);
  });

  it('desconto absurdo não gera custo negativo', () => {
    // Emissor com rodapé torto não pode produzir estoque de custo negativo,
    // que quebraria o PEPS silenciosamente.
    expect(custoComDesconto(10, 10, 999)).toBe(10);
  });
});
