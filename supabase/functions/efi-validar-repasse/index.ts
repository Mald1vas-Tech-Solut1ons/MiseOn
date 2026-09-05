// MiseOn — Edge Function: valida os dados de repasse Pix do lojista no Efí Bank
//
// POR QUE ESTA FUNÇÃO EXISTE
// Salvar CPF/CNPJ + número da conta Efí em `lojas` é uma escrita no Postgres:
// ela dá certo com dado certo e com dado errado igualmente. Até aqui a tela
// dizia "salvo com sucesso" nos dois casos, e o lojista só descobria que a
// conta estava errada quando o dinheiro de uma venda real não chegava.
//
// Esta função pergunta ao Efí em vez de supor: monta a MESMA configuração de
// split que a `pix-criar-cobranca` monta na hora da venda e vê se o Efí aceita
// o favorecido informado. O resultado — inclusive a recusa, com a mensagem do
// próprio Efí — é gravado em `lojas.efi_repasse_status`.
//
// LIMITE HONESTO DESTA VALIDAÇÃO: ela confirma que o Efí ACEITA os dados do
// favorecido, não que a conta pertence a quem diz pertencer. A verdade final
// continua sendo o `split_status` de uma cobrança real, que é gravado pela
// `pix-criar-cobranca`. Por isso o status 'aceito' nunca é apresentado como
// "conta verificada".
//
// Secrets: os mesmos da plataforma usados pela pix-criar-cobranca.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const EFI_URL = Deno.env.get('EFI_SANDBOX') === 'true'
  ? 'https://pix-h.api.efipay.com.br'
  : 'https://pix.api.efipay.com.br';

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

function envFirst(...names: string[]): string {
  for (const name of names) {
    const value = Deno.env.get(name)?.trim();
    if (value) return value;
  }
  throw new Error(`Secret ausente: informe um destes nomes -> ${names.join(', ')}`);
}

type EfiCreds = { clientId: string; clientSecret: string; certPem: string; pixKey: string };

function credsPlataforma(): EfiCreds {
  return {
    clientId: envFirst('EFI_PIX_CLIENT_ID', 'EFI_CLIENT_ID'),
    clientSecret: envFirst('EFI_PIX_CLIENT_SECRET', 'EFI_CLIENT_SECRET'),
    certPem: atob(envFirst('EFI_CERT_BASE64')),
    pixKey: envFirst('EFI_PIX_KEY'),
  };
}

function efiFetch(creds: EfiCreds, path: string, init: RequestInit, token?: string) {
  const client = Deno.createHttpClient({
    // @ts-ignore — API de mTLS do Deno
    cert: creds.certPem,
    key: creds.certPem,
  });
  return fetch(`${EFI_URL}${path}`, {
    ...init,
    // @ts-ignore — opção 'client' é específica do Deno (fetch com HttpClient)
    client,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
}

async function getToken(creds: EfiCreds): Promise<string> {
  const auth = btoa(`${creds.clientId}:${creds.clientSecret}`);
  const res = await efiFetch(creds, '/oauth/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}` },
    body: JSON.stringify({ grant_type: 'client_credentials' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.access_token) {
    throw new Error(`credenciais_plataforma: o Efí recusou o login da conta da plataforma (${data?.error_description ?? data?.mensagem ?? res.status})`);
  }
  return data.access_token;
}

async function gravarStatus(
  supabase: ReturnType<typeof createClient>,
  lojaId: string,
  status: string,
  detalhe: string | null,
) {
  await supabase
    .from('lojas')
    .update({
      efi_repasse_status: status,
      efi_repasse_detalhe: detalhe,
      efi_repasse_verificado_em: new Date().toISOString(),
    })
    .eq('id', lojaId);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let lojaId = '';
  try {
    const body = await req.json();
    lojaId = String(body?.loja_id ?? '');
    if (!lojaId) return json({ error: 'loja_id obrigatório' }, { status: 400 });

    // ── Autorização: só quem opera a loja pode disparar a validação ──────────
    // Diferente da pix-criar-cobranca, aqui NÃO existe caso anônimo legítimo:
    // esta chamada gasta uma requisição na conta Efí da plataforma.
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return json({ error: 'Autenticação obrigatória' }, { status: 401 });
    }
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user: authUser } } = await userClient.auth.getUser();
    if (!authUser || authUser.role === 'anon') {
      return json({ error: 'Autenticação obrigatória' }, { status: 401 });
    }
    const { data: vinculo } = await supabase
      .from('usuarios_loja')
      .select('papel')
      .eq('user_id', authUser.id)
      .eq('loja_id', lojaId)
      .maybeSingle();
    if (!vinculo) return json({ error: 'Acesso não autorizado para esta loja' }, { status: 403 });

    // ── Dados do favorecido ─────────────────────────────────────────────────
    const { data: loja } = await supabase
      .from('lojas')
      .select('nome, efi_titular_documento, efi_conta')
      .eq('id', lojaId)
      .single();
    if (!loja) return json({ error: 'loja não encontrada' }, { status: 404 });

    const doc = String(loja.efi_titular_documento ?? '').replace(/\D/g, '');
    const conta = String(loja.efi_conta ?? '').replace(/\D/g, '');
    if (!doc || !conta) {
      await gravarStatus(supabase, lojaId, 'nao_configurado', 'CPF/CNPJ do titular e número da conta Efí não estão preenchidos.');
      return json({ status: 'nao_configurado', detalhe: 'Preencha o CPF/CNPJ do titular e o número da conta Efí.' });
    }

    // ── Pergunta ao Efí ─────────────────────────────────────────────────────
    const creds = credsPlataforma();
    const token = await getToken(creds);

    const docKey = doc.length > 11 ? 'cnpj' : 'cpf';
    const cfgBody = {
      descricao: `Validacao de repasse MiseOn -> ${String(loja.nome ?? 'loja')}`.slice(0, 140),
      lancamento: { imediato: true },
      split: {
        divisaoTarifa: 'assumir_total',
        minhaParte: { tipo: 'porcentagem', valor: '0.00' },
        repasses: [
          { tipo: 'porcentagem', valor: '100.00', favorecido: { [docKey]: doc, conta } },
        ],
      },
    };

    const res = await efiFetch(creds, '/v2/gn/split/config', { method: 'POST', body: JSON.stringify(cfgBody) }, token);
    const cfg = await res.json().catch(() => ({}));
    const cfgId = cfg?.id ?? cfg?.identificador ?? cfg?.split_config_id;

    if (res.ok && cfgId) {
      const detalhe = `O Efí aceitou ${docKey.toUpperCase()} e conta ${conta} como favorecido do repasse.`;
      await gravarStatus(supabase, lojaId, 'aceito', detalhe);
      return json({ status: 'aceito', detalhe });
    }

    // Recusa explícita do Efí — é isto que antes passava por "salvo com sucesso".
    const motivo = cfg?.mensagem ?? cfg?.detalhe ?? cfg?.error_description ?? cfg?.nome ?? `HTTP ${res.status}`;
    const detalhe = `O Efí recusou os dados do repasse: ${motivo}`;
    await gravarStatus(supabase, lojaId, 'recusado', detalhe);
    return json({ status: 'recusado', detalhe });
  } catch (e) {
    // Falha de infraestrutura ou de credencial da plataforma: NÃO é um "ok",
    // e também não é culpa do dado que o lojista digitou. Fica explícito.
    const msg = String((e as Error)?.message ?? e);
    console.error('efi-validar-repasse:', msg);
    if (lojaId) {
      try { await gravarStatus(supabase, lojaId, 'indisponivel', msg); } catch { /* nada */ }
    }
    return json({ status: 'indisponivel', detalhe: msg }, { status: 200 });
  }
});
