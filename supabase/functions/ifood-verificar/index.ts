// MiseOn — Edge Function: "Verificar agora" a integração com o iFood.
//
// POR QUE EXISTE
// O polling só reverifica a cada 30 minutos quando o aplicativo está sem
// permissão no portal do iFood (ver ifood-polling: insistir de minuto em
// minuto contra uma porta fechada só enchia o log). O efeito colateral é que,
// no momento em que o lojista LIBERA a permissão no portal, ele ficaria
// olhando para uma tela vermelha por até meia hora sem saber se deu certo.
//
// Este endpoint fecha esse laço: um clique, uma tentativa real, e o painel
// responde na hora. É o momento em que a pessoa mais precisa de resposta.
//
// Ele NÃO lê pedido nem cardápio: pede um token e conta o que aconteceu.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const IFOOD = 'https://merchant-api.ifood.com.br';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-chat-session',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Só quem opera alguma loja. Não é dado sensível, mas disparar autenticação
  // no iFood é chamada externa: sem porta fechada, vira alavanca para queimar
  // a cota da plataforma.
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!bearer) return json({ error: 'Não autorizado' }, 401);

  const comoUsuario = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  });
  const { data: { user } } = await comoUsuario.auth.getUser();
  if (!user) return json({ error: 'Não autorizado' }, 401);

  const admin = createClient(url, service);
  const { data: vinculo } = await admin
    .from('usuarios_loja').select('papel').eq('user_id', user.id).limit(1).maybeSingle();
  if (!vinculo) return json({ error: 'Sem acesso' }, 403);

  const clientId = Deno.env.get('IFOOD_CLIENT_ID');
  const clientSecret = Deno.env.get('IFOOD_CLIENT_SECRET');
  if (!clientId || !clientSecret) return json({ error: 'Credenciais iFood ausentes na plataforma' }, 500);

  const res = await fetch(`${IFOOD}/authentication/v1.0/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grantType: 'client_credentials', clientId, clientSecret }),
  });

  const corpo = await res.text().catch(() => '');
  let motivo = corpo.slice(0, 300);
  try { motivo = JSON.parse(corpo)?.error?.message ?? motivo; } catch { /* corpo não-JSON */ }

  const estado = res.ok ? 'OK'
    : res.status === 403 ? 'SEM_PERMISSAO'
    : res.status === 401 ? 'CREDENCIAL'
    : 'ERRO';

  // Deu certo: zera o freio para o polling de minuto a minuto voltar já no
  // próximo ciclo, sem esperar a janela de 30 minutos terminar.
  await admin.from('integracao_ifood_saude').update({
    estado,
    http_status: res.status,
    mensagem: res.ok ? null : motivo,
    verificado_em: new Date().toISOString(),
    falhas_seguidas: res.ok ? 0 : 1,
    proxima_tentativa_em: res.ok ? null : new Date(Date.now() + 30 * 60_000).toISOString(),
  }).eq('id', true);

  return json({ estado, http_status: res.status, mensagem: res.ok ? null : motivo });
});
