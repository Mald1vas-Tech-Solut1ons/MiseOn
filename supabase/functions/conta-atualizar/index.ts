// MiseOn — Edge Function: atualização segura de conta (E-mail OTP & Alteração de Senha)
// Funciona 100% out-of-the-box armazenando estado temporário em user_metadata (sem depender de tabelas SQL adicionais).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.14';
import { checkRateLimit, ipDaRequisicao } from '../_shared/rate-limit.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-chat-session',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Aceita `json(x, 429)` E `json(x, { status: 429 })`.
 *
 *  Nao e conveniencia: e trava contra um erro que ja aconteceu aqui. Este
 *  helper recebia so `ResponseInit`, e uma chamada passou `429` cru. Espalhar
 *  um numero produz objeto vazio, entao a resposta saiu com o padrao 200 — o
 *  rate limit BARRAVA a requisicao e devolvia "sucesso". Medido em 01/09/2026:
 *  30 chamadas em 2s contra um teto de 20/min deram 11 respostas 200 no lugar
 *  de 429, e nenhum erro em lugar nenhum denunciava isso.
 *
 *  Outras funcoes do projeto usam `json(x, status)` com numero; misturar as
 *  duas convencoes sem que uma delas falhe alto e pedir para repetir. */
const json = (data: unknown, init: ResponseInit | number = {}) => {
  const opcoes: ResponseInit = typeof init === 'number' ? { status: init } : init;
  return new Response(JSON.stringify(data), {
    ...opcoes,
    headers: { 'Content-Type': 'application/json', ...cors, ...(opcoes.headers ?? {}) },
  });
};

/** Erro de NEGOCIO (dado invalido, senha errada, e-mail ja usado).
 *  Fica em 200 de proposito: a requisicao foi entendida e respondida, e a tela
 *  mostra a mensagem. */
function erro(msg: string) {
  return json({ error: msg }, { status: 200 });
}

/** Erro de AUTENTICACAO. Responde 401.
 *
 *  Antes tambem saia como 200. Isso significava que requisicao sem token, ou
 *  com sessao expirada, entrava no log de Edge Functions como sucesso — nao
 *  havia como distinguir uso normal de alguem batendo no endpoint, nem alarme
 *  possivel em cima disso.
 *
 *  A mensagem continua chegando na tela: o front le o corpo tambem em resposta
 *  nao-2xx (src/lib/edgeFunctionErro.ts). */
function naoAutenticado(msg: string) {
  return json({ error: msg }, { status: 401 });
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const SMTP_HOST = Deno.env.get('SMTP_HOST') ?? 'smtppro.zoho.com';
const SMTP_PORT = Number(Deno.env.get('SMTP_PORT') ?? '465');
const SMTP_USER = Deno.env.get('SMTP_USER') || '';
const SMTP_PASS = Deno.env.get('SMTP_PASS') || '';
const REMETENTE_EMAIL = Deno.env.get('EMAIL_FROM') ?? SMTP_USER;
const REMETENTE_NOME = Deno.env.get('EMAIL_FROM_NAME') ?? 'MiseOn';

function transportador() {
  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error('Credenciais de e-mail (SMTP_USER / SMTP_PASS) não configuradas no servidor.');
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  // Freio de vazao. A funcao ja exige autorizacao propria; o limite existe
  // para que tentativa em massa contra ela — inclusive contra o OTP de e-mail,
  // que e um codigo curto e adivinhavel por forca bruta — nao fique de graca.
  // Em falha de banco o limitador DEIXA PASSAR (ver _shared/rate-limit.ts),
  // entao ele nao vira um novo ponto unico de queda.
  //
  // 20/min por IP: e uma tela de conta, mexida de vez em quando por pessoa.
  const rl = await checkRateLimit(`conta-atualizar:${ipDaRequisicao(req)}`, {
    windowMs: 60_000,
    maxRequests: 20,
  });
  if (!rl.allowed) return json({ error: 'Muitas requisicoes. Tente em instantes.' }, { status: 429 });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return naoAutenticado('Não autenticado.');

    // Cliente com JWT do usuário chamador
    const supabaseAuth = createClient(
      SUPABASE_URL,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: caller } } = await supabaseAuth.auth.getUser();
    if (!caller) return naoAutenticado('Sessão expirada. Faça login novamente.');

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const { acao } = body;

    // ── 1. SOLICITAR TROCA DE E-MAIL ────────────────────────────
    if (acao === 'solicitar_troca_email') {
      const { novo_email } = body;
      if (!novo_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(novo_email))) {
        return erro('Informe um e-mail válido.');
      }
      const targetEmail = String(novo_email).trim().toLowerCase();

      if (targetEmail === caller.email?.toLowerCase()) {
        return erro('O novo e-mail é idêntico ao e-mail atual.');
      }

      // Verifica se o e-mail já pertence a outro usuário
      const { data: authUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 }).catch(() => ({ data: null }));
      const jaExiste = authUsers?.users.some((u) => u.email?.toLowerCase() === targetEmail && u.id !== caller.id);
      if (jaExiste) {
        return erro('Este e-mail já está cadastrado em outra conta.');
      }

      // Gera OTP de 6 dígitos numéricos
      const codigo = Math.floor(100000 + Math.random() * 900000).toString();
      const expiraEm = Date.now() + 10 * 60 * 1000; // 10 minutos em timestamp ms

      // Grava no user_metadata do usuário chamador (sem precisar de tabelas adicionais no SQL)
      const currentMeta = caller.user_metadata || {};
      const { error: errMeta } = await admin.auth.admin.updateUserById(caller.id, {
        user_metadata: {
          ...currentMeta,
          otp_troca_email: {
            novo_email: targetEmail,
            codigo,
            expira_em: expiraEm,
            tentativas: 0,
          },
        },
      });

      if (errMeta) {
        console.error('Erro ao gravar OTP nos metadados:', errMeta);
        return erro('Erro ao registrar código de segurança: ' + errMeta.message);
      }

      // Envia o e-mail com o código de 6 dígitos via SMTP
      try {
        const smtp = transportador();
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h2 style="color: #FC5B24; margin: 0; font-size: 24px; font-weight: 800;">MiseOn</h2>
              <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Segurança da Conta</p>
            </div>
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
              <p style="color: #374151; font-size: 14px; margin-top: 0; margin-bottom: 12px;">Seu código de verificação para alterar o e-mail para <strong>${targetEmail}</strong> é:</p>
              <div style="font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #111827; background: #ffffff; display: inline-block; padding: 12px 24px; border-radius: 8px; border: 2px dashed #FC5B24;">
                ${codigo}
              </div>
              <p style="color: #9ca3af; font-size: 12px; margin-top: 12px; margin-bottom: 0;">Válido por 10 minutos.</p>
            </div>
            <p style="color: #6b7280; font-size: 12px; line-height: 1.5; margin: 0;">Se você não solicitou esta alteração, ignore este e-mail. Sua conta continua segura.</p>
          </div>
        `;

        await smtp.sendMail({
          from: `"${REMETENTE_NOME}" <${REMETENTE_EMAIL}>`,
          to: targetEmail,
          subject: `${codigo} é o seu código de verificação MiseOn`,
          html,
          text: `Seu código de verificação MiseOn é: ${codigo}. Válido por 10 minutos.`,
        });
      } catch (errSmtp) {
        console.error('Erro ao enviar e-mail OTP:', errSmtp);
        return erro('Falha ao enviar e-mail: ' + (errSmtp as Error)?.message);
      }

      return json({ ok: true, expira_em: new Date(expiraEm).toISOString() });
    }

    // ── 2. CONFIRMAR CÓDIGO E ALTERAR E-MAIL ────────────────────
    if (acao === 'confirmar_email') {
      const { codigo, novo_email } = body;
      if (!codigo || String(codigo).trim().length !== 6) return erro('Informe o código de 6 dígitos.');
      if (!novo_email) return erro('Novo e-mail não especificado.');

      const targetEmail = String(novo_email).trim().toLowerCase();
      const otpInfo = caller.user_metadata?.otp_troca_email;

      if (!otpInfo || otpInfo.novo_email !== targetEmail) {
        return erro('Nenhuma solicitação de troca pendente para este e-mail. Solicite um novo código.');
      }

      if (Date.now() > otpInfo.expira_em) {
        return erro('O código expirou (válido por 10 min). Solicite um novo código.');
      }

      if (otpInfo.tentativas >= 5) {
        return erro('Número máximo de tentativas excedido. Solicite um novo código.');
      }

      if (otpInfo.codigo !== String(codigo).trim()) {
        const novasTentativas = (otpInfo.tentativas || 0) + 1;
        await admin.auth.admin.updateUserById(caller.id, {
          user_metadata: {
            ...caller.user_metadata,
            otp_troca_email: { ...otpInfo, tentativas: novasTentativas },
          },
        });
        const restantes = 5 - novasTentativas;
        return erro(`Código incorreto. ${restantes > 0 ? `Você tem mais ${restantes} tentativa(s).` : 'Código bloqueado.'}`);
      }

      // Código verificado com sucesso! Atualiza o e-mail e limpa a pendência no user_metadata
      const currentMeta = { ...(caller.user_metadata || {}) };
      delete currentMeta.otp_troca_email;

      const { error: errUpdate } = await admin.auth.admin.updateUserById(caller.id, {
        email: targetEmail,
        email_confirm: true,
        user_metadata: currentMeta,
      });

      if (errUpdate) {
        console.error('Erro no admin.auth.admin.updateUserById:', errUpdate);
        return erro('Erro ao atualizar e-mail: ' + errUpdate.message);
      }

      return json({ ok: true });
    }

    // ── 3. ALTERAR SENHA COM VALIDAÇÃO DA SENHA ATUAL ───────────
    if (acao === 'alterar_senha') {
      const { senha_atual, nova_senha } = body;
      if (!senha_atual) return erro('Informe sua senha atual por segurança.');
      if (!nova_senha || String(nova_senha).length < 6) {
        return erro('A nova senha precisa ter no mínimo 6 caracteres.');
      }

      // Valida a senha atual tentando autenticar
      const { error: errAuth } = await supabaseAuth.auth.signInWithPassword({
        email: caller.email!,
        password: String(senha_atual),
      });

      if (errAuth) {
        return erro('A senha atual informada está incorreta.');
      }

      // Atualiza para a nova senha via admin
      const { error: errUpdate } = await admin.auth.admin.updateUserById(caller.id, {
        password: String(nova_senha),
      });

      if (errUpdate) {
        return erro('Falha ao atualizar senha: ' + errUpdate.message);
      }

      return json({ ok: true });
    }

    return erro('Ação desconhecida.');
  } catch (e) {
    console.error('Erro na função conta-atualizar:', e);
    return json({ error: String((e as Error)?.message ?? e) });
  }
});
