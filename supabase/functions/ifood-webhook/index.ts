import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getIfoodToken(clientId: string, clientSecret: string) {
  const body = new URLSearchParams({
    grantType: 'client_credentials',
    clientId,
    clientSecret
  });
  const res = await fetch('https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!res.ok) throw new Error('Falha ao autenticar no iFood Centralizado');
  return res.json();
}

async function getOrderDetails(orderId: string, token: string) {
  const res = await fetch(`https://merchant-api.ifood.com.br/order/v1.0/orders/${orderId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Falha ao buscar pedido ${orderId}`);
  return res.json();
}

// Envia email de notificação de falha grave usando Resend
async function sendFailureEmail(orderId: string, lojaNome: string, errorMessage: string) {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const alertEmail = Deno.env.get('ALERT_EMAIL') || 'suporte@miseon.app.br';
  
  if (!resendKey) return;
  
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'MiseOn Alertas <suporte@miseon.app.br>',
        to: alertEmail,
        subject: `⚠️ ALERTA: Falha Crítica no Webhook iFood - Loja: ${lojaNome}`,
        html: `
          <h2>Falha na integração do Pedido iFood</h2>
          <p><strong>Loja:</strong> ${lojaNome}</p>
          <p><strong>ID do Pedido:</strong> ${orderId}</p>
          <p><strong>Erro:</strong> ${errorMessage}</p>
          <hr/>
          <p>Verifique os logs no painel do Supabase Edge Functions para mais detalhes.</p>
        `
      })
    });
  } catch (err) {
    console.error('Falha ao enviar email de notificação:', err);
  }
}

import { z } from 'npm:zod';
import { logger } from '../_shared/logger.ts';

const ifoodEventSchema = z.array(z.object({
  code: z.string(),
  orderId: z.string(),
}).passthrough());

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Cria um logger derivado com um ID de requisição para rastreabilidade
  const reqLogger = logger.withContext({ req_id: crypto.randomUUID() });

  try {
    let rawBody;
    try {
      rawBody = await req.json();
    } catch {
      rawBody = null;
    }

    const validation = ifoodEventSchema.safeParse(rawBody);
    if (!validation.success) {
      reqLogger.error('Payload inválido', validation.error, { issues: validation.error.issues });
      return new Response('Payload inválido', { status: 400 });
    }

    const events = validation.data;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const clientId = Deno.env.get('IFOOD_CLIENT_ID')!;
    const clientSecret = Deno.env.get('IFOOD_CLIENT_SECRET')!;

    if (!clientId || !clientSecret) {
      reqLogger.error('Credenciais do iFood ausentes nas variáveis de ambiente!');
      return new Response('Internal Server Error', { status: 500 });
    }

    // Apenas lidamos com PLC (Placed/Novo Pedido) e CAN (Cancelled) por enquanto
    const newOrderEvents = events.filter((e: any) => e.code === 'PLC');
    
    if (newOrderEvents.length > 0) {
      const { accessToken } = await getIfoodToken(clientId, clientSecret);

      for (const event of newOrderEvents) {
        let lojaNomeFallback = 'Desconhecida';
        try {
          const order = await getOrderDetails(event.orderId, accessToken);
          
          // 1. Descobrir de qual loja do MiseOn é este pedido e suas taxas
          const { data: loja } = await supabase
            .from('lojas')
            .select('id, nome, ifood_taxa_pct, ifood_taxa_fixa')
            .eq('ifood_merchant_id', order.merchant.id)
            .single();

          if (!loja) {
            reqLogger.warn(`Loja iFood ${order.merchant.id} não encontrada no MiseOn.`, { merchant_id: order.merchant.id });
            continue;
          }

          const lojaId = loja.id;
          lojaNomeFallback = loja.nome;

          // 2. Extrair dados do cliente com regras de LGPD (Fallback IFOOD_XYZ)
          let telefoneLimpo = (order.customer?.phone?.number || '').replace(/\\D/g, '');
          let clienteId = null;

          const validPhoneRegex = /^[1-9]{2}9?[0-9]{8}$/;
          
          if (!telefoneLimpo || !validPhoneRegex.test(telefoneLimpo)) {
             // Fallback LGPD / Telefone Incorreto
             telefoneLimpo = `IFOOD_${order.customer?.id || order.displayId || event.orderId}`;
          }

          if (telefoneLimpo) {
            const { data: clienteExistente } = await supabase
              .from('clientes')
              .select('id')
              .eq('loja_id', lojaId)
              .eq('telefone', telefoneLimpo)
              .single();

            if (clienteExistente) {
              clienteId = clienteExistente.id;
            } else {
              const { data: novoCli } = await supabase
                .from('clientes')
                .insert({
                  loja_id: lojaId,
                  nome: order.customer?.name || 'Cliente iFood',
                  telefone: telefoneLimpo,
                })
                .select('id')
                .single();
              if (novoCli) clienteId = novoCli.id;
            }
          }

          // Regra de Negócio: Cálculo de Repasse e Taxas
          const valorBrutoIfood = order.total.orderAmount || 0;
          const taxaPct = Number(loja.ifood_taxa_pct || 0) / 100;
          const taxaFixa = Number(loja.ifood_taxa_fixa || 0);
          
          // A taxa retida é (Bruto * % Taxa) + Taxa Fixa
          const taxaIfoodRetida = (valorBrutoIfood * taxaPct) + taxaFixa;

          // 3. Montar Pedido
          // IDEMPOTÊNCIA (auditoria, achado 07): o iFood reenvia eventos quando
          // não recebe acknowledgment — é comportamento normal, não exceção.
          // Sem esta guarda, cada reenvio virava um pedido novo: a cozinha
          // produzia duas vezes e a receita era contada duas vezes.
          const { data: jaProcessado } = await supabase
            .from('pedidos')
            .select('id')
            .eq('ifood_order_id', event.orderId)
            .maybeSingle();

          if (jaProcessado) {
            reqLogger.info(`Pedido iFood ${event.orderId} já processado — evento ignorado.`, {
              order_id: event.orderId, loja_id: lojaId,
            });
            continue;
          }

          const isDelivery = order.orderType === 'DELIVERY';
          const { data: novoPedido, error: pedidoError } = await supabase
            .from('pedidos')
            .insert({
              loja_id: lojaId,
              cliente_id: clienteId,
              status: 'NOVO',
              origem: 'ifood',
              tipo_pedido: isDelivery ? 'DELIVERY' : 'RETIRADA_BALCAO',
              // `subTotal` é a soma dos itens. Antes usava payments.prepaid, que é
              // um valor de PAGAMENTO — corrompia CMV e margem (achado 09).
              subtotal: order.total?.subTotal ?? 0,
              taxa_entrega: order.total.deliveryFee || 0,
              desconto: order.total.discounts || 0,
              valor_total: valorBrutoIfood,
              observacao: order.observations || null,
              numero: Number(order.displayId) || 0,
              identificador_cliente: order.customer?.name || 'iFood',
              ifood_order_id: event.orderId,
              valor_bruto_ifood: valorBrutoIfood,
              taxa_ifood_retida: taxaIfoodRetida
            })
            .select('id')
            .single();

          // Corrida entre dois reenvios simultâneos: o índice único
          // uniq_pedidos_ifood_order_id é a garantia dura.
          if (pedidoError?.code === '23505') {
            reqLogger.info(`Pedido iFood ${event.orderId} inserido em paralelo — evento ignorado.`, {
              order_id: event.orderId, loja_id: lojaId,
            });
            continue;
          }
          if (pedidoError || !novoPedido) throw pedidoError;
          const pedidoId = novoPedido.id;

          // 4. Mapear e Inserir Itens
          const { data: produtosLoja } = await supabase
            .from('produtos')
            .select('id, pdv_code, preco, nome')
            .eq('loja_id', lojaId);

          const insertItens = [];
          for (const item of order.items) {
            const produtoMatch = produtosLoja?.find((p: any) => p.pdv_code === item.externalCode);
            
            insertItens.push({
              pedido_id: pedidoId,
              produto_id: produtoMatch?.id || null, 
              quantidade: item.quantity,
              preco_unitario: item.unitPrice,
              observacao: item.observations || null,
              nome_produto: item.name
            });
          }

          if (insertItens.length > 0) {
             // Precisamos iterar para inserir os itens (porque tem tabela de opções separada se fosse o caso)
             // Para o MVP iFood simplificado da MiseOn, só inserimos na itens_pedido
             for (const it of insertItens) {
                await supabase.from('itens_pedido').insert(it);
             }
          }

          // 5. Pagamentos
          const insertPagamentos = [];
          // Regra Fundamental: "Nunca descartar silêncio como pagamento não confirmado"
          // O iFood assume o risco, então se não mandou método, consideramos PAGO via iFood.
          if (order.payments?.methods && order.payments.methods.length > 0) {
            for (const method of order.payments.methods) {
              const pagoOnline = method.prepaid; 
              insertPagamentos.push({
                pedido_id: pedidoId,
                metodo: method.method === 'PIX' ? 'PIX' : (method.method === 'CASH' ? 'DINHEIRO' : 'IFOOD'),
                valor_pago: method.value,
                status: pagoOnline ? 'PAGO' : 'PENDENTE',
                data_pagamento: pagoOnline ? new Date().toISOString() : null
              });
            }
          } else {
             // Silêncio = Pagamento Confirmado via iFood (Regra de Negócio)
             insertPagamentos.push({
                pedido_id: pedidoId,
                metodo: 'IFOOD',
                valor_pago: valorBrutoIfood,
                status: 'PAGO',
                data_pagamento: new Date().toISOString()
             });
          }
          
          if (insertPagamentos.length > 0) {
            await supabase.from('pagamentos').insert(insertPagamentos);
          }

          reqLogger.info(`Pedido ${order.displayId} (iFood) processado com sucesso para a loja ${lojaId}.`, { order_id: order.displayId, loja_id: lojaId });

        } catch (e: any) {
          reqLogger.error(`Erro ao processar pedido iFood ${event.orderId}`, e, { order_id: event.orderId });
          await sendFailureEmail(event.orderId, lojaNomeFallback, e.message);
        }
      }
    }

    // iFood exige apenas um status 200/202 para não retentar
    return new Response('OK', { status: 200, headers: corsHeaders });

  } catch (error: any) {
    reqLogger.error('Erro geral no ifood-webhook', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
