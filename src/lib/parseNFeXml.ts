import type { NotaLida, LoteDaNota } from '../hooks/useImportacaoNota';
import { conferirValoresNota } from './conferenciaNota';

/**
 * Lê o XML de uma NFe Modelo 55 (nota de fornecedor/distribuidora — o
 * documento que chega por e-mail ou portal do fornecedor, diferente do
 * cupom NFC-e que o cliente final recebe na compra). Devolve o mesmo
 * formato `NotaLida` que a consulta por QR Code e a leitura por foto —
 * é o que deixa as três rotas caírem na mesma tela de conferência.
 *
 * O PARSER EXTRAI FATOS, NÃO INTERPRETA. Cada campo do XML vai para o campo
 * de mesmo significado e nenhum outro:
 *
 *   qCom   → qtd                (quantidade comercial)
 *   uCom   → unidade            (unidade comercial)
 *   vUnCom → valor_unitario
 *   vProd  → valor_total        (NUNCA quantidade, NUNCA peso)
 *   qTrib/uTrib → qtd_tributavel/unidade_tributavel (a conversão CX → UN
 *                 que a própria nota declara)
 *   rastro → lotes              (lote, fabricação, validade)
 *
 * "20 KG × 18,90 = 378" sai como 20 kg a 18,90, total 378 — o 378 não tem
 * como virar quantidade porque não passa por nenhum campo de quantidade.
 */

/** Número do XML: ponto decimal, sem milhar. Vazio/inválido = null, não 0. */
function numero(texto: string | null | undefined): number | null {
  if (texto == null || texto.trim() === '') return null;
  const n = Number(texto.trim());
  return Number.isFinite(n) ? n : null;
}

/** Filho direto por nome local — imune a prefixo de namespace. */
function filho(pai: Element, nome: string): Element | null {
  for (const el of Array.from(pai.children)) if (el.localName === nome) return el;
  return null;
}
const textoDe = (pai: Element | null, nome: string) => (pai ? filho(pai, nome)?.textContent ?? null : null);

export function parseNFeXml(xmlText: string): NotaLida {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  if (xmlDoc.querySelector('parsererror')) {
    throw new Error('Arquivo XML mal formado — confira se é o XML original da nota, sem edição.');
  }

  const emitenteNome = xmlDoc.querySelector('emit > xNome')?.textContent || 'Fornecedor desconhecido';
  const emitenteCnpj = xmlDoc.querySelector('emit > CNPJ')?.textContent || null;
  const dhEmi = xmlDoc.querySelector('ide > dhEmi')?.textContent || null;
  const vNF = numero(xmlDoc.querySelector('total > ICMSTot > vNF')?.textContent) ?? 0;
  const vProd = numero(xmlDoc.querySelector('total > ICMSTot > vProd')?.textContent) ?? 0;
  const vDesc = numero(xmlDoc.querySelector('total > ICMSTot > vDesc')?.textContent) ?? 0;

  // Chave de acesso vem no atributo Id do infNFe ("NFe" + 44 dígitos) — é
  // o que permite travar reimportação da mesma nota, igual ao cupom NFC-e.
  const infNFeId = xmlDoc.querySelector('infNFe')?.getAttribute('Id') || '';
  const chave = infNFeId.replace(/^NFe/, '');
  const uf = chave.slice(0, 2);

  const detList = xmlDoc.querySelectorAll('det');
  const itens: NotaLida['itens'] = [];

  detList.forEach((det, idx) => {
    const prod = filho(det, 'prod');
    if (!prod) return;
    const codigo = textoDe(prod, 'cProd') || '';
    const descricao = textoDe(prod, 'xProd') || `Item ${idx + 1}`;
    // Quantidade ausente é defeito do documento, não "1". A conferência
    // aritmética abaixo marca a linha em vez de inventar.
    const qtd = numero(textoDe(prod, 'qCom')) ?? 0;
    const unidade = (textoDe(prod, 'uCom') || '').trim() || 'UN';
    const valorUnitario = numero(textoDe(prod, 'vUnCom')) ?? 0;
    const valorTotal = numero(textoDe(prod, 'vProd')) ?? 0;

    const cEAN = (textoDe(prod, 'cEAN') || '').trim();
    const cEANTrib = (textoDe(prod, 'cEANTrib') || '').trim();
    const gtin = /^\d{8,14}$/.test(cEAN) ? cEAN : /^\d{8,14}$/.test(cEANTrib) ? cEANTrib : null;

    // NCM é o classificador determinístico que a nota já carrega. Capítulo
    // fiscal não é opinião: 34 é sabão/limpeza, 02 é carne.
    const ncmBruto = (textoDe(prod, 'NCM') || '').replace(/\D/g, '');
    const ncm = ncmBruto.length >= 2 ? ncmBruto : null;

    const unidadeTrib = (textoDe(prod, 'uTrib') || '').trim() || null;
    const qtdTrib = numero(textoDe(prod, 'qTrib'));

    // `rastro` pode repetir (um por lote). Datas vêm AAAA-MM-DD.
    const lotes: LoteDaNota[] = Array.from(prod.children)
      .filter((el) => el.localName === 'rastro')
      .map((r) => ({
        numero: (textoDe(r, 'nLote') || '').trim(),
        qtd: numero(textoDe(r, 'qLote')),
        fabricado_em: (textoDe(r, 'dFab') || '').trim() || null,
        vence_em: (textoDe(r, 'dVal') || '').trim() || null,
      }))
      .filter((l) => l.numero || l.vence_em);

    const item: NotaLida['itens'][number] = {
      num_item: idx + 1,
      descricao,
      gtin,
      ncm,
      codigo_fornecedor: codigo || null,
      qtd,
      unidade,
      valor_unitario: valorUnitario,
      valor_total: valorTotal,
      unidade_tributavel: unidadeTrib,
      qtd_tributavel: qtdTrib,
      ...(lotes.length ? { lotes } : {}),
    };
    // A nota é aritmética: qCom × vUnCom = vProd (com o arredondamento da
    // SEFAZ). Documento que não fecha é marcado para conferência.
    item.conferencia = conferirValoresNota(item);
    itens.push(item);
  });

  if (itens.length === 0) {
    throw new Error('Nenhum item encontrado no XML — confira se é uma NFe Modelo 55 (nota de fornecedor).');
  }

  return {
    chave,
    uf,
    emitente: { razao_social: emitenteNome, cnpj: emitenteCnpj },
    data_emissao: dhEmi,
    valor_total: vNF || vProd,
    valor_produtos: vProd || undefined,
    desconto: vDesc || undefined,
    itens,
    origem: 'xml_nfe',
  };
}
