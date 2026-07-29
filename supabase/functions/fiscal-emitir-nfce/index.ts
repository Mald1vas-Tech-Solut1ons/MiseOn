import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(obj: any, init?: ResponseInit) {
  return new Response(JSON.stringify(obj), {
    ...init,
    headers: { ...cors, 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
}

const TOKEN_PROD = Deno.env.get('FOCUS_API_TOKEN_PROD') || Deno.env.get('FOCUS_NFE_PROD');
const TOKEN_HOMOLOG = Deno.env.get('FOCUS_API_TOKEN_HOMOLOG') || Deno.env.get('FOCUS_NFE_HOMOLOG');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  
  try {
    const { pedido_id } = await req.json();
    if (!pedido_id) return json({ error: 'pedido_id obrigatório' }, { status: 400 });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Load Pedido
    const { data: pedido, error: errPed } = await supabase
      .from('pedidos')
      .select('*, itens_pedido(*, itens_pedido_opcoes(*)), lojas(nome, cnpj, nfe_ambiente, endereco, bairro, cidade, uf, cep)')
      .eq('id', pedido_id)
      .single();

    if (errPed || !pedido) return json({ error: 'Pedido não encontrado' }, { status: 404 });

    const isProd = pedido.lojas.nfe_ambiente === 'producao';
    const baseUrl = isProd ? 'https://api.focusnfe.com.br/v2/nfce' : 'https://homologacao.focusnfe.com.br/v2/nfce';
    const token = isProd ? TOKEN_PROD : TOKEN_HOMOLOG;
    if (!token) {
      const secretVar = isProd ? 'FOCUS_API_TOKEN_PROD ou FOCUS_NFE_PROD' : 'FOCUS_API_TOKEN_HOMOLOG ou FOCUS_NFE_HOMOLOG';
      return json({ error: `Token Focus NFe não configurado nas variáveis de ambiente/secrets (${secretVar}).` }, { status: 500 });
    }
    
    const cnpjEmitente = pedido.lojas?.cnpj ? pedido.lojas.cnpj.replace(/\D/g, '') : '';
    if (!cnpjEmitente) {
      return json({ error: 'CNPJ/CPF do emitente não configurado para a loja.' }, { status: 400 });
    }
    
    const ref = `miseon_${pedido_id.substring(0,8)}_${Date.now()}`;
    
    // Formatar itens para NFC-e
    const itemsNF = pedido.itens_pedido.map((item: any, idx: number) => {
      // Cálculo do valor unitário + adicionais
      const valAdicionais = (item.itens_pedido_opcoes || []).reduce((acc: number, op: any) => acc + Number(op.preco_adicional || 0), 0);
      const valUnit = Number(item.preco_unitario) + valAdicionais;
      
      return {
        numero_item: idx + 1,
        codigo_produto: item.id.substring(0,10),
        descricao: item.nome_produto.substring(0, 120),
        codigo_ncm: "21069090", // Padrão genérico de alimentação (deve ser configurável por loja futuramente)
        cfop: "5102", // Venda mercadoria
        valor_unitario_comercial: valUnit.toFixed(2),
        valor_unitario_tributavel: valUnit.toFixed(2),
        unidade_comercial: "UN",
        unidade_tributavel: "UN",
        quantidade_comercial: item.quantidade,
        quantidade_tributavel: item.quantidade,
        valor_bruto: (valUnit * item.quantidade).toFixed(2),
        icms_origem: "0",
        icms_situacao_tributaria: "400", // Simples Nacional (Não tributada pelo ICMS)
      };
    });

    // Desconto rateado nos itens (Focus exige que o desconto total feche com a soma dos descontos)
    // Para simplificar no MVP, aplicamos desconto globalmente ou rateado.
    
    // Payload Focus NFe
    const nfePayload = {
      natureza_operacao: "Venda Presencial",
      data_emissao: new Date().toISOString(),
      presenca_comprador: "1", // 1 = Presencial, 2 = Internet, 4 = Entrega a domicílio
      cnpj_emitente: cnpjEmitente,
      itens: itemsNF,
      valor_frete: pedido.taxa_entrega > 0 ? Number(pedido.taxa_entrega).toFixed(2) : undefined,
      valor_desconto: pedido.desconto > 0 ? Number(pedido.desconto).toFixed(2) : undefined,
    };

    // Update DB to PROCESSANDO
    await supabase.from('pedidos').update({ nfe_status: 'PROCESSANDO' }).eq('id', pedido_id);

    // Send to Focus NFe
    const res = await fetch(`${baseUrl}?ref=${ref}`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(token + ':')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(nfePayload)
    });

    const data = await res.json();
    
    if (!res.ok || data.erros) {
      const errDetail = data.erros || data;
      await supabase.from('pedidos').update({ 
        nfe_status: 'ERRO',
        nfe_erros: errDetail
      }).eq('id', pedido_id);
      
      return json({ error: 'Erro na Focus NFe', detail: errDetail }, { status: 400 });
    }

    // Success (Autorizada)
    await supabase.from('pedidos').update({ 
      nfe_status: data.status, // EX: 'autorizado'
      nfe_chave: data.chave_nfe,
      nfe_numero: data.numero,
      nfe_url: data.caminho_xml_nota_fiscal ? `https://api.focusnfe.com.br${data.caminho_xml_nota_fiscal}`.replace('.xml', '.pdf') : null
    }).eq('id', pedido_id);

    return json({
      status: data.status,
      chave: data.chave_nfe,
      url: data.caminho_xml_nota_fiscal ? `https://api.focusnfe.com.br${data.caminho_xml_nota_fiscal}`.replace('.xml', '.pdf') : null
    });

  } catch (err: any) {
    console.error(err);
    return json({ error: String(err) }, { status: 500 });
  }
});
