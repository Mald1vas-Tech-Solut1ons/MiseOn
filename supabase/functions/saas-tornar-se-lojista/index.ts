// MiseOn — Edge Function: onboarding self-service ("Torne-se um lojista")
//
// Diferença para superadmin-criar-loja: aqui quem chama já está autenticado
// (Google ou e-mail, login que já existe no produto) e está criando a PRÓPRIA
// loja — sem gate de superadmin, sem convite, sem senha nova. Também grava os
// dados fiscais + perfil de negócio que a NFS-e da assinatura vai usar depois.

import { createClient } from 'jsr:@supabase/supabase-js@2';

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
    if (!segmento_negocio) return json({ error: 'Informe o segmento do negócio.' }, { status: 400 });

    // DADO FISCAL NÃO É MAIS PORTA DE ENTRADA (22/09/2026).
    // Pedir CNPJ, razão social e endereço antes de a pessoa ver o sistema foi
    // o muro onde uma lead real parou. No teste grátis não há nota a emitir;
    // a tela de Assinatura exige o cadastro fiscal antes de cobrar. Se vier
    // (tela antiga em cache), continua valendo — e aí vem inteiro.
    const temFiscal = !!String(cpf_cnpj ?? '').trim();
    if (temFiscal) {
      if (!['PF', 'PJ'].includes(tipo_pessoa)) return json({ error: 'tipo_pessoa inválido.' }, { status: 400 });
      if (!razao_social_ou_nome?.trim()) return json({ error: 'Informe a razão social/nome.' }, { status: 400 });
    }

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
    if (eVinculo) {
      // Sem o vínculo a loja fica sem dono e a pessoa volta para a tela de
      // cadastro; na segunda tentativa nasceria outra loja. Desfaz.
      await admin.from('lojas').delete().eq('id', loja.id);
      throw eVinculo;
    }

    // Achado do teste de usabilidade simulada (23/09/2026, A1): marcar "Salão
    // com garçom" só gravava o metadado pra nota fiscal — nenhuma mesa nascia,
    // ninguém era convidado, e quem prometeu ao cliente que "já configurou" a
    // conta desmentia a própria fala na primeira tela. A loja não fica pronta
    // sozinha, mas passa a nascer com a Mesa 1 — não zero.
    let mesaCriada = false;
    if (atende_salao_garcom) {
      const { error: eMesa } = await admin.from('mesas')
        .insert({ loja_id: loja.id, numero: 1, nome: 'Mesa 1', capacidade: 4 });
      if (eMesa) console.error('Mesa inicial não criada:', eMesa);
      else mesaCriada = true;
    }

    const { error: eCadastro } = await admin.from('assinatura_dados_cadastro').insert({
      loja_id: loja.id,
      tipo_pessoa: temFiscal ? tipo_pessoa : null,
      cpf_cnpj: temFiscal ? String(cpf_cnpj).replace(/\D/g, '') : null,
      razao_social_ou_nome: temFiscal ? razao_social_ou_nome.trim() : null,
      logradouro, numero, complemento, bairro, cidade,
      uf: uf ? String(uf).toUpperCase() : null,
      cep: cep ? String(cep).replace(/\D/g, '') : null,
      email_cobranca: String(email_cobranca || user.email || '').trim().toLowerCase(),
      segmento_negocio,
      qtd_funcionarios: qtd_funcionarios ?? null,
      atende_salao_garcom: !!atende_salao_garcom,
      faz_entregas: !!faz_entregas,
      modelo_entrega: faz_entregas ? (modelo_entrega ?? null) : null,
      aceite_trial_em: new Date().toISOString(),
    });
    // A loja já existe e já é dela: falhar aqui faria a pessoa tentar de novo
    // e bater no "já vinculada". Fica no log; a Assinatura pede depois.
    if (eCadastro) console.error('Cadastro da assinatura não gravou:', eCadastro);

    await admin.rpc('fn_email_enfileirar', {
      p_loja: loja.id,
      p_evento: 'boas-vindas-loja',
      p_destinatario: user.email ?? email_cobranca,
      p_payload: { trial_dias: TRIAL_DIAS },
      p_referencia_id: null,
      p_classe: 'TRANSACIONAL',
    });

    return json({ ok: true, loja_id: loja.id, slug: loja.slug, mesa_criada: mesaCriada });
  } catch (e) {
    console.error('Falha ao tornar-se lojista:', e);
    return json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
});
