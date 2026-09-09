import { createClient } from 'jsr:@supabase/supabase-js@2';
import { checkRateLimit, ipDaRequisicao } from '../_shared/rate-limit.ts';

const EFI_COB_URL = Deno.env.get('EFI_SANDBOX') === 'true'
  ? 'https://cobrancas-h.api.efipay.com.br'
  : 'https://cobrancas.api.efipay.com.br';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...cors, 'Content-Type': 'application/json' },
});

function envFirst(...names: string[]) {
  for (const name of names) {
    const value = Deno.env.get(name)?.trim();
    if (value) return value;
  }
  throw new Error('Credenciais Efí de Cobranças não configuradas.');
}

async function tokenEfi() {
  const basic = btoa(`${envFirst('EFI_COBRANCAS_CLIENT_ID', 'EFI_CLIENT_ID')}:${envFirst('EFI_COBRANCAS_CLIENT_SECRET', 'EFI_CLIENT_SECRET')}`);
  const resposta = await fetch(`${EFI_COB_URL}/v1/authorize`, {
    method: 'POST', headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials' }),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok || !dados?.access_token) throw new Error(`Efí OAuth falhou (${resposta.status}).`);
  return dados.access_token as string;
}

async function statusAssinatura(token: string, subscriptionId: string): Promise<string> {
  const resposta = await fetch(`${EFI_COB_URL}/v1/subscription/${encodeURIComponent(subscriptionId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(`Consulta da assinatura Efí falhou (${resposta.status}).`);
  return String(dados?.data?.status ?? '').toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  const limite = await checkRateLimit(`saas-cancelar:${ipDaRequisicao(req)}`, { windowMs: 60_000, maxRequests: 10 });
  if (!limite.allowed) return json({ error: 'Muitas tentativas. Aguarde um instante.' }, 429);

  try {
    const { loja_id } = await req.json().catch(() => ({}));
    if (!loja_id) return json({ error: 'Loja é obrigatória.' }, 400);
    const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!bearer) return json({ error: 'Não autorizado.' }, 401);

    const url = Deno.env.get('SUPABASE_URL')!;
    const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const usuarioClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    const { data: { user } } = await usuarioClient.auth.getUser();
    if (!user) return json({ error: 'Não autorizado.' }, 401);
    const { data: vinculo } = await service.from('usuarios_loja').select('papel')
      .eq('user_id', user.id).eq('loja_id', loja_id).maybeSingle();
    if (vinculo?.papel !== 'admin') return json({ error: 'Só o administrador da loja pode cancelar.' }, 403);

    const { data: fatura } = await service.from('faturas_assinatura')
      .select('efi_subscription_id').eq('loja_id', loja_id).eq('ciclo', 'mensal')
      .not('efi_subscription_id', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const subscriptionId = String(fatura?.efi_subscription_id ?? '');
    if (!subscriptionId) return json({ error: 'Esta loja não possui recorrência mensal para cancelar.' }, 409);

    const token = await tokenEfi();
    let status = await statusAssinatura(token, subscriptionId);
    if (!['canceled', 'expired'].includes(status)) {
      try {
        const resposta = await fetch(`${EFI_COB_URL}/v1/subscription/${encodeURIComponent(subscriptionId)}/cancel`, {
          method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}',
        });
        if (!resposta.ok) status = await statusAssinatura(token, subscriptionId);
        else status = 'canceled';
      } catch {
        // Queda após o PUT é resultado desconhecido: consultar antes de sugerir
        // uma nova tentativa evita decisões baseadas apenas no timeout.
        status = await statusAssinatura(token, subscriptionId);
      }
    }
    if (!['canceled', 'expired'].includes(status)) {
      return json({ error: 'A Efí ainda não confirmou o cancelamento. Tente novamente sem criar outra assinatura.' }, 502);
    }

    const { data: loja, error } = await service.from('lojas').update({
      status_assinatura: 'cancelada', assinatura_efi_status: status, assinatura_efi_evento_em: new Date().toISOString(),
    }).eq('id', loja_id).select('trial_termina_em').single();
    if (error) return json({ error: 'Cancelamento confirmado pela Efí; atualização local pendente de reconciliação.' }, 500);
    return json({ ok: true, status, acesso_ate: loja?.trial_termina_em ?? null });
  } catch (e) {
    console.error('Falha ao cancelar assinatura:', e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
