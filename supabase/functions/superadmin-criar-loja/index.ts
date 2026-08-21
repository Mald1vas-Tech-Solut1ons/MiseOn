// MiseOn — Edge Function: onboarding self-service de uma nova loja (SuperAdmin)
// Só quem está em `plataforma_admins` pode chamar. Cria a loja, convida o dono
// (Admin API) e vincula em usuarios_loja(papel='admin'). Registra em auditoria.

import { createClient } from 'jsr:@supabase/supabase-js@2';

// Chamada pelo painel do superadmin, ou seja: pelo navegador. Sem preflight
// respondido aqui, o POST nem chega a sair — o navegador barra antes.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-chat-session',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { slug, nome, whatsapp, email_dono } = await req.json();
    if (!slug || !nome || !whatsapp || !email_dono) {
      return Response.json({ error: 'slug, nome, whatsapp e email_dono são obrigatórios' }, { status: 400, headers: corsHeaders });
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: { user: caller } } = await supabaseAuth.auth.getUser();
    if (!caller) return Response.json({ error: 'Não autenticado' }, { status: 401, headers: corsHeaders });

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: souSuperadmin } = await admin.from('plataforma_admins').select('user_id').eq('user_id', caller.id).maybeSingle();
    if (!souSuperadmin) return Response.json({ error: 'Só o superadmin pode criar lojas' }, { status: 403, headers: corsHeaders });

    const slugLimpo = String(slug).toLowerCase().trim().replace(/[^a-z0-9-]/g, '-');
    const { data: existente } = await admin.from('lojas').select('id').eq('slug', slugLimpo).maybeSingle();
    if (existente) return Response.json({ error: `Slug "${slugLimpo}" já está em uso` }, { status: 409, headers: corsHeaders });

    const { data: loja, error: eLoja } = await admin.from('lojas')
      .insert({ slug: slugLimpo, nome, whatsapp })
      .select('id, slug').single();
    if (eLoja || !loja) throw eLoja ?? new Error('Falha ao criar loja');

    let userId: string | undefined;
    const { data: existentes } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = existentes?.users.find((u) => u.email?.toLowerCase() === String(email_dono).toLowerCase())?.id;
    if (!userId) {
      const { data: convite, error: eConvite } = await admin.auth.admin.inviteUserByEmail(email_dono, {
        redirectTo: `${Deno.env.get('SITE_URL') ?? ''}/admin`,
      });
      if (eConvite || !convite?.user) throw eConvite ?? new Error('Falha ao convidar o dono da loja');
      userId = convite.user.id;
    }

    await admin.from('usuarios_loja').upsert({ user_id: userId, loja_id: loja.id, papel: 'admin' });
    await admin.from('auditoria').insert({
      loja_id: loja.id, ator: caller.id, acao: 'onboarding_loja', detalhes: { slug: loja.slug, email_dono },
    });

    return Response.json({ ok: true, loja_id: loja.id, slug: loja.slug }, { headers: corsHeaders });
  } catch (e) {
    console.error(e);
    return Response.json({ error: String(e) }, { status: 500, headers: corsHeaders });
  }
});
