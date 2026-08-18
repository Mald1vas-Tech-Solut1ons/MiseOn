/**
 * Parser puro da consulta pública de NFC-e. Separado do index.ts para poder ser
 * testado sem subir a função: index.ts cuida de HTTP/auth, este arquivo só
 * transforma texto em dados.
 */
export interface ItemNFCe {
  num_item: number;
  descricao: string;
  /** EAN/GTIN real. Null quando a nota só traz o código interno do emitente. */
  gtin?: string | null;
  /** cProd: código interno do mercado. Só é único DENTRO de um mesmo CNPJ. */
  codigo_fornecedor?: string | null;
  qtd: number;
  unidade: string;
  valor_unitario: number;
  valor_total: number;
}

/** GTIN válido: 8, 12, 13 ou 14 dígitos com dígito verificador correto. */
export function ehGtinValido(codigo: string): boolean {
  if (!/^\d+$/.test(codigo)) return false;
  if (![8, 12, 13, 14].includes(codigo.length)) return false;
  const digitos = codigo.split('').map(Number);
  const dv = digitos.pop()!;
  let soma = 0;
  digitos.reverse().forEach((d, i) => { soma += d * (i % 2 === 0 ? 3 : 1); });
  return (10 - (soma % 10)) % 10 === dv;
}

export interface DadosNFCe {
  chave: string;
  uf: string;
  emitente: {
    razao_social: string;
    cnpj?: string | null;
  };
  data_emissao?: string | null;
  valor_total: number;
  itens: ItemNFCe[];
}

export function extrairChave(urlOuChave: string): { chave: string; uf: string } | null {
  const limpo = urlOuChave.replace(/\D/g, '');
  const matchChave = urlOuChave.match(/\b\d{44}\b/) || (limpo.length >= 44 ? { 0: limpo.slice(0, 44) } : null);
  if (!matchChave) return null;
  const chave = matchChave[0];
  const codigoUf = chave.slice(0, 2);
  const ufs: Record<string, string> = {
    '35': 'SP', '33': 'RJ', '31': 'MG', '41': 'PR', '43': 'RS',
    '53': 'DF', '29': 'BA', '23': 'CE', '52': 'GO', '26': 'PE'
  };
  return { chave, uf: ufs[codigoUf] ?? 'BR' };
}

/** Tira tags e normaliza espaço/entidade de um pedaço de HTML. */
export function texto(trecho: string): string {
  return trecho
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "1.234,56" -> 1234.56 */
export function numeroBr(valor: string | undefined): number {
  if (!valor) return 0;
  return parseFloat(valor.replace(/\./g, '').replace(',', '.')) || 0;
}

/**
 * Layout da consulta pública da SEFAZ-SP (ASP.NET). A tabela de itens usa as
 * classes fixo-prod-serv-numero / -descricao / -qtd / -uc / -vb, confirmadas nos
 * CSS publicados pelo próprio portal. É diferente do layout "padrão nacional"
 * (txtTit / Qtd.: / UN: / Vl. Unit.) que outros estados usam — o parser antigo
 * só conhecia esse segundo, por isso nunca achava item nenhum em SP.
 */
export function parseItensLayoutSp(h: string): ItemNFCe[] {
  const itens: ItemNFCe[] = [];
  const linhas = h.split(/<tr[^>]*>/i);

  for (const linha of linhas) {
    if (!/fixo-prod-serv-numero/i.test(linha)) continue;

    const celula = (classe: string) =>
      linha.match(new RegExp(`<td[^>]*class=["'][^"']*${classe}[^"']*["'][^>]*>([\\s\\S]*?)</td>`, 'i'))?.[1];

    const descricao = texto(celula('fixo-prod-serv-descricao') ?? '');
    if (!descricao) continue;

    const numero = parseInt(texto(celula('fixo-prod-serv-numero') ?? ''), 10);
    const qtd = numeroBr(texto(celula('fixo-prod-serv-qtd') ?? '').match(/[\d.,]+/)?.[0]);
    const unidade = texto(celula('fixo-prod-serv-uc') ?? '').replace(/[^A-Za-zÀ-ÿ0-9]/g, '') || 'un';
    const valorTotal = numeroBr(texto(celula('fixo-prod-serv-vb') ?? '').match(/[\d.,]+/)?.[0]);

    // Cupom traz o código interno do mercado junto da descrição, entre parênteses
    // ou no início. Só vira gtin se passar na validação de GTIN.
    const codigo = descricao.match(/\(C[óo]digo:\s*(\d+)\)/i)?.[1] ?? descricao.match(/^(\d{4,14})\s/)?.[1] ?? null;

    itens.push({
      num_item: Number.isFinite(numero) ? numero : itens.length + 1,
      descricao: descricao.replace(/\(C[óo]digo:\s*\d+\)/i, '').trim(),
      gtin: codigo && ehGtinValido(codigo) ? codigo : null,
      codigo_fornecedor: codigo,
      qtd: qtd || 1,
      unidade: unidade.toLowerCase(),
      valor_unitario: qtd > 0 ? Number((valorTotal / qtd).toFixed(4)) : valorTotal,
      valor_total: valorTotal,
    });
  }

  return itens;
}

export function parseHtmlSefazSp(html: string, chave: string): DadosNFCe {
  const h = html.replace(/\r?\n|\r/g, ' ');

  // 1. Razão Social
  let razaoSocial = 'Supermercado / Fornecedor';
  const matchRazao = h.match(/class=["']txtTopo["'][^>]*>(.*?)<\/div>/i) ||
                     h.match(/class=["']txtBox font-bold["'][^>]*>(.*?)<\/div>/i) ||
                     h.match(/<div id=["']conteudo["'][^>]*>[\s\S]*?<div[^>]*class=["']txtCenter["'][^>]*>(.*?)<\/div>/i);
  if (matchRazao && matchRazao[1]) {
    razaoSocial = matchRazao[1].replace(/<[^>]+>/g, '').trim() || razaoSocial;
  }

  // 2. CNPJ
  let cnpj: string | null = null;
  const matchCnpj = h.match(/CNPJ:\s*([\d\.\/\-]+)/i);
  if (matchCnpj) cnpj = matchCnpj[1].trim();

  // 3. Valor Total Nota
  let valorTotalNota = 0;
  const matchTotal = h.match(/txtMax[^>]*>([\d\.,]+)<\/span>/i) ||
                     h.match(/totalNota[^>]*>([\d\.,]+)</i) ||
                     h.match(/vLtn[^>]*>([\d\.,]+)</i);
  if (matchTotal) {
    valorTotalNota = parseFloat(matchTotal[1].replace(/\./g, '').replace(',', '.')) || 0;
  }

  // 4. Data Emissão
  let dataEmissao: string | null = null;
  const matchData = h.match(/Emiss[aã]o:\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/i);
  if (matchData) {
    const [d, m, y, h, min, s] = matchData[1].split(/[\/\s:]/);
    dataEmissao = `${y}-${m}-${d}T${h}:${min}:${s}Z`;
  }

  // 5. Itens
  const itens: ItemNFCe[] = [];
  // Layout de SP primeiro: é o estado que esta função atende hoje.
  const itensSp = parseItensLayoutSp(h);
  if (itensSp.length > 0) itens.push(...itensSp);

  const blocosItens = itens.length === 0 ? h.split(/<tr id=["']Item\d+["']/i).slice(1) : [];

  if (blocosItens.length > 0) {
    blocosItens.forEach((bloco, idx) => {
      const matchNome = bloco.match(/class=["']txtTit["'][^>]*>(.*?)<\/span>/i);
      const matchCod = bloco.match(/\(C[oó]digo:\s*(\d+)\)/i);
      const matchQtd = bloco.match(/Qtd\.:\s*<\/span>\s*<strong[^>]*>([\d\.,]+)<\/strong>/i) || bloco.match(/Qtd\.:\s*([\d\.,]+)/i);
      const matchUn = bloco.match(/UN:\s*<\/span>\s*<strong[^>]*>([^<]+)<\/strong>/i) || bloco.match(/UN:\s*([A-Za-z0-9]+)/i);
      const matchVlUnit = bloco.match(/Vl\.\s*Unit\.:\s*<\/span>\s*<strong[^>]*>([\d\.,]+)<\/strong>/i) || bloco.match(/Vl\.\s*Unit\.:\s*([\d\.,]+)/i);
      const matchVlTotal = bloco.match(/class=["']valor["'][^>]*>([\d\.,]+)<\/span>/i) || bloco.match(/class=["']vItem["'][^>]*>([\d\.,]+)<\/span>/i);

      const nome = matchNome ? matchNome[1].replace(/<[^>]+>/g, '').trim() : `Item ${idx + 1}`;
      // "(Código: NNN)" é o cProd do emitente, NÃO um EAN. Só promove a gtin
      // quando o número realmente passa na validação de GTIN.
      const codigo = matchCod ? matchCod[1].trim() : null;
      const gtin = codigo && ehGtinValido(codigo) ? codigo : null;
      const qtd = matchQtd ? parseFloat(matchQtd[1].replace(/\./g, '').replace(',', '.')) : 1;
      const un = matchUn ? matchUn[1].trim().toLowerCase() : 'un';
      const vlUnit = matchVlUnit ? parseFloat(matchVlUnit[1].replace(/\./g, '').replace(',', '.')) : 0;
      const vlTotal = matchVlTotal ? parseFloat(matchVlTotal[1].replace(/\./g, '').replace(',', '.')) : (qtd * vlUnit);

      if (nome) {
        itens.push({
          num_item: idx + 1,
          descricao: nome,
          gtin,
          codigo_fornecedor: codigo,
          qtd,
          unidade: un,
          valor_unitario: vlUnit,
          valor_total: vlTotal
        });
      }
    });
  } else if (itens.length === 0) {
    // Fallback: Regex genérica sobre tabela simples
    const regexLinha = /<span class="txtTit">([^<]+)<\/span>[\s\S]*?Qtd\.:\s*<strong[^>]*>([\d\.,]+)<\/strong>[\s\S]*?UN:\s*<strong[^>]*>([^<]+)<\/strong>[\s\S]*?Vl\.\s*Unit\.:\s*<strong[^>]*>([\d\.,]+)<\/strong>[\s\S]*?<span class="valor">([\d\.,]+)<\/span>/gi;
    let match;
    let idx = 1;
    while ((match = regexLinha.exec(h)) !== null) {
      itens.push({
        num_item: idx++,
        descricao: match[1].trim(),
        gtin: null,
        qtd: parseFloat(match[2].replace(/\./g, '').replace(',', '.')),
        unidade: match[3].trim().toLowerCase(),
        valor_unitario: parseFloat(match[4].replace(/\./g, '').replace(',', '.')),
        valor_total: parseFloat(match[5].replace(/\./g, '').replace(',', '.'))
      });
    }
  }

  return {
    chave,
    uf: 'SP',
    emitente: { razao_social: razaoSocial, cnpj },
    data_emissao: dataEmissao,
    valor_total: valorTotalNota || itens.reduce((acc, i) => acc + i.valor_total, 0),
    itens
  };
}

