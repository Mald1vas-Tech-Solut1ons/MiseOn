// MiseOn — Edge Function: responde às negociações pós-entrega do iFood
//
// POR QUE ISTO EXISTE:
// O cliente reclama depois de receber ("chegou frio", "faltou item") e o iFood
// NÃO cancela sozinho: ele abre uma negociação, manda o evento HANDSHAKE_DISPUTE
// e dá à loja um prazo curto — `expiresAt`, na casa de minutos — para aceitar,
// rejeitar ou fazer contraproposta.
//
// Sem resposta até o prazo, o `timeoutAction` executa. Em cancelamento
// pós-entrega ele costuma ser ACCEPT_CANCELLATION: o silêncio da loja vale
// como aceite. Enquanto o evento caía no ramo "evento não tratado" da webhook,
// o lojista perdia o valor do pedido sem nunca ter visto a reclamação.
//
// ── PORTAS DE ENTRADA ───────────────────────────────────────────────────────
//
//   { disputa_id, acao: 'aceitar', motivo, detalhe }  -> POST /accept
//   { disputa_id, acao: 'rejeitar', motivo }          -> POST /reject
//   { disputa_id, acao: 'alternativa', tipo, ... }    -> POST /alternative
//
// Uma resposta por disputa: o iFood devolve 422 DISPUTE_ALREADY_ANSWERED na
// segunda. A tela precisa saber a diferença entre "já respondida" e "falhou".

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { checkRateLimit, ipDaRequisicao } from '../_shared/rate-limit.ts';

const IFOOD = 'https://merchant-api.ifood.com.br';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-chat-session',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** Igual ao da ifood-status: token guardado entre invocações, com margem. */
let tokenCache: { valor: string; expiraEm: number } | null = null;

async function getPlatformToken(clientId: string, clientSecret: string): Promise<string> {
  if (tokenCache && tokenCache.expiraEm > Date.now()) return tokenCache.valor;

  const res = await fetch(`${IFOOD}/authentication/v1.0/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grantType: 'client_credentials', clientId, clientSecret }),
  });

  const texto = (await res.text()).trim();
  let dados: { accessToken?: string; expiresIn?: number } | null = null;
  try { dados = texto ? JSON.parse(texto) : null; } catch { /* corpo vazio sob rate limit */ }

  if (!res.ok || !dados?.accessToken) {
    throw new Error(`Falha ao autenticar no iFood (HTTP ${res.status})${texto ? `: ${texto.slice(0, 200)}` : ' — resposta vazia'}`);
  }

  tokenCache = {
    valor: dados.accessToken,
    expiraEm: Date.now() + Math.max((dados.expiresIn ?? 3600) - 60, 60) * 1000,
  };
  return tokenCache.valor;
}

/** Traduz a recusa do iFood para algo que o lojista consiga agir. */
function explicar(status: number, corpo: string): string {
  if (status === 401 || status === 403) {
    return 'O iFood recusou a credencial da integração. Reconecte a loja na aba Conexão.';
  }
  if (status === 404) {
    return 'O iFood não encontra mais esta negociação. Ela pode ter expirado — confira no Portal do Parceiro.';
  }
  if (status === 422 && corpo.includes('ALREADY_ANSWERED')) {
    return 'Esta negociação já foi respondida — por alguém da equipe ou pelo prazo ter estourado.';
  }
  if (status === 400 && corpo.includes('INVALID_REASON')) {
    return 'O iFood não aceita esse motivo para esta negociação.';
  }
  if (status === 400 && corpo.includes('INVALID_AMOUNT')) {
    return 'O valor proposto está fora do limite que o iFood permite para esta negociação.';
  }
  if (status === 429) return 'O iFood está limitando as requisições agora. Tente de novo em instantes.';
  if (status >= 500) return 'O iFood está fora do ar no momento. Tente de novo em instantes.';
  return `O iFood recusou (HTTP ${status}).`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  // Freio de vazao. A funcao ja exige autorizacao propria; o limite existe
  // para que tentativa em massa contra ela — ou um token vazado — nao vire
  // custo nem volume ilimitado. Em falha de banco o limitador DEIXA PASSAR
  // (ver _shared/rate-limit.ts), entao nao vira um novo ponto unico de queda.
  // 30/min por IP: resposta a negociacao, uma por reclamacao.
  const rl = await checkRateLimit(`ifood-disputa:${ipDaRequisicao(req)}`, {
    windowMs: 60_000,
    maxRequests: 30,
  });
  if (!rl.allowed) return json({ error: 'Muitas requisicoes. Tente em instantes.' }, 429);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const clientId = Deno.env.get('IFOOD_CLIENT_ID');
  const clientSecret = Deno.env.get('IFOOD_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    return json({ error: 'A integração com o iFood não está configurada nesta instalação.' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const corpo = await req.json().catch(() => ({}));
    const { disputa_id, acao, motivo, detalhe, tipo, valor, minutos } = corpo as {
      disputa_id?: string;
      acao?: 'aceitar' | 'rejeitar' | 'alternativa';
      motivo?: string;
      detalhe?: string;
      tipo?: 'REFUND' | 'BENEFIT' | 'ADDITIONAL_TIME';
      valor?: number;
      minutos?: number;
    };

    if (!disputa_id || !acao) return json({ error: 'disputa_id e acao são obrigatórios' }, 400);

    const { data: disputa } = await supabase
      .from('ifood_disputas')
      .select('id, loja_id, dispute_id, situacao, expira_em, alternativas')
      .eq('id', disputa_id)
      .maybeSingle();

    if (!disputa) return json({ error: 'Negociação não encontrada' }, 404);

    // ── Quem está pedindo ───────────────────────────────────────────────────
    // Responder disputa move dinheiro: aceitar um cancelamento pós-entrega é
    // abrir mão do valor do pedido. Exige vínculo com a loja, sempre.
    const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!bearer) return json({ error: 'Não autorizado' }, 401);

    const { data: auth } = await supabase.auth.getUser(bearer);
    if (!auth?.user) return json({ error: 'Sessão expirada. Entre de novo.' }, 401);

    const { data: vinculo } = await supabase
      .from('usuarios_loja')
      .select('papel')
      .eq('user_id', auth.user.id)
      .eq('loja_id', disputa.loja_id)
      .maybeSingle();

    if (!vinculo) return json({ error: 'Você não tem acesso a esta negociação.' }, 403);

    if (disputa.situacao !== 'ABERTA') {
      return json({ ok: false, jaRespondida: true, erro: 'Esta negociação já foi respondida.' });
    }

    // Prazo estourado: o iFood já executou o timeoutAction. Responder agora
    // volta 422 — melhor dizer a verdade aqui do que fazer o lojista esperar
    // uma requisição que já nasceu perdida.
    if (disputa.expira_em && new Date(disputa.expira_em) < new Date()) {
      await supabase
        .from('ifood_disputas')
        .update({ situacao: 'EXPIRADA', resposta_erro: 'Prazo estourou antes da resposta.' })
        .eq('id', disputa.id);
      return json({
        ok: false,
        expirada: true,
        erro: 'O prazo desta negociação já estourou e o iFood decidiu sozinho. Confira o desfecho no Portal do Parceiro.',
      });
    }

    // ── Monta a chamada ─────────────────────────────────────────────────────
    let endpoint: string;
    let payload: Record<string, unknown>;
    let novaSituacao: string;

    if (acao === 'aceitar') {
      if (!motivo) return json({ error: 'Escolha um motivo para aceitar.' }, 400);
      endpoint = 'accept';
      payload = { reason: motivo, ...(detalhe ? { detailReason: detalhe.slice(0, 250) } : {}) };
      novaSituacao = 'ACEITA';
    } else if (acao === 'rejeitar') {
      if (!motivo) return json({ error: 'Escolha um motivo para rejeitar.' }, 400);
      endpoint = 'reject';
      payload = { reason: motivo };
      novaSituacao = 'REJEITADA';
    } else {
      if (!tipo) return json({ error: 'Escolha o tipo de contraproposta.' }, 400);
      endpoint = 'alternative';
      // O iFood usa ISO 4217: valor SEM casas decimais. R$ 1,00 = "100".
      // Mandar "1.00" aqui vira um centavo — erro caro e silencioso.
      payload = {
        type: tipo,
        metadata:
          tipo === 'ADDITIONAL_TIME'
            ? { additionalTimeInMinutes: minutos, ...(motivo ? { reason: motivo } : {}) }
            : { amount: { value: String(Math.round((valor ?? 0) * 100)), currency: 'BRL' } },
      };
      novaSituacao = 'ALTERNATIVA';
    }

    const token = await getPlatformToken(clientId, clientSecret);
    const res = await fetch(`${IFOOD}/order/v1.0/disputes/${disputa.dispute_id}/${endpoint}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const texto = (await res.text()).slice(0, 400);

    if (!res.ok) {
      console.error(`disputa ${disputa.dispute_id} ${endpoint}: ${res.status} ${texto}`);
      // Já respondida no iFood: alinha o nosso registro em vez de deixar a
      // tela oferecendo botões para algo que lá já acabou.
      if (res.status === 422 && texto.includes('ALREADY_ANSWERED')) {
        await supabase
          .from('ifood_disputas')
          .update({ situacao: 'EXPIRADA', resposta_erro: 'O iFood já tinha registrado uma resposta.' })
          .eq('id', disputa.id);
      }
      return json({ ok: false, erro: explicar(res.status, texto), tecnico: texto }, 200);
    }

    await supabase
      .from('ifood_disputas')
      .update({
        situacao: novaSituacao,
        resposta_em: new Date().toISOString(),
        respondida_por: auth.user.id,
        resposta_motivo: motivo ?? tipo ?? null,
        resposta_erro: null,
      })
      .eq('id', disputa.id);

    return json({ ok: true, situacao: novaSituacao });
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    console.error('Erro na ifood-disputa:', msg);
    return json({ error: msg }, 500);
  }
});
