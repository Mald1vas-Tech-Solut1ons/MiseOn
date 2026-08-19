/**
 * MiseOn — Teste de Estresse com K6
 *
 * Objetivo: Validar o SLA de produção sob carga de pico realista.
 *
 * ATENCAO — este script esta OBSOLETO desde a blindagem de 19/08/2026 e vai
 * dar falso negativo se rodado como esta:
 *
 *   - Cenario 1 bate em `pix-webhook` sem assinatura HMAC. A funcao valida
 *     X-Efi-Signature e responde 401 em tudo: mede rejeicao, nao capacidade.
 *   - Cenario 2 cria pedido como ANONIMO. A policy `cria_pedido_cliente_ou_staff`
 *     agora exige cliente logado (ou staff da loja) — tudo volta 403.
 *
 * Enquanto ninguem reescrever com um JWT de cliente real e assinatura valida,
 * use `node scripts/qa/carga-pedidos.mjs <concorrencia> <total>`, que ja roda
 * autenticado e verifica o que realmente importa: numero de pedido duplicado.
 *
 * Medido em 19/08/2026 (200 pedidos, 25 em paralelo, contra producao):
 *   leitura de cardapio  p50 322ms  p95 763ms  p99 951ms  0 erros
 *   criacao de pedido    p50 324ms  p95 696ms  p99 712ms  0 erros
 *   numeros de pedido    200 gerados, 200 distintos, 0 duplicados
 *
 * Cenários originais:
 *  1. Webhook Pix — 200 req/s por 30s → latência p95 < 800ms, erros < 0.1%
 *  2. Criação de pedidos — 50 req/s por 60s → números únicos, sem race condition
 *  3. Finalização de pedidos — 30 req/s → sem duplicata no ledger
 *
 * Como executar:
 *   k6 run k6/load-test.js \
 *     -e SUPABASE_URL=https://xxx.supabase.co \
 *     -e ANON_KEY=eyJ... \
 *     -e LOJA_ID=uuid-aqui
 *
 * Instalar: https://k6.io/docs/get-started/installation/
 */

// @ts-nocheck — K6 usa runtime próprio (ES2015+), não tem tipos TypeScript nativos
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';

// ─── Métricas customizadas ────────────────────────────────────────────────────
const latenciaWebhookPix    = new Trend('latencia_webhook_pix', true);
const latenciaCriacaoPedido = new Trend('latencia_criacao_pedido', true);
const errosTotal            = new Counter('erros_total');
const taxaErros             = new Rate('taxa_erros');

// ─── Configuração de Cenários ─────────────────────────────────────────────────
export const options = {
  scenarios: {
    // Cenário 1: Pico de Webhooks Pix (ex.: virada do minuto, muitos clientes pagando)
    webhook_pix_stress: {
      executor: 'constant-arrival-rate',
      rate: 200,           // 200 req/s
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 50,
      maxVUs: 250,
      exec: 'testeWebhookPix',
      tags: { cenario: 'webhook_pix' },
    },

    // Cenário 2: Criação de pedidos concorrentes (validar anti-race condition)
    criacao_pedidos_concorrente: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: '60s',
      preAllocatedVUs: 20,
      maxVUs: 100,
      startTime: '35s',    // Começa após o cenário de Pix
      exec: 'testeCriacaoPedido',
      tags: { cenario: 'criacao_pedido' },
    },
  },

  // ─── Thresholds (SLAs de aceitação) ────────────────────────────────────────
  thresholds: {
    // Webhook Pix: 95% das requisições abaixo de 800ms
    'latencia_webhook_pix{cenario:webhook_pix}': ['p(95)<800'],
    // Pedidos: 99% abaixo de 1200ms
    'latencia_criacao_pedido{cenario:criacao_pedido}': ['p(99)<1200'],
    // Taxa de erros global abaixo de 0.1%
    'taxa_erros': ['rate<0.001'],
    // Erros absolutos — alerta se passar de 5 durante o teste
    'erros_total': ['count<5'],
    // Checks do K6: 99.9% de sucesso
    'checks': ['rate>0.999'],
  },
};

// ─── Variáveis de Ambiente ────────────────────────────────────────────────────
const SUPABASE_URL = __ENV.SUPABASE_URL;
const ANON_KEY     = __ENV.ANON_KEY;
const LOJA_ID      = __ENV.LOJA_ID ?? '00000000-0000-0000-0000-000000000000';

const headers = {
  'Content-Type': 'application/json',
  'apikey': ANON_KEY,
  'Authorization': `Bearer ${ANON_KEY}`,
};

// ─── Payload válido de Webhook Pix (mock da EFI) ─────────────────────────────
function pixPayload() {
  const txid = `txtest${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  return JSON.stringify({
    pix: [{
      txid,
      valor: '50.00',
      endToEndId: `E${Date.now()}`,
      pagador: { cpf: '00000000000', nome: 'Cliente Teste K6' },
    }],
  });
}

// ─── Cenário 1: Webhook Pix ───────────────────────────────────────────────────
export function testeWebhookPix() {
  const inicio = Date.now();

  const res = http.post(
    `${SUPABASE_URL}/functions/v1/pix-webhook`,
    pixPayload(),
    { headers, tags: { name: 'pix_webhook' } }
  );

  const ms = Date.now() - inicio;
  latenciaWebhookPix.add(ms);

  const ok = check(res, {
    'Pix webhook: status 2xx':    r => r.status >= 200 && r.status < 300,
    'Pix webhook: latência < 800ms': () => ms < 800,
  });

  if (!ok) {
    errosTotal.add(1);
    taxaErros.add(1);
    console.error(`[ERRO] Webhook Pix — status: ${res.status} | body: ${res.body?.slice(0, 200)}`);
  } else {
    taxaErros.add(0);
  }

  sleep(0.005); // Pequena pausa para evitar thundering herd local
}

// ─── Cenário 2: Criação de Pedidos (anti-race condition no número) ────────────
export function testeCriacaoPedido() {
  const inicio = Date.now();

  const res = http.post(
    `${SUPABASE_URL}/rest/v1/pedidos`,
    JSON.stringify({
      loja_id: LOJA_ID,
      tipo_pedido: 'BALCAO',
      status: 'NOVO',
      identificador_cliente: `K6-${__VU}-${__ITER}`,
      subtotal: 25.00,
      taxa_entrega: 0,
      desconto: 0,
      valor_total: 25.00,
      origem: 'balcao',
    }),
    {
      headers: { ...headers, Prefer: 'return=representation' },
      tags: { name: 'criacao_pedido' },
    }
  );

  const ms = Date.now() - inicio;
  latenciaCriacaoPedido.add(ms);

  const ok = check(res, {
    'Pedido: criado com sucesso (201)': r => r.status === 201,
    'Pedido: número gerado':            r => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body) ? body[0]?.numero > 0 : body?.numero > 0;
      } catch {
        return false;
      }
    },
    'Pedido: latência < 1200ms': () => ms < 1200,
  });

  if (!ok) {
    errosTotal.add(1);
    taxaErros.add(1);
    console.error(`[ERRO] Criação pedido — status: ${res.status} | body: ${res.body?.slice(0, 200)}`);
  } else {
    taxaErros.add(0);
  }

  sleep(0.02);
}
