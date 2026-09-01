// MiseOn — Edge Function: Assinatura SaaS Efí Bank
// Processa o pagamento da loja para a plataforma MiseOn.
// Usa a API de Cobranças da Efí (OAuth Basic).
//
// Dois fluxos bem diferentes por trás do mesmo botão "Assinar":
//   - mensal: assinatura recorrente de verdade (plan + subscription da Efí),
//     cobra R$169,90 todo mês até cancelar.
//   - anual: cobrança ÚNICA de R$1.798,80 parcelada no cartão (1x/3x/6x/8x/12x
//     via /v1/charge/one-step com installments) — não é recorrência, é o
//     valor fechado do ano à vista parcelado, igual à promessa da tela.
// Antes disto o "anual" também virava assinatura mensal recorrente (bug: o
// parcelamento anunciado na tela nunca existiu de fato). O valor de "sem
// juros" nas parcelas depende da configuração de taxa de juros da CONTA Efí
// (has_interest) — isso não é controlado por código, é configuração do
// painel/contrato Efí; se a conta tiver juros habilitados acima de certo
// número de parcelas, o valor total pode variar do anunciado.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { checkRateLimit, ipDaRequisicao } from '../_shared/rate-limit.ts';

const EFI_COB_URL = Deno.env.get('EFI_SANDBOX') === 'true'
  ? 'https://cobrancas-h.api.efipay.com.br'
  : 'https://cobrancas.api.efipay.com.br';

const PLAN_NAME = 'MiseOn Profissional';
const VALOR_MENSAL = 16990;      // R$ 169,90 em centavos (assinatura recorrente)
const VALOR_ANUAL_TOTAL = 179880; // R$ 1.798,80 em centavos (cobrança única parcelada)
const PARCELAS_VALIDAS = new Set([1, 3, 6, 8, 12]);

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
  const data = await res.json();
  if (!data.access_token) throw new Error(`Efí OAuth falhou: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function getOrCreatePlan(token: string): Promise<number> {
  const res = await fetch(`${EFI_COB_URL}/v1/plans?limit=100&offset=0`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  const plans = data.data || [];

  const existingPlan = plans.find((p: any) => p.name === PLAN_NAME && p.value === VALOR_MENSAL);
  if (existingPlan) return existingPlan.plan_id;

  const createRes = await fetch(`${EFI_COB_URL}/v1/plan`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: PLAN_NAME, repeats: null, interval: 1 }),
  });
  const createData = await createRes.json();
  if (!createData?.data?.plan_id) throw new Error(`Falha ao criar plano Efí: ${JSON.stringify(createData)}`);
  return createData.data.plan_id;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  // Freio de vazao. A funcao ja exige autorizacao propria; o limite existe
  // para que tentativa em massa contra ela — ou um token vazado — nao vire
  // custo nem volume ilimitado. Em falha de banco o limitador DEIXA PASSAR
  // (ver _shared/rate-limit.ts), entao nao vira um novo ponto unico de queda.
  // 20/min por IP: assinatura, uma vez por lojista.
  const rl = await checkRateLimit(`saas-assinar:${ipDaRequisicao(req)}`, {
    windowMs: 60_000,
    maxRequests: 20,
  });
  if (!rl.allowed) return json({ error: 'Muitas requisicoes. Tente em instantes.' }, { status: 429 });
  try {
    const { loja_id, ciclo, parcelas, payment_token, customer } = await req.json();
    if (!loja_id || !payment_token || !customer?.name || !customer?.cpf) {
      return json({ error: 'Faltam dados obrigatórios' }, { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ── AUTORIZAÇÃO ────────────────────────────────────────────────────────
    // Esta função ativa a assinatura da loja e emite fatura + NFS-e. Aceitava
    // `loja_id` do corpo sem verificar quem chamava — qualquer um ativava (ou
    // mexia na cobrança de) uma loja alheia. Só admin da própria loja passa.
    const authHeader = req.headers.get('Authorization') ?? '';
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
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

    // Endereço do tomador (cadastro do onboarding) — a Efí exige endereço de
    // cobrança no fluxo de cobrança única (one-step); a assinatura recorrente
    // não exige, mas usamos o mesmo dado pra manter a fatura consistente.
    const { data: dadosCadastro } = await supabase
      .from('assinatura_dados_cadastro')
      .select('*')
      .eq('loja_id', loja_id)
      .maybeSingle();

    const token = await getToken();
    const ehAnual = ciclo === 'anual';
    let subscriptionId: string | number | null = null;
    let chargeIdReal: string | null = null;
    let statusPago: string;
    let valorCobrado: number; // em reais
    let parcelasCobradas = 1;

    if (ehAnual) {
      if (!dadosCadastro?.logradouro || !dadosCadastro?.cidade || !dadosCadastro?.uf || !dadosCadastro?.cep) {
        return json({ error: 'Complete seu endereço no cadastro antes de assinar o plano anual.' }, { status: 422 });
      }
      const nParcelas = PARCELAS_VALIDAS.has(Number(parcelas)) ? Number(parcelas) : 12;

      const chargeRes = await fetch(`${EFI_COB_URL}/v1/charge/one-step`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ name: 'Assinatura MiseOn SaaS Pro — Plano Anual', value: VALOR_ANUAL_TOTAL, amount: 1 }],
          payment: {
            credit_card: {
              payment_token,
              installments: nParcelas,
              customer: {
                name: customer.name,
                cpf: String(customer.cpf).replace(/\D/g, ''),
                email: dadosCadastro.email_cobranca || undefined,
                phone_number: String(customer.phone ?? '').replace(/\D/g, '') || undefined,
                address: {
                  street: dadosCadastro.logradouro,
                  number: dadosCadastro.numero || 'S/N',
                  neighborhood: dadosCadastro.bairro || 'Centro',
                  zipcode: String(dadosCadastro.cep).replace(/\D/g, ''),
                  city: dadosCadastro.cidade,
                  complement: dadosCadastro.complemento || undefined,
                  state: dadosCadastro.uf,
                },
              },
              billing_address: {
                street: dadosCadastro.logradouro,
                number: dadosCadastro.numero || 'S/N',
                neighborhood: dadosCadastro.bairro || 'Centro',
                zipcode: String(dadosCadastro.cep).replace(/\D/g, ''),
                city: dadosCadastro.cidade,
                complement: dadosCadastro.complemento || undefined,
                state: dadosCadastro.uf,
              },
            },
          },
        }),
      });
      const chargeData = await chargeRes.json();
      const status = String(chargeData?.data?.status ?? '').toLowerCase();
      if (chargeData.code !== 200 || !['paid', 'approved', 'liquidado'].includes(status)) {
        return json({ error: chargeData?.message ?? chargeData?.error_description ?? 'Cartão recusado', detail: chargeData }, { status: 402 });
      }
      chargeIdReal = String(chargeData.data.charge_id);
      statusPago = status;
      valorCobrado = VALOR_ANUAL_TOTAL / 100;
      parcelasCobradas = nParcelas;
    } else {
      // Mensal: assinatura recorrente de verdade via plan/subscription.
      const planId = await getOrCreatePlan(token);
      const subRes = await fetch(`${EFI_COB_URL}/v1/plan/${planId}/subscription`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ name: 'Mensalidade MiseOn Profissional', value: VALOR_MENSAL, amount: 1 }] }),
      });
      const subData = await subRes.json();
      if (!subData?.data?.subscription_id) throw new Error(`Falha ao criar subscription: ${JSON.stringify(subData)}`);
      subscriptionId = subData.data.subscription_id;

      const payRes = await fetch(`${EFI_COB_URL}/v1/subscription/${subscriptionId}/pay`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment: {
            credit_card: {
              payment_token,
              customer: {
                name: customer.name,
                cpf: String(customer.cpf).replace(/\D/g, ''),
                phone_number: String(customer.phone ?? '').replace(/\D/g, '') || undefined,
              }
            }
          }
        }),
      });
      const payData = await payRes.json();
      const status = String(payData?.data?.status ?? '');
      if (payData.code !== 200 || !['active', 'paid'].includes(status)) {
        return json({ error: payData?.message ?? 'Cartão recusado', detail: payData }, { status: 402 });
      }
      statusPago = status;
      valorCobrado = VALOR_MENSAL / 100;
      chargeIdReal = `sub-${subscriptionId}-${Date.now()}`;
    }

    // Atualiza o banco de dados da loja.
    // Renovação ESTENDE o vencimento a partir da data atual quando ela ainda
    // está no futuro — antes contava sempre a partir de hoje, então quem
    // renovava adiantado perdia os dias que ainda tinha pagos.
    const { data: lojaAtual } = await supabase
      .from('lojas').select('status_assinatura, trial_termina_em').eq('id', loja_id).maybeSingle();
    // Loja vitalícia não vira 'ativa' ao pagar: seria trocar acesso permanente
    // por acesso com data de validade.
    const vitalicia = String(lojaAtual?.status_assinatura ?? '').toLowerCase() === 'vitalicio';
    const vencimentoVigente = lojaAtual?.trial_termina_em
      ? new Date(lojaAtual.trial_termina_em)
      : null;
    const agora = new Date();
    const base = vencimentoVigente && vencimentoVigente > agora ? vencimentoVigente : agora;
    const novoVencimento = new Date(base);
    novoVencimento.setMonth(novoVencimento.getMonth() + (ehAnual ? 12 : 1));

    const { error: updErr } = await supabase.from('lojas').update({
      ...(vitalicia ? {} : { status_assinatura: 'ativa' }),
      trial_termina_em: novoVencimento.toISOString(),
    }).eq('id', loja_id);
    if (updErr) {
      console.error('Falha ao atualizar assinatura da loja', updErr);
      return json({ error: 'Pagamento aprovado, mas falha ao ativar a loja. Contate o suporte.', detail: updErr }, { status: 500 });
    }

    // Gera a fatura da assinatura (valor real cobrado) e dispara a NFS-e.
    const { data: fatura, error: eFatura } = await supabase.from('faturas_assinatura').insert({
      loja_id,
      ciclo: ehAnual ? 'anual' : 'mensal',
      parcelas: parcelasCobradas,
      forma_pagamento: 'cartao',
      valor_cobrado: valorCobrado,
      efi_subscription_id: subscriptionId != null ? String(subscriptionId) : null,
      efi_charge_id: chargeIdReal,
      status_cobranca: 'pago',
      data_pagamento: new Date().toISOString(),
      tomador_cpf_cnpj: dadosCadastro?.cpf_cnpj ?? null,
      tomador_razao_social: dadosCadastro?.razao_social_ou_nome ?? null,
      tomador_logradouro: dadosCadastro?.logradouro ?? null,
      tomador_numero: dadosCadastro?.numero ?? null,
      tomador_complemento: dadosCadastro?.complemento ?? null,
      tomador_bairro: dadosCadastro?.bairro ?? null,
      tomador_cidade: dadosCadastro?.cidade ?? null,
      tomador_uf: dadosCadastro?.uf ?? null,
      tomador_cep: dadosCadastro?.cep ?? null,
      tomador_email: dadosCadastro?.email_cobranca ?? null,
    }).select('id').single();

    if (!eFatura && fatura?.id) {
      supabase.functions.invoke('fiscal-emitir-nfse', { body: { fatura_id: fatura.id } }).catch((e) => {
        console.error('Falha ao acionar emissão de NFS-e (não bloqueia o pagamento):', e);
      });
    } else if (eFatura) {
      console.error('Falha ao registrar fatura da assinatura:', eFatura);
    }

    return json({
      success: true,
      subscription_id: subscriptionId,
      charge_id: chargeIdReal,
      status: statusPago,
      parcelas: parcelasCobradas,
      vencimento: novoVencimento.toISOString(),
    });

  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, { status: 500 });
  }
});
