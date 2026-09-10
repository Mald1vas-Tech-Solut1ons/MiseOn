// MiseOn — Edge Function: pagamento com CARTÃO DE CRÉDITO via Efí Bank
// Porte do EfiCardService.create_one_step_charge do MySuperStore
// (backend/apps/payments/services.py)
//
// O cartão é tokenizado NO NAVEGADOR pela lib oficial `payment-token-efi`
// (PCI: o número do cartão nunca chega aqui — só o payment_token).
//
// Secrets exclusivos do CARTÃO do checkout (nunca Pix e nunca SaaS):
//   EFI_CARTAO_PROD_CLIENT_ID / EFI_CARTAO_PROD_CLIENT_SECRET
//   EFI_CARTAO_HOMOLOG_CLIENT_ID / EFI_CARTAO_HOMOLOG_CLIENT_SECRET
//
// A conta e o ambiente que geram o token no navegador são os mesmos usados
// aqui para cobrar. A seleção de ambiente vem da configuração da plataforma,
// não de uma secret reaproveitada por Pix ou assinatura.
// (API de Cobranças usa OAuth Basic — não exige certificado mTLS como o Pix)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const EFI_COB_HOMOLOG = 'https://cobrancas-h.api.efipay.com.br';
const EFI_COB_PRODUCAO = 'https://cobrancas.api.efipay.com.br';

/**
 * Host da API de Cobrancas (cartao).
 *
 * O BANCO manda. Antes isto era uma const de modulo lida so de uma secret
 * compartilhada de ambiente: bastava ela ficar 'true' para TODA cobranca de cartao
 * sair para a homologacao — onde a conta tem limite operacional simbolico e
 * o banco real nunca ve a transacao. O sintoma e exatamente
 * "o valor da emissao e superior ao limite operacional da conta" numa
 * cobranca de poucos reais, com o Pix (que nao usa esta variavel) recebendo
 * normalmente na mesma conta.
 *
 * `configuracoes_fiscais_plataforma.efi_sandbox` ja e a fonte de verdade do
 * ambiente desde 20260902220212; a env vira fallback para quando a linha de
 * configuracao ainda nao existe.
 */
function ambienteCartao(sandboxDoBanco: boolean | null | undefined): boolean {
  return sandboxDoBanco ?? (Deno.env.get('EFI_CARTAO_SANDBOX') === 'true');
}

function urlCobrancas(sandbox: boolean): string {
  return sandbox ? EFI_COB_HOMOLOG : EFI_COB_PRODUCAO;
}

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

function credenciaisCartao(sandbox: boolean | null | undefined) {
  const homologacao = ambienteCartao(sandbox);
  const ambiente = homologacao ? 'HOMOLOG' : 'PROD';
  return {
    ambiente: homologacao ? 'homologacao' : 'producao',
    clientId: envFirst(`EFI_CARTAO_${ambiente}_CLIENT_ID`),
    clientSecret: envFirst(`EFI_CARTAO_${ambiente}_CLIENT_SECRET`),
  };
}

async function getToken(baseUrl: string, clientId: string, clientSecret: string): Promise<string> {
  const auth = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(`${baseUrl}/v1/authorize`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials' }),
  });
  const raw = await res.text();
  let data: { access_token?: string; error_description?: string; message?: string } | null = null;
  try { data = JSON.parse(raw); } catch { /* A Efí pode devolver texto simples em 401. */ }
  if (!res.ok || !data?.access_token) {
    const detalhe = data?.error_description ?? data?.message ?? raw.slice(0, 300) ?? 'sem detalhe';
    throw new Error(`Efí OAuth (cartão) falhou [HTTP ${res.status}]: ${detalhe}`);
  }
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

const handler = async (_req: Request, ctx: { user: any, supabase: any }, body: z.infer<typeof cartaoPagarSchema>) => {
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


    // Conta que PROCESSA o cartao. Antes vinha so de env; agora o banco e a
    // fonte de verdade e a env fica como fallback, para trocar de conta Efi
    // sem redeploy e sem depender de variavel de build da Vercel.
    const { data: cfgPlataforma } = await supabaseAdmin
      .from('configuracoes_fiscais_plataforma')
      .select('efi_payee_code, efi_payee_code_antecipado, efi_sandbox')
      .eq('id', true)
      .maybeSingle();

    const sandboxCartao = ambienteCartao((cfgPlataforma as any)?.efi_sandbox);
    const efiCobUrl = urlCobrancas(sandboxCartao);
    const credenciaisPadrao = credenciaisCartao(sandboxCartao);

    const payeeAntecipadoCfg = (Deno.env.get('EFI_ANTECIPADO_PAYEE_CODE')
      ?? (cfgPlataforma as any)?.efi_payee_code_antecipado ?? '')?.trim();

    const querAntecipado = !!(pedido as any).lojas?.antecipacao_cartao;
    // Antecipacao exige aplicacao PROPRIA no Efi (produto contratado a parte),
    // nao e um escopo da aplicacao de cobrancas. Sem as tres pecas ela nao roda.
    const antecipadoDisponivel = !!(
      Deno.env.get('EFI_ANTECIPADO_CLIENT_ID')
      && Deno.env.get('EFI_ANTECIPADO_CLIENT_SECRET')
      && payeeAntecipadoCfg
    );
    const usarAntecipado = querAntecipado && antecipadoDisponivel;
    // Antes este caso caia no padrao SEM AVISAR NINGUEM: a loja pedia
    // antecipado, recebia em 31 dias e ninguem registrava a divergencia.
    const avisoModalidade = querAntecipado && !antecipadoDisponivel
      ? 'A loja pediu recebimento antecipado, mas a antecipacao nao esta contratada/configurada na conta da plataforma. A cobranca rodou na modalidade padrao (repasse em ate 31 dias).'
      : null;
    if (avisoModalidade) reqLogger.warn(avisoModalidade, { pedido_id });

    const token = usarAntecipado
      ? await getToken(efiCobUrl, Deno.env.get('EFI_ANTECIPADO_CLIENT_ID')!.trim(), Deno.env.get('EFI_ANTECIPADO_CLIENT_SECRET')!.trim())
      : await getToken(
          efiCobUrl,
          credenciaisPadrao.clientId,
          credenciaisPadrao.clientSecret,
        );

    const payeeCode = (pedido as any).lojas?.efi_payee_code?.trim();

    // NUNCA repassar para a propria conta que processa.
    //
    // O split so faz sentido quando o recebedor e OUTRA conta. Se a loja
    // estiver cadastrada com o mesmo payee_code da plataforma (que e o caso
    // quando o dono da plataforma tambem e o lojista), mandar
    // `marketplace.repasses` de 100% faz a Efi validar o limite operacional
    // do "recebedor" — e recusar a cobranca ANTES de falar com o banco. Foi
    // o que aconteceu em 08/09: cartao recusado com "valor da emissao
    // superior ao limite operacional da conta" numa cobranca de R$ 4,75,
    // enquanto o Pix na mesma conta funcionava.
    //
    // Antes a comparacao era contra UMA origem so (env, com o banco de
    // fallback). Env desatualizada vencia o banco e reabria a auto-transferencia.
    // Agora qualquer payee conhecido da plataforma — env ou banco, padrao ou
    // antecipado — desliga o split.
    // O BANCO manda; a env so entra quando o banco esta vazio.
    //
    // Se a env entrasse SEMPRE, uma secret desatualizada com o payee do
    // LOJISTA faria o sistema achar que aquela conta e da plataforma e
    // desligar o repasse: a cobranca passaria e o dinheiro do lojista ficaria
    // na conta da plataforma, em silencio. Precedencia errada aqui nao
    // quebra pagamento — desvia dinheiro.
    const payeePadraoPlataforma = String(
      (cfgPlataforma as any)?.efi_payee_code ?? Deno.env.get('EFI_PLATFORM_PAYEE_CODE') ?? '',
    ).trim().toLowerCase();
    const payeeAntecipadoPlataforma = String(
      (cfgPlataforma as any)?.efi_payee_code_antecipado ?? Deno.env.get('EFI_ANTECIPADO_PAYEE_CODE') ?? '',
    ).trim().toLowerCase();

    const payeesDaPlataforma = new Set(
      [payeePadraoPlataforma, payeeAntecipadoPlataforma].filter((v) => v.length > 0),
    );

    const usarSplit = !!payeeCode
      && payeeCode.length > 5
      && !payeesDaPlataforma.has(payeeCode.toLowerCase());

    reqLogger.info('Cobranca de cartao montada', {
      context: {
        pedido_id,
        valor_centavos: valorCobrancaCentavos,
        usar_split: usarSplit,
        payee_loja_definido: !!payeeCode,
        payee_e_da_plataforma: !!payeeCode && payeesDaPlataforma.has(payeeCode.toLowerCase()),
        modalidade: usarAntecipado ? 'antecipado' : 'padrao',
        // Sem isto nao da para saber se a cobranca foi para producao ou
        // homologacao — foi o que escondeu a causa da recusa de 08/09.
        host_efi: efiCobUrl,
        ambiente: credenciaisPadrao.ambiente,
        // DOCUMENTO DO PAGADOR, MASCARADO.
        //
        // A recusa 4600222 diz "recebedor e cliente sao a mesma pessoa", mas o
        // log nao dizia QUAL documento chegou aqui — entao nao havia como
        // separar "o formulario mandou o CPF errado" de "o formulario mandou o
        // certo e a Efi recusou por outro motivo". Discutir isso no escuro
        // custou duas rodadas.
        //
        // Mascarado de proposito: os tres primeiros e os dois ultimos digitos
        // bastam para reconhecer de quem e o documento sem guardar dado
        // pessoal completo em log.
        pagador_documento: (() => {
          const d = String(customer?.cpf ?? '').replace(/\D/g, '');
          return d.length >= 5 ? `${d.slice(0, 3)}***${d.slice(-2)} (${d.length} digitos)` : `invalido (${d.length} digitos)`;
        })(),
        pagador_nome_preenchido: Boolean(String(customer?.name ?? '').trim()),
      },
    });
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

    const res = await fetch(`${efiCobUrl}/v1/charge/one-step`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyToSend),
    });
    const charge = await res.json();
    const data = charge?.data;
    if (!data?.charge_id) {
      // A resposta do provedor É o diagnóstico. Vai em `context` (o logger
      // descartava chave fora do contrato — ver _shared/logger.ts).
      reqLogger.error('Efí recusou o cartão', undefined, {
        context: { pedido_id, http_status: res.status, efi: charge },
      });
      const ed = charge?.error_description;
      let motivo = typeof ed === 'string'
        ? ed
        : (ed?.message ?? charge?.message ?? (Array.isArray(charge?.errors) ? charge.errors[0]?.message : null) ?? 'Cobrança não autorizada');
      if (ed && typeof ed === 'object' && ed.property) motivo = `${motivo} (${ed.property})`;

      // Erro de CONTA do recebedor nao e problema do comprador: ele nao tem
      // como resolver "limite operacional da conta" nem falar com o suporte
      // do adquirente, e mostrar isso a ele expoe um problema interno do
      // lojista no meio do checkout. Para o comprador vale a saida pratica;
      // o texto do provedor continua no motivo_tecnico e no log, que e onde
      // o lojista (e eu) precisa dele.
      // Recusa por CONTA (limite operacional, conta nao habilitada) nao e
      // "cartao do cliente recusado": e a loja que nao consegue cobrar. Isso
      // se repete em 100% das tentativas, entao deixar o cartao no ar so
      // produz carrinho abandonado. Marca o bloqueio; a vitrine para de
      // oferecer cartao na hora (lojas_publicas.efi_configurado) e o lojista
      // ve o motivo no painel, com o texto que ele leva para o provedor.
      // ── PAGADOR IGUAL AO RECEBEDOR (Efí 4600222) ──────────────────────
      // Medido em producao 10/09/2026: a Efi respondeu HTTP 500 com
      //   { code: 4600222, error_description:
      //     "Recebedor e cliente não podem ser a mesma pessoa." }
      // porque o CPF do comprador era o do titular da conta que recebe. E uma
      // regra do adquirente, nao um defeito da loja e nem do cartao.
      //
      // POR QUE ISSO PRECISAVA DE CASO PROPRIO: o texto contem a palavra
      // "recebedor", entao caia no teste de problema-de-conta abaixo e
      // produzia DOIS estragos de uma vez.
      //   1. O comprador via "Nao conseguimos processar o cartao agora",
      //      que esconde a unica informacao que resolveria: e o CPF.
      //   2. Pior: disparava fn_bloquear_cartao_online e DESLIGAVA o cartao
      //      da loja inteira. Ou seja, o dono testando o proprio sistema com
      //      o proprio CPF derrubava a venda no cartao para todos os clientes
      //      dele — um autoteste virando incidente de producao.
      const codigoEfi = Number(charge?.code ?? charge?.error_code ?? 0);
      const ehPagadorIgualRecebedor =
        codigoEfi === 4600222 || /mesma pessoa/i.test(String(motivo));

      const ehProblemaDaConta = !ehPagadorIgualRecebedor
        && /limite operacional|recebedor|payee|marketplace|conta do|nao habilitad|não habilitad/i.test(String(motivo));
      if (ehProblemaDaConta) {
        await supabaseAdmin.rpc('fn_bloquear_cartao_online', {
          p_loja_id: pedido.loja_id,
          p_motivo: String(motivo),
        });
        reqLogger.warn('Cartao online bloqueado para a loja: o provedor recusou por motivo de conta', {
          context: { loja_id: pedido.loja_id, motivo: String(motivo) },
        });
      }

      const mensagemCliente = ehPagadorIgualRecebedor
        // Aqui a verdade tecnica AJUDA: quem cai neste caso e quase sempre o
        // proprio dono testando, e a acao que resolve e trocar o CPF. Esconder
        // isso atras de uma frase generica foi o que fez parecer que o cartao
        // do sistema estava quebrado.
        ? 'O CPF informado é o mesmo do titular da conta que recebe o pagamento, e o provedor não autoriza pagamento para si mesmo. Use o CPF e o cartão de outra pessoa — com o cliente real isso não acontece.'
        : ehProblemaDaConta
          ? 'Não conseguimos processar o cartão agora. Você pode pagar com Pix ou escolher outra forma de pagamento.'
          : String(motivo);

      return json({
        aprovado: false,
        error: mensagemCliente,
        motivo_tecnico: String(motivo),
        detail: charge,
      }, { status: 200 });
    }

    const aprovado = ['approved', 'paid'].includes(String(data.status));
    await supabaseAdmin
      .from('pagamentos')
      .update({
        gateway_txid: String(data.charge_id),
        status: aprovado ? 'PAGO' : 'PENDENTE',
        data_pagamento: aprovado ? new Date().toISOString() : null,
        modalidade: usarAntecipado ? 'antecipado' : 'padrao',
        aviso: avisoModalidade,
        split_status: usarSplit ? 'marketplace_repasse' : 'sem_dados_repasse',
      })
      .eq('pedido_id', pedido_id)
      .eq('metodo', 'CREDITO');

    if (aprovado) {
      // Só aqui, com a cobrança aprovada, o pedido deixa de ser carrinho e
      // aparece para o lojista (ver AGUARDANDO_PAGAMENTO, 20260908).
      await supabaseAdmin.from('pedidos').update({ status: 'ACEITO' })
        .eq('id', pedido_id).in('status', ['NOVO', 'AGUARDANDO_PAGAMENTO']);
    }

    reqLogger.info('Pagamento com cartão processado com sucesso', { charge_id: data.charge_id, aprovado });

    return json({
      charge_id: data.charge_id,
      status: data.status,
      installments: Number(installments),
      total: data.total,
      aprovado,
      modalidade: usarAntecipado ? 'antecipado' : 'padrao',
      modalidade_solicitada: querAntecipado ? 'antecipado' : 'padrao',
      aviso: avisoModalidade,
      split_status: usarSplit ? 'marketplace_repasse' : 'sem_dados_repasse',
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
