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

async function efiFetch(certPem: string, path: string, init: RequestInit, token?: string) {
  const client = Deno.createHttpClient({
    // @ts-ignore
    cert: certPem,
    key: certPem,
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

function valorPagoDaCobranca(cob: any): number {
  const lista = Array.isArray(cob?.pix) ? cob.pix : [];
  const somaPix = lista.reduce((s: number, p: any) => s + Number(p?.valor ?? 0), 0);
  if (somaPix > 0) return somaPix;
  return Number(cob?.valor?.original ?? 0);
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
  } catch (e) {
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
    
    // 1. VALIDAÇÃO DE ASSINATURA HMAC OBRIGATÓRIA
    // Auditoria, achado 11: antes era `if (efiSecret)` — sem a env, a validação
    // de assinatura sumia em silêncio. Segredo ausente é erro de configuração,
    // não permissão para aceitar webhook não assinado.
    const efiSecret = Deno.env.get('EFI_WEBHOOK_SECRET');
    if (!efiSecret) {
      reqLogger.error('EFI_WEBHOOK_SECRET não configurada — recusando webhook.');
      return Response.json({ error: 'Webhook não configurado' }, { status: 500 });
    }
    const signature = req.headers.get('X-Efi-Signature');
    if (!signature || !(await validarHmacSha256(bodyText, signature, efiSecret))) {
      reqLogger.error('HMAC inválido ou ausente no webhook Efí.');
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
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

      const { data: pgto } = await supabase
        .from('pagamentos')
        .select('pedido_id, status, pedidos(loja_id, numero, valor_total, status)')
        .eq('gateway_txid', pix.txid)
        .eq('status', 'PENDENTE')
        .maybeSingle();
        
      if (!pgto?.pedido_id) continue;

      // 2. SOMENTE DEPOIS DE CONFIRMAÇÃO INEQUÍVOCA DA EFÍ
      const res = await efiFetch(creds.certPem, `/v2/cob/${pix.txid}`, { method: 'GET' }, token);
      const cob = await res.json().catch(() => ({}));
      
      if (String(cob?.status) === 'CONCLUIDA') {
        const totalPedido = Number((pgto.pedidos as any)?.valor_total ?? 0);
        const pago = valorPagoDaCobranca(cob);
        
        if (pago + 0.01 >= totalPedido) {
          const { data: pagoRow } = await supabase
            .from('pagamentos')
            .update({ status: 'PAGO', data_pagamento: new Date().toISOString() })
            .eq('gateway_txid', pix.txid)
            .eq('status', 'PENDENTE')
            .select('pedido_id')
            .maybeSingle();

          if (pagoRow?.pedido_id) {
            const lojaId = (pgto.pedidos as any)?.loja_id;
            const numero = (pgto.pedidos as any)?.numero;

            if (lojaId) {
               // Buscar as contas financeiras apropriadas
               const { data: contasInfo } = await supabase.from('contas').select('id, codigo').eq('loja_id', lojaId);
               const contaEfi = contasInfo?.find(c => c.codigo === '1.1.02')?.id;
               const contaReceita = contasInfo?.find(c => c.codigo === '3.1.01')?.id;

               // Lançamento Contábil no Ledger de Dupla Entrada
               if (contaEfi && contaReceita) {
                 await supabase.from('lancamentos_financeiros').insert({
                   loja_id: lojaId,
                   historico: `Recebimento Pix pedido #${numero}`,
                   valor: pago,
                   conta_debitada: contaEfi,
                   conta_creditada: contaReceita,
                   referencia_tipo: 'PAGAMENTO',
                   referencia_id: pagoRow.pedido_id
                 });
               }
            }

            // 3. SOMENTE AGORA ATUALIZA STATUS DO PEDIDO (DEPOIS DA CONFIRMAÇÃO E LEDGER)
            await supabase
              .from('pedidos')
              .update({ status: 'ACEITO' })
              .eq('id', pagoRow.pedido_id)
              .eq('status', 'NOVO');
              
            reqLogger.info('Pagamento PIX confirmado e ledger atualizado', { txid: pix.txid, pedido_id: pagoRow.pedido_id });
          }
        } else {
           reqLogger.warn(`Webhook Pix: pago (${pago}) < total (${totalPedido}) para txid ${pix.txid}; não confirma.`, { txid: pix.txid, pago, totalPedido });
        }
      }
    }
    return Response.json({ ok: true });
  } catch (e) {
    reqLogger.error('Erro no processamento do webhook Pix', e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
});
