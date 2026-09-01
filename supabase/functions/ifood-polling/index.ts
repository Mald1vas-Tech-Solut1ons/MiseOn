// MiseOn — Edge Function: polling da fila de eventos do iFood
//
// POR QUE ISTO EXISTE (não remova achando que o webhook basta):
// A Order API do iFood entrega pedido por FILA DE EVENTOS. O fluxo oficial é
//   1. GET  /order/v1.0/orders:polling        -> eventos pendentes
//   2. processa
//   3. POST /order/v1.0/orders:acknowledgment -> tira da fila
//      corpo: { "acknowledgedEventIds": ["evt_1", "evt_2"] }
// Caminhos conferidos na doc oficial do iFood (Order module / Event polling).
// O webhook é complemento, não substituto: se a nossa função estiver fora do
// ar por um minuto — deploy, erro, rate limit, cold start — o evento se perde
// e O PEDIDO NUNCA CHEGA NA COZINHA. Para um restaurante isso é cliente
// esperando comida que ninguém está preparando, e penalidade do iFood.
//
// Sem acknowledgment, a fila do iFood também nunca esvazia: o mesmo evento
// volta sempre, e a idempotência do nosso lado é a única coisa impedindo
// pedido duplicado.
//
// O processamento em si NÃO é duplicado aqui: os eventos coletados são
// entregues à `ifood-webhook`, que já tem toda a lógica testada de PLC/CFR/
// RTP/DSP/CON/CAN e a idempotência por `ifood_order_id`. Esta função é só o
// coletor + o "recebi".
//
// Agendada pelo pg_cron a cada minuto (ver migration ifood_polling_agendado).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const IFOOD = 'https://merchant-api.ifood.com.br';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-chat-session',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

type Autenticacao =
  | { ok: true; token: string }
  | { ok: false; status: number; motivo: string };

/** Autentica no iFood devolvendo o MOTIVO, nao so o numero.
 *
 *  Antes isto lancava `Error("Falha ao autenticar no iFood: 403")` e o catch
 *  la embaixo respondia 500. Resultado medido em 01/09/2026: 500 a cada
 *  minuto, para sempre, com stack trace no lugar da explicacao — e o log
 *  cheio de 500 esconde justamente o erro que importa.
 *
 *  A mensagem do iFood dizia tudo:
 *    {"error":{"code":"Forbidden",
 *     "message":"No permissions granted to client c44831bc-..."}}
 *  ou seja, aplicativo sem permissoes concedidas no portal. Agora ela chega
 *  ao log inteira. */
async function getPlatformToken(clientId: string, clientSecret: string): Promise<Autenticacao> {
  const body = new URLSearchParams({ grantType: 'client_credentials', clientId, clientSecret });
  const res = await fetch(`${IFOOD}/authentication/v1.0/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const corpo = await res.text().catch(() => '');
    let motivo = corpo.slice(0, 300);
    try { motivo = JSON.parse(corpo)?.error?.message ?? motivo; } catch { /* corpo nao-JSON */ }
    return { ok: false, status: res.status, motivo };
  }
  const { accessToken } = await res.json();
  return { ok: true, token: accessToken };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

  // Só chamada interna. Aceita a service role (chamada function-to-function)
  // ou o IFOOD_POLLING_TOKEN, que é de menor privilégio e só serve para
  // disparar este coletor — é ele que fica no Vault para o pg_cron usar.
  // A service role key NUNCA vai para o banco: é a mesma regra que
  // api/cron/email.ts documenta.
  // Sem isto, um terceiro dispara polling em laço e queima a cota do iFood.
  const pollingToken = Deno.env.get('IFOOD_POLLING_TOKEN');
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const autorizado = bearer === serviceKey || (!!pollingToken && bearer === pollingToken);
  if (!autorizado) return json({ error: 'Não autorizado' }, 401);

  const clientId = Deno.env.get('IFOOD_CLIENT_ID');
  const clientSecret = Deno.env.get('IFOOD_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    return json({ error: 'Credenciais iFood ausentes' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Nenhuma loja integrada = nada a fazer. Evita bater no iFood à toa a cada
  // minuto enquanto ninguém usa a integração.
  const { count } = await supabase
    .from('lojas')
    .select('id', { count: 'exact', head: true })
    .not('ifood_merchant_id', 'is', null);
  if (!count) return json({ ok: true, motivo: 'nenhuma loja com iFood integrado' });

  const auth = await getPlatformToken(clientId, clientSecret);
  if (!auth.ok) {
    // 401/403 sao condicao de CONFIGURACAO — credencial revogada ou
    // aplicativo sem permissao no portal do iFood. A execucao terminou e
    // concluiu corretamente que nao ha o que fazer; nao e falha do servidor,
    // entao nao volta 5xx. Mesmo tratamento que ja se da a "nenhum modulo de
    // polling liberado" logo abaixo.
    const configuracao = auth.status === 401 || auth.status === 403;
    const linha = `iFood recusou a autenticacao da plataforma (${auth.status}): ${auth.motivo}`;
    if (configuracao) console.warn(linha); else console.error(linha);
    return json(
      { ok: false, motivo: auth.motivo, status: auth.status },
      configuracao ? 200 : 502,
    );
  }
  const token = auth.token;

  try {

    // 1. Coleta. `x-polling-merchants` limita aos merchants que são nossos —
    // sem isso o integrador recebe evento de loja que não opera aqui.
    const { data: lojas } = await supabase
      .from('lojas')
      .select('ifood_merchant_id')
      .not('ifood_merchant_id', 'is', null);
    const merchants = (lojas ?? []).map((l) => l.ifood_merchant_id).filter(Boolean);

    // Dois caminhos convivem na API do iFood e qual responde depende dos
    // modulos liberados para a conta:
    //   /order/v1.0/orders:polling    -> modulo Order (o documentado hoje)
    //   /events/v1.0/events:polling   -> modulo Events (legado, ainda ativo)
    // Conta sem homologacao concluida recebe 404 no primeiro. Medido nesta
    // conta: o de Order deu 404 e o de Events respondeu.
    // Em vez de fixar um chute, tenta o documentado e cai no legado — e diz
    // na resposta qual funcionou, para nao ficar adivinhando depois.
    const CAMINHOS = [
      { via: 'order',  poll: '/order/v1.0/orders:polling',   ack: '/order/v1.0/orders:acknowledgment' },
      { via: 'events', poll: '/events/v1.0/events:polling',  ack: '/events/v1.0/events/acknowledgment' },
    ];

    let res: Response | null = null;
    let rota = CAMINHOS[0];
    for (const c of CAMINHOS) {
      const tentativa = await fetch(`${IFOOD}${c.poll}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-polling-merchants': merchants.join(','),
        },
      });
      // 404 = esse modulo nao esta liberado para a conta; tenta o proximo.
      if (tentativa.status === 404) continue;
      res = tentativa; rota = c; break;
    }
    if (!res) {
      console.error('Nenhum caminho de polling do iFood respondeu (404 nos dois) — conta sem modulo liberado?');
      return json({ ok: false, motivo: 'nenhum modulo de polling liberado para a conta' });
    }

    // 204 = fila vazia. É o caso normal na maior parte das execuções.
    if (res.status === 204) return json({ ok: true, via: rota.via, eventos: 0 });
    if (!res.ok) {
      const erro = await res.text();
      console.error('Polling iFood falhou:', res.status, erro.slice(0, 300));
      return json({ error: 'polling falhou', status: res.status }, 502);
    }

    const eventos = await res.json();
    if (!Array.isArray(eventos) || eventos.length === 0) return json({ ok: true, via: rota.via, eventos: 0 });

    // 2. Processa reusando a lógica já testada do webhook.
    const entrega = await fetch(`${supabaseUrl}/functions/v1/ifood-webhook`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(eventos.map((e: any) => ({ code: e.code, orderId: e.orderId }))),
    });

    // 3. Acknowledgment SÓ se o processamento foi aceito. Confirmar antes de
    // processar é como o pedido some: o iFood tira da fila e nós perdemos.
    if (!entrega.ok) {
      console.error('ifood-webhook recusou o lote; NÃO confirmando para o iFood reentregar');
      return json({ error: 'processamento falhou', eventos: eventos.length }, 502);
    }

    // O ack espera { acknowledgedEventIds: [...] } — nao uma lista de objetos.
    const ack = await fetch(`${IFOOD}${rota.ack}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      // O modulo Order espera { acknowledgedEventIds: [...] }; o legado de
      // Events espera a lista de objetos. Manda no formato do que respondeu.
      body: JSON.stringify(
        rota.via === 'order'
          ? { acknowledgedEventIds: eventos.map((e: any) => e.id) }
          : eventos.map((e: any) => ({ id: e.id })),
      ),
    });
    if (!ack.ok) {
      // Não é fatal: sem ack o evento volta no próximo ciclo e a idempotência
      // por ifood_order_id impede pedido duplicado.
      console.warn('Acknowledgment falhou:', ack.status, (await ack.text()).slice(0, 200));
    }

    return json({
      ok: true,
      via: rota.via,
      eventos: eventos.length,
      confirmados: ack.ok,
      codigos: eventos.map((e: any) => e.code).join(','),
    });
  } catch (e) {
    console.error('Erro no polling iFood:', e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
