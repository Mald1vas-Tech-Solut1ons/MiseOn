// MiseOn — Edge Function: retomada de cadastro.
//
// Quem entra (Google ou e-mail) e não cria a loja some sem deixar rastro.
// Em 22/09/2026 foi assim com uma lead real vinda de grupo de delivery. Esta
// função manda no MÁXIMO dois lembretes (≈1h e ≈24h depois), com link para
// continuar e para parar de receber. Quem decide QUEM recebe é o banco
// (fn_onboarding_candidatos_retomada), atrás do interruptor
// plataforma_flags.onboarding_retomada.
//
// Ações:
//   POST { acao: 'processar' } + x-worker-token → envia o lote (pg_cron)
//   POST { acao: 'previa', envio: 1|2 } + JWT de superadmin → manda um exemplo
//        para o e-mail de quem pediu, para conferir o texto antes de ligar
//   GET  ?parar=<token>                        → descadastro, página simples

import { createClient } from 'jsr:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.14';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SMTP_HOST = Deno.env.get('SMTP_HOST') ?? 'smtppro.zoho.com';
const SMTP_PORT = Number(Deno.env.get('SMTP_PORT') ?? '465');
const SMTP_USER = Deno.env.get('SMTP_USER')!;
const SMTP_PASS = Deno.env.get('SMTP_PASS')!;
const REMETENTE_EMAIL = Deno.env.get('EMAIL_FROM') ?? SMTP_USER;
const SITE = (Deno.env.get('SITE_URL') ?? 'https://miseon.vercel.app').replace(/\/+$/, '');
const EMAIL_WORKER_TOKEN_DB = Deno.env.get('EMAIL_WORKER_TOKEN_DB');
const WHATSAPP = '5511919889233';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-worker-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors } });

function tokenConfere(recebido: string | null, esperado: string) {
  if (!recebido) return false;
  const a = new TextEncoder().encode(recebido);
  const b = new TextEncoder().encode(esperado);
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

const escapar = (s: string) => s.replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/**
 * O texto. Nada de número que não foi medido e nada de urgência inventada:
 * o que muda de um envio para o outro é o tom — o primeiro lembra, o
 * segundo oferece ajuda de gente.
 */
export function montar(envio: number, nome: string, token: string) {
  const ola = nome ? `Olá, ${escapar(nome)}!` : 'Olá!';
  const continuar = `${SITE}/admin`;
  const parar = `${SUPABASE_URL}/functions/v1/onboarding-retomada?parar=${token}`;
  const zap = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Oi, Rafael! Comecei o cadastro no MiseOn e queria ajuda para terminar.')}`;

  const assunto = envio === 1
    ? 'Sua loja no MiseOn ficou pela metade'
    : 'Quer ajuda para configurar sua loja no MiseOn?';

  const corpo = envio === 1
    ? [
      'Você entrou no MiseOn, mas a sua loja ainda não foi criada.',
      'Agora são só dois campos — o nome da loja e o tipo de negócio — e você já entra no sistema. São 30 dias grátis, sem cartão.',
    ]
    : [
      'Vi que você começou o cadastro no MiseOn e não chegou a abrir a loja.',
      'Se alguma coisa travou ou ficou confusa, me chama no WhatsApp que eu configuro com você — cardápio, produtos e o primeiro pedido de teste.',
    ];

  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#EAF1FB;font-family:Manrope,Segoe UI,Arial,sans-serif;color:#070C18">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#004198;padding:20px 28px;color:#ffffff;font-family:Sora,Segoe UI,Arial,sans-serif;font-size:20px;font-weight:800">MiseOn</td></tr>
<tr><td style="padding:28px">
<p style="margin:0 0 16px;font-size:18px;font-weight:700">${ola}</p>
${corpo.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6">${p}</p>`).join('\n')}
<p style="margin:24px 0"><a href="${envio === 1 ? continuar : zap}" style="display:inline-block;background:#FC5B24;color:#ffffff;text-decoration:none;font-weight:800;padding:14px 24px;border-radius:12px;font-size:15px">${envio === 1 ? 'Continuar de onde parei' : 'Falar com o Rafael no WhatsApp'}</a></p>
<p style="margin:0 0 6px;font-size:14px;line-height:1.6">${envio === 1
    ? `Travou em alguma coisa? <a href="${zap}" style="color:#0A5CC4">Me chama no WhatsApp</a> ou responda este e-mail.`
    : `Se preferir fazer sozinho, é só <a href="${continuar}" style="color:#0A5CC4">continuar de onde parou</a>.`}</p>
<p style="margin:18px 0 0;font-size:14px">Rafael<br><span style="color:#5b6475">MiseOn</span></p>
</td></tr>
<tr><td style="padding:16px 28px;background:#f5f7fb;font-size:12px;color:#5b6475;line-height:1.5">
Você recebeu este e-mail porque criou uma conta no MiseOn. São no máximo dois lembretes.
<a href="${parar}" style="color:#5b6475">Não quero mais receber</a>.
</td></tr></table></td></tr></table></body></html>`;

  const texto = [ola, '', ...corpo, '',
    envio === 1 ? `Continuar: ${continuar}` : `WhatsApp: ${zap}`,
    '', 'Rafael — MiseOn', '', `Não quero mais receber: ${parar}`].join('\n');

  return { assunto, html, texto, parar };
}

function transportador() {
  if (!SMTP_USER || !SMTP_PASS) throw new Error('SMTP_USER/SMTP_PASS ausentes.');
  return nodemailer.createTransport({
    host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

async function enviar(smtp: ReturnType<typeof transportador>, para: string, envio: number, nome: string, token: string) {
  const { assunto, html, texto, parar } = montar(envio, nome, token);
  await smtp.sendMail({
    from: `"Rafael · MiseOn" <${REMETENTE_EMAIL}>`,
    to: para,
    subject: assunto,
    html,
    text: texto,
    list: { unsubscribe: { url: parar, comment: 'Parar lembretes de cadastro' } },
  });
}

const pagina = (titulo: string, msg: string) => new Response(
  `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#EAF1FB;font-family:Segoe UI,Arial,sans-serif;color:#070C18">
<div style="max-width:420px;background:#fff;border-radius:16px;padding:32px;text-align:center"><h1 style="font-size:20px;margin:0 0 12px">${titulo}</h1><p style="margin:0;line-height:1.6">${msg}</p></div></body></html>`,
  { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    if (req.method === 'GET') {
      const token = new URL(req.url).searchParams.get('parar') ?? '';
      if (!/^[0-9a-f-]{36}$/i.test(token)) return pagina('Link inválido', 'Este link não é válido.');
      const { data } = await db.rpc('fn_onboarding_parar_retomada', { p_token: token });
      return data
        ? pagina('Pronto', 'Você não vai mais receber lembretes de cadastro do MiseOn.')
        : pagina('Link inválido', 'Não encontramos este cadastro. Se continuar recebendo, responda o e-mail.');
    }

    const body = await req.json().catch(() => ({}));

    if (body.acao === 'previa') {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user?.email) return json({ error: 'Não autenticado' }, 401);
      const { data: ehSuper } = await userClient.rpc('fn_sou_superadmin');
      if (!ehSuper) return json({ error: 'Acesso restrito' }, 403);
      const envio = body.envio === 2 ? 2 : 1;
      await enviar(transportador(), user.email, envio, 'Vitória', '00000000-0000-0000-0000-000000000000');
      return json({ ok: true, enviado_para: user.email, envio });
    }

    if (body.acao !== 'processar') return json({ error: 'Ação desconhecida' }, 400);
    if (!EMAIL_WORKER_TOKEN_DB || !tokenConfere(req.headers.get('x-worker-token'), EMAIL_WORKER_TOKEN_DB)) {
      return json({ error: 'Não autorizado' }, 401);
    }

    const { data: candidatos, error } = await db.rpc('fn_onboarding_candidatos_retomada', { p_limite: 20 });
    if (error) throw error;
    if (!candidatos?.length) return json({ ok: true, enviados: 0 });

    const smtp = transportador();
    let enviados = 0;
    for (const c of candidatos as Array<{ user_id: string; email: string; nome: string; envio: number; token: string }>) {
      try {
        await enviar(smtp, c.email, c.envio, c.nome ?? '', c.token);
        // Marca DEPOIS de enviar: falha de SMTP tenta de novo no próximo ciclo.
        const { error: eMarca } = await db.rpc('fn_onboarding_marcar_retomada', { p_user_id: c.user_id });
        if (eMarca) console.error('Enviado mas não marcado (pode repetir):', c.user_id, eMarca);
        enviados++;
      } catch (e) {
        console.error('Falha ao enviar retomada para', c.user_id, e);
      }
    }
    return json({ ok: true, enviados, candidatos: candidatos.length });
  } catch (e) {
    console.error('onboarding-retomada:', e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
