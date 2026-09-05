// MiseOn — Edge Function: webhook Pix do Efí Bank (Segurança Máxima)
//
// IMPLEMENTAÇÃO DE LEDGER E HMAC:
// 1. Validação de Assinatura HMAC (X-Efi-Signature).
// 2. Consulta à API Efí para ratificar transação.
// 3. Inserção contábil (Ledger de Dupla Entrada).
// 4. Efetivação do Pedido (ACEITO).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const EFI_URL = Deno.env.get('EFI_SANDBOX') === 'true'
  ? 'https://pix-h.api.efipay.com.br'
  : 'https://pix.api.efipay.com.br';

function envFirst(...names: string[]): string {
  for (const name of names) {
    const value = Deno.env.get(name)?.trim();
    if (value) return value;
  }
  throw new Error(`Secret ausente: informe um destes nomes -> ${names.join(', ')}`);
}

function credsPlataforma() {
  return {
    clientId: envFirst('EFI_PIX_CLIENT_ID', 'EFI_CLIENT_ID'),
    clientSecret: envFirst('EFI_PIX_CLIENT_SECRET', 'EFI_CLIENT_SECRET'),
    certPem: atob(envFirst('EFI_CERT_BASE64')),
  };
}

function efiFetch(certPem: string, path: string, init: RequestInit, token?: string) {
  const client = Deno.createHttpClient({
    // @ts-ignore — API de mTLS do Deno
    cert: certPem,
    key: certPem,
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

async function getToken(creds: { clientId: string; clientSecret: string; certPem: string }): Promise<string> {
  const auth = btoa(`${creds.clientId}:${creds.clientSecret}`);
  const res = await efiFetch(creds.certPem, '/oauth/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}` },
    body: JSON.stringify({ grant_type: 'client_credentials' }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Efí OAuth falhou: ${JSON.stringify(data)}`);
  return data.access_token;
}

import { aplicarPagamentoAssinatura } from '../_shared/assinatura-pix.ts';
import { confirmarPagamentoPedido } from '../_shared/pedido-pix.ts';

// Confirma a ASSINATURA da loja (cobrança criada pela saas-pix, txid 'saas...').
// A regra de ativação mora em _shared/assinatura-pix.ts porque a tela também
// precisa dela: quando o webhook falha ou atrasa, quem já pagou não pode ficar
// preso olhando o QR. Aqui só buscamos a verdade na Efí e aplicamos.
async function confirmarAssinatura(
  supabase: any,
  certPem: string,
  token: string,
  txid: string,
  log: any,
) {
  const res = await efiFetch(certPem, `/v2/cob/${txid}`, { method: 'GET' }, token);
  const cob = await res.json().catch(() => ({}));
  await aplicarPagamentoAssinatura(supabase, txid, cob, log);
}

// HMAC-SHA256 Helper
async function validarHmacSha256(message: string, signature: string, secret: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );
    const signatureBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
    return await crypto.subtle.verify("HMAC", key, signatureBytes, new TextEncoder().encode(message));
  } catch {
    return false;
  }
}

// Teto de 6/s por IP. Era um Map local — mesmo defeito do _shared antigo: cada
// isolate contava sozinho, então o limite se multiplicava justo sob carga.
// Agora usa o contador do Postgres, compartilhado por todos os isolates.
const MAX_REQ_PER_SEC = 6;
const WINDOW_MS = 1000;

import { z } from 'npm:zod';
import { logger } from '../_shared/logger.ts';
import { checkRateLimit, ipDaRequisicao } from '../_shared/rate-limit.ts';

const pixWebhookSchema = z.object({
  pix: z.array(
    z.object({
      txid: z.string(),
      valor: z.string().optional()
    }).passthrough()
  ).optional().default([]),
}).passthrough();

Deno.serve(async (req) => {
  const reqLogger = logger.withContext({ req_id: crypto.randomUUID() });
  const clientIp = ipDaRequisicao(req);
  const rl = await checkRateLimit(`pix-webhook:${clientIp}`, {
    windowMs: WINDOW_MS,
    maxRequests: MAX_REQ_PER_SEC,
  });
  if (!rl.allowed) {
    return Response.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  try {
    // Leitura atômica do body para validação de HMAC
    const bodyText = await req.text();
    
    // 1. AUTENTICIDADE DO CALLBACK
    //
    // Quem decide se um Pix foi pago NÃO é este corpo de requisição: é a
    // consulta GET /v2/cob/{txid} feita mais abaixo, por mTLS, com o
    // certificado da conta Efí. Nenhuma linha daqui confirma pagamento por
    // acreditar no payload — o payload só diz QUAL txid conferir. Callback
    // forjado, no máximo, faz o servidor perguntar à Efí e ouvir "não paga".
    //
    // Então a assinatura é defesa em profundidade, não o portão:
    //   • assinatura + segredo  -> tem que bater, senão é forjaria (401);
    //   • assinatura sem segredo -> registra e segue para a ratificação;
    //   • sem assinatura         -> segue para a ratificação.
    //
    // Exigir o segredo como pré-condição (como estava desde 17/08/2026)
    // derrubava 100% dos callbacks enquanto `EFI_WEBHOOK_SECRET` não existisse
    // no projeto — e derrubaria de novo se a Efí não mandar esse header, que é
    // o caso da API Pix quando ela autentica o callback por mTLS. Resultado
    // observado: nenhum pagamento confirmado e ninguém avisado. Recusa
    // silenciosa é pior que log ruidoso.
    const efiSecret = Deno.env.get('EFI_WEBHOOK_SECRET');
    const signature = req.headers.get('X-Efi-Signature');
    if (signature && efiSecret) {
      if (!(await validarHmacSha256(bodyText, signature, efiSecret))) {
        reqLogger.error('HMAC inválido no webhook Efí — recusando.');
        return Response.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } else if (signature) {
      reqLogger.warn('Webhook Efí assinado, mas EFI_WEBHOOK_SECRET não configurada: seguindo só com a ratificação na Efí.');
    } else {
      reqLogger.warn('Webhook Efí sem assinatura: seguindo só com a ratificação na Efí.');
    }

    let payloadRaw;
    try {
      payloadRaw = JSON.parse(bodyText);
    } catch {
      payloadRaw = {};
    }

    const validation = pixWebhookSchema.safeParse(payloadRaw);
    if (!validation.success) {
      reqLogger.error('Payload validation failed', validation.error, { issues: validation.error.issues });
      return Response.json({ error: 'Invalid payload', issues: validation.error.issues }, { status: 400 });
    }

    const payload = validation.data;
    const pixList = payload.pix;
    if (!pixList || !pixList.length) return Response.json({ ok: true }); // ping/configuração

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let creds;
    let token;
    try {
      creds = credsPlataforma();
      token = await getToken(creds);
    } catch (e) {
      reqLogger.error('Webhook Pix: sem credenciais Efí para verificar; ignorando.', e);
      return Response.json({ ok: true, verificado: false });
    }

    for (const pix of pixList) {
      if (!pix.txid) continue;

      // Cobrança de assinatura (saas-pix) — o txid nasce com prefixo 'saas'.
      // Não tem pedido nem linha em `pagamentos`: é a loja pagando a MiseOn.
      if (pix.txid.startsWith('saas')) {
        await confirmarAssinatura(supabase, creds.certPem, token, pix.txid, reqLogger);
        continue;
      }

      // 2. SOMENTE DEPOIS DE CONFIRMAÇÃO INEQUÍVOCA DA EFÍ.
      // A regra do pedido mora em _shared/pedido-pix.ts porque a tela do
      // cliente também precisa dela (pix-criar-cobranca, ação 'status'):
      // pagamento não pode depender de um canal único.
      const res = await efiFetch(creds.certPem, `/v2/cob/${pix.txid}`, { method: 'GET' }, token);
      const cob = await res.json().catch(() => ({}));
      await confirmarPagamentoPedido(supabase, pix.txid, cob, reqLogger);
    }
    return Response.json({ ok: true });
  } catch (e) {
    reqLogger.error('Erro no processamento do webhook Pix', e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
