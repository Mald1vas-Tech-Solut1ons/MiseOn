// MiseOn — Edge Function: devolve ao iFood a mudança de status do pedido
//
// POR QUE ISTO EXISTE:
// A integração recebia pedido do iFood mas nunca respondia de volta. O lojista
// marcava PREPARANDO no KDS, PRONTO no balcão, despachava com o entregador —
// e o cliente no app do iFood continuava vendo "pedido confirmado", parado.
// Para o iFood isso é integração incompleta: os endpoints de ciclo de vida
// (startPreparation, readyToPickup, dispatch) fazem parte dos critérios de
// homologação, e sem eles o pedido também não avança do lado deles.
//
// Mapeamento (status MiseOn -> endpoint iFood):
//   PREPARANDO  -> /startPreparation
//   PRONTO      -> /readyToPickup   (retirada/balcão)
//   EM_ROTA     -> /dispatch        (entrega)
//
// FINALIZADO e CANCELADO não têm callback: CON e CAN vêm DO iFood para nós,
// não o contrário. Cancelamento partindo da loja usa requestCancellation, que
// já está na ifood-webhook.
//
// Chamada pelo gatilho `trg_ifood_status` em `pedidos` (pg_net), então cobre
// KDS, Painel de Pedidos e app do entregador de uma vez — sem depender de cada
// tela lembrar de avisar o iFood.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const IFOOD = 'https://merchant-api.ifood.com.br';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function getPlatformToken(clientId: string, clientSecret: string): Promise<string> {
  const body = new URLSearchParams({ grantType: 'client_credentials', clientId, clientSecret });
  const res = await fetch(`${IFOOD}/authentication/v1.0/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Falha ao autenticar no iFood: ${res.status}`);
  const { accessToken } = await res.json();
  return accessToken;
}

/** status do MiseOn -> ação no iFood. null = nada a enviar. */
function acaoPara(status: string, tipoPedido: string): string | null {
  if (status === 'PREPARANDO') return 'startPreparation';
  if (status === 'PRONTO') return tipoPedido === 'DELIVERY' ? null : 'readyToPickup';
  if (status === 'EM_ROTA') return 'dispatch';
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const pollingToken = Deno.env.get('IFOOD_POLLING_TOKEN');
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (bearer !== serviceKey && !(pollingToken && bearer === pollingToken)) {
    return json({ error: 'Não autorizado' }, 401);
  }

  const clientId = Deno.env.get('IFOOD_CLIENT_ID');
  const clientSecret = Deno.env.get('IFOOD_CLIENT_SECRET');
  if (!clientId || !clientSecret) return json({ error: 'Credenciais iFood ausentes' }, 500);

  try {
    const { pedido_id } = await req.json();
    if (!pedido_id) return json({ error: 'pedido_id obrigatório' }, 400);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);
    const { data: pedido } = await supabase
      .from('pedidos')
      .select('id, status, tipo_pedido, ifood_order_id')
      .eq('id', pedido_id)
      .maybeSingle();

    if (!pedido?.ifood_order_id) return json({ ok: true, motivo: 'pedido não é do iFood' });

    const acao = acaoPara(pedido.status, pedido.tipo_pedido);
    if (!acao) return json({ ok: true, motivo: `status ${pedido.status} não tem callback` });

    const token = await getPlatformToken(clientId, clientSecret);
    const res = await fetch(`${IFOOD}/order/v1.0/orders/${pedido.ifood_order_id}/${acao}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      const erro = (await res.text()).slice(0, 300);
      console.error(`iFood recusou ${acao} para ${pedido.ifood_order_id}: ${res.status} ${erro}`);
      // Não derruba a operação da loja: o status no MiseOn já mudou e o balcão
      // segue trabalhando. Fica no log para diagnóstico.
      return json({ ok: false, acao, status: res.status, erro }, 200);
    }

    return json({ ok: true, acao, ifood_order_id: pedido.ifood_order_id });
  } catch (e) {
    console.error('Erro no ifood-status:', e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
