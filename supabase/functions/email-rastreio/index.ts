// MiseOn — Edge Function: rastreio de e-mail.
//
// Servida pelo domínio da marca: miseon.app.br/e/<acao>?t=<token> é um rewrite
// da Vercel para cá (vercel.json). Nenhum e-mail mostra domínio técnico.
//
//   /e/a?t=TOKEN            → abertura: registra e devolve GIF 1×1
//   /e/c?t=TOKEN&u=URL      → clique: registra e redireciona (só domínio nosso)
//   /e/sair?t=TOKEN         → descadastro: registra e mostra confirmação
//
// Abertura é ESTIMADA: Apple Mail pré-carrega imagens e há quem bloqueie. O
// clique e a conversão são os números confiáveis — o painel diz isso.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
export const SITE = 'https://miseon.app.br';

/** Para onde um clique pode ir. Qualquer outra coisa cai no site. */
const DESTINOS_PERMITIDOS = new Set(['miseon.app.br', 'www.miseon.app.br', 'wa.me', 'api.whatsapp.com']);

const GIF = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), (c) => c.charCodeAt(0));

export function destinoSeguro(bruto: string | null): string {
  if (!bruto) return SITE;
  try {
    const u = new URL(bruto);
    if (u.protocol === 'https:' && DESTINOS_PERMITIDOS.has(u.hostname)) return u.toString();
  } catch { /* URL inválida cai no site */ }
  return SITE;
}

const tokenValido = (t: string | null) => !!t && /^[0-9a-f-]{36}$/i.test(t);

const pagina = (titulo: string, msg: string) => new Response(
  `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo} · MiseOn</title>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#EAF1FB;font-family:Segoe UI,Arial,sans-serif;color:#070C18">
<div style="max-width:420px;background:#fff;border-radius:16px;padding:32px;text-align:center"><p style="margin:0 0 16px;font-weight:800;color:#004198">MiseOn</p><h1 style="font-size:20px;margin:0 0 12px">${titulo}</h1><p style="margin:0 0 20px;line-height:1.6">${msg}</p><a href="${SITE}" style="color:#0A5CC4">miseon.app.br</a></div></body></html>`,
  { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
);

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // Via rewrite a ação chega em ?acao=; chamada direta pode trazer no caminho.
  const acao = url.searchParams.get('acao') ?? url.pathname.split('/').pop() ?? '';
  const token = url.searchParams.get('t');
  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  const registrar = async (tipo: string, destino?: string) => {
    if (!tokenValido(token)) return;
    const { error } = await db.rpc('fn_email_registrar_evento', { p_token: token, p_tipo: tipo, p_url: destino ?? null });
    if (error) console.error('email-rastreio: falha ao registrar', tipo, error.message);
  };

  try {
    if (acao === 'a') {
      await registrar('abertura');
      return new Response(GIF, {
        headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, max-age=0' },
      });
    }

    if (acao === 'c') {
      const destino = destinoSeguro(url.searchParams.get('u'));
      await registrar('clique', destino);
      return new Response(null, { status: 302, headers: { Location: destino, 'Cache-Control': 'no-store' } });
    }

    if (acao === 'sair') {
      if (!tokenValido(token)) return pagina('Link inválido', 'Este link de descadastro não é válido.');
      await registrar('descadastro');
      return pagina('Pronto', 'Você não vai mais receber estes e-mails do MiseOn.');
    }

    return Response.redirect(SITE, 302);
  } catch (e) {
    console.error('email-rastreio:', e);
    // Rastreio nunca pode quebrar o que a pessoa foi fazer.
    return acao === 'a'
      ? new Response(GIF, { headers: { 'Content-Type': 'image/gif' } })
      : Response.redirect(SITE, 302);
  }
});
