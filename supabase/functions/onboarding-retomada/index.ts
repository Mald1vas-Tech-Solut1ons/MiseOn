// MiseOn — Edge Function: retomada de cadastro.
//
// Quem entra (Google ou e-mail) e não cria a loja recebe no MÁXIMO dois
// lembretes (≈1h e ≈24h depois), no e-mail da própria conta. Quem decide QUEM
// recebe é o banco (fn_onboarding_candidatos_retomada), atrás do interruptor
// plataforma_flags.onboarding_retomada.
//
// Todo envio vira linha em email_log ANTES de sair (o token vai nos links):
// campanha, destinatário, status, id da mensagem, abertura, clique,
// descadastro e conversão aparecem no superadmin → E-mails.
//
// Ações:
//   POST { acao: 'processar' } + x-worker-token → envia o lote (pg_cron)
//   POST { acao: 'previa', envio: 1|2 } + JWT de superadmin → manda um
//        exemplo MARCADO "[PRÉVIA]" para quem pediu. Não conta na métrica.

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
const EMAIL_WORKER_TOKEN_DB = Deno.env.get('EMAIL_WORKER_TOKEN_DB');

// O domínio da marca é fixo. Ler de variável de ambiente foi o que mandou o
// 1º lembrete com link para miseon.vercel.app.
const SITE = 'https://miseon.app.br';
const WHATSAPP = '5511919889233';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-worker-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

/** Link rastreado: passa por miseon.app.br/e/c e cai no destino. */
const rastreado = (token: string, destino: string) =>
  `${SITE}/e/c?t=${token}&u=${encodeURIComponent(destino)}`;

/**
 * O texto. Nada de número que não foi medido e nada de urgência inventada:
 * o primeiro lembra, o segundo oferece ajuda de gente.
 */
export function montar(envio: number, nome: string, token: string, previa = false) {
  const ola = nome ? `Olá, ${escapar(nome)}!` : 'Olá!';
  const continuar = rastreado(token, `${SITE}/admin`);
  const zap = rastreado(token, `https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Oi, Rafael! Comecei o cadastro no MiseOn e queria ajuda para terminar.')}`);
  const sair = `${SITE}/e/sair?t=${token}`;
  const pixel = `${SITE}/e/a?t=${token}`;

  const assuntoBase = envio === 1
    ? 'Sua loja no MiseOn ficou pela metade'
    : 'Quer ajuda para configurar sua loja no MiseOn?';
  const assunto = previa ? `[PRÉVIA] ${assuntoBase}` : assuntoBase;

  const corpo = envio === 1
    ? [
      'Você entrou no MiseOn, mas a sua loja ainda não foi criada.',
      'Agora são só dois campos — o nome da loja e o tipo de negócio — e você já entra no sistema. São 30 dias grátis, sem cartão.',
    ]
    : [
      'Vi que você começou o cadastro no MiseOn e não chegou a abrir a loja.',
      'Se alguma coisa travou ou ficou confusa, me chama no WhatsApp que eu configuro com você — cardápio, produtos e o primeiro pedido de teste.',
    ];

  const aviso = previa
    ? `<tr><td style="background:#FFF4E5;padding:12px 28px;font-size:13px;color:#8A4B00">Prévia do lembrete ${envio} de 2. Quem recebe de verdade é o dono da conta sem loja, no e-mail cadastrado dele.</td></tr>`
    : '';

  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#EAF1FB;font-family:Manrope,Segoe UI,Arial,sans-serif;color:#070C18">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#004198;padding:20px 28px;color:#ffffff;font-family:Sora,Segoe UI,Arial,sans-serif;font-size:20px;font-weight:800">MiseOn</td></tr>
${aviso}
<tr><td style="padding:28px">
<p style="margin:0 0 16px;font-size:18px;font-weight:700">${ola}</p>
${corpo.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6">${p}</p>`).join('\n')}
<p style="margin:24px 0"><a href="${envio === 1 ? continuar : zap}" style="display:inline-block;background:#FC5B24;color:#ffffff;text-decoration:none;font-weight:800;padding:14px 24px;border-radius:12px;font-size:15px">${envio === 1 ? 'Continuar de onde parei' : 'Falar com o Rafael no WhatsApp'}</a></p>
<p style="margin:0 0 6px;font-size:14px;line-height:1.6">${envio === 1
    ? `Travou em alguma coisa? <a href="${zap}" style="color:#0A5CC4">Me chama no WhatsApp</a> ou responda este e-mail.`
    : `Se preferir fazer sozinho, é só <a href="${continuar}" style="color:#0A5CC4">continuar de onde parou</a>.`}</p>
<p style="margin:18px 0 0;font-size:14px">Rafael<br><span style="color:#5b6475">MiseOn · miseon.app.br</span></p>
</td></tr>
<tr><td style="padding:16px 28px;background:#f5f7fb;font-size:12px;color:#5b6475;line-height:1.5">
Você recebeu este e-mail porque criou uma conta no MiseOn. São no máximo dois lembretes.
<a href="${sair}" style="color:#5b6475">Não quero mais receber</a>.
</td></tr></table></td></tr></table><img src="${pixel}" width="1" height="1" alt="" style="display:block;border:0"></body></html>`;

  const texto = [previa ? '[PRÉVIA]' : '', ola, '', ...corpo, '',
    envio === 1 ? `Continuar: ${SITE}/admin` : `WhatsApp: https://wa.me/${WHATSAPP}`,
    '', 'Rafael — MiseOn · miseon.app.br', '', `Não quero mais receber: ${sair}`].filter((l, i) => i > 0 || l).join('\n');

  return { assunto, html, texto, sair };
}

function transportador() {
  if (!SMTP_USER || !SMTP_PASS) throw new Error('SMTP_USER/SMTP_PASS ausentes.');
  return nodemailer.createTransport({
    host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

type Db = ReturnType<typeof createClient>;

/**
 * Registra no log, envia, e fecha o registro com o resultado. O registro vem
 * primeiro porque o token dele vai dentro dos links do e-mail.
 */
async function enviarRegistrado(
  db: Db, smtp: ReturnType<typeof transportador>,
  args: { para: string; envio: number; nome: string; userId: string | null; previa: boolean },
): Promise<{ ok: boolean; erro?: string }> {
  const campanha = `retomada-cadastro-${args.envio}`;
  const { data: log, error: eLog } = await db.from('email_log').insert({
    user_id: args.userId,
    recipient: args.para,
    status: 'sending',
    evento: campanha,
    template_type: campanha,
    campanha,
    classe: args.previa ? 'PREVIA' : 'PLATAFORMA',
    metadata: { envio: args.envio, previa: args.previa },
  }).select('id, token').single();
  if (eLog || !log) return { ok: false, erro: `log: ${eLog?.message ?? 'sem retorno'}` };

  const { assunto, html, texto, sair } = montar(args.envio, args.nome, log.token as string, args.previa);
  try {
    const info = await smtp.sendMail({
      from: `"Rafael · MiseOn" <${REMETENTE_EMAIL}>`,
      to: args.para,
      subject: assunto,
      html,
      text: texto,
      list: { unsubscribe: { url: sair, comment: 'Parar lembretes de cadastro' } },
    });
    await db.from('email_log').update({ status: 'sent', message_id: info.messageId, sent_at: new Date().toISOString() }).eq('id', log.id);
    return { ok: true };
  } catch (e) {
    const erro = String((e as Error)?.message ?? e).slice(0, 500);
    await db.from('email_log').update({ status: 'failed', error_message: erro }).eq('id', log.id);
    return { ok: false, erro };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // Link de descadastro antigo (1º lembrete de 22/09): continua funcionando.
    if (req.method === 'GET') {
      const token = new URL(req.url).searchParams.get('parar') ?? '';
      if (/^[0-9a-f-]{36}$/i.test(token)) await db.rpc('fn_onboarding_parar_retomada', { p_token: token });
      return Response.redirect(SITE, 302);
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
      const nome = String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? '').split(' ')[0] ?? '';
      const r = await enviarRegistrado(db, transportador(), { para: user.email, envio, nome, userId: user.id, previa: true });
      return r.ok ? json({ ok: true, enviado_para: user.email, envio }) : json({ error: r.erro }, 500);
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
    for (const c of candidatos as Array<{ user_id: string; email: string; nome: string; envio: number }>) {
      const r = await enviarRegistrado(db, smtp, { para: c.email, envio: c.envio, nome: c.nome ?? '', userId: c.user_id, previa: false });
      if (!r.ok) { console.error('Falha ao enviar retomada para', c.user_id, r.erro); continue; }
      // Marca DEPOIS de enviar: falha de SMTP tenta de novo no próximo ciclo.
      const { error: eMarca } = await db.rpc('fn_onboarding_marcar_retomada', { p_user_id: c.user_id });
      if (eMarca) console.error('Enviado mas não marcado (pode repetir):', c.user_id, eMarca);
      enviados++;
    }
    return json({ ok: true, enviados, candidatos: candidatos.length });
  } catch (e) {
    console.error('onboarding-retomada:', e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
