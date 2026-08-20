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
//   CANCELADO   -> /cancellationReasons + /requestCancellation
//
// FINALIZADO não tem callback: CON vem DO iFood para nós, não o contrário.
//
// O cancelamento tem duas direções e só UMA delas passa por aqui:
//   - iFood cancela  -> evento CAN chega na ifood-webhook, que grava o status
//     com o prefixo "[iFood]" no motivo. Aqui isso é ignorado, senão a gente
//     devolveria ao iFood um cancelamento que partiu dele — eco.
//   - Lojista cancela no Painel de Pedidos -> cai aqui e vira requestCancellation.
//     O iFood exige escolher um motivo da lista dele, então buscamos
//     /cancellationReasons antes.
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

/**
 * O iFood não aceita cancelamento com texto livre: o motivo tem que ser um dos
 * códigos que ELE devolve para aquele pedido (varia com o estágio do pedido).
 */
async function motivosDeCancelamento(orderId: string, token: string) {
  const res = await fetch(`${IFOOD}/order/v1.0/orders/${orderId}/cancellationReasons`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  return (await res.json()) as { cancelCodeId: string; description: string }[];
}

async function cancelarNoIfood(orderId: string, token: string, motivoDaLoja: string | null) {
  const motivos = await motivosDeCancelamento(orderId, token);
  if (motivos.length === 0) {
    return { ok: false, erro: 'iFood não devolveu motivos de cancelamento para este pedido' };
  }

  // Tenta casar com o que o lojista escreveu; sem correspondência, usa o primeiro
  // que o iFood ofereceu — recusar o cancelamento seria pior para a loja.
  const alvo = (motivoDaLoja ?? '').toLowerCase();
  const escolhido =
    motivos.find((m) => alvo && m.description?.toLowerCase().includes(alvo)) ?? motivos[0];

  const res = await fetch(`${IFOOD}/order/v1.0/orders/${orderId}/requestCancellation`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cancellationCode: escolhido.cancelCodeId,
      reason: escolhido.description,
    }),
  });

  if (!res.ok) {
    return { ok: false, erro: (await res.text()).slice(0, 300), codigo: escolhido.cancelCodeId };
  }
  return { ok: true, codigo: escolhido.cancelCodeId, motivo: escolhido.description };
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
      .select('id, status, tipo_pedido, ifood_order_id, motivo_cancelamento')
      .eq('id', pedido_id)
      .maybeSingle();

    if (!pedido?.ifood_order_id) return json({ ok: true, motivo: 'pedido não é do iFood' });

    // ── Cancelamento pedido PELA LOJA ────────────────────────────────────────
    if (pedido.status === 'CANCELADO') {
      // Cancelamento que veio DO iFood já está cancelado lá; devolver seria eco.
      if ((pedido.motivo_cancelamento ?? '').startsWith('[iFood]')) {
        return json({ ok: true, motivo: 'cancelamento originado no iFood, nada a devolver' });
      }

      const token = await getPlatformToken(clientId, clientSecret);
      const r = await cancelarNoIfood(
        pedido.ifood_order_id,
        token,
        pedido.motivo_cancelamento ?? null,
      );

      if (!r.ok) {
        console.error(`iFood recusou cancelamento de ${pedido.ifood_order_id}: ${r.erro}`);
        // Mesma regra dos outros callbacks: o status no MiseOn já mudou e a loja
        // segue trabalhando. Fica no log em vez de derrubar a operação.
        return json({ ok: false, acao: 'requestCancellation', erro: r.erro }, 200);
      }
      return json({ ok: true, acao: 'requestCancellation', ...r });
    }

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
