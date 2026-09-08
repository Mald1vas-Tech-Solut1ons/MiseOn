/**
 * @vitest-environment jsdom
 *
 * O parser usa DOMParser (API do navegador) — no ambiente node do vitest ele
 * nem existe, e o teste falharia por 'DOMParser is not defined' em vez de
 * medir o que interessa.
 */
/**
 * XML da NFe: o parser extrai FATO, não interpreta.
 *
 * Esta suíte existe porque a rota de XML é a única das três que o lojista não
 * conseguiu testar (ele não tem nota de fornecedor em XML) — e é justamente a
 * mais confiável, a que vai carregar o estoque de verdade. Sem teste, ela era
 * a rota sem nenhuma prova.
 *
 * O que está travado aqui é a separação semântica que o mandato exige: em
 * `qCom=20 / uCom=KG / vUnCom=18,90 / vProd=378,00`, a quantidade é 20 e o
 * valor total é 378 — 378 NUNCA pode virar quantidade nem peso. É o erro que
 * transforma um dado fiscal correto em estoque semanticamente errado.
 */

import { describe, it, expect } from 'vitest';
import { parseNFeXml } from '../src/lib/parseNFeXml';

/** Monta uma NFe modelo 55 mínima, porém com a estrutura real do layout. */
function nfe(itens: string, total = '378.00'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe35260812345678000199550010000012341000012348" versao="4.00">
      <ide><dhEmi>2026-08-12T09:15:00-03:00</dhEmi></ide>
      <emit><CNPJ>12345678000199</CNPJ><xNome>DISTRIBUIDORA TESTE LTDA</xNome></emit>
      ${itens}
      <total><ICMSTot><vProd>${total}</vProd><vDesc>0.00</vDesc><vNF>${total}</vNF></ICMSTot></total>
    </infNFe>
  </NFe>
</nfeProc>`;
}

function det(n: number, p: Record<string, string>): string {
  return `<det nItem="${n}"><prod>${Object.entries(p)
    .map(([k, v]) => `<${k}>${v}</${k}>`)
    .join('')}</prod></det>`;
}

describe('parseNFeXml — o documento manda', () => {
  it('20 KG a 18,90: quantidade é 20 e valor total é 378 — nunca o contrário', () => {
    const xml = nfe(
      det(1, {
        cProd: '7891',
        cEAN: '7891000315507',
        xProd: 'ACEM BOVINO RESFRIADO',
        NCM: '02013000',
        CFOP: '5102',
        uCom: 'KG',
        qCom: '20.0000',
        vUnCom: '18.9000000000',
        vProd: '378.00',
      }),
    );

    const nota = parseNFeXml(xml);
    expect(nota.itens).toHaveLength(1);

    const item = nota.itens[0];
    expect(item.qtd).toBe(20);
    expect(item.unidade).toBe('KG');
    expect(item.valor_unitario).toBeCloseTo(18.9, 4);
    expect(item.valor_total).toBeCloseTo(378, 2);

    // A armadilha explícita do mandato: o total não pode contaminar a
    // quantidade nem o peso.
    expect(item.qtd).not.toBe(378);
  });

  it('10 CX a 50,00: a caixa continua caixa — converter é decisão de outra camada', () => {
    const xml = nfe(
      det(1, {
        cProd: 'REF12',
        cEAN: 'SEM GTIN',
        xProd: 'REFRIGERANTE COLA 350ML CX 12',
        NCM: '22021000',
        uCom: 'CX',
        qCom: '10.0000',
        vUnCom: '50.0000000000',
        vProd: '500.00',
      }),
      '500.00',
    );

    const item = parseNFeXml(xml).itens[0];
    expect(item.qtd).toBe(10);
    expect(item.unidade).toBe('CX');
    expect(item.valor_total).toBeCloseTo(500, 2);
    // cEAN inválido ("SEM GTIN") não vira código de barras.
    expect(item.gtin).toBeNull();
  });

  it('NCM vem junto: é o classificador determinístico que a nota já carrega', () => {
    const xml = nfe(
      det(1, {
        cProd: '99',
        cEAN: '7896098900116',
        xProd: 'AGUA SANITARIA 5L',
        NCM: '34022000',
        uCom: 'UN',
        qCom: '6.0000',
        vUnCom: '8.5000000000',
        vProd: '51.00',
      }),
      '51.00',
    );

    const item = parseNFeXml(xml).itens[0];
    expect(item.ncm).toBe('34022000');
    expect(item.gtin).toBe('7896098900116');
    // O parser NÃO decide que isto é limpeza — ele só entrega o fato.
    // Quem classifica é fn_classificar_insumo, no banco, e por isso o NCM
    // precisa chegar lá inteiro.
    expect(item.ncm?.slice(0, 2)).toBe('34');
  });

  it('quantidade fracionada de item pesável sobrevive à leitura', () => {
    const xml = nfe(
      det(1, {
        cProd: '55',
        cEAN: '2000000000000',
        xProd: 'QUEIJO MUSSARELA FATIADO',
        NCM: '04061010',
        uCom: 'KG',
        qCom: '2.4560',
        vUnCom: '42.9000000000',
        vProd: '105.36',
      }),
      '105.36',
    );

    const item = parseNFeXml(xml).itens[0];
    expect(item.qtd).toBeCloseTo(2.456, 4);
    expect(item.valor_total).toBeCloseTo(105.36, 2);
  });

  it('lê a nota inteira: emitente, chave, data e todos os itens na ordem', () => {
    const xml = nfe(
      det(1, { cProd: 'A', xProd: 'ITEM UM', NCM: '07010000', uCom: 'KG', qCom: '3', vUnCom: '5', vProd: '15.00' }) +
        det(2, { cProd: 'B', xProd: 'ITEM DOIS', NCM: '22021000', uCom: 'UN', qCom: '2', vUnCom: '10', vProd: '20.00' }),
      '35.00',
    );

    const nota = parseNFeXml(xml);
    expect(nota.chave).toBe('35260812345678000199550010000012341000012348');
    expect(nota.uf).toBe('35');
    expect(nota.emitente.razao_social).toBe('DISTRIBUIDORA TESTE LTDA');
    expect(nota.emitente.cnpj).toBe('12345678000199');
    expect(nota.data_emissao).toContain('2026-08-12');
    expect(nota.valor_total).toBeCloseTo(35, 2);
    expect(nota.itens.map((i) => i.descricao)).toEqual(['ITEM UM', 'ITEM DOIS']);
    expect(nota.itens.map((i) => i.num_item)).toEqual([1, 2]);
    expect(nota.origem).toBe('xml_nfe');
  });

  it('desconto da nota é lido — sem ele o CMV nasce acima do que a compra custou', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe><infNFe Id="NFe35260812345678000199550010000012341000012348" versao="4.00">
    <ide><dhEmi>2026-08-12T09:15:00-03:00</dhEmi></ide>
    <emit><CNPJ>12345678000199</CNPJ><xNome>DISTRIBUIDORA TESTE LTDA</xNome></emit>
    ${det(1, { cProd: 'A', xProd: 'ITEM', NCM: '07010000', uCom: 'KG', qCom: '10', vUnCom: '47.237', vProd: '472.37' })}
    <total><ICMSTot><vProd>472.37</vProd><vDesc>14.88</vDesc><vNF>457.49</vNF></ICMSTot></total>
  </infNFe></NFe>
</nfeProc>`;

    const nota = parseNFeXml(xml);
    expect(nota.valor_produtos).toBeCloseTo(472.37, 2);
    expect(nota.desconto).toBeCloseTo(14.88, 2);
    // valor_total é o que saiu do caixa, com desconto abatido.
    expect(nota.valor_total).toBeCloseTo(457.49, 2);
  });

  it('XML que não é NFe falha claro, em vez de importar lixo', () => {
    expect(() => parseNFeXml('<html><body>não sou nota</body></html>')).toThrow(/Nenhum item/i);
    expect(() => parseNFeXml('{ isto: "json" }')).toThrow();
  });
});
