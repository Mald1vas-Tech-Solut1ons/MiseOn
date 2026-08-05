import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...cors, ...(init.headers ?? {}) },
  });

const erro = (msg: string, status = 400) => json({ error: msg }, { status });

interface ItemNFCe {
  num_item: number;
  descricao: string;
  gtin?: string | null;
  qtd: number;
  unidade: string;
  valor_unitario: number;
  valor_total: number;
}

interface DadosNFCe {
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

function extrairChave(urlOuChave: string): { chave: string; uf: string } | null {
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

function parseHtmlSefazSp(html: string, chave: string): DadosNFCe {
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
  const blocosItens = h.split(/<tr id=["']Item\d+["']/i).slice(1);

  if (blocosItens.length > 0) {
    blocosItens.forEach((bloco, idx) => {
      const matchNome = bloco.match(/class=["']txtTit["'][^>]*>(.*?)<\/span>/i);
      const matchCod = bloco.match(/\(C[oó]digo:\s*(\d+)\)/i);
      const matchQtd = bloco.match(/Qtd\.:\s*<\/span>\s*<strong[^>]*>([\d\.,]+)<\/strong>/i) || bloco.match(/Qtd\.:\s*([\d\.,]+)/i);
      const matchUn = bloco.match(/UN:\s*<\/span>\s*<strong[^>]*>([^<]+)<\/strong>/i) || bloco.match(/UN:\s*([A-Za-z0-9]+)/i);
      const matchVlUnit = bloco.match(/Vl\.\s*Unit\.:\s*<\/span>\s*<strong[^>]*>([\d\.,]+)<\/strong>/i) || bloco.match(/Vl\.\s*Unit\.:\s*([\d\.,]+)/i);
      const matchVlTotal = bloco.match(/class=["']valor["'][^>]*>([\d\.,]+)<\/span>/i) || bloco.match(/class=["']vItem["'][^>]*>([\d\.,]+)<\/span>/i);

      const nome = matchNome ? matchNome[1].replace(/<[^>]+>/g, '').trim() : `Item ${idx + 1}`;
      const gtin = matchCod ? matchCod[1].trim() : null;
      const qtd = matchQtd ? parseFloat(matchQtd[1].replace(/\./g, '').replace(',', '.')) : 1;
      const un = matchUn ? matchUn[1].trim().toLowerCase() : 'un';
      const vlUnit = matchVlUnit ? parseFloat(matchVlUnit[1].replace(/\./g, '').replace(',', '.')) : 0;
      const vlTotal = matchVlTotal ? parseFloat(matchVlTotal[1].replace(/\./g, '').replace(',', '.')) : (qtd * vlUnit);

      if (nome) {
        itens.push({
          num_item: idx + 1,
          descricao: nome,
          gtin,
          qtd,
          unidade: un,
          valor_unitario: vlUnit,
          valor_total: vlTotal
        });
      }
    });
  } else {
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { url_qrcode, chave_acesso } = await req.json();
    const entrada = url_qrcode || chave_acesso;
    if (!entrada) return erro('url_qrcode ou chave_acesso é obrigatório');

    const info = extrairChave(entrada);
    if (!info) return erro('Chave ou URL da NFC-e inválida (deve conter 44 dígitos)');

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    );
    const { data: { user: caller } } = await supabaseAuth.auth.getUser();
    if (!caller) return erro('Não autenticado', 401);

    const targetUrl = url_qrcode || `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${info.chave}|2|1|1|000000`;

    const resp = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    if (!resp.ok) {
      return erro(`Não foi possível acessar a SEFAZ (Status: ${resp.status}). Verifique o QR Code.`, 502);
    }

    const html = await resp.text();
    const dados = parseHtmlSefazSp(html, info.chave);

    if (dados.itens.length === 0) {
      return erro('A SEFAZ respondeu, mas não foi possível extrair os produtos. Verifique se o QR Code da NFC-e é de São Paulo.', 422);
    }

    return json(dados);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
});
