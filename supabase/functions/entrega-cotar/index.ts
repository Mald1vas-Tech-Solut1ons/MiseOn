// MiseOn — Edge Function: entrega-cotar
//
//   { acao: 'cotar', loja_id, endereco, subtotal }  → cotação gravada + regra
//   { acao: 'localizar', texto }                    → coordenada do endereço da loja
//
// A cotação é o que o pedido de entrega exige (fn_criar_pedido_completo): a
// distância é medida AQUI, pela rua, e não vem mais do navegador. Ver
// _shared/entrega.ts.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { checkRateLimit, ipDaRequisicao } from '../_shared/rate-limit.ts';
import { cotarEntrega, localizarTexto, type EnderecoEntrega } from '../_shared/entrega.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-chat-session',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return json({ error: 'Corpo inválido.' }, 400);
  }

  const acao = String(corpo.acao ?? 'cotar');
  const ip = ipDaRequisicao(req);
  // Provedores abertos de mapa pedem uso moderado; o cache cobre o repetido.
  const rl = await checkRateLimit(`entrega-${acao}:${ip}`, { windowMs: 60_000, maxRequests: acao === 'localizar' ? 10 : 40 });
  if (!rl.allowed) return json({ error: 'Muitas consultas seguidas. Aguarde um instante.' }, 429);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    if (acao === 'localizar') {
      const achado = await localizarTexto(String(corpo.texto ?? ''));
      if (!achado) return json({ error: 'Não encontramos esse endereço. Confira rua, número, cidade e UF.' }, 404);
      return json({ lat: achado.geo.lat, lng: achado.geo.lng, precisao: achado.precisao });
    }

    if (acao !== 'cotar') return json({ error: 'Ação desconhecida.' }, 400);

    const lojaId = String(corpo.loja_id ?? '');
    if (!UUID.test(lojaId)) return json({ error: 'Loja inválida.' }, 400);
    const endereco = (corpo.endereco ?? {}) as EnderecoEntrega;
    const subtotal = Math.max(0, Number(corpo.subtotal ?? 0) || 0);

    return json(await cotarEntrega(db, lojaId, endereco, subtotal));
  } catch (e) {
    console.error('entrega-cotar:', (e as Error).message);
    return json({ error: 'Não foi possível calcular a entrega agora. Tente de novo em instantes.' }, 500);
  }
});
