import type { NotaLida } from '../hooks/useImportacaoNota';

/**
 * Lê o XML de uma NFe Modelo 55 (nota de fornecedor/distribuidora — o
 * documento que chega por e-mail ou portal do fornecedor, diferente do
 * cupom NFC-e que o cliente final recebe na compra). Devolve o mesmo
 * formato `NotaLida` que a consulta por QR Code e a leitura por foto —
 * é o que deixa as três rotas caírem na mesma tela de conferência.
 */
export function parseNFeXml(xmlText: string): NotaLida {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
  if (xmlDoc.querySelector('parsererror')) {
    throw new Error('Arquivo XML mal formado — confira se é o XML original da nota, sem edição.');
  }

  const emitenteNome = xmlDoc.querySelector('emit > xNome')?.textContent || 'Fornecedor desconhecido';
  const emitenteCnpj = xmlDoc.querySelector('emit > CNPJ')?.textContent || null;
  const dhEmi = xmlDoc.querySelector('ide > dhEmi')?.textContent || null;
  const vNF = parseFloat(xmlDoc.querySelector('total > ICMSTot > vNF')?.textContent || '0');
  const vProd = parseFloat(xmlDoc.querySelector('total > ICMSTot > vProd')?.textContent || '0');
  const vDesc = parseFloat(xmlDoc.querySelector('total > ICMSTot > vDesc')?.textContent || '0');

  // Chave de acesso vem no atributo Id do infNFe ("NFe" + 44 dígitos) — é
  // o que permite travar reimportação da mesma nota, igual ao cupom NFC-e.
  const infNFeId = xmlDoc.querySelector('infNFe')?.getAttribute('Id') || '';
  const chave = infNFeId.replace(/^NFe/, '');
  const uf = chave.slice(0, 2);

  const detList = xmlDoc.querySelectorAll('det');
  const itens: NotaLida['itens'] = [];

  detList.forEach((det, idx) => {
    const prod = det.querySelector('prod');
    if (!prod) return;
    const codigo = prod.querySelector('cProd')?.textContent || '';
    const descricao = prod.querySelector('xProd')?.textContent || `Item ${idx + 1}`;
    const qtd = parseFloat(prod.querySelector('qCom')?.textContent || '1');
    const unidade = prod.querySelector('uCom')?.textContent || 'UN';
    const valorUnitario = parseFloat(prod.querySelector('vUnCom')?.textContent || '0');
    const valorTotal = parseFloat(prod.querySelector('vProd')?.textContent || '0');
    const cEAN = prod.querySelector('cEAN')?.textContent || '';
    const gtin = /^\d{8,14}$/.test(cEAN) ? cEAN : null;

    itens.push({
      num_item: idx + 1,
      descricao,
      gtin,
      codigo_fornecedor: codigo || null,
      qtd,
      unidade,
      valor_unitario: valorUnitario,
      valor_total: valorTotal,
    });
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
