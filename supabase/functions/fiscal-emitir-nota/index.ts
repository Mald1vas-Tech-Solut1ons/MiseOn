import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-chat-session',
};

const json = (data: any, init?: ResponseInit) => new Response(JSON.stringify(data), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  ...init
});

const TOKEN_PROD = Deno.env.get('FOCUS_API_TOKEN_PROD') || Deno.env.get('FOCUS_NFE_PROD');
const TOKEN_HOMOLOG = Deno.env.get('FOCUS_API_TOKEN_HOMOLOG') || Deno.env.get('FOCUS_NFE_HOMOLOG');

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { pedido_id, tipo = 'NFCE', cliente_cpf_cnpj, cliente_nome } = await req.json();

    if (!pedido_id) {
      return json({ error: 'pedido_id é obrigatório para emissão' }, { status: 400 });
    }

    const authHeader = req.headers.get('Authorization');
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Carrega o pedido completo com itens e loja
    const { data: pedido, error: errPed } = await supabaseAdmin
      .from('pedidos')
      .select('*, itens_pedido(*, itens_pedido_opcoes(*)), lojas(*)')
      .eq('id', pedido_id)
      .single();

    if (errPed || !pedido) {
      return json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    const lojaId = pedido.loja_id;

    // Carrega as configurações fiscais do tenant
    const { data: configFiscal } = await supabaseAdmin
      .from('configuracoes_fiscais')
      .select('*')
      .eq('loja_id', lojaId)
      .single();

    const isProd = (configFiscal?.nfe_ambiente || pedido.lojas?.nfe_ambiente) === 'producao';
    const isNfce = tipo === 'NFCE';
    
    const baseUrl = isNfce
      ? (isProd ? 'https://api.focusnfe.com.br/v2/nfce' : 'https://homologacao.focusnfe.com.br/v2/nfce')
      : (isProd ? 'https://api.focusnfe.com.br/v2/nfe' : 'https://homologacao.focusnfe.com.br/v2/nfe');
      
    const token = isProd ? TOKEN_PROD : TOKEN_HOMOLOG;
    if (!token) {
      const secretVar = isProd ? 'FOCUS_API_TOKEN_PROD ou FOCUS_NFE_PROD' : 'FOCUS_API_TOKEN_HOMOLOG ou FOCUS_NFE_HOMOLOG';
      return json({ error: `Token Focus NFe não configurado nas variáveis de ambiente/secrets (${secretVar}).` }, { status: 500 });
    }

    const cnpjEmitente = (configFiscal?.cnpj || pedido.lojas?.cnpj || '').replace(/\D/g, '');
    if (!cnpjEmitente) {
      return json({ error: 'CNPJ/CPF do emitente não configurado para a loja.' }, { status: 400 });
    }
    const ref = `miseon_${tipo.toLowerCase()}_${pedido_id.substring(0, 8)}_${Date.now()}`;

    // Monta itens no padrão SEFAZ/Focus NFe
    const itemsNF = (pedido.itens_pedido || []).map((item: any, idx: number) => {
      const valAdicionais = (item.itens_pedido_opcoes || []).reduce((acc: number, op: any) => acc + Number(op.preco_adicional || 0), 0);
      const valUnit = Number(item.preco_unitario || 0) + valAdicionais;
      const qtd = Number(item.quantidade || 1);

      return {
        numero_item: idx + 1,
        codigo_produto: (item.produto_id || item.id || `PROD-${idx + 1}`).substring(0, 10),
        descricao: (item.nome_produto || 'Item de Consumo').substring(0, 120),
        codigo_ncm: "21069090", // Padrão alimentação preparada
        cfop: "5102", // Venda de mercadoria adquirida de terceiros
        valor_unitario_comercial: valUnit.toFixed(2),
        valor_unitario_tributavel: valUnit.toFixed(2),
        unidade_comercial: "UN",
        unidade_tributavel: "UN",
        quantidade_comercial: qtd,
        quantidade_tributavel: qtd,
        valor_bruto: (valUnit * qtd).toFixed(2),
        icms_origem: "0",
        icms_situacao_tributaria: "400", // Simples Nacional - Não tributada pelo ICMS no SIMPLES
      };
    });

    // Mapeia formas de pagamento SEFAZ
    // 01: Dinheiro, 03: Cartão de Crédito, 04: Cartão de Débito, 17: PIX
    let formaPagamentoSefaz = "01";
    const formaOriginal = (pedido.forma_pagamento || '').toLowerCase();
    if (formaOriginal.includes('pix')) formaPagamentoSefaz = "17";
    else if (formaOriginal.includes('credito')) formaPagamentoSefaz = "03";
    else if (formaOriginal.includes('debito') || formaOriginal.includes('cartao')) formaPagamentoSefaz = "04";

    const valorTotalCalc = Number(pedido.total || 0);

    // Payload Focus NFe
    const nfePayload: Record<string, any> = {
      natureza_operacao: "Venda ao Consumidor Final",
      data_emissao: new Date().toISOString(),
      presenca_comprador: "1", // 1 = Presencial, 4 = Entrega
      cnpj_emitente: cnpjEmitente,
      itens: itemsNF,
      formas_pagamento: [
        {
          forma_pagamento: formaPagamentoSefaz,
          valor: valorTotalCalc.toFixed(2)
        }
      ],
      valor_frete: pedido.taxa_entrega > 0 ? Number(pedido.taxa_entrega).toFixed(2) : undefined,
      valor_desconto: pedido.desconto > 0 ? Number(pedido.desconto).toFixed(2) : undefined,
    };

    // Dados do destinatário se fornecido
    const cpfCnpjLimpo = (cliente_cpf_cnpj || pedido.cliente_cpf || '').replace(/\D/g, '');
    if (cpfCnpjLimpo) {
      nfePayload.cpf_destinatario = cpfCnpjLimpo.length === 11 ? cpfCnpjLimpo : undefined;
      nfePayload.cnpj_destinatario = cpfCnpjLimpo.length === 14 ? cpfCnpjLimpo : undefined;
      if (cliente_nome || pedido.cliente_nome) {
        nfePayload.nome_destinatario = cliente_nome || pedido.cliente_nome;
      }
    }

    // Registra como PROCESSANDO na tabela notas_fiscais e no pedido
    const { data: notaCriada, error: errNota } = await supabaseAdmin
      .from('notas_fiscais')
      .insert({
        loja_id: lojaId,
        pedido_id: pedido_id,
        tipo: tipo,
        ambiente: isProd ? 'producao' : 'homologacao',
        ref: ref,
        status: 'PROCESSANDO',
        payload_envio: nfePayload,
        valor_total: valorTotalCalc
      })
      .select()
      .single();

    await supabaseAdmin
      .from('pedidos')
      .update({ nfe_status: 'PROCESSANDO' })
      .eq('id', pedido_id);

    // Transmite para Focus NFe API v2
    const res = await fetch(`${baseUrl}?ref=${ref}`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(token + ':')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(nfePayload)
    });

    const data = await res.json();
    console.log(`Focus NFe resposta HTTP ${res.status}:`, data);

    if (!res.ok || data.erros || data.status === 'erro_autorizacao') {
      const errDetail = data.erros || data;
      const statusFinal = 'REJEITADA';

      if (notaCriada?.id) {
        await supabaseAdmin
          .from('notas_fiscais')
          .update({
            status: statusFinal,
            erros: errDetail,
            retorno_focus: data,
            mensagem_sefaz: data.mensagem_sefaz || data.mensagem || 'Rejeição na transmissão SEFAZ'
          })
          .eq('id', notaCriada.id);
      }

      await supabaseAdmin
        .from('pedidos')
        .update({ nfe_status: 'REJEITADA', nfe_erros: errDetail })
        .eq('id', pedido_id);

      return json({ error: 'Erro de autorização na Focus NFe / SEFAZ', detail: errDetail }, { status: 400 });
    }

    // Sucesso ou Nota Autorizada
    const danfeUrl = data.caminho_danfe 
      ? `https://api.focusnfe.com.br${data.caminho_danfe}` 
      : (data.caminho_xml_nota_fiscal ? `https://api.focusnfe.com.br${data.caminho_xml_nota_fiscal}`.replace('.xml', '.pdf') : null);
      
    const xmlUrl = data.caminho_xml_nota_fiscal 
      ? `https://api.focusnfe.com.br${data.caminho_xml_nota_fiscal}` 
      : null;

    const qrCodeUrl = data.qrcode_url || data.caminho_qrcode || null;
    const statusFinal = (data.status === 'autorizado' || data.status === 'AUTORIZADA') ? 'AUTORIZADA' : 'PROCESSANDO';

    if (notaCriada?.id) {
      await supabaseAdmin
        .from('notas_fiscais')
        .update({
          status: statusFinal,
          chave_nfe: data.chave_nfe,
          numero: data.numero,
          protocolo: data.protocolo,
          xml_url: xmlUrl,
          danfe_url: danfeUrl,
          qrcode_url: qrCodeUrl,
          retorno_focus: data,
          mensagem_sefaz: data.mensagem_sefaz || 'Nota Autorizada com Sucesso'
        })
        .eq('id', notaCriada.id);
    }

    await supabaseAdmin
      .from('pedidos')
      .update({
        nfe_status: statusFinal,
        nfe_chave: data.chave_nfe,
        nfe_numero: data.numero,
        nfe_url: danfeUrl
      })
      .eq('id', pedido_id);

    return json({
      success: true,
      status: statusFinal,
      chave: data.chave_nfe,
      numero: data.numero,
      danfe_url: danfeUrl,
      xml_url: xmlUrl,
      qrcode_url: qrCodeUrl
    });

  } catch (err: any) {
    console.error('Crash na emissão fiscal:', err);
    return json({ error: err.message || String(err) }, { status: 500 });
  }
});
