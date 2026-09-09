// MiseOn — webhook do ciclo de vida da assinatura recorrente Efí.
// O POST traz somente um token. A fonte de verdade é sempre o histórico
// consultado em GET /v1/notification/:token; cada item é persistido e aplicado
// atomicamente pela RPC antes de respondermos 200.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { checkRateLimit, ipDaRequisicao } from '../_shared/rate-limit.ts';
import { processarHistoricoAssinaturaEfi } from '../_shared/assinatura-recorrencia.ts';

const EFI_COB_URL = Deno.env.get('EFI_SANDBOX') === 'true'
  ? 'https://cobrancas-h.api.efipay.com.br'
  : 'https://cobrancas.api.efipay.com.br';

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

function envFirst(...names: string[]): string {
  for (const name of names) {
    const value = Deno.env.get(name)?.trim();
    if (value) return value;
  }
  throw new Error(`Secret ausente: informe um destes nomes -> ${names.join(', ')}`);
}

async function getToken(): Promise<string> {
  const clientId = envFirst('EFI_COBRANCAS_CLIENT_ID', 'EFI_CLIENT_ID');
  const clientSecret = envFirst('EFI_COBRANCAS_CLIENT_SECRET', 'EFI_CLIENT_SECRET');
  const auth = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(`${EFI_COB_URL}/v1/authorize`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error(`Efí OAuth falhou (${res.status})`);
  return data.access_token;
}

async function processarToken(supabase: any, notificationToken: string) {
  await supabase.from('assinatura_notificacoes_efi').upsert({
    notification_token: notificationToken,
    estado: 'recebida',
    ultimo_erro: null,
  }, { onConflict: 'notification_token', ignoreDuplicates: true });

  const { data: inbox, error: erroInbox } = await supabase
    .from('assinatura_notificacoes_efi')
    .select('tentativas')
    .eq('notification_token', notificationToken)
    .single();
  if (erroInbox) throw new Error(`Falha ao persistir token Efí: ${erroInbox.message}`);

  await supabase.from('assinatura_notificacoes_efi').update({
    estado: 'processando',
    tentativas: Number(inbox?.tentativas ?? 0) + 1,
    ultima_tentativa_em: new Date().toISOString(),
  }).eq('notification_token', notificationToken);

  try {
    const token = await getToken();
    const res = await fetch(`${EFI_COB_URL}/v1/notification/${encodeURIComponent(notificationToken)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const notif = await res.json().catch(() => ({}));
    if (!res.ok || !Array.isArray(notif?.data)) {
      throw new Error(`Consulta da notificação Efí falhou (${res.status})`);
    }
    const resultado = await processarHistoricoAssinaturaEfi(supabase, notificationToken, notif.data);
    await supabase.from('assinatura_notificacoes_efi').update({
      estado: 'concluida', concluida_em: new Date().toISOString(), ultimo_erro: null,
    }).eq('notification_token', notificationToken);
    return resultado;
  } catch (e) {
    await supabase.from('assinatura_notificacoes_efi').update({
      estado: 'erro', ultimo_erro: String((e as Error)?.message ?? e).slice(0, 500),
    }).eq('notification_token', notificationToken);
    throw e;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, { status: 405 });

  const rl = await checkRateLimit(`efi-assinatura:${ipDaRequisicao(req)}`, {
    windowMs: 60_000,
    maxRequests: 120,
  });
  if (!rl.allowed) return json({ error: 'Muitas requisições.' }, { status: 429 });

  try {
    const body = await req.json().catch(() => ({}));
    const notificationToken = String(body?.notification ?? body?.token ?? '').trim();
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    if (body?.reconciliar === true) {
      const auth = req.headers.get('Authorization') ?? '';
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      if (!serviceKey || auth !== `Bearer ${serviceKey}`) return json({ error: 'Não autorizado.' }, { status: 403 });
      const { data: pendentes, error } = await supabase.from('assinatura_notificacoes_efi')
        .select('notification_token').in('estado', ['recebida', 'erro']).order('recebida_em').limit(20);
      if (error) throw error;
      const resultados = [];
      for (const item of pendentes ?? []) {
        try {
          resultados.push({ ok: true, ...(await processarToken(supabase, item.notification_token)) });
        } catch (e) {
          resultados.push({ ok: false, error: String((e as Error)?.message ?? e) });
        }
      }
      return json({ ok: resultados.every((r) => r.ok), resultados });
    }

    if (!notificationToken) return json({ ok: true, processados: 0 });
    const resultado = await processarToken(supabase, notificationToken);
    return json({ ok: true, ...resultado });
  } catch (e) {
    console.error('Erro no webhook de renovação da assinatura:', e);
    return json({ error: 'Não foi possível conciliar a notificação.' }, { status: 500 });
  }
});
