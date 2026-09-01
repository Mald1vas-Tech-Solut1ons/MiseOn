import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.6';
import { z } from 'npm:zod';
import { logger } from '../_shared/logger.ts';
import { checkRateLimit, ipDaRequisicao } from '../_shared/rate-limit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-chat-session',
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


// Nao existe requestCancellation aqui de proposito: cancelar no iFood e ato
// que parte da LOJA, e mora na Edge Function ifood-status, onde a tela consegue
// esperar a resposta e mostrar o que aconteceu. Este arquivo so RECEBE eventos.

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
  // CFM e o codigo que o iFood realmente manda na confirmacao
  // (fullCode CONFIRMED). `CFR` estava aqui desde o inicio e NUNCA casou com
  // nada: toda confirmacao caia em "evento nao tratado". Medido no log da
  // homologacao de 21/08: {"code":"CFM","fullCode":"CONFIRMED"}.
  // CFR fica como apelido porque contas antigas ainda o emitem.
  CFM: 'ACEITO',
  CFR: 'ACEITO',
  PRS: 'PREPARANDO',  // PREPARATION_STARTED
  RTP: 'PRONTO',     // Pronto para entrega/retirada
  DSP: 'EM_ROTA',    // Entregador a caminho
  CON: 'FINALIZADO', // Concluído
  CAN: 'CANCELADO',
};

// ─── Handler principal ────────────────────────────────────────────────────────

// ─── Resposta ao iFood ────────────────────────────────────────────────────────
//
// 202, NUNCA 200.
//
// A documentacao do iFood e explicita: o endpoint deve responder `202 Accepted`,
// e e a resposta 202 que gera o heartbeat de presenca — uma unica resposta 202
// marca como online os merchants com escopo de pedido. QUALQUER outro codigo,
// 200 incluido, nao gera heartbeat nenhum.
//
// Este arquivo respondia 200 em todos os caminhos, com um comentario afirmando
// que "o iFood exige 200". Era falso. O preco foi o aviso de 01/09/2026 —
// "webhook falhando em responder requests de healthcheck", app miseon
// (c44831bc-9cc2-47c0-ac61-5e73b71645d3). Healthcheck com erro reincidente por
// 72h DESATIVA o webhook, e webhook desativado e pedido que nao chega na
// cozinha.
const aceito = () => new Response('Accepted', { status: 202, headers: corsHeaders });

// `EdgeRuntime` existe no runtime do Supabase, nao na tipagem do Deno.
declare const EdgeRuntime: { waitUntil?: (p: Promise<unknown>) => void } | undefined;

type EventoIfood = { code: string; orderId: string } & Record<string, unknown>;

// ─── Processamento: fora do caminho da resposta ──────────────────────────────
//
// O iFood espera resposta em 1–2s e corta em 5s. Cada evento aqui faz uma ou
// duas chamadas a API deles (token + busca do pedido) ANTES de tocar no banco;
// um lote de eventos estourava esse teto com folga, e webhook que estoura o
// prazo e webhook marcado como falho — o mesmo balde do e-mail de healthcheck.
//
// Por isso a resposta sai primeiro e o trabalho continua depois dela, preso ao
// `EdgeRuntime.waitUntil`, que mantem o isolate vivo ate a promessa terminar.
// Sem ele o runtime pode encerrar a invocacao junto com a resposta e o
// processamento morre no meio — pedido perdido, silenciosamente.
async function processarEventos(
  events: EventoIfood[],
  reqLogger: ReturnType<typeof logger.withContext>,
) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const clientId = Deno.env.get('IFOOD_CLIENT_ID')!;
    const clientSecret = Deno.env.get('IFOOD_CLIENT_SECRET')!;
    if (!clientId || !clientSecret) {
      reqLogger.error('Credenciais iFood ausentes!');
      return;
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

          // A preferencia da loja decide quem confirma.
          //
          // A tela oferece "Confirmar pedido automaticamente" desde a migration
          // de preferencias, mas NENHUMA linha de codigo lia a coluna: o
          // webhook confirmava sempre. O lojista desligava o interruptor e o
          // MiseOn continuava aceitando pedido por ele — inclusive com a loja
          // sem condicao de produzir. Interruptor decorativo e pior do que
          // interruptor nenhum, porque o lojista acha que decidiu.
          //
          // Desligado, o pedido entra como NOVO e espera o "Aceitar pedido" no
          // Painel. O SLA de 8 minutos passa a ser responsabilidade de quem
          // desligou — e a tela diz isso ao lado do interruptor.
          const { data: prefLoja } = await supabase
            .from('lojas')
            .select('ifood_confirmar_automatico')
            .eq('ifood_merchant_id', order?.merchant?.id ?? '')
            .maybeSingle();
          const confirmaSozinho = prefLoja?.ifood_confirmar_automatico ?? true;

          if (criado?.status === 'ja_existe') {
            if (confirmaSozinho) {
              reqLogger.info(`Pedido iFood ${orderId} ja processado — confirmando mesmo assim.`);
              await confirmOrder(orderId, token);
            }
            continue;
          }

          // Confirmar so acontece depois que o pedido inteiro ja esta comitado.
          if (confirmaSozinho) {
            await confirmOrder(orderId, token);
          } else {
            reqLogger.info(`PLC ${orderId}: confirmacao automatica desligada — aguardando o lojista.`);
          }

          reqLogger.info(`PLC processado: pedido #${criado?.numero} (${orderId}) → loja ${criado?.loja}`, {
            context: {
              order_id: orderId, pedido_id: criado?.pedido_id,
              itens: criado?.itens, pagamentos: criado?.pagamentos,
            },
          });
        }

        // ── CFM/CFR: Confirmado pelo iFood ─────────────────────────────────
        else if (code === 'CFM' || code === 'CFR') {
          const { error } = await supabase
            .from('pedidos')
            .update({ status: 'ACEITO' })
            .eq('ifood_order_id', orderId);

          if (error) reqLogger.warn(`${code}: falha ao atualizar status ${orderId}`, { context: { erro: error.message } });
          else reqLogger.info(`${code}: pedido ${orderId} → ACEITO`);
        }

        // ── PRS: preparo iniciado ──────────────────────────────────────────
        // Eco do "iniciar preparo" — pelo Portal do Parceiro, pelo wizard de
        // homologacao ou pelo proprio MiseOn. Ficou em "evento nao tratado"
        // desde sempre, e o efeito colateral apareceu na homologacao de 21/08:
        // o pedido nao andava de estado sozinho, entao os botoes de despachar e
        // cancelar nao apareciam na hora em que o iFood esperava a acao.
        //
        // A maquina de estado LOCAL continua mandando na estacao: se a cozinha
        // ainda nao recebeu o pedido, `fn_valida_transicao_pedido` recusa e
        // esta recusa e legitima — quem organiza a producao aqui e o KDS, nao o
        // iFood. Por isso a falha e `info`, nao `warn`: nao ha nada a consertar.
        else if (code === 'PRS') {
          const { error } = await supabase
            .from('pedidos')
            .update({ status: 'PREPARANDO' })
            .eq('ifood_order_id', orderId)
            .in('status', ['NOVO', 'ACEITO']);

          if (error) reqLogger.info(`PRS: ${orderId} segue no fluxo local (${error.message})`);
          else reqLogger.info(`PRS: pedido ${orderId} → PREPARANDO`);
        }

        // ── DDCR: o iFood gerou o codigo de entrega ────────────────────────
        // DELIVERY_DROP_CODE_REQUESTED avisa que existe codigo para este
        // pedido; o codigo em si NAO vem no evento — mora em
        // `delivery.pickupCode`, que o PLC ja gravou em `ifood_codigo_coleta`.
        // Nao ha estado a mudar. Esta como ramo proprio so para parar de sujar
        // o log de "evento nao tratado", que e onde se procura problema real.
        else if (code === 'DDCR') {
          reqLogger.info(`DDCR: iFood gerou codigo de entrega para ${orderId}`);
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

        // ── CAN: pedido cancelado no iFood ─────────────────────────────────
        // CAN e AVISO, nao pedido de acao: quando ele chega, o pedido JA esta
        // cancelado la. O codigo antigo respondia com requestCancellation, o que
        // era cancelar de novo o que ja caiu — o iFood recusava e a falha ficava
        // num warn que ninguem lia.
        //
        // O CAN tambem volta como eco do cancelamento que a LOJA fez pelo
        // Painel. Por isso o update nao pode sobrescrever cegamente: se o
        // carimbo diz que a origem foi a loja, o motivo escolhido pelo lojista
        // e a versao que vale, e sobrescrever apagaria justamente a informacao
        // que explica o cancelamento para quem for olhar depois.
        else if (code === 'CAN') {
          const { data: existente } = await supabase
            .from('pedidos')
            .select('id, status, ifood_cancelamento_origem')
            .eq('ifood_order_id', orderId)
            .maybeSingle();

          if (!existente) {
            reqLogger.warn(`CAN: pedido ${orderId} não encontrado no MiseOn`);
          } else if (existente.ifood_cancelamento_origem === 'LOJA') {
            // Chegou o CAN: o cancelamento da loja passou. Qualquer recusa
            // registrada antes (CARF de uma tentativa anterior) deixa de valer.
            await supabase
              .from('pedidos')
              .update({ ifood_cancelamento_erro: null })
              .eq('id', existente.id)
              .not('ifood_cancelamento_erro', 'is', null);

            // Motivo e origem ficam como o lojista deixou. Mas o status ainda
            // precisa fechar: se a tela cancelou no iFood e caiu antes de gravar
            // no MiseOn, este eco e a rede que impede o pedido de ficar aberto
            // aqui e cancelado la.
            if (existente.status !== 'CANCELADO') {
              const { error } = await supabase
                .from('pedidos')
                .update({ status: 'CANCELADO' })
                .eq('id', existente.id);
              if (error) reqLogger.warn(`CAN: falha ao fechar ${orderId}`, { context: { erro: error.message } });
              else reqLogger.info(`CAN: ${orderId} fechado pelo eco — cancelamento tinha parado no meio`);
            } else {
              reqLogger.info(`CAN: eco do cancelamento feito pela loja em ${orderId} — nada a mudar`);
            }
          } else {
            // O motivo REAL vem do pedido, nao da lista de motivos possiveis.
            // O codigo antigo gravava reasons[0].description — o primeiro item
            // do cardapio de motivos — como se fosse o motivo escolhido. Num
            // cancelamento feito pelo cliente, isso escrevia "Problemas de
            // sistema na loja" no historico de um pedido que a loja nao errou.
            const detalhe = await getOrderDetails(orderId, token).catch(() => null);
            const cancelamento = detalhe?.cancellation ?? detalhe?.cancellationDetails ?? null;

            const { error } = await supabase
              .from('pedidos')
              .update({
                status: 'CANCELADO',
                motivo_cancelamento:
                  cancelamento?.reason ?? detalhe?.cancellationReason ?? 'Cancelado pelo iFood',
                ifood_cancelamento_origem: 'IFOOD',
                ifood_cancelamento_codigo: cancelamento?.cancelCodeId ?? cancelamento?.code ?? null,
                // Carimbo: e ele que impede o gatilho de status de devolver ao
                // iFood um cancelamento que nasceu no proprio iFood.
                ifood_cancelamento_em: new Date().toISOString(),
              })
              .eq('id', existente.id);

            if (error) reqLogger.warn(`CAN: falha ao atualizar status ${orderId}`, { context: { erro: error.message } });
            else reqLogger.info(`CAN: pedido ${orderId} → CANCELADO`);
          }
        }

        // ── HSD: negociacao pos-entrega aberta pelo cliente ────────────────
        //
        // O cliente reclamou depois de receber e o iFood NAO cancela sozinho:
        // abre uma negociacao e da a loja um prazo curto (`expiresAt`) para
        // aceitar, rejeitar ou fazer contraproposta. Sem resposta, o
        // `timeoutAction` executa — e em cancelamento pos-entrega ele costuma
        // ser ACCEPT_CANCELLATION.
        //
        // Enquanto este codigo caiu no ramo "evento nao tratado", o lojista
        // PERDIA o valor do pedido sem nunca ter visto a reclamacao. Nao e
        // falha de tela: e dinheiro saindo por omissao nossa.
        else if (code === 'HSD' || (event as { fullCode?: string }).fullCode === 'HANDSHAKE_DISPUTE') {
          const d = (event as { metadata?: Record<string, unknown> })?.metadata ?? {};
          const disputeId = String(d.id ?? '');

          if (!disputeId) {
            reqLogger.warn(`HSD sem id de disputa para ${orderId} — evento descartado`);
            continue;
          }

          // O pedido pode nao existir aqui (disputa de pedido anterior a
          // integracao). Guardar assim mesmo e melhor que descartar: o prazo
          // corre igual, e o lojista precisa ver.
          const { data: pedidoLocal } = await supabase
            .from('pedidos')
            .select('id, loja_id, numero')
            .eq('ifood_order_id', orderId)
            .maybeSingle();

          let lojaId = pedidoLocal?.loja_id ?? null;
          if (!lojaId) {
            const merchantId = (event as { merchantId?: string })?.merchantId ?? '';
            const { data: loja } = await supabase
              .from('lojas').select('id').eq('ifood_merchant_id', merchantId).maybeSingle();
            lojaId = loja?.id ?? null;
          }

          if (!lojaId) {
            reqLogger.warn(`HSD ${disputeId}: loja nao identificada para ${orderId}`);
            continue;
          }

          const meta = (d.metadata ?? {}) as Record<string, unknown>;

          // `upsert` por dispute_id: o mesmo evento pode chegar pela webhook E
          // pelo polling. Gravar duas vezes criaria duas negociacoes na tela
          // para a mesma reclamacao.
          const { error } = await supabase
            .from('ifood_disputas')
            .upsert({
              loja_id: lojaId,
              pedido_id: pedidoLocal?.id ?? null,
              dispute_id: disputeId,
              ifood_order_id: orderId,
              acao: d.action ?? null,
              tipo: d.handshakeType ?? null,
              grupo: d.handshakeGroup ?? null,
              mensagem: d.message ?? null,
              expira_em: d.expiresAt ?? null,
              acao_no_prazo: d.timeoutAction ?? null,
              alternativas: d.alternatives ?? null,
              metadados: meta,
            }, { onConflict: 'dispute_id' });

          if (error) {
            reqLogger.error(`HSD ${disputeId}: falha ao gravar negociacao`, error);
          } else {
            reqLogger.info(
              `HSD: negociacao ${disputeId} aberta no pedido #${pedidoLocal?.numero ?? '?'} ` +
              `(${d.action}, expira ${d.expiresAt}, sem resposta o iFood faz ${d.timeoutAction})`,
            );
          }
        }

        // ── HSS: desfecho da negociacao ────────────────────────────────────
        // Chega quando a negociacao fecha — por resposta nossa, por
        // contraproposta aceita, ou por prazo estourado (status EXPIRED).
        else if (code === 'HSS' || (event as { fullCode?: string }).fullCode === 'HANDSHAKE_SETTLEMENT') {
          const d = (event as { metadata?: Record<string, unknown> })?.metadata ?? {};
          const disputeId = String(d.disputeId ?? '');
          const status = String(d.status ?? '');

          const mapa: Record<string, string> = {
            ACCEPTED: 'ACEITA',
            REJECTED: 'REJEITADA',
            ALTERNATIVE_REPLIED: 'ALTERNATIVA',
            EXPIRED: 'EXPIRADA',
          };

          if (disputeId) {
            await supabase
              .from('ifood_disputas')
              .update({
                situacao: mapa[status] ?? 'EXPIRADA',
                resposta_erro: status === 'EXPIRED'
                  ? 'O prazo estourou e o iFood decidiu sozinho.'
                  : null,
              })
              .eq('dispute_id', disputeId);
            reqLogger.info(`HSS: negociacao ${disputeId} encerrada como ${status}`);
          }
        }

        // ── CAR / CARF: o desfecho do cancelamento que a LOJA pediu ────────
        // requestCancellation responde 202 e nao decide nada ali. O iFood
        // manda CAR ("recebi seu pedido de cancelamento") e depois CAN
        // (cancelou) ou CARF (recusou). Enquanto esses dois codigos cairam no
        // ramo "evento nao tratado", a recusa era invisivel: MiseOn com o
        // pedido cancelado, iFood com o pedido de pe, cliente esperando.
        else if (code === 'CAR') {
          reqLogger.info(`CAR: iFood recebeu o pedido de cancelamento de ${orderId}`);
        }

        else if (code === 'CARF') {
          const { error } = await supabase
            .from('pedidos')
            .update({
              ifood_cancelamento_erro:
                'O iFood recusou o cancelamento. O pedido pode continuar ativo no app do cliente — ' +
                'confira no Portal do Parceiro.',
            })
            .eq('ifood_order_id', orderId);

          if (error) reqLogger.warn(`CARF: falha ao registrar recusa de ${orderId}`, { context: { erro: error.message } });
          else reqLogger.warn(`CARF: iFood RECUSOU o cancelamento de ${orderId}`);
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
  } catch (error: any) {
    reqLogger.error('Erro geral ao processar eventos do iFood', error);
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const reqLogger = logger.withContext({ req_id: crypto.randomUUID() });

  let rawBody: unknown;
  try { rawBody = await req.json(); } catch { rawBody = null; }

  // "Testar conexao" e healthcheck mandam um objeto unico; evento real chega
  // como array. Normalizar para array nos dois casos.
  const normalizedBody =
    rawBody && !Array.isArray(rawBody) && typeof rawBody === 'object' ? [rawBody] : rawBody;
  const eventosBrutos = Array.isArray(normalizedBody) ? normalizedBody : [];

  // ── HEALTHCHECK ────────────────────────────────────────────────────────────
  // O iFood bate aqui a cada ~25s so para saber se estamos de pe. Vem sem
  // orderId (codigo KEEPALIVE) e, em algumas variacoes, sem corpo util nenhum.
  //
  // Responde 202 ANTES de qualquer trabalho: sem rate limit, sem banco, sem
  // rede. E este caminho que decide se a loja aparece online no iFood, e ele
  // nao pode depender de nenhuma dependencia nossa estar de pe.
  const soKeepalive =
    eventosBrutos.length === 0 ||
    eventosBrutos.every((e) => (e as { code?: string })?.code === 'KEEPALIVE');
  if (soKeepalive) return aceito();

  // ── Rate limit: so para evento, nunca para healthcheck ─────────────────────
  // 429 e resposta legitima para evento — o iFood reenvia depois. No
  // healthcheck seria veneno: qualquer nao-202 tira os merchants do ar. Por
  // isso o freio mora aqui embaixo, depois do desvio do keepalive.
  //
  // Endpoint aberto por necessidade: o iFood chama sem JWT do Supabase, entao
  // verify_jwt=false nao tem alternativa. Sem freio, um terceiro queima a cota
  // da conta, porque cada evento dispara chamada a API do iFood.
  //
  // Validacao de assinatura continua fora DE PROPOSITO: todo evento e conferido
  // contra a API do iFood antes de agir (ver "AUTENTICIDADE DO EVENTO"), entao
  // orderId forjado nao existe la e o evento e descartado.
  const ipOrigem = ipDaRequisicao(req);
  const rl = await checkRateLimit(`ifood:${ipOrigem}`, { windowMs: 60_000, maxRequests: 120 });
  if (!rl.allowed) {
    reqLogger.warn('Rate limit atingido no webhook iFood', { context: { ip: ipOrigem } });
    return new Response('Too Many Requests', { status: 429, headers: corsHeaders });
  }

  const validation = ifoodEventSchema.safeParse(normalizedBody);
  if (!validation.success) {
    // `warn`, nao `error`: corpo desconhecido do iFood nao e falha nossa, e
    // subir como erro so afoga o log — foi assim que o keepalive escondeu
    // problema de verdade durante a homologacao.
    reqLogger.warn('Payload iFood nao reconhecido — nada a processar', {
      context: { raw: JSON.stringify(rawBody).slice(0, 500) },
    });
    return aceito();
  }

  const events = validation.data as EventoIfood[];
  reqLogger.info(`Webhook recebeu ${events.length} evento(s)`, {
    context: { codes: events.map((e) => e.code).join(',') },
  });

  // Resposta primeiro, trabalho depois.
  const tarefa = processarEventos(events, reqLogger);
  if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime?.waitUntil === 'function') {
    EdgeRuntime.waitUntil(tarefa);
  } else {
    await tarefa; // runtime sem waitUntil: melhor demorar do que perder o evento
  }

  return aceito();
});
