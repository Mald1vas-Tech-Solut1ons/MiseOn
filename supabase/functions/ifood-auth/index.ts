/**
 * Vinculação da loja do lojista ao aplicativo iFood do MiseOn.
 *
 * ─── O QUE ESTAVA ERRADO ──────────────────────────────────────────────────
 * Esta função implementava o fluxo de aplicativo DISTRIBUÍDO: pedia ao lojista
 * um `authorizationCode` digitado, chamava `/oauth/userCode` para trocá-lo por
 * token e mandava um `authorizationCodeVerifier` fixo no código
 * ("miseon-integradora-master"). Três erros de uma vez — o endpoint é o de
 * OBTER o código, não o de trocá-lo; o verifier tem que vir da resposta do
 * passo anterior, nunca fixo; e, principalmente, o aplicativo do MiseOn é
 * CENTRALIZADO, com credencial do tipo Client Credentials.
 *
 * Em aplicativo centralizado não existe código para o lojista digitar. O
 * aplicativo se autentica com as próprias credenciais e enxerga as lojas que o
 * iFood associou a ele. O trabalho da vinculação é outro: descobrir QUAL das
 * lojas visíveis é a deste lojista e gravar esse merchantId.
 *
 * Prova de que este é o fluxo certo: `ifood-status` e `ifood-polling` — que já
 * recebem pedido de verdade em produção — sempre usaram client_credentials.
 * Só o onboarding tinha ficado para trás.
 *
 * ─── AS TRÊS AÇÕES ────────────────────────────────────────────────────────
 *   diagnostico  responde se o servidor tem credencial, se ela autentica e
 *                quais lojas o aplicativo enxerga. É o que se roda ANTES de ir
 *                ao cliente, para não descobrir problema na frente dele.
 *   listar       as lojas disponíveis, para o lojista escolher a dele.
 *   vincular     grava o merchantId escolhido.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';

const IFOOD = 'https://merchant-api.ifood.com.br';

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

const erro = (msg: string, status = 400, extra: Record<string, unknown> = {}) =>
  json({ error: msg, ...extra }, { status });

/**
 * Token da plataforma, com cache de módulo.
 *
 * Mesmo desenho de `ifood-status`: a Edge Function é reaproveitada entre
 * requisições, então guardar o token corta quase toda emissão. Margem de 60s
 * para nunca usar um token que expira no meio da chamada seguinte.
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

  const texto = await res.text();
  let dados: { accessToken?: string; expiresIn?: number } | null = null;
  try { dados = JSON.parse(texto); } catch { /* resposta não-JSON: cai no erro abaixo */ }

  if (!res.ok || !dados?.accessToken) {
    // A mensagem do iFood é curta e específica ("Client not found or
    // deactivated"), e vale mais que qualquer texto nosso: ela distingue
    // credencial errada de aplicativo desativado.
    throw new Error(
      `Falha ao autenticar no iFood (HTTP ${res.status})${texto ? `: ${texto.slice(0, 220)}` : ''}`,
    );
  }

  tokenCache = {
    valor: dados.accessToken,
    expiraEm: Date.now() + Math.max((dados.expiresIn ?? 3600) - 60, 60) * 1000,
  };
  return tokenCache.valor;
}

interface MerchantIFood {
  id: string;
  name?: string;
  corporateName?: string;
}

/** Lojas que o aplicativo enxerga. Em app centralizado, é a lista de vínculos. */
async function listarMerchants(token: string): Promise<MerchantIFood[]> {
  const res = await fetch(`${IFOOD}/merchant/v1.0/merchants`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const texto = await res.text();

  if (!res.ok) {
    throw new Error(`Não consegui listar as lojas no iFood (HTTP ${res.status}): ${texto.slice(0, 220)}`);
  }
  try {
    const lista = JSON.parse(texto);
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { lojaId, acao = 'listar', merchantId } = await req.json();
    if (!lojaId) return erro('lojaId é obrigatório');

    // ─── Quem está pedindo ────────────────────────────────────────────────
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return erro('Não autenticado', 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: acesso } = await admin
      .from('usuarios_loja').select('papel')
      .eq('user_id', user.id).eq('loja_id', lojaId).maybeSingle();
    if (!acesso || acesso.papel !== 'admin') {
      return erro('Só o administrador da loja pode conectar o iFood.', 403);
    }

    // ─── Credencial do aplicativo, no servidor ────────────────────────────
    const clientId = Deno.env.get('IFOOD_CLIENT_ID');
    const clientSecret = Deno.env.get('IFOOD_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      // Erro de configuração, não do lojista. A mensagem diz exatamente o que
      // falta e onde, para não virar caça ao tesouro na frente do cliente.
      return erro(
        'O servidor não tem as credenciais do aplicativo iFood configuradas. ' +
        'Defina IFOOD_CLIENT_ID e IFOOD_CLIENT_SECRET nos secrets do projeto.',
        500,
        { credenciaisConfiguradas: false },
      );
    }

    // ─── Ações ────────────────────────────────────────────────────────────
    if (acao === 'diagnostico') {
      // Roda antes da visita ao cliente: separa "credencial não configurada" de
      // "credencial recusada" de "aplicativo não enxerga nenhuma loja".
      const passos: Record<string, unknown> = { credenciaisConfiguradas: true };
      try {
        const token = await getPlatformToken(clientId, clientSecret);
        passos.autenticacao = 'ok';
        passos.tokenObtido = token.length > 0;

        const merchants = await listarMerchants(token);
        passos.lojasVisiveis = merchants.length;
        passos.lojas = merchants.map((m) => ({
          id: m.id,
          nome: m.name ?? m.corporateName ?? '(sem nome)',
        }));
        passos.pronto = merchants.length > 0;
      } catch (e) {
        passos.autenticacao = 'falhou';
        passos.detalhe = String((e as Error)?.message ?? e);
        passos.pronto = false;
      }
      return json(passos);
    }

    const token = await getPlatformToken(clientId, clientSecret);

    if (acao === 'listar') {
      const merchants = await listarMerchants(token);
      // Loja já vinculada a OUTRA loja do MiseOn não pode ser escolhida duas
      // vezes: dois cadastros recebendo o mesmo pedido do iFood duplicaria
      // venda e baixa de estoque.
      const { data: usadas } = await admin
        .from('lojas').select('id, nome, ifood_merchant_id')
        .not('ifood_merchant_id', 'is', null);

      const ocupadas = new Map(
        (usadas ?? [])
          .filter((l: { id: string }) => l.id !== lojaId)
          .map((l: { ifood_merchant_id: string; nome: string }) => [l.ifood_merchant_id, l.nome]),
      );

      return json({
        merchants: merchants.map((m) => ({
          id: m.id,
          nome: m.name ?? m.corporateName ?? '(sem nome)',
          jaVinculadaEm: ocupadas.get(m.id) ?? null,
        })),
      });
    }

    if (acao === 'vincular') {
      if (!merchantId) return erro('Escolha a loja do iFood para vincular.');

      const merchants = await listarMerchants(token);
      const escolhida = merchants.find((m) => m.id === merchantId);
      if (!escolhida) {
        return erro(
          'Essa loja não aparece mais entre as que o aplicativo enxerga. ' +
          'Atualize a lista e escolha de novo.',
          404,
        );
      }

      const { data: conflito } = await admin
        .from('lojas').select('id, nome')
        .eq('ifood_merchant_id', merchantId).neq('id', lojaId).maybeSingle();
      if (conflito) {
        return erro(
          `Esta loja do iFood já está conectada em "${conflito.nome}". ` +
          'Desconecte lá antes de conectar aqui, senão o mesmo pedido entraria duas vezes.',
          409,
        );
      }

      const { error: errUpdate } = await admin
        .from('lojas')
        .update({ ifood_merchant_id: merchantId })
        .eq('id', lojaId);
      if (errUpdate) return erro(`Não consegui salvar o vínculo: ${errUpdate.message}`, 500);

      return json({
        success: true,
        merchantId,
        nome: escolhida.name ?? escolhida.corporateName ?? null,
      });
    }

    return erro(`Ação desconhecida: ${acao}`);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
});
