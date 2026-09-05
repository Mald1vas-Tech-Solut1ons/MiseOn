// MiseOn — Edge Function: gestão da equipe da loja
// Chamada autenticada a partir do painel admin (supabase.functions.invoke já manda o JWT do usuário).
// Só quem é 'admin' da loja pode gerenciar. Roda com service role pra:
//   1) criar o login (email + senha) direto no Supabase Auth — sem depender de SMTP
//   2) convidar por e-mail (opcional, exige SMTP configurado no projeto)
//   3) atualizar dados/papel/senha e remover membros
//   4) manter o vínculo em usuarios_loja (+ entregadores quando papel = entregador)
//   5) registrar tudo em auditoria

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

const PAPEIS = ['admin', 'operador', 'garcom', 'entregador'];
const CONTRATOS = ['CLT', 'FREELANCE', 'PJ', 'TEMPORARIO'];

function erro(msg: string, status = 400) {
  return json({ error: msg }, { status });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await req.json();
    const { loja_id } = body;
    if (!loja_id) return erro('loja_id obrigatório');

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: { user: caller } } = await supabaseAuth.auth.getUser();
    if (!caller) return erro('Não autenticado', 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: acesso } = await admin
      .from('usuarios_loja').select('papel').eq('user_id', caller.id).eq('loja_id', loja_id).maybeSingle();
    if (acesso?.papel !== 'admin') return erro('Só o admin da loja pode gerenciar a equipe', 403);

    const auditar = (acao: string, detalhes: Record<string, unknown>) =>
      admin.from('auditoria').insert({ loja_id, ator: caller.id, acao, detalhes });

    // vínculo operacional do app do entregador (tabela entregadores)
    const sincronizarEntregador = async (userId: string, papel: string, nome?: string, telefone?: string) => {
      if (papel !== 'entregador') return;
      const { data: existente } = await admin
        .from('entregadores').select('id').eq('loja_id', loja_id).eq('user_id', userId).maybeSingle();
      if (existente) {
        await admin.from('entregadores').update({ nome: nome || 'Entregador', telefone: telefone ?? null, ativo: true }).eq('id', existente.id);
      } else {
        await admin.from('entregadores').insert({ loja_id, user_id: userId, nome: nome || 'Entregador', telefone: telefone ?? null, ativo: true });
      }
    };

    // ── remover membro ──────────────────────────────────────
    if (body.remover_user_id) {
      if (body.remover_user_id === caller.id) return erro('Você não pode remover a si mesmo');
      await admin.from('usuarios_loja').delete().eq('user_id', body.remover_user_id).eq('loja_id', loja_id);
      await admin.from('entregadores').update({ ativo: false }).eq('loja_id', loja_id).eq('user_id', body.remover_user_id);
      await auditar('equipe_remocao', { remover_user_id: body.remover_user_id });
      return json({ ok: true });
    }

    // ── atualizar membro (dados, papel, senha) ──────────────
    if (body.acao === 'atualizar') {
      const { user_id, papel, nome, telefone, tipo_contrato, nova_senha } = body;
      if (!user_id) return erro('user_id obrigatório');
      if (papel && !PAPEIS.includes(papel)) return erro('papel inválido');
      if (tipo_contrato && !CONTRATOS.includes(tipo_contrato)) return erro('tipo de contrato inválido');

      const patch: Record<string, unknown> = {};
      if (papel) patch.papel = papel;
      if (nome !== undefined) patch.nome = nome;
      if (telefone !== undefined) patch.telefone = telefone;
      if (tipo_contrato) patch.tipo_contrato = tipo_contrato;
      if (Object.keys(patch).length > 0) {
        const { error: eUp } = await admin.from('usuarios_loja').update(patch).eq('user_id', user_id).eq('loja_id', loja_id);
        if (eUp) throw eUp;
      }

      if (nova_senha) {
        if (String(nova_senha).length < 6) return erro('A senha precisa ter no mínimo 6 caracteres');
        const { error: eSenha } = await admin.auth.admin.updateUserById(user_id, { password: String(nova_senha) });
        if (eSenha) return erro('Falha ao redefinir a senha: ' + eSenha.message);
      }

      if (papel) await sincronizarEntregador(user_id, papel, nome, telefone);
      await auditar('equipe_atualizacao', { user_id, papel, tipo_contrato, senha_redefinida: !!nova_senha });
      return json({ ok: true });
    }

    // ── criar login direto (email + senha) ──────────────────
    if (body.acao === 'criar') {
      const { email, senha, papel, nome, telefone, tipo_contrato } = body;
      if (!email || !senha || !papel) return erro('email, senha e papel são obrigatórios');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) return erro('E-mail inválido');
      if (String(senha).length < 6) return erro('A senha precisa ter no mínimo 6 caracteres');
      if (!PAPEIS.includes(papel)) return erro('papel inválido');
      if (tipo_contrato && !CONTRATOS.includes(tipo_contrato)) return erro('tipo de contrato inválido');

      // reaproveita a conta se o e-mail já existe no Auth
      const { data: existentes } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 }).catch(() => ({ data: null }));
      let userId = existentes?.users.find((u) => u.email?.toLowerCase() === String(email).toLowerCase())?.id;
      const contaExistia = !!userId;

      if (!userId) {
        const { data: criado, error: eCriar } = await admin.auth.admin.createUser({
          email: String(email),
          password: String(senha),
          email_confirm: true,
          user_metadata: { nome: nome ?? null, origem: 'equipe_miseon' },
        });
        if (eCriar || !criado?.user) {
          if (/already.*(registered|exists)/i.test(eCriar?.message ?? '')) {
            return erro('Este e-mail já tem uma conta. Peça para a pessoa usar a senha atual, ou redefina a senha depois de vincular.');
          }
          return erro('Falha ao criar o login: ' + (eCriar?.message ?? 'erro desconhecido'));
        }
        userId = criado.user.id;
      } else {
        // conta já existia: só redefine a senha se o admin pediu explicitamente
        if (body.forcar_senha) {
          const { error: eSenha } = await admin.auth.admin.updateUserById(userId, { password: String(senha) });
          if (eSenha) return erro('Conta já existia e não foi possível redefinir a senha: ' + eSenha.message);
        }
      }

      const { error: eVinculo } = await admin.from('usuarios_loja').upsert({
        user_id: userId,
        loja_id,
        papel,
        nome: nome ?? null,
        telefone: telefone ?? null,
        tipo_contrato: tipo_contrato ?? 'CLT',
      });
      if (eVinculo) throw eVinculo;

      await sincronizarEntregador(userId!, papel, nome, telefone);
      await auditar('equipe_criacao_login', { email, papel, tipo_contrato, conta_existia: contaExistia });
      return json({ ok: true, user_id: userId, conta_existia: contaExistia });
    }

    // ── convite por e-mail (compatibilidade; exige SMTP) ────
    const { email, papel, nome, telefone, tipo_contrato } = body;
    if (!email || !papel) return erro('email e papel são obrigatórios');
    if (!PAPEIS.includes(papel)) return erro('papel inválido');

    let userId: string | undefined;
    const { data: existentes } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    userId = existentes?.users.find((u) => u.email?.toLowerCase() === String(email).toLowerCase())?.id;

    if (!userId) {
      const { data: convite, error: eConvite } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${Deno.env.get('SITE_URL') ?? ''}/admin`,
      });
      if (eConvite || !convite?.user) {
        return erro('Não foi possível enviar o convite por e-mail (' + (eConvite?.message ?? 'erro desconhecido') + '). Use "Criar acesso com senha" — funciona sem e-mail.');
      }
      userId = convite.user.id;
    }

    const { error: eVinculo } = await admin.from('usuarios_loja').upsert({
      user_id: userId, loja_id, papel,
      nome: nome ?? null, telefone: telefone ?? null, tipo_contrato: tipo_contrato ?? 'CLT',
    });
    if (eVinculo) throw eVinculo;

    await sincronizarEntregador(userId, papel, nome, telefone);
    await auditar('equipe_convite', { email, papel });
    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
});
