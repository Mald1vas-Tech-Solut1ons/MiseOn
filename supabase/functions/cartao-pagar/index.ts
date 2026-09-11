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

  // A COBRANCA TEM QUE SAIR NA MESMA CONTA QUE EMITIU O TOKEN.
  //
  // MAPA DAS CONTAS — medido em 11/09/2026 autenticando cada par de credencial
  // e lendo o `key_id` de dentro do proprio access_token (nenhum segredo
  // impresso). Este bloco existe porque o mapa ja foi anotado ao contrario
  // aqui, e a suposicao errada custou dias:
  //
  //   conta PESSOAL (931902)  -> key_id 3108186  -> payee f03566ad…c448
  //   conta PJ      (950009)  -> key_id 3102801  -> payee baf9ef35…1e16
  //
  //   EFI_COBRANCAS_*        = PESSOAL producao
  //   EFI_CARTAO_PROD_*      = PESSOAL producao   (mesma conta, outro par)
  //   EFI_CLIENT_*           = PJ      producao   <- NAO serve para cartao
  //   EFI_PIX_*              = PJ      producao
  //
  // O CARTAO RODA NA CONTA PESSOAL. MEDIDO, NAO SUPOSTO.
  //
  // 11/09/2026, cobranca de R$ 7,00 disparada direto na API com cartao
  // sintetico (nenhum dinheiro se move; o que se mede e ate onde a Efi deixa
  // chegar):
  //
  //   conta PESSOAL (3108186): CPF de terceiro -> 200, chega no emissor
  //                            CPF da pagadora -> 200, chega no emissor
  //   conta PJ      (3102801): CPF da pagadora -> 4600037, "valor da emissao
  //                            e superior ao limite operacional da conta"
  //
  // Ou seja: a PJ esta com limite operacional bloqueado ate para R$ 7,00, e a
  // PESSOAL nao rejeita a pagadora. A instrucao do dono — cartao na conta
  // pessoal, que e a que tem limite liberado pelo banco — e a que funciona.
  // Eu cheguei a mover o cartao para a PJ hoje com base numa inferencia
  // errada; o teste acima desfez isso.
  //
  // A CAUSA DO 4600222 NAO ESTAVA AQUI. Ficou registrada em
  // `_shared/pagador.ts`: era o `phone_number`, que ia com o telefone de
  // contato do pedido — o do dono, que e o cadastrado nesta conta. Trocar de
  // conta nao resolvia nada, e eu tentei duas vezes antes de medir.
  //
  // Producao lista UM par de nomes so, de proposito. Fallback que troca de
  // conta nao degrada, quebra: o token e emitido no navegador com
  // `setAccount(plataforma_pagamento_publico.efi_payee_code)`, e cobrar numa
  // conta diferente da que emitiu devolve "payment_token nao existe" para
  // TODO cliente. Foi o que aconteceu em 09/09/2026, quando uma secret nova
  // entrou na frente de uma lista de precedencia e a cobranca migrou de conta
  // sem uma linha de codigo mudar. Se a secret sumir, e melhor falhar com
  // "Secret ausente" do que cobrar na conta errada — e o guarda de
  // `efi_key_id` la embaixo recusa antes de falar com a Efi se ainda assim
  // divergir.
  //
  // Homologacao mantem o par proprio (EFI_CARTAO_HOMOLOG_*, da PJ).
  const nomesId = homologacao
    ? [`EFI_CARTAO_${ambiente}_CLIENT_ID`]
    : ['EFI_COBRANCAS_CLIENT_ID'];
  const nomesSecret = homologacao
    ? [`EFI_CARTAO_${ambiente}_CLIENT_SECRET`]
    : ['EFI_COBRANCAS_CLIENT_SECRET'];

  return {
    ambiente: homologacao ? 'homologacao' : 'producao',
    clientId: envFirst(...nomesId),
    clientSecret: envFirst(...nomesSecret),
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
import { telefoneDoPagador } from '../_shared/pagador.ts';

// ── DOIS JEITOS DE PAGAR ─────────────────────────────────────────────────────
// 1. `payment_token` — cartão digitado agora no checkout.
// 2. `cartao_salvo_id` — cartão que o cliente já usou antes. O token fica no
//    banco, fechado para o navegador; quem o lê é esta função, com service
//    role. Assim repetir um pedido não exige redigitar número, validade, CVV,
//    nome e CPF — que era o atrito que fazia o segundo pedido não acontecer.
//
// `customer` vira opcional porque, no cartão salvo, nome e CPF do titular já
// estão gravados: pedi-los de novo seria exatamente o que este caminho existe
// para eliminar.
const cartaoPagarSchema = z.object({
  pedido_id: z.string().uuid(),
  payment_token: z.string().optional(),
  cartao_salvo_id: z.string().uuid().optional(),
  // Presente quando o cliente marcou "salvar este cartão". A máscara vem do
  // navegador; o número completo e o CVV não passam por aqui em hipótese
  // nenhuma (ver migração 20260911030000_cartao_salvo).
  salvar_cartao: z.object({
    bandeira: z.string().max(30).optional(),
    ultimos_digitos: z.string().regex(/^\d{4}$/),
    validade_mes: z.number().int().min(1).max(12).optional(),
    validade_ano: z.number().int().min(2000).max(2100).optional(),
    apelido: z.string().max(40).optional(),
  }).optional(),
  installments: z.number().int().min(1).optional().default(1),
  customer: z.object({
    name: z.string(),
    cpf: z.string(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    birth: z.string().optional() // YYYY-MM-DD
  }).optional(),
}).refine(
  (v) => !!v.payment_token || !!v.cartao_salvo_id,
  { message: 'Informe payment_token (cartão novo) ou cartao_salvo_id (cartão já guardado).' },
).refine(
  (v) => !!v.cartao_salvo_id || (!!v.customer?.name && !!v.customer?.cpf),
  { message: 'customer{name,cpf} é obrigatório quando o cartão é digitado agora.' },
);

const handler = async (_req: Request, ctx: { user: any, supabase: any }, body: z.infer<typeof cartaoPagarSchema>) => {
  const reqLogger = logger.withContext({ req_id: crypto.randomUUID(), tenant_id: ctx.user?.id });
  try {
    const { pedido_id, installments, cartao_salvo_id, salvar_cartao } = body;
    // Reatribuídos abaixo quando o pagamento usa um cartão já guardado.
    let payment_token = body.payment_token;
    let customer = body.customer;

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
      .select('id, numero, valor_total, cliente_id, cliente_user_id, loja_id, telefone_contato, cep, logradouro, numero_endereco, complemento, bairro, cidade, uf, lojas(efi_payee_code, antecipacao_cartao), clientes(email), itens_pedido(nome_produto, preco_unitario, quantidade)')
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

    // ── CARTÃO JÁ GUARDADO ─────────────────────────────────────────────────
    //
    // O token reutilizável COBRA o cartão. Por isso ele nunca é servido ao
    // navegador (a vitrine lê a view `meus_cartoes`, que não tem a coluna) e a
    // troca id → token acontece só aqui, com service role.
    //
    // A dona do cartão é verificada contra `auth.uid()`, não contra o pedido:
    // sem isso, quem conseguisse adivinhar um uuid cobraria o cartão alheio.
    if (cartao_salvo_id) {
      const { data: cartao } = await supabaseAdmin
        .from('cartoes_salvos')
        .select('payment_token, titular_nome, titular_documento, ultimos_digitos, clientes!inner(user_id)')
        .eq('id', cartao_salvo_id)
        .eq('loja_id', pedido.loja_id)
        .eq('ativo', true)
        .maybeSingle();

      const donoDoCartao = (cartao as any)?.clientes?.user_id as string | undefined;
      const ehServico = ctx.user?.role === 'service_role';
      if (!cartao || (!ehServico && donoDoCartao !== ctx.user?.id)) {
        // Mesma resposta para "não existe" e "não é seu": responder coisas
        // diferentes transformaria este endpoint num detector de cartões.
        return json({ error: 'Cartão salvo não encontrado.' }, { status: 404 });
      }

      payment_token = String((cartao as any).payment_token);
      customer = {
        ...(customer ?? {}),
        name: customer?.name ?? String((cartao as any).titular_nome),
        cpf: customer?.cpf ?? String((cartao as any).titular_documento),
      };

      await supabaseAdmin
        .from('cartoes_salvos')
        .update({ ultimo_uso_em: new Date().toISOString() })
        .eq('id', cartao_salvo_id);

      reqLogger.info('Pagamento com cartão guardado', {
        context: { pedido_id, final: String((cartao as any).ultimos_digitos) },
      });
    }

    if (!payment_token || !customer?.name || !customer?.cpf) {
      return json({ error: 'Dados do cartão incompletos.' }, { status: 400 });
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
      .select('efi_payee_code, efi_payee_code_antecipado, efi_sandbox, efi_key_id, efi_titular_telefone')
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

    // ── AS TRÊS PONTAS TÊM DE SER A MESMA CONTA ────────────────────────────
    //
    // O token é emitido no navegador com `setAccount(<identificador>)`; a
    // cobrança autentica com um par CLIENT_ID/SECRET; e a Efí credita quem
    // autenticou (a doc do split: o restante do repasse vai "automaticamente
    // para a conta do integrador"). Se a credencial autenticar noutra conta,
    // a Efí responde "payment_token não existe" — para TODO cliente, não só
    // para quem configurou errado. Foi o estrago de 09/09/2026, causado por
    // uma secret nova entrar na frente numa lista de precedência.
    //
    // O `key_id` vem dentro do access_token e diz, sem expor segredo, em qual
    // conta a credencial entrou. Comparado com o que está declarado na
    // configuração, transforma aquele mês de recusa inexplicável num erro
    // explícito na primeira tentativa.
    const keyIdAutenticado = (() => {
      try {
        const meio = token.split('.')[1];
        const dados = JSON.parse(atob(meio.replace(/-/g, '+').replace(/_/g, '/')));
        return Number(dados?.data?.key_id) || null;
      } catch { return null; }
    })();
    const keyIdDeclarado = Number((cfgPlataforma as any)?.efi_key_id) || null;

    if (keyIdDeclarado && keyIdAutenticado && keyIdDeclarado !== keyIdAutenticado) {
      reqLogger.error('Credencial de cartão autenticou em outra conta Efí', undefined, {
        context: {
          pedido_id,
          key_id_declarado: keyIdDeclarado,
          key_id_autenticado: keyIdAutenticado,
          payee_da_plataforma: String((cfgPlataforma as any)?.efi_payee_code ?? '').slice(0, 8) + '…',
        },
      });
      return json({
        aprovado: false,
        error: 'Não conseguimos processar o cartão agora. Você pode pagar com Pix ou escolher outra forma de pagamento.',
        motivo_tecnico: `A credencial de cartao autenticou na conta Efi ${keyIdAutenticado}, mas a plataforma esta declarada como ${keyIdDeclarado}. O token do navegador foi emitido para a conta declarada, entao esta cobranca seria recusada com "payment_token nao existe". Corrija a secret ou o efi_key_id em configuracoes_fiscais_plataforma.`,
      }, { status: 200 });
    }

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

    // ── SEM SPLIT NÃO É NEUTRO: A VENDA FICA COM A PLATAFORMA ──────────────
    //
    // Quando o split é desligado, a cobrança inteira é creditada na conta que
    // processa (a pessoal) e a loja não recebe nada. Isso é correto para a
    // venda da própria MiseOn e ERRADO para a venda de um lojista.
    //
    // Foi exatamente esse estado que produziu a recusa 4600222 do pedido #298
    // em 11/09/2026: o Lanche do Paulista estava gravado com o payee_code DA
    // PLATAFORMA, o split foi desligado, e a Efí passou a ver o recebedor
    // (dona da conta pessoal) e a pagadora como a mesma pessoa. O erro
    // chegava ao cliente como "cartão recusado", sem nenhum rastro de que a
    // causa era cadastro.
    //
    // Agora o caso fica gravado em `pagamentos.split_status` com nome próprio
    // — dá para achar por SQL toda venda que foi parar na conta errada.
    const repasseApontaParaPlataforma = !!payeeCode
      && payeesDaPlataforma.has(payeeCode.toLowerCase());
    const statusDoRepasse = usarSplit
      ? 'marketplace_repasse'
      : (repasseApontaParaPlataforma ? 'creditado_na_plataforma' : 'loja_sem_payee');

    if (!usarSplit) {
      reqLogger.warn('Venda de loja sem repasse: o valor fica na conta da plataforma', {
        context: {
          pedido_id,
          loja_id: pedido.loja_id,
          motivo: repasseApontaParaPlataforma
            ? 'a loja esta cadastrada com o payee_code da plataforma'
            : 'a loja nao tem efi_payee_code',
          consequencia: 'a loja nao recebe, e a Efi pode recusar com 4600222 quando o pagador for a propria dona da conta',
        },
      });
    }

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
        // QUAL CONTA EFI ESTA COBRANDO.
        //
        // Medido em 11/09/2026: a mesma cobranca, disparada direto na API da
        // Efi com as credenciais EFI_CLIENT_ID do projeto, passou pela
        // validacao de identidade com o CPF da compradora (erro devolvido foi
        // so de payment_token inexistente). Pela funcao, com as credenciais
        // EFI_CARTAO_PROD_*, a mesma identidade e recusada com 4600222.
        //
        // Se as duas credenciais apontam para contas diferentes, e a conta que
        // muda o resultado — nao o documento de quem paga. O key_id vem dentro
        // do proprio access_token e identifica a conta sem expor segredo.
        conta_efi_key_id: (() => {
          try {
            const meio = token.split('.')[1];
            const json = JSON.parse(atob(meio.replace(/-/g, '+').replace(/_/g, '/')));
            return json?.data?.key_id ?? '(sem key_id)';
          } catch { return '(token nao legivel)'; }
        })(),
        payee_code_usado: payeeCode ? `${payeeCode.slice(0, 8)}…` : '(nenhum)',
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

    // ── QUEM É O COMPRADOR, PARA A EFÍ ─────────────────────────────────────
    // Quando quem está logado é a EQUIPE DA LOJA (dono testando, operador
    // lançando pelo balcão), o e-mail do "cliente" do pedido é o e-mail de
    // alguém ligado ao recebedor. Mandar isso junto com o CPF de outra pessoa
    // é o que faz a Efí concluir "recebedor e cliente são a mesma pessoa"
    // (4600222) mesmo com o documento correto — medido em 10/09/2026.
    // Nesse caso vai um endereço por pedido, que não pertence a ninguém.
    const emailDoCliente = (pedido as any)?.clientes?.email as string | undefined;
    let compradorEhDaLoja = false;
    if ((pedido as any).cliente_user_id) {
      const { data: vinculo } = await supabaseAdmin
        .from('usuarios_loja')
        .select('papel')
        .eq('loja_id', pedido.loja_id)
        .eq('user_id', (pedido as any).cliente_user_id)
        .maybeSingle();
      compradorEhDaLoja = !!vinculo;
    }
    const emailDoComprador =
      customer.email
      ?? (compradorEhDaLoja ? undefined : emailDoCliente)
      ?? `pedido-${pedido.numero}@clientes.miseon.app.br`;

    // O TELEFONE SEGUE A MESMA REGRA DO E-MAIL.
    //
    // `phone_number` é obrigatório na Efí, então não dá para omitir — omitir
    // devolve "A propriedade [phone_number] é obrigatória" (medido em
    // 10/09/2026, e foi por isso que eu tinha revertido a primeira tentativa
    // de tratar este campo). O que dá, e é o certo, é não mandar o telefone
    // do RECEBEDOR como se fosse o do pagador.
    //
    // Ordem: o que o checkout informar; senão o contato do pedido; e quando
    // quem compra é da equipe da loja, um número de preenchimento, porque
    // naquele caso o contato do pedido é o do dono da conta que recebe.
    const { numero: foneDoPagador, origem: origemDoFone } = telefoneDoPagador({
      doCheckout: customer.phone,
      doPedido: (pedido as any).telefone_contato,
      compradorEhDaLoja,
      telefoneDoTitularDaConta: (cfgPlataforma as any)?.efi_titular_telefone,
    });

    // Só o domínio: basta para saber se o e-mail que foi para a Efí pertencia
    // ao comprador ou ao recebedor, sem guardar endereço pessoal no log.
    reqLogger.info('Identidade do comprador resolvida', {
      context: {
        pedido_id,
        comprador_e_da_loja: compradorEhDaLoja,
        email_dominio: String(emailDoComprador).split('@')[1] ?? '(sem dominio)',
        email_veio_de: customer.email ? 'checkout' : (compradorEhDaLoja ? 'neutro-por-pedido' : (emailDoCliente ? 'cadastro-do-cliente' : 'neutro-por-pedido')),
        // O campo que causou o 4600222. Sem isto no log, a proxima recusa
        // volta a ser adivinhacao.
        telefone_veio_de: origemDoFone,
      },
    });

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
            // E-MAIL DO COMPRADOR — NUNCA O DA PLATAFORMA.
            //
            // Antes: `customer.email ?? 'contato@miseon.app.br'`. O checkout
            // manda só nome e CPF, entao TODA cobranca de cartao saia com o
            // e-mail da propria MiseOn no lugar do e-mail do comprador. A Efi
            // recebia CPF de uma pessoa e e-mail do recebedor — que e um jeito
            // direto de a validacao dela concluir "recebedor e cliente sao a
            // mesma pessoa" (code 4600222), mesmo com o CPF certo.
            //
            // Medido em 10/09/2026: cobranca com `customer.cpf` da compradora,
            // pedido de R$ 7,00, recusada com 4600222 enquanto o e-mail
            // enviado era contato@miseon.app.br.
            //
            // Ordem agora: o que o checkout mandar, senao o e-mail do CLIENTE
            // do pedido, senao um endereco por pedido que nao pertence a
            // ninguem. Endereco da plataforma nao entra em nenhuma hipotese.
            email: emailDoComprador,
            // TELEFONE DO PAGADOR — CAMPO OBRIGATORIO NA EFI.
            //
            // Eu tinha tornado este campo opcional quando o comprador e da
            // equipe da loja, achando que o telefone do pedido contribuia para
            // a Efi confundir pagador e recebedor. Nao contribuia — a causa era
            // a credencial trocada em 09/09 — e omitir o campo produziu
            // "A propriedade [phone_number] e obrigatoria".
            //
            // Volta a regra simples: o telefone que o checkout informar; na
            // falta dele, o contato do pedido, que sempre existe.
            //
            // ── 11/09/2026: ERA O TELEFONE. ────────────────────────────────
            // Bisseccionado na API da Efi, um campo por vez, mesma conta,
            // mesmo CPF, sem split, cartao sintetico:
            //
            //   telefone (11) 91988-9233 + e-mail neutro -> 4600222
            //   e-mail por pedido + telefone neutro      -> 200, vai ao emissor
            //   os dois como a funcao mandava            -> 4600222
            //
            // (11) 91988-9233 e o telefone cadastrado na conta Efi que
            // processa. A Efi casa o pagador com o titular PELO TELEFONE, nao
            // so pelo CPF — e o `telefone_contato` do pedido e o contato de
            // ENTREGA, que num pedido feito pela propria equipe da loja e o
            // do dono. Resultado: toda tentativa recusada com uma mensagem
            // que falava de "mesma pessoa" sem dizer por qual campo.
            //
            // Em julho funcionou porque o pedido #23 tinha outro telefone.
            //
            // Mesmo tratamento que ja era dado ao e-mail logo acima: quando
            // quem compra e da equipe da loja, o contato do pedido pertence ao
            // RECEBEDOR e nao pode ir como dado do pagador. Cliente de
            // verdade continua mandando o telefone dele, que e o certo para
            // antifraude.
            phone_number: foneDoPagador,
            ...(customer.birth ? { birth: String(customer.birth) } : {}),
          },
        },
      },
    };

    // ── O QUE EXATAMENTE SAI DAQUI ─────────────────────────────────────────
    // Ate agora o log mostrava a RESPOSTA da Efi e nada do PEDIDO que ela
    // recusou. Sem isso, cada recusa virava hipotese: "sera o e-mail?", "sera
    // o telefone?" — e duas hipoteses erradas custaram duas rodadas. Com o
    // payload registrado, a proxima recusa e conclusiva.
    //
    // Mascarado: CPF sai com tres primeiros e dois ultimos; o payment_token
    // nao entra (e credencial de uso unico do cartao); numero e CVV nunca
    // passam por esta funcao.
    {
      const c = bodyToSend.payment.credit_card.customer as Record<string, unknown>;
      const doc = String(c.cpf ?? '');
      reqLogger.info('Payload enviado a Efi', {
        context: {
          pedido_id,
          item_nome: bodyToSend.items[0]?.name,
          valor_centavos: bodyToSend.items[0]?.value,
          installments: bodyToSend.payment.credit_card.installments,
          tem_marketplace: 'marketplace' in (bodyToSend.items[0] ?? {}),
          customer: {
            name: String(c.name ?? '').slice(0, 30),
            cpf: doc.length >= 5 ? `${doc.slice(0, 3)}***${doc.slice(-2)}` : `(${doc.length} digitos)`,
            email: String(c.email ?? ''),
            phone_number: c.phone_number ? `***${String(c.phone_number).slice(-4)}` : '(vazio)',
            tem_birth: 'birth' in c,
          },
          billing_address: {
            city: bodyToSend.payment.credit_card.billing_address.city,
            state: bodyToSend.payment.credit_card.billing_address.state,
            neighborhood: bodyToSend.payment.credit_card.billing_address.neighborhood,
            zipcode: String(bodyToSend.payment.credit_card.billing_address.zipcode ?? '').slice(0, 5) + '***',
          },
        },
      });
    }

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
        // A REGRA REAL, da documentação do split da Efí: quem autentica a
        // cobrança é sempre recebedor — "o valor restante será automaticamente
        // transferido para a conta do integrador". Logo a comparação da Efí é
        // contra o titular da conta da PLATAFORMA, não contra a loja e não
        // contra os payees do repasse.
        //
        // Isso foi medido: o pedido #300 (11/09/2026) repassava 100% para a
        // conta da loja e mesmo assim voltou 4600222, porque a conta que
        // cobrava era a mesma do documento informado. Antes esta mensagem
        // dizia "titular da conta que recebe", o que mandava procurar no lugar
        // errado — o problema não está no cadastro da loja.
        ? 'Os dados do pagador coincidem com os do titular da conta que processa os pagamentos — pode ser o CPF, o e-mail ou o TELEFONE, e a Efí não autoriza cobrança para si mesmo. Confira principalmente o telefone de contato do pedido. Com um cliente real isso não acontece.'
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
        split_status: statusDoRepasse,
      })
      .eq('pedido_id', pedido_id)
      .eq('metodo', 'CREDITO');

    if (aprovado) {
      // Só aqui, com a cobrança aprovada, o pedido deixa de ser carrinho e
      // aparece para o lojista (ver AGUARDANDO_PAGAMENTO, 20260908).
      await supabaseAdmin.from('pedidos').update({ status: 'ACEITO' })
        .eq('id', pedido_id).in('status', ['NOVO', 'AGUARDANDO_PAGAMENTO']);
    }

    // ── GUARDAR O CARTÃO PARA A PRÓXIMA COMPRA ─────────────────────────────
    //
    // Só depois de APROVADO: guardar um cartão que o emissor acabou de recusar
    // é oferecer ao cliente, na próxima compra, um atalho que já se sabe que
    // não funciona.
    //
    // Só para cliente identificado e dono do pedido — carteira é de pessoa,
    // não de pedido. O que entra aqui é o token reutilizável mais a máscara;
    // número completo e CVV não existem nesta função.
    if (aprovado && salvar_cartao && !cartao_salvo_id && pedido.cliente_id) {
      const podeGuardar = ctx.user?.role === 'service_role'
        || (!!pedido.cliente_user_id && pedido.cliente_user_id === ctx.user?.id);
      if (podeGuardar) {
        const { error: erroSalvar } = await supabaseAdmin
          .from('cartoes_salvos')
          .upsert({
            cliente_id: pedido.cliente_id,
            loja_id: pedido.loja_id,
            payment_token,
            bandeira: salvar_cartao.bandeira ?? null,
            ultimos_digitos: salvar_cartao.ultimos_digitos,
            titular_nome: customer.name,
            titular_documento: String(customer.cpf).replace(/\D/g, ''),
            validade_mes: salvar_cartao.validade_mes ?? null,
            validade_ano: salvar_cartao.validade_ano ?? null,
            apelido: salvar_cartao.apelido ?? null,
            ultimo_uso_em: new Date().toISOString(),
          }, { onConflict: 'cliente_id,loja_id,payment_token' });

        // Falhar em guardar NÃO pode derrubar um pagamento já aprovado: o
        // dinheiro entrou, o pedido é válido. Fica no log, e o cliente só
        // digita de novo da próxima vez.
        if (erroSalvar) {
          reqLogger.warn('Pagamento aprovado, mas o cartão não pôde ser guardado', {
            context: { pedido_id, motivo: String(erroSalvar.message ?? erroSalvar) },
          });
        }
      }
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
      split_status: statusDoRepasse,
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
