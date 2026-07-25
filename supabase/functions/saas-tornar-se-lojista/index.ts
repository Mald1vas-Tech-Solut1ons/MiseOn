// MiseOn — Edge Function: onboarding self-service ("Torne-se um lojista")
//
// Diferença para superadmin-criar-loja: aqui quem chama já está autenticado
// (Google ou e-mail, login que já existe no produto) e está criando a PRÓPRIA
// loja — sem gate de superadmin, sem convite, sem senha nova. Também grava os
// dados fiscais + perfil de negócio que a NFS-e da assinatura vai usar depois.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...cors, ...(init.headers ?? {}) },
  });

function gerarSlug(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const TRIAL_DIAS = 30;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const body = await req.json();
    const {
      nome_loja, tipo_pessoa, cpf_cnpj, razao_social_ou_nome,
      logradouro, numero, complemento, bairro, cidade, uf, cep,
      email_cobranca, segmento_negocio, qtd_funcionarios,
      atende_salao_garcom, faz_entregas, modelo_entrega,
    } = body;

    if (!nome_loja?.trim()) return json({ error: 'Informe o nome da loja.' }, { status: 400 });
    if (!['PF', 'PJ'].includes(tipo_pessoa)) return json({ error: 'tipo_pessoa inválido.' }, { status: 400 });
    if (!cpf_cnpj?.trim()) return json({ error: 'Informe o CPF/CNPJ.' }, { status: 400 });
    if (!razao_social_ou_nome?.trim()) return json({ error: 'Informe a razão social/nome.' }, { status: 400 });
    if (!email_cobranca?.trim()) return json({ error: 'Informe o e-mail de cobrança.' }, { status: 400 });
    if (!segmento_negocio) return json({ error: 'Informe o segmento do negócio.' }, { status: 400 });

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: { user }, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !user) return json({ error: 'Não autenticado.' }, { status: 401 });

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Se esse usuário já tem loja, não deixa criar outra por engano.
    const { data: vinculoExistente } = await admin
      .from('usuarios_loja').select('loja_id').eq('user_id', user.id).maybeSingle();
    if (vinculoExistente) return json({ error: 'Esta conta já está vinculada a uma loja.' }, { status: 409 });

    const base = gerarSlug(nome_loja) || 'loja';
    let slug = base;
    for (let tentativa = 0; tentativa < 20; tentativa++) {
      const { data: existente } = await admin.from('lojas').select('id').eq('slug', slug).maybeSingle();
      if (!existente) break;
      slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }

    const trialTerminaEm = new Date(Date.now() + TRIAL_DIAS * 24 * 60 * 60 * 1000);

    const { data: loja, error: eLoja } = await admin.from('lojas')
      .insert({
        slug, nome: nome_loja.trim(),
        status_assinatura: 'trial', plano: 'trial',
        trial_termina_em: trialTerminaEm.toISOString(),
      })
      .select('id, slug, nome').single();
    if (eLoja || !loja) throw eLoja ?? new Error('Falha ao criar a loja.');

    const { error: eVinculo } = await admin.from('usuarios_loja')
      .insert({ user_id: user.id, loja_id: loja.id, papel: 'admin' });
    if (eVinculo) throw eVinculo;

    const { error: eCadastro } = await admin.from('assinatura_dados_cadastro').insert({
      loja_id: loja.id,
      tipo_pessoa,
      cpf_cnpj: String(cpf_cnpj).replace(/\D/g, ''),
      razao_social_ou_nome: razao_social_ou_nome.trim(),
      logradouro, numero, complemento, bairro, cidade,
      uf: uf ? String(uf).toUpperCase() : null,
      cep: cep ? String(cep).replace(/\D/g, '') : null,
      email_cobranca: email_cobranca.trim().toLowerCase(),
      segmento_negocio,
      qtd_funcionarios: qtd_funcionarios ?? null,
      atende_salao_garcom: !!atende_salao_garcom,
      faz_entregas: !!faz_entregas,
      modelo_entrega: faz_entregas ? (modelo_entrega ?? null) : null,
      aceite_trial_em: new Date().toISOString(),
    });
    if (eCadastro) throw eCadastro;

    await admin.rpc('fn_email_enfileirar', {
      p_loja: loja.id,
      p_evento: 'boas-vindas-loja',
      p_destinatario: user.email ?? email_cobranca,
      p_payload: { trial_dias: TRIAL_DIAS },
      p_referencia_id: null,
      p_classe: 'TRANSACIONAL',
    });

    return json({ ok: true, loja_id: loja.id, slug: loja.slug });
  } catch (e) {
    console.error('Falha ao tornar-se lojista:', e);
    return json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
});
