// MiseOn — Edge Function: lista a equipe (usuarios_loja + e-mail + dados cadastrais) da loja do chamador
// auth.users não é legível pelo client (nem com RLS) — por isso isso roda com service role.
// Mesmo check de permissão do equipe-convidar: só admin da própria loja.

import { createClient } from 'jsr:@supabase/supabase-js@2';

// CORS: sem isto o navegador bloqueia a chamada do painel antes de chegar na função.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-chat-session',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...cors, ...(init.headers ?? {}) },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { loja_id } = await req.json();
    if (!loja_id) return json({ error: 'loja_id obrigatório' }, { status: 400 });

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

    const { data: acesso } = await admin
      .from('usuarios_loja').select('papel').eq('user_id', caller.id).eq('loja_id', loja_id).maybeSingle();
    if (acesso?.papel !== 'admin') return json({ error: 'Só o admin da loja pode ver a equipe' }, { status: 403 });

    const { data: vinculos } = await admin
      .from('usuarios_loja')
      .select('user_id, papel, nome, telefone, tipo_contrato, criado_em')
      .eq('loja_id', loja_id)
      .order('criado_em', { ascending: true });

    // getUserById por membro (e não listUsers global): não quebra se alguma
    // conta antiga do projeto tiver campos inconsistentes no Auth.
    const contas = await Promise.all(
      (vinculos ?? []).map(async (v) => {
        const { data } = await admin.auth.admin.getUserById(v.user_id).catch(() => ({ data: null }));
        return [v.user_id, data?.user ?? null] as const;
      }),
    );
    const porId = new Map(contas);

    const equipe = (vinculos ?? []).map((v) => {
      const u = porId.get(v.user_id);
      return {
        user_id: v.user_id,
        papel: v.papel,
        nome: v.nome ?? (u?.user_metadata?.nome as string | undefined) ?? null,
        telefone: v.telefone ?? null,
        tipo_contrato: v.tipo_contrato ?? 'CLT',
        criado_em: v.criado_em ?? u?.created_at ?? null,
        email: u?.email ?? '(desconhecido)',
        ultimo_acesso: u?.last_sign_in_at ?? null,
        confirmado: !!u?.email_confirmed_at,
        sou_eu: v.user_id === caller.id,
      };
    });

    return json({ equipe });
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
});
