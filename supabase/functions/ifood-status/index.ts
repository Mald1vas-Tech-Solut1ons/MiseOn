// MiseOn — Edge Function: ponte de status entre o MiseOn e o iFood
//
// POR QUE ISTO EXISTE:
// A integração recebia pedido do iFood mas nunca respondia de volta. O lojista
// marcava PREPARANDO no KDS, PRONTO no balcão, despachava com o entregador —
// e o cliente no app do iFood continuava vendo "pedido confirmado", parado.
// Para o iFood isso é integração incompleta: os endpoints de ciclo de vida
// fazem parte dos critérios de homologação.
//
// Mapeamento (status MiseOn -> endpoint iFood):
//   PREPARANDO  -> /startPreparation
//   PRONTO      -> /readyToPickup   (retirada/balcão)
//   EM_ROTA     -> /dispatch        (entrega)
//   CANCELADO   -> /cancellationReasons + /requestCancellation
//
// FINALIZADO não tem callback: CON vem DO iFood para nós, não o contrário.
//
// ── PORTAS DE ENTRADA ───────────────────────────────────────────────────────
//
//   { pedido_id }                              -> sincroniza o status (gatilho)
//   { pedido_id, acao: 'motivos' }             -> motivos que o iFood aceita
//   { pedido_id, acao: 'cancelar', codigo }    -> cancela no iFood
//   { pedido_id, acao: 'despachar' }           -> /dispatch (etapa 4)
//   { pedido_id, acao: 'validar_coleta', … }   -> confere o entregador do iFood
//   { pedido_id, acao: 'validar_entrega', … }  -> conclui o pedido (etapa 5)
//
// Todas as ações nomeadas são chamadas PELA TELA, com o JWT do lojista. Isso é
// deliberado e é o coração da correção: cancelamento não pode ser
// "dispara e reza". Antes, o Painel gravava CANCELADO no banco e o gatilho
// avisava o iFood por pg_net, sem retorno — se o iFood recusasse (e ele recusa:
// exige um código da lista DELE, que muda conforme o estágio do pedido), o
// MiseOn dizia "cancelado" e o cliente continuava com o pedido ativo no app.
// O lojista não tinha como saber. É divergência silenciosa entre dois sistemas,
// e é exatamente o que a etapa 3 da homologação testa.
//
// Agora a ordem é: pergunta os motivos -> lojista escolhe -> cancela no iFood
// -> SÓ ENTÃO o MiseOn grava CANCELADO. Se o iFood recusar, o pedido continua
// vivo nos dois lados e a tela diz o porquê.
//
// O gatilho continua existindo como rede de segurança para cancelamentos que
// nascem fora do Painel (fechamento de comanda, script de suporte). Para não
// cancelar duas vezes, quem já acertou com o iFood carimba
// `ifood_cancelamento_em` no pedido, e o gatilho respeita esse carimbo.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const IFOOD = 'https://merchant-api.ifood.com.br';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** Campos do pedido que esta função precisa — um só lugar para não divergir. */
const CAMPOS_PEDIDO =
  'id, numero, loja_id, status, estacao_atual, tipo_pedido, ifood_order_id, ' +
  'motivo_cancelamento, ifood_cancelamento_em, ifood_despachado_em, ' +
  'ifood_entrega_validada_em, ifood_entregue_por, ifood_localizador, ifood_codigo_coleta';

/**
 * Lê o corpo como JSON sem explodir quando ele vem vazio.
 *
 * `res.json()` direto foi a causa de um erro que aparecia como
 * "Unexpected end of JSON input" e não dizia NADA sobre o iFood: quando a API
 * deles responde 200 com corpo vazio (acontece sob rate limit no endpoint de
 * token), o parse morre e o erro sobe como falha genérica da função. O lojista
 * via "não consegui cancelar" sem uma linha de diagnóstico.
 */
async function lerJson(res: Response): Promise<{ corpo: unknown; texto: string }> {
  const texto = (await res.text()).trim();
  if (!texto) return { corpo: null, texto: '' };
  try {
    return { corpo: JSON.parse(texto), texto };
  } catch {
    return { corpo: null, texto };
  }
}

/**
 * Token da plataforma, guardado entre invocações.
 *
 * O iFood limita a frequência de emissão de token — e a integração pedia um
 * token NOVO a cada chamada (polling de minuto em minuto, mais webhook, mais
 * cada mudança de status). Estourado o limite, o endpoint responde sem corpo e
 * TUDO que depende de token falha junto, inclusive o cancelamento.
 *
 * A Edge Function é reaproveitada entre requisições, então um cache de módulo
 * já corta a maior parte das emissões. Margem de 60s para nunca usar um token
 * que expira no meio da chamada seguinte.
 */
let tokenCache: { valor: string; expiraEm: number } | null = null;

async function getPlatformToken(clientId: string, clientSecret: string): Promise<string> {
  if (tokenCache && tokenCache.expiraEm > Date.now()) return tokenCache.valor;

  const body = new URLSearchParams({ grantType: 'client_credentials', clientId, clientSecret });
  const res = await fetch(`${IFOOD}/authentication/v1.0/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const { corpo, texto } = await lerJson(res);
  const dados = corpo as { accessToken?: string; expiresIn?: number } | null;

  if (!res.ok || !dados?.accessToken) {
    throw new Error(
      `Falha ao autenticar no iFood (HTTP ${res.status})${texto ? `: ${texto.slice(0, 200)}` : ' — resposta vazia'}`,
    );
  }

  tokenCache = {
    valor: dados.accessToken,
    expiraEm: Date.now() + Math.max((dados.expiresIn ?? 3600) - 60, 60) * 1000,
  };
  return tokenCache.valor;
}

/** status do MiseOn -> ação no iFood. null = nada a enviar. */
function acaoPara(status: string, tipoPedido: string): string | null {
  if (status === 'PREPARANDO') return 'startPreparation';
  if (status === 'PRONTO') return tipoPedido === 'DELIVERY' ? null : 'readyToPickup';
  if (status === 'EM_ROTA') return 'dispatch';
  return null;
}

type Motivo = { codigo: string; descricao: string };

/**
 * Catálogo padrão de motivos do iFood.
 *
 * POR QUE ISTO EXISTE: o endpoint /cancellationReasons responde 204 sem corpo
 * de forma intermitente (medido nesta conta: às 20h34 devolveu os 13 motivos,
 * às 20h40 devolveu 204 para os MESMOS pedidos, sem nada ter mudado). Com a
 * lista vindo só de lá, o lojista fica sem poder cancelar enquanto o iFood
 * estiver nesse estado — e cancelamento é justamente o que não pode esperar:
 * do outro lado tem cliente com pedido que a loja não vai fazer.
 *
 * Estes códigos são os que a própria API devolveu, e são estáveis (fazem parte
 * do catálogo público do iFood). Usados SÓ como retaguarda, e a tela avisa
 * quando está com eles em vez da lista ao vivo — porque a lista ao vivo é a
 * autoridade sobre o que aquele pedido, naquele estágio, aceita.
 */
const MOTIVOS_PADRAO: Motivo[] = [
  { codigo: '501', descricao: 'Problemas de sistema na loja' },
  { codigo: '502', descricao: 'O pedido está duplicado' },
  { codigo: '503', descricao: 'Item indisponível/desatualizado' },
  { codigo: '504', descricao: 'A loja está sem entregadores disponíveis' },
  { codigo: '506', descricao: 'O pedido está fora da área de entrega' },
  { codigo: '507', descricao: 'Suspeita de golpe ou trote' },
  { codigo: '508', descricao: 'O pedido foi feito fora do horário de funcionamento da loja' },
  { codigo: '509', descricao: 'A loja está passando por dificuldades internas' },
  { codigo: '511', descricao: 'A entrega é em uma área de risco' },
  { codigo: '512', descricao: 'A loja só abrirá mais tarde' },
  { codigo: '520', descricao: 'O endereço está incompleto e o cliente não atende' },
  { codigo: '523', descricao: 'Erro na promoção' },
  { codigo: '860', descricao: 'Problema com pagamento do cliente' },
];

/**
 * O iFood não aceita cancelamento com texto livre: o motivo tem que ser um dos
 * códigos que ELE devolve para aquele pedido, e a lista muda conforme o estágio
 * (pedido ainda não confirmado oferece motivos diferentes de um já em rota).
 *
 * Devolve a lista OU o erro — a tela precisa saber a diferença entre "o iFood
 * disse que não há motivo aplicável" e "não consegui falar com o iFood".
 */
async function motivosDeCancelamento(
  orderId: string,
  token: string,
): Promise<{ ok: true; motivos: Motivo[]; diagnostico: string } | { ok: false; status: number; erro: string }> {
  const res = await fetch(`${IFOOD}/order/v1.0/orders/${orderId}/cancellationReasons`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const { corpo, texto } = await lerJson(res);
  if (!res.ok) {
    return { ok: false, status: res.status, erro: texto.slice(0, 300) };
  }

  // Lista vazia não é sempre a mesma coisa: pode ser "este pedido não aceita
  // cancelamento" ou "o iFood devolveu 200 com corpo vazio". Sem guardar de
  // qual dos dois se trata, o suporte fica adivinhando.
  const diagnostico = `HTTP ${res.status} · ${texto ? `${texto.length} bytes` : 'corpo vazio'}`;

  // Duas formas coexistem: a doc atual descreve `{ reasons: [{code, description}] }`
  // e a API desta conta responde com um array cru de `{cancelCodeId, description}`.
  // Ler as duas evita lista vazia por detalhe de contrato — que aqui significa
  // lojista sem conseguir cancelar.
  const envelope = corpo as { reasons?: unknown } | null;
  const lista = Array.isArray(corpo)
    ? corpo
    : Array.isArray(envelope?.reasons)
      ? envelope.reasons
      : [];
  const motivos: Motivo[] = lista
    .map((m: Record<string, string>) => ({
      codigo: m.cancelCodeId ?? m.cancellationCode ?? m.code ?? '',
      descricao: m.description ?? m.reason ?? '',
    }))
    .filter((m: Motivo) => m.codigo);

  return { ok: true, motivos, diagnostico };
}

/** Traduz a recusa do iFood para algo que o lojista consiga agir. */
function explicarFalha(status: number, corpo: string): string {
  if (status === 401 || status === 403) {
    return 'O iFood recusou a credencial da integração. Reconecte a loja na aba Conexão.';
  }
  if (status === 404) {
    return 'O iFood não encontrou mais este pedido. Ele pode já ter sido encerrado por lá.';
  }
  if (status === 409 || /already|status/i.test(corpo)) {
    return 'O iFood não aceita cancelar este pedido no estágio atual. Atualize a tela e confira o status.';
  }
  if (status >= 500) {
    return 'O iFood está instável agora e não respondeu ao cancelamento. Tente de novo em instantes.';
  }
  return `O iFood recusou o cancelamento (HTTP ${status}).`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const pollingToken = Deno.env.get('IFOOD_POLLING_TOKEN');
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();

  // Chamada interna (gatilho pg_net ou function-to-function) vs. chamada da
  // tela com o JWT do lojista. O JWT é validado adiante, contra o pedido.
  const interno = bearer === serviceKey || (!!pollingToken && bearer === pollingToken);
  if (!bearer) return json({ error: 'Não autorizado' }, 401);

  const clientId = Deno.env.get('IFOOD_CLIENT_ID');
  const clientSecret = Deno.env.get('IFOOD_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    return json({ error: 'A integração com o iFood não está configurada nesta instalação.' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const corpo = await req.json().catch(() => ({}));
    const { pedido_id, acao, codigo } = corpo as {
      pedido_id?: string;
      acao?: 'motivos' | 'cancelar' | 'despachar' | 'validar_entrega' | 'validar_coleta';
      codigo?: string;
    };
    if (!pedido_id) return json({ error: 'pedido_id obrigatório' }, 400);

    const { data: pedido } = await supabase
      .from('pedidos')
      .select(CAMPOS_PEDIDO)
      .eq('id', pedido_id)
      .maybeSingle();

    if (!pedido) return json({ error: 'Pedido não encontrado' }, 404);

    // ── Quem está pedindo ───────────────────────────────────────────────────
    // Ações vindas da tela exigem que o usuário seja da equipe DESTA loja. A
    // política de RLS já cobriria a leitura, mas cancelar é ato de escrita num
    // sistema de terceiros: vale checar explicitamente.
    let papel: string | null = null;
    if (!interno) {
      const { data: auth } = await supabase.auth.getUser(bearer);
      if (!auth?.user) return json({ error: 'Sessão expirada. Entre de novo.' }, 401);

      const { data: vinculo } = await supabase
        .from('usuarios_loja')
        .select('papel')
        .eq('user_id', auth.user.id)
        .eq('loja_id', pedido.loja_id)
        .maybeSingle();

      if (!vinculo) return json({ error: 'Você não tem acesso a este pedido.' }, 403);
      papel = vinculo.papel;
    }

    if (!pedido.ifood_order_id) {
      return acao
        ? json({ error: 'Este pedido não veio do iFood.' }, 400)
        : json({ ok: true, motivo: 'pedido não é do iFood' });
    }

    // ════════════════════════════════════════════════════════════════════════
    // AÇÃO: consultar os motivos que o iFood aceita para ESTE pedido
    // ════════════════════════════════════════════════════════════════════════
    if (acao === 'motivos') {
      const token = await getPlatformToken(clientId, clientSecret);
      const r = await motivosDeCancelamento(pedido.ifood_order_id, token);

      if (!r.ok) {
        console.error(`cancellationReasons ${pedido.ifood_order_id}: ${r.status} ${r.erro}`);
        return json({ ok: false, erro: explicarFalha(r.status, r.erro), tecnico: r.erro }, 200);
      }
      if (r.motivos.length === 0) {
        console.warn(`cancellationReasons vazio para ${pedido.ifood_order_id}: ${r.diagnostico}`);
        return json({
          ok: true,
          motivos: MOTIVOS_PADRAO,
          origem: 'padrao',
          tecnico: `cancellationReasons: ${r.diagnostico}`,
        });
      }
      return json({ ok: true, motivos: r.motivos, origem: 'ifood' });
    }

    // ════════════════════════════════════════════════════════════════════════
    // AÇÃO: cancelar no iFood (e só então liberar a tela para gravar no banco)
    // ════════════════════════════════════════════════════════════════════════
    if (acao === 'cancelar') {
      if (['FINALIZADO', 'CANCELADO'].includes(pedido.status)) {
        return json({ ok: false, erro: `O pedido #${pedido.numero} já foi encerrado.` }, 200);
      }

      // Mesma regra do gatilho `fn_valida_transicao_pedido`, aplicada ANTES de
      // falar com o iFood. Se só o banco checasse, um operador sem permissão
      // conseguiria cancelar no iFood e travar no MiseOn — pior dos mundos.
      const livre = ['NOVO', 'ACEITO'].includes(pedido.status) && pedido.estacao_atual === 'BALCAO';
      if (!interno && !livre && papel !== 'admin') {
        return json(
          { ok: false, erro: 'A cozinha já iniciou este pedido — só um admin pode cancelar agora.' },
          200,
        );
      }

      const token = await getPlatformToken(clientId, clientSecret);

      // A lista é buscada de novo, e não confiada do que a tela mandou: entre
      // abrir o modal e confirmar, o pedido pode ter avançado de estágio e o
      // código escolhido deixado de valer.
      const r = await motivosDeCancelamento(pedido.ifood_order_id, token);
      if (!r.ok) {
        return json({ ok: false, erro: explicarFalha(r.status, r.erro), tecnico: r.erro }, 200);
      }
      // Lista ao vivo quando o iFood responde; catálogo padrão quando ele
      // devolve 204 (ver MOTIVOS_PADRAO). O requestCancellation abaixo é o juiz
      // final: se o código não valer para este pedido, ele recusa e a tela diz.
      const aceitos = r.motivos.length > 0 ? r.motivos : MOTIVOS_PADRAO;
      const escolhido = aceitos.find((m) => m.codigo === codigo) ?? aceitos[0];

      const res = await fetch(`${IFOOD}/order/v1.0/orders/${pedido.ifood_order_id}/requestCancellation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        // `reason` vai com a DESCRIÇÃO do código, não com o texto livre do
        // lojista. Medido nesta conta: mandando texto próprio, o iFood aceita o
        // POST (202) e depois recusa por evento — chega CAR e logo CARF
        // (cancellation request failed), sem nenhum erro na resposta HTTP.
        // A observação do lojista vive no MiseOn, em motivo_cancelamento.
        // `reason` leva o CÓDIGO, não a descrição. A doc atual do iFood
        // documenta o corpo como { "reason": "501" }; mandando a descrição, o
        // POST volta 202 e o cancelamento é recusado DEPOIS, por evento CARF —
        // sem nenhum erro na resposta HTTP para a tela mostrar.
        // `cancellationCode` vai junto porque contas antigas ainda leem esse
        // campo; os dois carregam o mesmo código, então não há como divergir.
        body: JSON.stringify({
          reason: escolhido.codigo,
          cancellationCode: escolhido.codigo,
        }),
      });

      if (!res.ok) {
        const erro = (await res.text()).slice(0, 300);
        console.error(`requestCancellation ${pedido.ifood_order_id}: ${res.status} ${erro}`);
        return json({ ok: false, erro: explicarFalha(res.status, erro), tecnico: erro }, 200);
      }

      // Carimbo ANTES de a tela gravar CANCELADO: é ele que impede o gatilho de
      // mandar um segundo requestCancellation quando o status mudar.
      await supabase
        .from('pedidos')
        .update({
          ifood_cancelamento_em: new Date().toISOString(),
          ifood_cancelamento_codigo: escolhido.codigo,
          ifood_cancelamento_origem: 'LOJA',
        })
        .eq('id', pedido.id);

      return json({ ok: true, codigo: escolhido.codigo, motivo: escolhido.descricao });
    }

    // ════════════════════════════════════════════════════════════════════════
    // AÇÃO: despachar (o pedido saiu para entrega)
    // ════════════════════════════════════════════════════════════════════════
    // Etapa 4 da homologação. Vale só para entrega PRÓPRIA: quando quem entrega
    // é o iFood, o despacho parte do entregador deles e o /dispatch é recusado.
    if (acao === 'despachar') {
      if (pedido.ifood_despachado_em) {
        return json({ ok: true, jaFeito: true, motivo: 'este pedido já foi despachado no iFood' });
      }
      if (pedido.ifood_entregue_por === 'IFOOD') {
        return json(
          {
            ok: false,
            erro: 'Quem entrega este pedido é o iFood — o despacho é feito pelo entregador deles, não pela loja.',
          },
          200,
        );
      }

      const token = await getPlatformToken(clientId, clientSecret);
      const res = await fetch(`${IFOOD}/order/v1.0/orders/${pedido.ifood_order_id}/dispatch`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveredBy: 'MERCHANT' }),
      });

      if (!res.ok) {
        const erro = (await res.text()).slice(0, 300);
        console.error(`dispatch ${pedido.ifood_order_id}: ${res.status} ${erro}`);
        return json({ ok: false, erro: explicarFalha(res.status, erro), tecnico: erro }, 200);
      }

      await supabase
        .from('pedidos')
        .update({ ifood_despachado_em: new Date().toISOString() })
        .eq('id', pedido.id);

      return json({ ok: true });
    }

    // ════════════════════════════════════════════════════════════════════════
    // AÇÃO: validar código (coleta pelo entregador iFood, ou entrega ao cliente)
    // ════════════════════════════════════════════════════════════════════════
    // Etapa 5 da homologação ("Conclua um pedido"). São dois momentos diferentes
    // e dois endpoints diferentes:
    //
    //   validar_coleta  -> o entregador DO IFOOD chega na loja e mostra um
    //                      código. Confere e libera a sacola. Não encerra nada:
    //                      quem conclui depois é o iFood.
    //   validar_entrega -> a sacola chega em quem pediu (entrega própria) ou o
    //                      cliente retira no balcão. Este CONCLUI o pedido no
    //                      iFood — é o passo que a homologação valida.
    if (acao === 'validar_coleta' || acao === 'validar_entrega') {
      const digitado = (codigo ?? '').replace(/\D/g, '');
      if (!digitado) return json({ ok: false, erro: 'Informe o código.' }, 200);

      const coleta = acao === 'validar_coleta';
      if (!coleta && pedido.ifood_entrega_validada_em) {
        return json({ ok: true, jaFeito: true, motivo: 'entrega já validada no iFood' });
      }

      const endpoint = coleta ? 'validatePickupCode' : 'verifyDeliveryCode';
      const token = await getPlatformToken(clientId, clientSecret);
      const res = await fetch(`${IFOOD}/order/v1.0/orders/${pedido.ifood_order_id}/${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: digitado }),
      });

      const { corpo: corpoRes, texto } = await lerJson(res);

      if (!res.ok) {
        console.error(`${endpoint} ${pedido.ifood_order_id}: ${res.status} ${texto}`);
        // 400/422 aqui quase sempre é código errado, não falha de integração.
        // Dizer "erro na API" para quem digitou 5 números seria mentira útil
        // para ninguém.
        if (res.status === 400 || res.status === 422) {
          return json({ ok: false, codigoInvalido: true, erro: 'Código não confere. Confira e digite de novo.' }, 200);
        }
        return json({ ok: false, erro: explicarFalha(res.status, texto), tecnico: texto.slice(0, 300) }, 200);
      }

      // O iFood responde 200 com { valid: false } quando o código está errado —
      // ou seja, sucesso de HTTP e fracasso de negócio na mesma resposta.
      const valido = (corpoRes as { valid?: boolean } | null)?.valid;
      if (valido === false) {
        return json({ ok: false, codigoInvalido: true, erro: 'Código não confere. Confira e digite de novo.' }, 200);
      }

      if (!coleta) {
        await supabase
          .from('pedidos')
          .update({ ifood_entrega_validada_em: new Date().toISOString() })
          .eq('id', pedido.id);
      }

      return json({ ok: true, acao });
    }

    // ════════════════════════════════════════════════════════════════════════
    // SEM AÇÃO: sincronização disparada pelo gatilho de status
    // ════════════════════════════════════════════════════════════════════════
    if (pedido.status === 'CANCELADO') {
      // Já acertado com o iFood (pela tela, ou porque o cancelamento nasceu lá).
      if (pedido.ifood_cancelamento_em) {
        return json({ ok: true, motivo: 'cancelamento já sincronizado com o iFood' });
      }
      // Compatibilidade com pedidos gravados antes do carimbo existir.
      if ((pedido.motivo_cancelamento ?? '').startsWith('[iFood]')) {
        return json({ ok: true, motivo: 'cancelamento originado no iFood, nada a devolver' });
      }

      const token = await getPlatformToken(clientId, clientSecret);
      const r = await motivosDeCancelamento(pedido.ifood_order_id, token);
      if (!r.ok) {
        console.error(`Cancelamento de ${pedido.ifood_order_id} não devolvido ao iFood: ${r.status} ${r.erro}`);
        return json({ ok: false, acao: 'requestCancellation', erro: r.erro }, 200);
      }

      // Sem escolha do lojista (este caminho é o de retaguarda), casa pelo texto
      // que estiver no pedido e cai no primeiro da lista.
      const aceitos = r.motivos.length > 0 ? r.motivos : MOTIVOS_PADRAO;
      const alvo = (pedido.motivo_cancelamento ?? '').toLowerCase();
      const escolhido =
        aceitos.find((m) => alvo && m.descricao.toLowerCase().includes(alvo)) ?? aceitos[0];

      const res = await fetch(`${IFOOD}/order/v1.0/orders/${pedido.ifood_order_id}/requestCancellation`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        // `reason` leva o CÓDIGO, não a descrição. A doc atual do iFood
        // documenta o corpo como { "reason": "501" }; mandando a descrição, o
        // POST volta 202 e o cancelamento é recusado DEPOIS, por evento CARF —
        // sem nenhum erro na resposta HTTP para a tela mostrar.
        // `cancellationCode` vai junto porque contas antigas ainda leem esse
        // campo; os dois carregam o mesmo código, então não há como divergir.
        body: JSON.stringify({
          reason: escolhido.codigo,
          cancellationCode: escolhido.codigo,
        }),
      });

      if (!res.ok) {
        const erro = (await res.text()).slice(0, 300);
        console.error(`iFood recusou cancelamento de ${pedido.ifood_order_id}: ${res.status} ${erro}`);
        return json({ ok: false, acao: 'requestCancellation', status: res.status, erro }, 200);
      }

      await supabase
        .from('pedidos')
        .update({
          ifood_cancelamento_em: new Date().toISOString(),
          ifood_cancelamento_codigo: escolhido.codigo,
          ifood_cancelamento_origem: 'LOJA',
        })
        .eq('id', pedido.id);

      return json({ ok: true, acao: 'requestCancellation', codigo: escolhido.codigo });
    }

    const proxima = acaoPara(pedido.status, pedido.tipo_pedido);
    if (!proxima) return json({ ok: true, motivo: `status ${pedido.status} não tem callback` });

    // Despacho já acertado pela tela (ação 'despachar'), ou pedido que o iFood
    // entrega: em ambos, mandar /dispatch daqui seria repetir ou errar.
    if (proxima === 'dispatch') {
      if (pedido.ifood_despachado_em) {
        return json({ ok: true, motivo: 'despacho já sincronizado com o iFood' });
      }
      if (pedido.ifood_entregue_por === 'IFOOD') {
        return json({ ok: true, motivo: 'entrega do iFood — despacho não parte da loja' });
      }
    }

    const token = await getPlatformToken(clientId, clientSecret);
    const res = await fetch(`${IFOOD}/order/v1.0/orders/${pedido.ifood_order_id}/${proxima}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      // /dispatch é o único do ciclo de vida que pede corpo: `deliveredBy`
      // diz QUEM está entregando. Sem ele o iFood aceita o POST e o despacho
      // não completa — mesmo padrão de recusa silenciosa do cancelamento.
      // Aqui é sempre MERCHANT: /dispatch só existe para entrega própria
      // (entrega do iFood é despachada pelo entregador deles).
      body: proxima === 'dispatch' ? JSON.stringify({ deliveredBy: 'MERCHANT' }) : undefined,
    });

    if (!res.ok) {
      const erro = (await res.text()).slice(0, 300);
      console.error(`iFood recusou ${proxima} para ${pedido.ifood_order_id}: ${res.status} ${erro}`);
      // Não derruba a operação da loja: o status no MiseOn já mudou e o balcão
      // segue trabalhando. Fica no log para diagnóstico.
      return json({ ok: false, acao: proxima, status: res.status, erro }, 200);
    }

    if (proxima === 'dispatch') {
      await supabase
        .from('pedidos')
        .update({ ifood_despachado_em: new Date().toISOString() })
        .eq('id', pedido.id);
    }

    return json({ ok: true, acao: proxima, ifood_order_id: pedido.ifood_order_id });
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    console.error('Erro no ifood-status:', msg);
    // 200 de propósito: a tela chama esta função por supabase.functions.invoke,
    // que em status de erro devolve só "non-2xx" e esconde o corpo. Sem isto o
    // lojista lê "erro desconhecido" enquanto o motivo real (credencial, limite
    // do iFood) fica preso no log.
    return json({ ok: false, erro: 'Não deu para falar com o iFood agora.', tecnico: msg }, 200);
  }
});
