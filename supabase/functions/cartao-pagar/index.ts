// MiseOn — Edge Function: pagamento com CARTÃO DE CRÉDITO via Efí Bank
// Porte do EfiCardService.create_one_step_charge do MySuperStore
// (backend/apps/payments/services.py)
//
// O cartão é tokenizado NO NAVEGADOR pela lib oficial `payment-token-efi`
// (PCI: o número do cartão nunca chega aqui — só o payment_token).
//
// Secrets:
//   EFI_COBRANCAS_CLIENT_ID/EFI_COBRANCAS_CLIENT_SECRET
//   ou EFI_CLIENT_ID/EFI_CLIENT_SECRET
//   + EFI_SANDBOX
// (API de Cobranças usa OAuth Basic — não exige certificado mTLS como o Pix)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const EFI_COB_URL = Deno.env.get('EFI_SANDBOX') === 'true'
  ? 'https://cobrancas-h.api.efipay.com.br'
  : 'https://cobrancas.api.efipay.com.br';

// CORS: sem isto o navegador bloqueia a chamada do checkout antes de chegar na Efí.
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

async function getToken(clientId: string, clientSecret: string): Promise<string> {
  const auth = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(`${EFI_COB_URL}/v1/authorize`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials' }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Efí OAuth (cobranças) falhou: ${JSON.stringify(data)}`);
  return data.access_token;
}

import { z } from 'npm:zod';
import { withAuthAndValidation } from '../_shared/validate-middleware.ts';
import { logger } from '../_shared/logger.ts';

const cartaoPagarSchema = z.object({
  pedido_id: z.string().uuid(),
  payment_token: z.string(),
  installments: z.number().int().min(1).optional().default(1),
  customer: z.object({
    name: z.string(),
    cpf: z.string(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    birth: z.string().optional() // YYYY-MM-DD
  })
});

const handler = async (req: Request, ctx: { user: any, supabase: any }, body: z.infer<typeof cartaoPagarSchema>) => {
  const reqLogger = logger.withContext({ req_id: crypto.randomUUID(), tenant_id: ctx.user?.id });
  try {
    const { pedido_id, payment_token, installments, customer } = body;

    // Utilize o client injetado pelo withAuth que já está autenticado,
    // mas se precisarmos de bypass de RLS para mutação (como estava no código original), 
    // podemos usar a role key, mas a requisição já foi autenticada.
    // Para manter a lógica exata de ler e escrever via service_role, criamos o cliente admin:
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: pedido } = await supabaseAdmin
      .from('pedidos')
      .select('id, numero, valor_total, cliente_id, cliente_user_id, loja_id, telefone_contato, cep, logradouro, numero_endereco, complemento, bairro, cidade, uf, lojas(efi_payee_code, antecipacao_cartao), itens_pedido(nome_produto, preco_unitario, quantidade)')
      .eq('id', pedido_id)
      .single();
    if (!pedido) return json({ error: 'pedido não encontrado' }, { status: 404 });

    // Validação de Autorização / Ownership do pedido:
    if (ctx.user && ctx.user.role !== 'service_role' && ctx.user.role !== 'anon') {
      // `cliente_user_id` (FK para auth.users), nao `cliente_id` (id da linha
      // em `clientes`). Comparar com cliente_id nunca casava, entao TODO
      // cliente logado tomava 403 e nao conseguia pagar no cartao.
      const isClienteDono = !!pedido.cliente_user_id && pedido.cliente_user_id === ctx.user.id;
      if (!isClienteDono) {
        const { data: vinculo } = await supabaseAdmin
          .from('usuarios_loja')
          .select('papel')
          .eq('user_id', ctx.user.id)
          .eq('loja_id', pedido.loja_id)
          .maybeSingle();
        if (!vinculo) {
          return json({ error: 'Acesso não autorizado para este pedido' }, { status: 403 });
        }
      }
    }

    const { data: totalReal, error: erroRecalc } = await supabaseAdmin.rpc('fn_recalcular_pedido', { p_pedido_id: pedido_id });
    if (erroRecalc) return json({ error: 'Falha ao validar o valor do pedido', detail: String((erroRecalc as any)?.message ?? erroRecalc) }, { status: 500 });
    const valorCobrancaCentavos = Math.round(Number(totalReal) * 100);
    if (!(valorCobrancaCentavos > 0)) return json({ error: 'Valor do pedido inválido para cobrança.' }, { status: 400 });


    const querAntecipado = !!(pedido as any).lojas?.antecipacao_cartao;
    const antecipadoDisponivel = !!(Deno.env.get('EFI_ANTECIPADO_CLIENT_ID') && Deno.env.get('EFI_ANTECIPADO_CLIENT_SECRET'));
    const usarAntecipado = querAntecipado && antecipadoDisponivel;

    const token = usarAntecipado
      ? await getToken(Deno.env.get('EFI_ANTECIPADO_CLIENT_ID')!.trim(), Deno.env.get('EFI_ANTECIPADO_CLIENT_SECRET')!.trim())
      : await getToken(
          envFirst('EFI_COBRANCAS_CLIENT_ID', 'EFI_CLIENT_ID'),
          envFirst('EFI_COBRANCAS_CLIENT_SECRET', 'EFI_CLIENT_SECRET'),
        );

    const payeeCode = (pedido as any).lojas?.efi_payee_code?.trim();
    const payeePlataforma = (usarAntecipado
      ? Deno.env.get('EFI_ANTECIPADO_PAYEE_CODE')
      : Deno.env.get('EFI_PLATFORM_PAYEE_CODE'))?.trim();
    const usarSplit = !!payeeCode && payeeCode.length > 5 && payeeCode !== payeePlataforma;
    const marketplace = usarSplit
      ? { marketplace: { repasses: [{ payee_code: payeeCode, percentage: 10000 }] } }
      : {};

    const p = pedido as any;
    const billing_address = {
      street: String(p.logradouro || 'Nao informado').slice(0, 255),
      number: String(p.numero_endereco || 'SN').slice(0, 30),
      neighborhood: String(p.bairro || 'Centro').slice(0, 255),
      zipcode: (String(p.cep || '').replace(/\D/g, '') || '01001000').slice(0, 8),
      city: String(p.cidade || 'Sao Paulo').slice(0, 255),
      state: String(p.uf || 'SP').slice(0, 2).toUpperCase(),
      complement: p.complemento ? String(p.complemento).slice(0, 80) : undefined,
    };

    const bodyToSend = {
      items: [{
        name: `Pedido #${pedido.numero}`.slice(0, 255),
        value: valorCobrancaCentavos,
        amount: 1,
        ...marketplace,
      }],
      payment: {
        credit_card: {
          payment_token,
          installments: Number(installments),
          billing_address,
          customer: {
            name: customer.name,
            cpf: String(customer.cpf).replace(/\D/g, ''),
            email: customer.email ?? 'contato@miseon.app.br',
            phone_number: (String(customer.phone ?? '').replace(/\D/g, '') || String(p.telefone_contato ?? '').replace(/\D/g, '')),
            ...(customer.birth ? { birth: String(customer.birth) } : {}),
          },
        },
      },
    };

    const res = await fetch(`${EFI_COB_URL}/v1/charge/one-step`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyToSend),
    });
    const charge = await res.json();
    const data = charge?.data;
    if (!data?.charge_id) {
      reqLogger.error('Efí recusou o cartão', undefined, { response: charge });
      const ed = charge?.error_description;
      let motivo = typeof ed === 'string'
        ? ed
        : (ed?.message ?? charge?.message ?? (Array.isArray(charge?.errors) ? charge.errors[0]?.message : null) ?? 'Cobrança não autorizada');
      if (ed && typeof ed === 'object' && ed.property) motivo = `${motivo} (${ed.property})`;
      return json({ aprovado: false, error: String(motivo), detail: charge }, { status: 200 });
    }

    const aprovado = ['approved', 'paid'].includes(String(data.status));
    await supabaseAdmin
      .from('pagamentos')
      .update({
        gateway_txid: String(data.charge_id),
        status: aprovado ? 'PAGO' : 'PENDENTE',
        data_pagamento: aprovado ? new Date().toISOString() : null,
      })
      .eq('pedido_id', pedido_id)
      .eq('metodo', 'CREDITO');

    if (aprovado) {
      await supabaseAdmin.from('pedidos').update({ status: 'ACEITO' }).eq('id', pedido_id).eq('status', 'NOVO');
    }

    reqLogger.info('Pagamento com cartão processado com sucesso', { charge_id: data.charge_id, aprovado });

    return json({
      charge_id: data.charge_id,
      status: data.status,
      installments: Number(installments),
      total: data.total,
      aprovado,
      modalidade: usarAntecipado ? 'antecipado' : 'padrao',
    });
  } catch (e) {
    reqLogger.error('Erro na função cartao-pagar', e);
    return json({ error: String(e) }, { status: 500 });
  }
};

import { withAuth } from '../_shared/jwt-middleware.ts';

const protectedHandler = withAuth((req, ctx) => withAuthAndValidation(cartaoPagarSchema, handler)(req, ctx));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  return await protectedHandler(req);
});
