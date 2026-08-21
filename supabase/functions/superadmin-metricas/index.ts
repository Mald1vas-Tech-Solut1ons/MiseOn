// MiseOn — Edge Function: métricas cross-tenant pro painel SuperAdmin
// Roda com service role de propósito: assim o RLS de `pedidos` de cada loja
// nunca precisa ser afrouxado pro client do superadmin (menor raio de exposição).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-chat-session',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: { user: caller } } = await supabaseAuth.auth.getUser();
    if (!caller) return json({ error: 'Não autenticado' }, { status: 401 });

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: souSuperadmin } = await admin.from('plataforma_admins').select('user_id').eq('user_id', caller.id).maybeSingle();
    if (!souSuperadmin) return json({ error: 'Só o superadmin pode ver métricas' }, { status: 403 });

    const desde30d = new Date(Date.now() - 30 * 24 * 3600e3).toISOString();
    const { data: pedidos } = await admin
      .from('pedidos')
      .select('loja_id, valor_total, criado_em')
      .neq('status', 'CANCELADO')
      .gte('criado_em', desde30d);

    const porLoja = new Map<string, { pedidos_30d: number; gmv_30d: number; ultimo_pedido: string | null }>();
    for (const p of pedidos ?? []) {
      const cur = porLoja.get(p.loja_id) ?? { pedidos_30d: 0, gmv_30d: 0, ultimo_pedido: null };
      cur.pedidos_30d += 1;
      cur.gmv_30d += Number(p.valor_total);
      if (!cur.ultimo_pedido || p.criado_em > cur.ultimo_pedido) cur.ultimo_pedido = p.criado_em;
      porLoja.set(p.loja_id, cur);
    }

    const metricas = Array.from(porLoja.entries()).map(([loja_id, m]) => ({ loja_id, ...m }));
    return json({ metricas });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, { status: 500 });
  }
});
