// MiseOn — Edge Function: cobrança Pix da ASSINATURA da loja (SaaS)
//
// Irmã da `saas-assinar` (cartão), mas por Pix e com um detalhe que muda tudo:
// Pix não confirma na hora. Aqui a função só CRIA a cobrança e devolve o QR;
// quem ativa a assinatura é o `pix-webhook`, quando a Efí confirma o pagamento.
// Por isso a fatura nasce em `faturas_assinatura` com status 'pendente' e o
// txid em `efi_charge_id` — é esse txid que o webhook usa para achar a fatura.
//
// Diferença importante para a `pix-criar-cobranca` (cobrança do PEDIDO): ali o
// dinheiro é do lojista e vai embora por split. Aqui o dinheiro é da PLATAFORMA
// (a loja está pagando a MiseOn), então NÃO existe split — o valor fica na
// conta Efí da MiseOn mesmo.
//
// Secrets: os mesmos da pix-criar-cobranca (EFI_PIX_CLIENT_ID/SECRET ou
// EFI_CLIENT_ID/SECRET, EFI_PIX_KEY, EFI_CERT_BASE64, EFI_SANDBOX).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { checkRateLimit, ipDaRequisicao } from '../_shared/rate-limit.ts';
import { aplicarPagamentoAssinatura } from '../_shared/assinatura-pix.ts';

const EFI_URL = Deno.env.get('EFI_SANDBOX') === 'true'
  ? 'https://pix-h.api.efipay.com.br'
  : 'https://pix.api.efipay.com.br';

// Valores à vista no Pix (5% OFF), em centavos. Espelham SAAS_PRICING de
// src/lib/efiInfo.ts. Ficam no servidor de propósito: o valor que o navegador
// manda é sugestão de tela, não preço — preço quem decide é esta function.
const VALOR_PIX_MENSAL = 16140;  // R$ 161,40
const VALOR_PIX_ANUAL  = 170886; // R$ 1.708,86

const EXPIRACAO_SEG = 3600;
// Janela para reaproveitar uma cobrança já criada em vez de gerar outra: dois
// cliques no botão não podem virar dois Pix pagáveis. Menor que a expiração
// para não devolver QR que morre no meio do caminho.
const REAPROVEITAR_ATE_MS = 50 * 60 * 1000;

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

type EfiCreds = { clientId: string; clientSecret: string; certPem: string; pixKey: string };

function credsPlataforma(): EfiCreds {
  return {
    clientId: envFirst('EFI_PIX_CLIENT_ID', 'EFI_CLIENT_ID'),
    clientSecret: envFirst('EFI_PIX_CLIENT_SECRET', 'EFI_CLIENT_SECRET'),
    certPem: atob(envFirst('EFI_CERT_BASE64')),
    pixKey: envFirst('EFI_PIX_KEY'),
  };
}

// mTLS: a API Pix da Efí exige o certificado da conta em toda chamada.
async function efiFetch(creds: EfiCreds, path: string, init: RequestInit, token?: string) {
  const client = Deno.createHttpClient({
    // @ts-ignore — API de mTLS do Deno
    cert: creds.certPem,
    key: creds.certPem,
  });
  return fetch(`${EFI_URL}${path}`, {
    ...init,
    // @ts-ignore
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
  const data = await res.json();
  if (!data.access_token) throw new Error(`Efí OAuth falhou: ${JSON.stringify(data)}`);
  return data.access_token;
}

// txid da Efí: 26–35 caracteres alfanuméricos, e o teto de 35 é apertado.
// Montagem: 'saas' (4) + 25 hex da loja + 6 aleatórios = 35 exatos.
//   - 'saas' faz o webhook saber que é assinatura, não pedido;
//   - o pedaço da loja permite conferir dono do txid sem ir ao banco;
//   - o aleatório impede que duas cobranças da mesma loja colidam no mesmo
//     txid (cortar o aleatório no slice deixava o txid fixo por loja, e a
//     segunda cobrança sobrescrevia a primeira na Efí).
const HEX_LOJA_NO_TXID = 25;

function prefixoTxid(lojaId: string): string {
  return `saas${String(lojaId).replace(/-/g, '').slice(0, HEX_LOJA_NO_TXID)}`;
}

function gerarTxid(lojaId: string): string {
  const aleatorio = crypto.randomUUID().replace(/-/g, '').slice(0, 6);
  return `${prefixoTxid(lojaId)}${aleatorio}`;
}

async function qrCodeDaCobranca(creds: EfiCreds, token: string, locId: unknown): Promise<string | null> {
  if (!locId) return null;
  const qr = await efiFetch(creds, `/v2/loc/${locId}/qrcode`, { method: 'GET' }, token);
  const qrData = await qr.json().catch(() => ({}));
  return qrData.imagemQrcode ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { loja_id, ciclo, acao, txid: txidConsulta } = await req.json();
    if (!loja_id) return json({ error: 'loja_id obrigatório' }, { status: 400 });
    const ehAnual = ciclo === 'anual';
    // 'status' é chamada em laço pela tela enquanto o QR está aberto, então
    // tem teto próprio — o teto de criar cobrança é apertado de propósito.
    const consultando = acao === 'status';
    const rl = await checkRateLimit(
      `saas-pix:${consultando ? 'status' : 'criar'}:${ipDaRequisicao(req)}`,
      { windowMs: 60000, maxRequests: consultando ? 30 : 10 },
    );
    if (!rl.allowed) return json({ error: 'Muitas tentativas seguidas. Aguarde um minuto.' }, { status: 429 });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ── AUTORIZAÇÃO ────────────────────────────────────────────────────────
    // Mesma regra da saas-assinar: gerar cobrança em nome de uma loja é ato de
    // admin daquela loja. `loja_id` vindo do corpo, sozinho, não prova nada.
    const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!bearer) return json({ error: 'Não autorizado' }, { status: 401 });

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${bearer}` } } },
    );
    const { data: { user: usuario } } = await supabaseUser.auth.getUser();
    if (!usuario) return json({ error: 'Não autorizado' }, { status: 401 });

    const { data: vinculo } = await supabase
      .from('usuarios_loja')
      .select('papel')
      .eq('user_id', usuario.id)
      .eq('loja_id', loja_id)
      .maybeSingle();
    if (vinculo?.papel !== 'admin') {
      return json({ error: 'Só o administrador da loja pode assinar.' }, { status: 403 });
    }

    // ── CONSULTA DE PAGAMENTO ──────────────────────────────────────────────
    // A tela pergunta aqui de tempos em tempos. Não é conveniência: é o que
    // faz o lojista que já pagou sair da tela mesmo se o webhook da Efí falhar,
    // atrasar ou não estiver configurado. A verdade vem da Efí, não do cliente.
    if (consultando) {
      const creds = credsPlataforma();
      const token = await getToken(creds);

      let txid = typeof txidConsulta === 'string' ? txidConsulta : '';
      if (!txid) {
        const { data: ultima } = await supabase
          .from('faturas_assinatura')
          .select('efi_charge_id')
          .eq('loja_id', loja_id)
          .eq('forma_pagamento', 'pix')
          .eq('status_cobranca', 'pendente')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        txid = ultima?.efi_charge_id ?? '';
      }
      if (!txid) return json({ confirmado: false, motivo: 'sem_cobranca' });

      // A cobrança consultada tem que ser desta loja: o txid nasce com o id da
      // loja embutido, então dá para conferir sem ir ao banco de novo.
      if (!txid.startsWith(prefixoTxid(loja_id))) {
        return json({ error: 'Cobrança não pertence a esta loja' }, { status: 403 });
      }

      const res = await efiFetch(creds, `/v2/cob/${txid}`, { method: 'GET' }, token);
      const cob = await res.json().catch(() => ({}));
      const resultado = await aplicarPagamentoAssinatura(supabase, txid, cob, {
        info: (m, c) => console.log(m, c ?? ''),
        warn: (m, c) => console.warn(m, c ?? ''),
        error: (m, e, c) => console.error(m, e ?? '', c ?? ''),
      });

      return json({
        txid,
        status_cobranca_efi: cob?.status ?? null,
        confirmado: resultado.confirmado,
        vencimento: resultado.vencimento ?? null,
        motivo: resultado.motivo ?? null,
      });
    }

    const valorCentavos = ehAnual ? VALOR_PIX_ANUAL : VALOR_PIX_MENSAL;
    const valorReais = valorCentavos / 100;

    const { data: loja } = await supabase.from('lojas').select('nome').eq('id', loja_id).maybeSingle();
    const { data: cadastro } = await supabase
      .from('assinatura_dados_cadastro')
      .select('*')
      .eq('loja_id', loja_id)
      .maybeSingle();

    const creds = credsPlataforma();
    const token = await getToken(creds);

    // ── REAPROVEITA COBRANÇA VIVA ──────────────────────────────────────────
    // Se já existe Pix pendente do mesmo plano e ele ainda está ATIVA na Efí,
    // devolve o mesmo QR. Sem isso, cada clique gera uma cobrança nova e o
    // lojista pode pagar duas.
    const desde = new Date(Date.now() - REAPROVEITAR_ATE_MS).toISOString();
    const { data: pendente } = await supabase
      .from('faturas_assinatura')
      .select('id, efi_charge_id, valor_cobrado')
      .eq('loja_id', loja_id)
      .eq('forma_pagamento', 'pix')
      .eq('status_cobranca', 'pendente')
      .eq('ciclo', ehAnual ? 'anual' : 'mensal')
      .gte('created_at', desde)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendente?.efi_charge_id) {
      const res = await efiFetch(creds, `/v2/cob/${pendente.efi_charge_id}`, { method: 'GET' }, token);
      const cob = await res.json().catch(() => ({}));
      if (String(cob?.status) === 'ATIVA' && cob?.pixCopiaECola) {
        return json({
          txid: cob.txid,
          copia_e_cola: cob.pixCopiaECola,
          qr_imagem: await qrCodeDaCobranca(creds, token, cob?.loc?.id),
          expiracao: Number(cob?.calendario?.expiracao ?? EXPIRACAO_SEG),
          fatura_id: pendente.id,
          valor: Number(pendente.valor_cobrado ?? valorReais),
          reaproveitada: true,
        });
      }
    }

    // ── COBRANÇA NOVA ──────────────────────────────────────────────────────
    const txid = gerarTxid(loja_id);
    const descricao = `Assinatura MiseOn ${ehAnual ? 'Anual' : 'Mensal'} — ${loja?.nome ?? 'loja'}`.slice(0, 140);

    const res = await efiFetch(creds, `/v2/cob/${txid}`, {
      method: 'PUT',
      body: JSON.stringify({
        calendario: { expiracao: EXPIRACAO_SEG },
        valor: { original: valorReais.toFixed(2) },
        chave: creds.pixKey,
        solicitacaoPagador: descricao,
      }),
    }, token);
    const charge = await res.json().catch(() => ({}));
    if (!charge?.txid) {
      return json({ error: `Efí recusou a cobrança: ${charge?.mensagem ?? charge?.nome ?? 'erro desconhecido'}` }, { status: 502 });
    }

    // A fatura nasce pendente. O webhook é que marca 'pago', estende o
    // vencimento da loja e dispara a NFS-e — aqui ninguém ativa nada.
    const { data: fatura, error: eFatura } = await supabase.from('faturas_assinatura').insert({
      loja_id,
      ciclo: ehAnual ? 'anual' : 'mensal',
      parcelas: 1,
      forma_pagamento: 'pix',
      valor_cobrado: valorReais,
      efi_charge_id: charge.txid,
      status_cobranca: 'pendente',
      tomador_cpf_cnpj: cadastro?.cpf_cnpj ?? null,
      tomador_razao_social: cadastro?.razao_social_ou_nome ?? null,
      tomador_logradouro: cadastro?.logradouro ?? null,
      tomador_numero: cadastro?.numero ?? null,
      tomador_complemento: cadastro?.complemento ?? null,
      tomador_bairro: cadastro?.bairro ?? null,
      tomador_cidade: cadastro?.cidade ?? null,
      tomador_uf: cadastro?.uf ?? null,
      tomador_cep: cadastro?.cep ?? null,
      tomador_email: cadastro?.email_cobranca ?? null,
    }).select('id').single();

    if (eFatura || !fatura?.id) {
      // Cobrança criada e fatura não registrada = pagamento que ninguém
      // reconhece depois. Melhor falhar aqui, com o QR ainda não entregue.
      console.error('Falha ao registrar fatura Pix da assinatura:', eFatura);
      return json({ error: 'Não foi possível registrar a cobrança. Tente de novo.' }, { status: 500 });
    }

    return json({
      txid: charge.txid,
      copia_e_cola: charge.pixCopiaECola ?? charge.location,
      qr_imagem: await qrCodeDaCobranca(creds, token, charge?.loc?.id),
      expiracao: EXPIRACAO_SEG,
      fatura_id: fatura.id,
      valor: valorReais,
    });
  } catch (e) {
    console.error('Erro na função saas-pix:', String((e as Error)?.message ?? e));
    return json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
});
