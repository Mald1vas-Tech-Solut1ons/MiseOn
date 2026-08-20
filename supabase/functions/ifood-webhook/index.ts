import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.6';
import { z } from 'npm:zod';
import { logger } from '../_shared/logger.ts';
import { checkRateLimit, ipDaRequisicao } from '../_shared/rate-limit.ts';

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
    logger.warn('Falha ao enviar email de alerta', { context: { erro: String(err) } });
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

  // Endpoint aberto por necessidade: o iFood chama sem JWT do Supabase, então
  // verify_jwt=false não tem alternativa. O que dá para fazer sem arriscar a
  // integração é limitar a vazão — cada evento aqui dispara chamadas à API do
  // iFood (busca do pedido), e sem freio um terceiro queima a cota da conta.
  //
  // Validação de assinatura continua fora DE PROPÓSITO: o esquema do iFood
  // precisa ser conferido contra tráfego real antes de virar bloqueio, senão o
  // risco vira pedido deixando de entrar em produção sem ninguém perceber.
  // No lugar dela, TODO evento é confirmado contra a API do iFood antes de
  // agir (ver "AUTENTICIDADE DO EVENTO" no laço abaixo) — orderId forjado não
  // existe lá e o evento é descartado.
  const ipOrigem = ipDaRequisicao(req);
  const rl = await checkRateLimit(`ifood:${ipOrigem}`, { windowMs: 60_000, maxRequests: 120 });
  if (!rl.allowed) {
    reqLogger.warn('Rate limit atingido no webhook iFood', { context: { ip: ipOrigem } });
    // 429 e não 200: aqui queremos que o iFood reenvie o evento depois.
    return new Response('Too Many Requests', { status: 429, headers: corsHeaders });
  }

  try {
    let rawBody: unknown;
    try { rawBody = await req.json(); } catch { rawBody = null; }

    // LOG TEMPORÁRIO: mostrar payload bruto para debug (remover após homologação)
    reqLogger.info('RAW_PAYLOAD recebido', { context: { raw: JSON.stringify(rawBody).slice(0, 500) } });

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
      context: { codes: events.map((e) => e.code).join(',') },
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

        // ── AUTENTICIDADE DO EVENTO ───────────────────────────────────────
        // Este endpoint e aberto por necessidade (o iFood chama sem JWT do
        // Supabase) e nao valida assinatura. Antes, so o PLC consultava a API
        // do iFood; CFR/RTP/DSP/CON mudavam o status do pedido confiando
        // apenas no orderId do corpo, e o CAN chegava a chamar a API real de
        // cancelamento. Ou seja: quem tivesse um orderId valido conseguia
        // finalizar pedido (creditando cashback e lancando receita no ledger)
        // ou CANCELAR de verdade um pedido no iFood.
        //
        // A correcao usa o proprio iFood como autenticador: antes de agir,
        // busca o pedido na API deles. orderId forjado nao existe la e a
        // chamada falha, entao o evento e descartado. Custa uma requisicao a
        // mais por evento — volume de webhook do iFood comporta.
        //
        // PLC ja fazia isso logo abaixo (precisa do pedido inteiro), entao so
        // os demais codigos entram aqui.
        if (code !== 'PLC') {
          try {
            const confere = await getOrderDetails(orderId, token);
            if (!confere?.id && !confere?.displayId) {
              reqLogger.warn(`Evento ${code} descartado: iFood nao reconhece ${orderId}`);
              continue;
            }
          } catch (e) {
            reqLogger.warn(`Evento ${code} descartado: falha ao confirmar ${orderId} no iFood`, { context: { erro: String(e) } });
            continue;
          }
        }

        // ── PLC: Novo Pedido ────────────────────────────────────────────────
        if (code === 'PLC') {
          const order = await getOrderDetails(orderId, token);

          // Cliente, pedido, itens e pagamentos numa transacao so.
          //
          // Antes eram quatro escritas sequenciais daqui. Timeout da Edge
          // Function ou queda no meio deixava pedido sem item — e logo abaixo
          // o confirmOrder() avisava o iFood que tinhamos aceitado um pedido
          // que o banco guardou pela metade. O laco de itens e o insert de
          // pagamentos ainda por cima ignoravam o retorno, entao a perda era
          // silenciosa.
          //
          // O pagamento, alias, NUNCA entrava quando o meio nao era PIX nem
          // dinheiro: o codigo mandava metodo 'IFOOD' e o enum metodo_pgto nao
          // tinha esse valor. Conferido no banco antes de mexer: zero pedidos
          // de iFood tinham pagamento. Enum corrigido em 20260819172900.
          const { data: dadosCriacao, error: erroCriacao } = await supabase.rpc('fn_ifood_criar_pedido', {
            p_order_id: orderId,
            p_order: order,
          });

          // O client tipa retorno de RPC como `{}`; o formato real vem da funcao.
          const criado = dadosCriacao as {
            status?: 'criado' | 'ja_existe' | 'loja_nao_encontrada';
            merchant?: string; loja?: string; numero?: number;
            pedido_id?: string; itens?: number; pagamentos?: number;
          } | null;

          if (erroCriacao) {
            reqLogger.error(`PLC: falha ao criar pedido ${orderId}`, erroCriacao);
            await sendFailureEmail(orderId, lojaNomeFallback, erroCriacao.message);
            continue;
          }

          if (criado?.status === 'loja_nao_encontrada') {
            reqLogger.warn(`Loja iFood ${criado.merchant} nao encontrada no MiseOn.`);
            continue;
          }

          lojaNomeFallback = criado?.loja ?? lojaNomeFallback;

          if (criado?.status === 'ja_existe') {
            reqLogger.info(`Pedido iFood ${orderId} ja processado — confirmando mesmo assim.`);
            await confirmOrder(orderId, token);
            continue;
          }

          // Confirmar e obrigatorio (SLA de 8 min do iFood), e so acontece
          // depois que o pedido inteiro ja esta comitado.
          await confirmOrder(orderId, token);

          reqLogger.info(`PLC processado: pedido #${criado?.numero} (${orderId}) → loja ${criado?.loja}`, {
            context: {
              order_id: orderId, pedido_id: criado?.pedido_id,
              itens: criado?.itens, pagamentos: criado?.pagamentos,
            },
          });
        }

        // ── CFR: Confirmado pelo iFood ──────────────────────────────────────
        else if (code === 'CFR') {
          const { error } = await supabase
            .from('pedidos')
            .update({ status: 'ACEITO' })
            .eq('ifood_order_id', orderId);

          if (error) reqLogger.warn(`CFR: falha ao atualizar status ${orderId}`, { context: { erro: error.message } });
          else reqLogger.info(`CFR: pedido ${orderId} → ACEITO`);
        }

        // ── RTP: Pronto para retirada/entrega ──────────────────────────────
        else if (code === 'RTP') {
          const { error } = await supabase
            .from('pedidos')
            .update({ status: 'PRONTO' })
            .eq('ifood_order_id', orderId);

          if (error) reqLogger.warn(`RTP: falha ao atualizar status ${orderId}`, { context: { erro: error.message } });
          else reqLogger.info(`RTP: pedido ${orderId} → PRONTO`);
        }

        // ── DSP: Despachado (entregador a caminho) ─────────────────────────
        else if (code === 'DSP') {
          const { error } = await supabase
            .from('pedidos')
            .update({ status: 'EM_ROTA' })
            .eq('ifood_order_id', orderId);

          if (error) reqLogger.warn(`DSP: falha ao atualizar status ${orderId}`, { context: { erro: error.message } });
          else reqLogger.info(`DSP: pedido ${orderId} → EM_ROTA`);
        }

        // ── CON: Concluído ─────────────────────────────────────────────────
        else if (code === 'CON') {
          const { error } = await supabase
            .from('pedidos')
            .update({ status: 'FINALIZADO' })
            .eq('ifood_order_id', orderId);

          if (error) reqLogger.warn(`CON: falha ao atualizar status ${orderId}`, { context: { erro: error.message } });
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
              // Prefixo "[iFood]" marca a ORIGEM do cancelamento. A ifood-status lê
              // isto para não devolver ao iFood um cancelamento que partiu dele
              // mesmo — sem a marca, o gatilho de status geraria eco.
              motivo_cancelamento: `[iFood] ${reasons?.[0]?.description || 'Cancelado via iFood'}`,
            })
            .eq('ifood_order_id', orderId);

          if (error) reqLogger.warn(`CAN: falha ao atualizar status ${orderId}`, { context: { erro: error.message } });
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
