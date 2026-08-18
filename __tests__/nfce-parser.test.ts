/**
 * Testes do parser da consulta pública de NFC-e.
 *
 * Existe porque a versão anterior só reconhecia o layout "padrão nacional"
 * (txtTit / Qtd.: / UN:) e, contra São Paulo — que usa fixo-prod-serv-* —
 * devolvia zero item em toda nota, sempre com a mesma mensagem genérica.
 * Sem teste, isso passou despercebido.
 */
import { describe, it, expect } from 'vitest';
import { extrairChave, parseHtmlSefazSp } from '../supabase/functions/nfe-importar-qrcode/parser';

const CHAVE = '35260801157555004878651070001051029721313325';

/** Recorte fiel do layout da SEFAZ-SP: tabela de itens com as classes do portal. */
const HTML_SP = `
<html><body>
  <div class="txtTopo">SUPERMERCADO TESTE LTDA</div>
  <div>CNPJ: 01.157.555/0048-78</div>
  <div>Emissão: 04/08/2026 18:43:08</div>
  <table class="toggle">
    <tr>
      <td class="fixo-prod-serv-numero"><span>1</span></td>
      <td class="fixo-prod-serv-descricao"><span>DETERG LIQ MINUANO NEUTRO (Código: 356115)</span></td>
      <td class="fixo-prod-serv-qtd"><span>1,000</span></td>
      <td class="fixo-prod-serv-uc"><span>FR</span></td>
      <td class="fixo-prod-serv-vb"><span>2,39</span></td>
    </tr>
    <tr>
      <td class="fixo-prod-serv-numero"><span>2</span></td>
      <td class="fixo-prod-serv-descricao"><span>APP1 OVOS EXTRA BRANCO PV (Código: 956228)</span></td>
      <td class="fixo-prod-serv-qtd"><span>2,000</span></td>
      <td class="fixo-prod-serv-uc"><span>BD</span></td>
      <td class="fixo-prod-serv-vb"><span>19,80</span></td>
    </tr>
    <tr>
      <td class="fixo-prod-serv-numero"><span>3</span></td>
      <td class="fixo-prod-serv-descricao"><span>ARROZ TIPO 1 PACOTE 5KG</span></td>
      <td class="fixo-prod-serv-qtd"><span>1,000</span></td>
      <td class="fixo-prod-serv-uc"><span>PC</span></td>
      <td class="fixo-prod-serv-vb"><span>1.234,56</span></td>
    </tr>
  </table>
  <span class="txtMax">457,49</span>
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

describe('parseHtmlSefazSp — layout de São Paulo', () => {
  const dados = parseHtmlSefazSp(HTML_SP, CHAVE);

  it('deve encontrar todos os itens da nota', () => {
    expect(dados.itens).toHaveLength(3);
  });

  it('deve ler descrição, quantidade, unidade e valor de cada item', () => {
    expect(dados.itens[1]).toMatchObject({
      num_item: 2,
      descricao: 'APP1 OVOS EXTRA BRANCO PV',
      qtd: 2,
      unidade: 'bd',
      valor_total: 19.8,
      valor_unitario: 9.9,
    });
  });

  it('deve separar o código do mercado da descrição', () => {
    expect(dados.itens[0].codigo_fornecedor).toBe('356115');
    expect(dados.itens[0].descricao).toBe('DETERG LIQ MINUANO NEUTRO');
  });

  it('não deve tratar código interno do mercado como EAN', () => {
    // 356115 não é GTIN válido: virar "gtin" faria o De-Para casar produtos
    // de mercados diferentes que usam o mesmo número interno.
    expect(dados.itens.every((i) => i.gtin === null)).toBe(true);
  });

  it('deve interpretar número brasileiro com milhar e decimal', () => {
    expect(dados.itens[2].valor_total).toBe(1234.56);
  });

  it('deve ler emitente, CNPJ e data de emissão', () => {
    expect(dados.emitente.razao_social).toBe('SUPERMERCADO TESTE LTDA');
    expect(dados.emitente.cnpj).toBe('01.157.555/0048-78');
    expect(dados.data_emissao).toBe('2026-08-04T18:43:08Z');
  });

  it('deve devolver o valor total da nota', () => {
    expect(dados.valor_total).toBe(457.49);
  });
});

describe('parseHtmlSefazSp — página sem itens', () => {
  it('deve devolver lista vazia em vez de quebrar', () => {
    const dados = parseHtmlSefazSp('<html><body>QR Code inválido</body></html>', CHAVE);
    expect(dados.itens).toEqual([]);
  });
});
