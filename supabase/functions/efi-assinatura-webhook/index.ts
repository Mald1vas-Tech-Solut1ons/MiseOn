// MiseOn — Edge Function: webhook de renovação recorrente da assinatura (Efí Cobranças)
//
// IMPORTANTE — validar no sandbox antes de ir para produção:
// A API de Cobranças da Efí notifica mudanças de cobrança/assinatura por um
// mecanismo diferente do Pix (que usa HMAC + payload direto, ver
// pix-webhook/index.ts). Aqui a Efí faz POST com { notification: "<token>" }
// nesta URL (configurada no painel/API da Efí), e o servidor busca o detalhe
// via GET /v1/notification/:token. O formato exato da resposta (nomes de
// campo do item de assinatura, status de "pago") precisa ser conferido contra
// o sandbox assim que a conta Efí tiver assinaturas recorrentes de teste
// rodando — o código abaixo foi escrito de forma defensiva (aceita algumas
// variações de nome de campo) mas não foi validado contra uma notificação
// real ainda.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { checkRateLimit, ipDaRequisicao } from '../_shared/rate-limit.ts';

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
  const data = await res.json();
  if (!data.access_token) throw new Error(`Efí OAuth falhou: ${JSON.stringify(data)}`);
  return data.access_token;
}

const STATUS_PAGO = new Set(['paid', 'pago', 'liquidado', 'active']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  // Freio de vazao. 120/min: quem chama e a Efi, avisando mudanca de
  // assinatura — volume baixo por natureza, entao o teto e contra abuso de
  // um endpoint que e publico por necessidade.
  //
  // 429 e nao 200 de proposito: a Efi reentrega a notificacao, e a confirmacao
  // de pagamento nao depende so deste webhook (ha tambem a consulta ativa a
  // Efi), entao atrasar um aviso nao perde dinheiro.
  const rl = await checkRateLimit(`efi-assinatura:${ipDaRequisicao(req)}`, {
    windowMs: 60_000,
    maxRequests: 120,
  });
  if (!rl.allowed) return json({ error: 'Muitas requisicoes.' }, { status: 429 });

  try {
    const body = await req.json().catch(() => ({}));
    const notificationToken: string | undefined = body?.notification ?? body?.token;
    if (!notificationToken) return json({ ok: true }); // ping/configuração, sem token a processar

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const token = await getToken();
    const res = await fetch(`${EFI_COB_URL}/v1/notification/${notificationToken}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const notif = await res.json().catch(() => ({}));
    const itens: any[] = Array.isArray(notif?.data) ? notif.data : (notif?.data ? [notif.data] : []);

    // Nada se perde: cada item recebido vira uma linha em
    // `assinatura_eventos_efi` com o payload cru, reconhecido ou não. Antes,
    // um formato inesperado caía num `continue` silencioso — a Efí registrava
    // o pagamento e do nosso lado não sobrava nem a fatura nem a NFS-e do
    // assinante, sem nenhum rastro de que a notificação chegou.
    const registrarEvento = async (
      item: any,
      situacao: 'reconhecido' | 'nao_reconhecido' | 'ignorado' | 'duplicado',
      extra: { subscription_id?: string | null; charge_id?: string | null; status_lido?: string | null; fatura_id?: string | null; observacao?: string } = {},
    ) => {
      try {
        const { error } = await supabase.from('assinatura_eventos_efi').insert({
          notification_token: notificationToken,
          payload_bruto: item ?? {},
          situacao,
          subscription_id: extra.subscription_id ?? null,
          charge_id: extra.charge_id ?? null,
          status_lido: extra.status_lido ?? null,
          fatura_id: extra.fatura_id ?? null,
          observacao: extra.observacao ?? null,
        });
        if (error) console.error('Falha ao registrar evento de assinatura:', error);
      } catch (e) {
        console.error('Falha ao registrar evento de assinatura:', e);
      }
    };

    if (!itens.length) {
      await registrarEvento(notif, 'nao_reconhecido',
        { observacao: 'Notificação sem `data` interpretável — conferir formato contra o painel da Efí.' });
    }

    for (const item of itens) {
      // Nomes de campo ainda não confirmados contra tráfego real: aceitamos as
      // variações conhecidas e, se nenhuma casar, o payload fica guardado.
      const subscriptionId = item?.subscription_id ?? item?.subscription?.id ?? item?.identifiers?.subscription_id
        ?? item?.subscription?.subscription_id ?? item?.data?.subscription_id;
      const chargeId = String(item?.charge_id ?? item?.identifiers?.charge_id ?? item?.id ?? `${subscriptionId}-${item?.created_at ?? Date.now()}`);
      const status = String(item?.status ?? item?.status?.current ?? '').toLowerCase();

      if (!subscriptionId) {
        await registrarEvento(item, 'nao_reconhecido',
          { charge_id: chargeId, status_lido: status,
            observacao: 'subscription_id não encontrado no payload — fatura NÃO gerada, precisa de conferência manual.' });
        continue;
      }
      if (!STATUS_PAGO.has(status)) {
        await registrarEvento(item, 'ignorado',
          { subscription_id: String(subscriptionId), charge_id: chargeId, status_lido: status,
            observacao: 'Status não é de pagamento concluído.' });
        continue;
      }

      // Idempotência: se já registramos esta cobrança, não duplica.
      const { data: jaExiste } = await supabase
        .from('faturas_assinatura').select('id').eq('efi_charge_id', chargeId).maybeSingle();
      if (jaExiste) {
        await registrarEvento(item, 'duplicado',
          { subscription_id: String(subscriptionId), charge_id: chargeId, status_lido: status,
            fatura_id: jaExiste.id, observacao: 'Cobranca ja registrada anteriormente.' });
        continue;
      }

      // Encontra a loja pela última fatura desta subscription (criada em
      // saas-assinar na cobrança inicial, ou por uma renovação anterior).
      const { data: faturaAnterior } = await supabase
        .from('faturas_assinatura')
        .select('loja_id, ciclo, tomador_cpf_cnpj, tomador_razao_social, tomador_logradouro, tomador_numero, tomador_complemento, tomador_bairro, tomador_cidade, tomador_uf, tomador_cep, tomador_email')
        .eq('efi_subscription_id', String(subscriptionId))
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!faturaAnterior?.loja_id) {
        console.error(`Webhook assinatura: subscription ${subscriptionId} sem fatura anterior vinculada; ignorando.`);
        await registrarEvento(item, 'nao_reconhecido',
          { subscription_id: String(subscriptionId), charge_id: chargeId, status_lido: status,
            observacao: 'Pagamento reconhecido, mas nenhuma fatura anterior aponta para esta subscription — nao da para saber a loja. Exige vinculo manual.' });
        continue;
      }

      const valorCentavos = Number(item?.value ?? item?.total_value ?? 0);
      const novoVencimento = new Date();
      novoVencimento.setMonth(novoVencimento.getMonth() + 1);

      await supabase.from('lojas').update({
        status_assinatura: 'ativa',
        trial_termina_em: novoVencimento.toISOString(),
      }).eq('id', faturaAnterior.loja_id);

      const { data: fatura, error: eFatura } = await supabase.from('faturas_assinatura').insert({
        loja_id: faturaAnterior.loja_id,
        ciclo: faturaAnterior.ciclo,
        parcelas: 1,
        forma_pagamento: 'cartao',
        valor_cobrado: valorCentavos > 0 ? valorCentavos / 100 : null,
        efi_subscription_id: String(subscriptionId),
        efi_charge_id: chargeId,
        status_cobranca: 'pago',
        data_pagamento: new Date().toISOString(),
        tomador_cpf_cnpj: faturaAnterior.tomador_cpf_cnpj,
        tomador_razao_social: faturaAnterior.tomador_razao_social,
        tomador_logradouro: faturaAnterior.tomador_logradouro,
        tomador_numero: faturaAnterior.tomador_numero,
        tomador_complemento: faturaAnterior.tomador_complemento,
        tomador_bairro: faturaAnterior.tomador_bairro,
        tomador_cidade: faturaAnterior.tomador_cidade,
        tomador_uf: faturaAnterior.tomador_uf,
        tomador_cep: faturaAnterior.tomador_cep,
        tomador_email: faturaAnterior.tomador_email,
      }).select('id').single();

      if (!eFatura && fatura?.id) {
        await registrarEvento(item, 'reconhecido',
          { subscription_id: String(subscriptionId), charge_id: chargeId, status_lido: status,
            fatura_id: fatura.id, observacao: 'Renovacao registrada e NFS-e acionada.' });
        await supabase.functions.invoke('fiscal-emitir-nfse', { body: { fatura_id: fatura.id } }).catch((e) => {
          console.error('Falha ao acionar emissão de NFS-e na renovação (não bloqueia):', e);
        });
      } else if (eFatura) {
        console.error('Falha ao registrar fatura de renovação:', eFatura);
        await registrarEvento(item, 'nao_reconhecido',
          { subscription_id: String(subscriptionId), charge_id: chargeId, status_lido: status,
            observacao: 'Pagamento reconhecido mas o INSERT da fatura falhou: ' + String(eFatura?.message ?? eFatura) });
      }
    }

    return json({ ok: true });
  } catch (e) {
    console.error('Erro no webhook de renovação da assinatura:', e);
    return json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
});
