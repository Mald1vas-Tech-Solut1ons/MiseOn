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
  /** O que foi efetivamente pago: já com o desconto abatido. */
  valor_total: number;
  /** Soma das linhas de produto, antes do desconto. */
  valor_produtos?: number;
  /**
   * Desconto da nota inteira.
   *
   * O cupom do atacado traz "produtos 472,37 / Desconto 14,88 / Valor total
   * 457,49". Sem ler esta linha, o estoque entra pelos 472,37 e o CMV nasce 3%
   * acima do que a compra custou de verdade — um erro que não aparece em lugar
   * nenhum da tela e contamina toda decisão de preço tomada depois.
   */
  desconto?: number;
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
 * Transforma a página em texto com fronteira visível entre elementos.
 *
 * Sem essa fronteira, "TOMATE SALADA kg" e "(Código: 2410)" — que vivem em
 * spans vizinhos — grudam com o item seguinte e a descrição sai contaminada.
 */
function textoComSeparador(html: string): string {
  return texto(
    html
      .replace(/<\/(td|tr|span|div|p|table|h1|h2|h3|h4|li)>/gi, ' | ')
      .replace(/<br\s*\/?>/gi, ' | ')
  );
}

/**
 * Extrai os itens do DANFE da consulta pública.
 *
 * Trabalha sobre o TEXTO da página, não sobre nomes de classe nem ids. Motivo:
 * as duas tentativas anteriores morreram em detalhe de marcação — uma dividia
 * os itens por `<tr id="Item1">` quando o portal gera `id="Item + 1"`, e
 * procurava "Qtd.:" quando a página escreve "Qtde.:"; a outra apostou nas
 * classes fixo-prod-serv-*, que pertencem a outra tela do mesmo portal. O texto
 * visível é estável e é o que o lojista enxerga:
 *
 *   TOMATE SALADA kg (Código: 2410 ) Qtde.:1,022 UN: kg Vl. Unit.: 6,99 Vl. Total 7,14
 */
export function parseItens(html: string): ItemNFCe[] {
  const plano = textoComSeparador(html);

  // Campos separados por poucos caracteres de "cola" (espaço, |, rótulo curto),
  // nunca o bastante para atravessar o item seguinte.
  const regexItem =
    /([^|]{2,120}?)\s*\|?\s*\(\s*C[óo]digo:\s*(\d+)\s*\)[\s\S]{0,40}?Qtde?\.?:\s*([\d.,]+)[\s\S]{0,40}?UN:?\s*([A-Za-zÀ-ÿ]{1,6})[\s\S]{0,40}?Vl\.?\s*Unit\.?:?\s*([\d.,]+)[\s\S]{0,120}?Vl\.?\s*Total\s*\|?\s*([\d.,]+)/gi;

  const itens: ItemNFCe[] = [];
  let achado: RegExpExecArray | null;

  while ((achado = regexItem.exec(plano)) !== null) {
    const [, descricaoBruta, codigo, qtdTexto, unidade, unitTexto, totalTexto] = achado;

    // A descrição arrasta o rabo do item anterior; corta no último separador.
    const descricao = descricaoBruta.split('|').pop()!.trim().replace(/^\d+\s+/, '');
    if (!descricao) continue;

    const qtd = numeroBr(qtdTexto);
    const valorUnitario = numeroBr(unitTexto);
    const valorTotal = numeroBr(totalTexto);

    itens.push({
      num_item: itens.length + 1,
      descricao,
      // "(Código: N)" é o cProd do emitente, não um EAN. Só vira gtin quando
      // passa na validação — senão o De-Para casaria produtos de mercados
      // diferentes que reusam o mesmo número interno.
      gtin: ehGtinValido(codigo) ? codigo : null,
      codigo_fornecedor: codigo,
      qtd: qtd || 1,
      unidade: (unidade || 'un').toLowerCase(),
      valor_unitario: valorUnitario || (qtd > 0 ? Number((valorTotal / qtd).toFixed(4)) : valorTotal),
      valor_total: valorTotal || qtd * valorUnitario,
    });
  }

  return itens;
}

export function parseHtmlSefazSp(html: string, chave: string): DadosNFCe {
  const h = html.replace(/\r?\n|\r/g, ' ');
  const plano = textoComSeparador(h);

  const itens = parseItens(h);

  // Razão social: o rótulo em destaque no topo, ou o texto logo antes do CNPJ.
  const porClasse = texto(h.match(/class=["'][^"']*txtTopo[^"']*["'][^>]*>([\s\S]*?)</i)?.[1] ?? '');
  const antesDoCnpj = plano.match(/\|\s*([^|]{4,90}?)\s*\|\s*CNPJ:/i)?.[1]?.trim();
  const razaoSocial = porClasse || antesDoCnpj || 'Supermercado / Fornecedor';

  const cnpj = plano.match(/CNPJ:\s*([\d./-]{14,20})/i)?.[1]?.trim() ?? null;

  // "Desconto R$ 14,88" / "Descontos 14,88" — o rótulo varia entre emissores.
  const descontoTexto = plano.match(/Descontos?\s*(?:R\$)?\s*\|?\s*([\d.,]+)/i)?.[1];
  const produtosTexto = plano.match(/(?:Valor\s+dos\s+)?produtos\s*(?:R\$)?\s*\|?\s*([\d.,]+)/i)?.[1];

  const totalTexto =
    plano.match(/Valor\s+total\s*(?:R\$)?\s*\|?\s*([\d.,]+)/i)?.[1] ??
    h.match(/txtMax[^>]*>\s*([\d.,]+)/i)?.[1];

  let dataEmissao: string | null = null;
  const matchData = plano.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (matchData) {
    const [, d, m, a, hh, mm, ss] = matchData;
    dataEmissao = `${a}-${m}-${d}T${hh}:${mm}:${ss}Z`;
  }

  return {
    chave,
    uf: 'SP',
    emitente: { razao_social: razaoSocial, cnpj },
    data_emissao: dataEmissao,
    valor_total: numeroBr(totalTexto) || itens.reduce((acc, i) => acc + i.valor_total, 0),
    valor_produtos: numeroBr(produtosTexto) || undefined,
    desconto: numeroBr(descontoTexto) || undefined,
    itens,
  };
}
