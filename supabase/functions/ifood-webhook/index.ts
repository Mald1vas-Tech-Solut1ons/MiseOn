import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.6';
import { z } from 'npm:zod';
import { logger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Auth helpers ─────────────────────────────────────────────────────────────

/** Obtém token de plataforma via client_credentials (token de integração SaaS) */
async function getPlatformToken(clientId: string, clientSecret: string): Promise<string> {
  const body = new URLSearchParams({ grantType: 'client_credentials', clientId, clientSecret });
  const res = await fetch('https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Falha ao autenticar no iFood: ${res.status}`);
  const { accessToken } = await res.json();
  return accessToken;
}

// ─── Order API helpers ────────────────────────────────────────────────────────

async function getOrderDetails(orderId: string, token: string) {
  const res = await fetch(`https://merchant-api.ifood.com.br/order/v1.0/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Falha ao buscar pedido ${orderId}: ${res.status} - ${err}`);
  }
  return res.json();
}

/** Confirma o pedido para o iFood (obrigatório em até 8 min após PLC) */
async function confirmOrder(orderId: string, token: string): Promise<void> {
  const res = await fetch(`https://merchant-api.ifood.com.br/order/v1.0/orders/${orderId}/confirm`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.text();
    logger.warn(`Falha ao confirmar pedido ${orderId}: ${res.status} - ${err}`);
  }
}

/** Busca os motivos de cancelamento disponíveis para o pedido */
async function getCancellationReasons(orderId: string, token: string): Promise<{ cancelCodeId: string; description: string }[]> {
  const res = await fetch(`https://merchant-api.ifood.com.br/order/v1.0/orders/${orderId}/cancellationReasons`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  return res.json();
}

/** Solicita/confirma cancelamento de um pedido */
async function requestCancellation(orderId: string, cancelCodeId: string, token: string): Promise<void> {
  const res = await fetch(`https://merchant-api.ifood.com.br/order/v1.0/orders/${orderId}/requestCancellation`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ cancellationCode: cancelCodeId }),
  });
  if (!res.ok) {
    const err = await res.text();
    logger.warn(`Falha ao solicitar cancelamento ${orderId}: ${res.status} - ${err}`);
  }
}

// ─── Email de falha crítica ───────────────────────────────────────────────────

async function sendFailureEmail(orderId: string, lojaNome: string, errorMessage: string) {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const alertEmail = Deno.env.get('ALERT_EMAIL') || 'suporte@miseon.app.br';
  if (!resendKey) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'MiseOn Alertas <suporte@miseon.app.br>',
        to: alertEmail,
        subject: `⚠️ Falha Crítica no Webhook iFood – Loja: ${lojaNome}`,
        html: `<h2>Falha na integração do Pedido iFood</h2>
          <p><strong>Loja:</strong> ${lojaNome}</p>
          <p><strong>Pedido:</strong> ${orderId}</p>
          <p><strong>Erro:</strong> ${errorMessage}</p>
          <hr/><p>Verifique os logs no Supabase Edge Functions.</p>`,
      }),
    });
  } catch (err) {
    logger.warn('Falha ao enviar email de alerta', err);
  }
}

// ─── Schema de validação ──────────────────────────────────────────────────────

const ifoodEventSchema = z.array(
  z.object({ code: z.string(), orderId: z.string() }).passthrough()
);

// ─── Mapeamento de status iFood → MiseOn ────────────────────────────────────

// Mapeamento iFood → enum status_pedido do banco
const STATUS_MAP: Record<string, string> = {
  PLC: 'NOVO',
  CFR: 'ACEITO',      // Confirmado pelo lojista
  RTP: 'PRONTO',     // Pronto para entrega/retirada
  DSP: 'EM_ROTA',    // Entregador a caminho
  CON: 'FINALIZADO', // Concluído
  CAN: 'CANCELADO',
};

// ─── Handler principal ────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const reqLogger = logger.withContext({ req_id: crypto.randomUUID() });

  try {
    let rawBody: unknown;
    try { rawBody = await req.json(); } catch { rawBody = null; }

    // LOG TEMPORÁRIO: mostrar payload bruto para debug (remover após homologação)
    reqLogger.info('RAW_PAYLOAD recebido', { raw: JSON.stringify(rawBody).slice(0, 500) });

    // iFood "Testar conexão" envia um objeto único; eventos reais chegam como array.
    // Normalizar para array em ambos os casos.
    let normalizedBody = rawBody;
    if (rawBody && !Array.isArray(rawBody) && typeof rawBody === 'object') {
      normalizedBody = [rawBody];
    }

    const validation = ifoodEventSchema.safeParse(normalizedBody);
    if (!validation.success) {
      reqLogger.error('Payload inválido após normalização', validation.error);
      // Sempre retornar 200 para o iFood não retentar indefinidamente
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    const events = validation.data;
    reqLogger.info(`Webhook processando ${events.length} evento(s)`, {
      codes: events.map((e) => e.code).join(','),
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const clientId = Deno.env.get('IFOOD_CLIENT_ID')!;
    const clientSecret = Deno.env.get('IFOOD_CLIENT_SECRET')!;
    if (!clientId || !clientSecret) {
      reqLogger.error('Credenciais iFood ausentes!');
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    // Token único por invocação (evita múltiplas chamadas de auth)
    let platformToken: string | null = null;
    const getToken = async () => {
      if (!platformToken) platformToken = await getPlatformToken(clientId, clientSecret);
      return platformToken;
    };

    // ── Processar cada evento ────────────────────────────────────────────────
    for (const event of events) {
      const { code, orderId } = event;
      let lojaNomeFallback = 'Desconhecida';

      try {
        const token = await getToken();

        // ── PLC: Novo Pedido ────────────────────────────────────────────────
        if (code === 'PLC') {
          const order = await getOrderDetails(orderId, token);

          const { data: loja } = await supabase
            .from('lojas')
            .select('id, nome, ifood_taxa_pct, ifood_taxa_fixa')
            .eq('ifood_merchant_id', order.merchant?.id)
            .single();

          if (!loja) {
            reqLogger.warn(`Loja iFood ${order.merchant?.id} não encontrada no MiseOn.`);
            continue;
          }
          lojaNomeFallback = loja.nome;

          // Idempotência: verificar se já foi processado
          const { data: jaProcessado } = await supabase
            .from('pedidos')
            .select('id')
            .eq('ifood_order_id', orderId)
            .maybeSingle();

          if (jaProcessado) {
            reqLogger.info(`Pedido iFood ${orderId} já processado — ignorando.`);
            // Confirmar mesmo assim para garantir que o iFood sabe que recebemos
            await confirmOrder(orderId, token);
            continue;
          }

          // Cliente (com respeito à LGPD)
          let telefoneLimpo = (order.customer?.phone?.number || '').replace(/\D/g, '');
          const validPhoneRegex = /^[1-9]{2}9?[0-9]{8}$/;
          if (!telefoneLimpo || !validPhoneRegex.test(telefoneLimpo)) {
            telefoneLimpo = `IFOOD_${order.customer?.id || order.displayId || orderId}`;
          }

          let clienteId: string | null = null;
          if (telefoneLimpo) {
            const { data: clienteExistente } = await supabase
              .from('clientes')
              .select('id')
              .eq('loja_id', loja.id)
              .eq('telefone', telefoneLimpo)
              .single();

            if (clienteExistente) {
              clienteId = clienteExistente.id;
            } else {
              const { data: novoCli } = await supabase
                .from('clientes')
                .insert({ loja_id: loja.id, nome: order.customer?.name || 'Cliente iFood', telefone: telefoneLimpo })
                .select('id')
                .single();
              if (novoCli) clienteId = novoCli.id;
            }
          }

          // Cálculo de repasse
          const valorBrutoIfood = order.total?.orderAmount || 0;
          const taxaPct = Number(loja.ifood_taxa_pct || 0) / 100;
          const taxaFixa = Number(loja.ifood_taxa_fixa || 0);
          const taxaIfoodRetida = (valorBrutoIfood * taxaPct) + taxaFixa;

          const isDelivery = order.orderType === 'DELIVERY';

          const { data: novoPedido, error: pedidoError } = await supabase
            .from('pedidos')
            .insert({
              loja_id: loja.id,
              cliente_id: clienteId,
              status: 'NOVO',
              origem: 'ifood',
              tipo_pedido: isDelivery ? 'DELIVERY' : 'RETIRADA_BALCAO',
              subtotal: order.total?.subTotal ?? 0,
              taxa_entrega: order.total?.deliveryFee || 0,
              desconto: order.total?.discounts || 0,
              valor_total: valorBrutoIfood,
              observacao: order.observations || null,
              numero: Number(order.displayId) || 0,
              identificador_cliente: order.customer?.name || 'iFood',
              ifood_order_id: orderId,
              valor_bruto_ifood: valorBrutoIfood,
              taxa_ifood_retida: taxaIfoodRetida,
            })
            .select('id')
            .single();

          // Race condition protection (unique index)
          if ((pedidoError as any)?.code === '23505') {
            reqLogger.info(`Pedido iFood ${orderId} inserido em paralelo — ignorando.`);
            await confirmOrder(orderId, token);
            continue;
          }
          if (pedidoError || !novoPedido) throw pedidoError;

          const pedidoId = novoPedido.id;

          // Itens
          const { data: produtosLoja } = await supabase
            .from('produtos')
            .select('id, pdv_code')
            .eq('loja_id', loja.id);

          for (const item of (order.items || [])) {
            const produtoMatch = produtosLoja?.find((p: any) => p.pdv_code === item.externalCode);
            await supabase.from('itens_pedido').insert({
              pedido_id: pedidoId,
              produto_id: produtoMatch?.id || null,
              quantidade: item.quantity,
              preco_unitario: item.unitPrice,
              observacao: item.observations || null,
              nome_produto: item.name,
            });
          }

          // Pagamentos
          if (order.payments?.methods && order.payments.methods.length > 0) {
            const pagamentos = order.payments.methods.map((m: any) => ({
              pedido_id: pedidoId,
              metodo: m.method === 'PIX' ? 'PIX' : m.method === 'CASH' ? 'DINHEIRO' : 'IFOOD',
              valor_pago: m.value,
              status: m.prepaid ? 'PAGO' : 'PENDENTE',
              data_pagamento: m.prepaid ? new Date().toISOString() : null,
            }));
            await supabase.from('pagamentos').insert(pagamentos);
          } else {
            await supabase.from('pagamentos').insert({
              pedido_id: pedidoId,
              metodo: 'IFOOD',
              valor_pago: valorBrutoIfood,
              status: 'PAGO',
              data_pagamento: new Date().toISOString(),
            });
          }

          // ✅ CONFIRMAR PEDIDO AUTOMATICAMENTE (obrigatório — SLA 8 min)
          await confirmOrder(orderId, token);

          reqLogger.info(`PLC processado: pedido #${order.displayId} (${orderId}) → loja ${loja.nome}`, {
            order_id: orderId, loja_id: loja.id,
          });
        }

        // ── CFR: Confirmado pelo iFood ──────────────────────────────────────
        else if (code === 'CFR') {
          const { error } = await supabase
            .from('pedidos')
            .update({ status: 'ACEITO' })
            .eq('ifood_order_id', orderId);

          if (error) reqLogger.warn(`CFR: falha ao atualizar status ${orderId}`, error);
          else reqLogger.info(`CFR: pedido ${orderId} → ACEITO`);
        }

        // ── RTP: Pronto para retirada/entrega ──────────────────────────────
        else if (code === 'RTP') {
          const { error } = await supabase
            .from('pedidos')
            .update({ status: 'PRONTO' })
            .eq('ifood_order_id', orderId);

          if (error) reqLogger.warn(`RTP: falha ao atualizar status ${orderId}`, error);
          else reqLogger.info(`RTP: pedido ${orderId} → PRONTO`);
        }

        // ── DSP: Despachado (entregador a caminho) ─────────────────────────
        else if (code === 'DSP') {
          const { error } = await supabase
            .from('pedidos')
            .update({ status: 'EM_ROTA' })
            .eq('ifood_order_id', orderId);

          if (error) reqLogger.warn(`DSP: falha ao atualizar status ${orderId}`, error);
          else reqLogger.info(`DSP: pedido ${orderId} → EM_ROTA`);
        }

        // ── CON: Concluído ─────────────────────────────────────────────────
        else if (code === 'CON') {
          const { error } = await supabase
            .from('pedidos')
            .update({ status: 'FINALIZADO' })
            .eq('ifood_order_id', orderId);

          if (error) reqLogger.warn(`CON: falha ao atualizar status ${orderId}`, error);
          else reqLogger.info(`CON: pedido ${orderId} → FINALIZADO`);
        }

        // ── CAN: Cancelamento solicitado ───────────────────────────────────
        else if (code === 'CAN') {
          // 1. Buscar motivos disponíveis
          const reasons = await getCancellationReasons(orderId, token);

          // 2. Usar o primeiro motivo disponível (ou um genérico se a lista vier vazia)
          const cancelCodeId = reasons?.[0]?.cancelCodeId ?? '501';

          // 3. Confirmar o cancelamento para o iFood
          await requestCancellation(orderId, cancelCodeId, token);

          // 4. Atualizar no banco
          const { error } = await supabase
            .from('pedidos')
            .update({
              status: 'CANCELADO',
              motivo_cancelamento: reasons?.[0]?.description || 'Cancelado via iFood',
            })
            .eq('ifood_order_id', orderId);

          if (error) reqLogger.warn(`CAN: falha ao atualizar status ${orderId}`, error);
          else reqLogger.info(`CAN: pedido ${orderId} → CANCELADO (motivo: ${reasons?.[0]?.description})`);
        }

        // ── Outros eventos: logar e ignorar graciosamente ──────────────────
        else {
          reqLogger.info(`Evento não tratado recebido: ${code} para pedido ${orderId}`);
        }

      } catch (e: any) {
        reqLogger.error(`Erro ao processar evento ${code} do pedido ${orderId}`, e);
        await sendFailureEmail(orderId, lojaNomeFallback, e.message);
        // NÃO lançar exceção — continuar processando os demais eventos do batch
      }
    }

    // O iFood exige 200 para não retentar. SEMPRE retornar 200.
    return new Response('OK', { status: 200, headers: corsHeaders });

  } catch (error: any) {
    reqLogger.error('Erro geral no ifood-webhook', error);
    // Mesmo em erro geral: retornar 200 para o iFood não retentar indefinidamente
    return new Response('OK', { status: 200, headers: corsHeaders });
  }
});
