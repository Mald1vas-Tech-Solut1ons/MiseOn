// MiseOn — Edge Function: sincroniza o cardápio do MiseOn com o iFood
//
// POR QUE ISTO EXISTE:
// Sem o módulo Catalog, o lojista mantém o cardápio DUAS vezes — aqui e no
// portal do iFood. Preço, descrição, disponibilidade e complemento em dobro.
// Na prática o que acontece é: sobe o preço da carne, ele atualiza num lugar
// e esquece do outro, e passa a vender no iFood abaixo do custo. Ou acaba o
// item, ele pausa no KDS e o iFood continua vendendo.
//
// Hierarquia do iFood (catalog v2.0):
//   catálogo -> categoria -> item -> produto
//                          -> optionGroup -> option
// O MiseOn tem categoria -> produto -> grupo_opcoes -> opcao, que mapeia 1:1.
//
// Endpoints usados (conferidos na doc oficial, não de memória):
//   GET   /catalog/v2.0/merchants/{m}/catalogs
//   GET   /catalog/v2.0/merchants/{m}/catalogs/{c}/categories?include_items=true
//   PUT   /catalog/v2.0/merchants/{m}/items          -> cria/atualiza item inteiro
//   PATCH /catalog/v2.0/merchants/{m}/items/price    -> só preço (devolve batchId)
//   PATCH /catalog/v2.0/merchants/{m}/items/status   -> só disponibilidade
//
// O PUT /items exige os QUATRO campos sempre — item, products, optionGroups e
// options — mesmo quando os dois últimos vão vazios.
//
// Idempotência: `externalCode` leva o id do MiseOn, e os ids que o iFood
// devolve ficam gravados em produtos.ifood_item_id / ifood_product_id. Sem
// isso, cada execução criaria o cardápio inteiro de novo, duplicado.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { checkRateLimit, ipDaRequisicao } from '../_shared/rate-limit.ts';

const IFOOD = 'https://merchant-api.ifood.com.br';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-chat-session',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function getPlatformToken(clientId: string, clientSecret: string): Promise<string> {
  const body = new URLSearchParams({ grantType: 'client_credentials', clientId, clientSecret });
  const res = await fetch(`${IFOOD}/authentication/v1.0/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Falha ao autenticar no iFood: ${res.status}`);
  const { accessToken } = await res.json();
  return accessToken;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  // Freio de vazao. A funcao ja exige autorizacao propria; o limite existe
  // para que tentativa em massa contra ela — ou um token vazado — nao vire
  // custo nem volume ilimitado. Em falha de banco o limitador DEIXA PASSAR
  // (ver _shared/rate-limit.ts), entao nao vira um novo ponto unico de queda.
  // 10/min por IP: sincronizacao de cardapio e pesada e rara.
  const rl = await checkRateLimit(`ifood-catalog-sync:${ipDaRequisicao(req)}`, {
    windowMs: 60_000,
    maxRequests: 10,
  });
  if (!rl.allowed) return json({ error: 'Muitas requisicoes. Tente em instantes.' }, 429);

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { loja_id } = await req.json().catch(() => ({ loja_id: null }));
  if (!loja_id) return json({ error: 'loja_id obrigatório' }, 400);

  // ── AUTORIZAÇÃO ────────────────────────────────────────────────────────
  // Sincronizar cardápio reescreve preço e disponibilidade no iFood da loja.
  // Só admin dela, ou chamada interna.
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!bearer) return json({ error: 'Não autorizado' }, 401);

  // Comparar a chave por string quebra quando existe mais de uma service key
  // válida (rotação, chave legada x nova). O que importa é a claim `role` do
  // JWT — mesmo critério que fiscal-emitir-nfse já usa.
  const ehServiceRole = (() => {
    if (bearer === serviceKey) return true;
    try {
      const payload = bearer.split('.')[1];
      if (!payload) return false;
      const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
      return claims?.role === 'service_role';
    } catch { return false; }
  })();

  if (!ehServiceRole) {
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Não autorizado' }, 401);
    const { data: vinculo } = await supabase
      .from('usuarios_loja').select('papel')
      .eq('user_id', user.id).eq('loja_id', loja_id).maybeSingle();
    if (vinculo?.papel !== 'admin') {
      return json({ error: 'Só o administrador da loja pode sincronizar o cardápio' }, 403);
    }
  }

  const clientId = Deno.env.get('IFOOD_CLIENT_ID');
  const clientSecret = Deno.env.get('IFOOD_CLIENT_SECRET');
  if (!clientId || !clientSecret) return json({ error: 'Credenciais iFood ausentes' }, 500);

  const { data: loja } = await supabase
    .from('lojas')
    .select('id, nome, ifood_merchant_id, ifood_addon_ativo, ifood_sync_cardapio, ifood_sync_preco_auto, ifood_sync_disponibilidade')
    .eq('id', loja_id).maybeSingle();
  if (!loja?.ifood_merchant_id) {
    return json({ error: 'Loja sem iFood integrado (ifood_merchant_id ausente)' }, 422);
  }

  // ── PREFERENCIAS DA LOJA ───────────────────────────────────────────────
  // Nada e imposto: o lojista decide se o cardapio daqui manda no de la.
  // Havia um `ifood_addon_ativo` no banco que esta funcao ignorava — passa a
  // valer como interruptor geral da integracao.
  if (!loja.ifood_addon_ativo) {
    return json({ error: 'Integração iFood desativada para esta loja', chave: 'ifood_addon_ativo' }, 409);
  }
  if (!loja.ifood_sync_cardapio) {
    return json({ error: 'Sincronização de cardápio desligada nas preferências da loja', chave: 'ifood_sync_cardapio' }, 409);
  }
  const merchant = loja.ifood_merchant_id;

  // Registra a execução antes de começar: sync que morre no meio precisa
  // deixar rastro, senão o lojista descobre pelo cliente reclamando.
  const { data: exec } = await supabase
    .from('ifood_catalog_sync').insert({ loja_id }).select('id').single();
  const execId = exec?.id;

  const encerrar = async (campos: Record<string, unknown>) => {
    if (execId) {
      await supabase.from('ifood_catalog_sync')
        .update({ concluido_em: new Date().toISOString(), ...campos }).eq('id', execId);
    }
  };

  try {
    const token = await getPlatformToken(clientId, clientSecret);
    const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    // 1. Descobre o catálogo de DELIVERY da loja.
    const resCat = await fetch(`${IFOOD}/catalog/v2.0/merchants/${merchant}/catalogs`, { headers: auth });
    if (!resCat.ok) {
      const erro = (await resCat.text()).slice(0, 300);
      await encerrar({ situacao: 'erro', erro: `catalogs ${resCat.status}: ${erro}` });
      return json({ error: 'Falha ao listar catálogos', status: resCat.status, detalhe: erro }, 502);
    }
    const catalogos = await resCat.json();
    const catalogo = (Array.isArray(catalogos) ? catalogos : []).find(
      (c: any) => c.context?.includes?.('DELIVERY') || c.catalogContext === 'DELIVERY',
    ) ?? catalogos?.[0];
    if (!catalogo?.catalogId) {
      await encerrar({ situacao: 'erro', erro: 'nenhum catálogo retornado pelo iFood' });
      return json({ error: 'Nenhum catálogo disponível para esta loja no iFood' }, 422);
    }

    // 2. Categorias e produtos do MiseOn.
    const { data: categorias } = await supabase
      .from('categorias')
      .select('id, nome, ordem, ativo, ifood_category_id')
      .eq('loja_id', loja_id).order('ordem');

    let catsEnviadas = 0, itensEnviados = 0, falhas = 0;
    const detalhe: any[] = [];

    for (const cat of categorias ?? []) {
      if (cat.ativo === false) continue;

      // 2a. Categoria: cria se ainda não tem id do iFood.
      let categoryId = cat.ifood_category_id;
      if (!categoryId) {
        const r = await fetch(
          `${IFOOD}/catalog/v2.0/merchants/${merchant}/catalogs/${catalogo.catalogId}/categories`,
          { method: 'POST', headers: auth,
            body: JSON.stringify({ name: cat.nome, externalCode: cat.id, status: 'AVAILABLE', index: cat.ordem ?? 0, template: 'DEFAULT' }) },
        );
        if (r.ok) {
          const criada = await r.json();
          categoryId = criada?.id ?? criada?.categoryId;
          if (categoryId) {
            await supabase.from('categorias').update({ ifood_category_id: categoryId }).eq('id', cat.id);
            catsEnviadas++;
          }
        } else {
          falhas++;
          detalhe.push({ categoria: cat.nome, status: r.status, erro: (await r.text()).slice(0, 200) });
          continue;
        }
      }
      if (!categoryId) { falhas++; continue; }

      // 2b. Produtos da categoria, com complementos.
      const { data: produtos } = await supabase
        .from('produtos')
        .select('id, nome, descricao, preco, imagem_url, disponivel, ordem, ifood_item_id, ifood_product_id, grupos_opcoes(id, nome, min_escolhas, max_escolhas, ordem, opcoes(id, nome, preco_adicional, disponivel))')
        .eq('categoria_id', cat.id);

      for (const p of produtos ?? []) {
        // O PUT /items exige os quatro campos sempre, mesmo vazios.
        // O iFood exige UUID nos ids de item/produto/grupo/opcao
        // (erro NotAnUUID em ItemDto.productId). Os ids do MiseOn ja sao
        // UUID, entao servem direto e ainda deixam a relacao 1:1 explicita
        // entre os dois catalogos — sem tabela de-para extra.
        const optionGroups = (p.grupos_opcoes ?? []).map((g: any) => ({
          id: g.id,
          name: g.nome,
          externalCode: g.id,
          status: 'AVAILABLE',
          min: g.min_escolhas ?? 0,
          max: g.max_escolhas ?? 1,
          index: g.ordem ?? 0,
          // O grupo precisa DECLARAR quais opcoes sao dele. Sem `optionIds` o
          // iFood recusa: "Options provided in payload but no optionGroups
          // have optionIds". Mandar as opcoes soltas nao basta.
          optionIds: (g.opcoes ?? []).map((o: any) => o.id),
        }));
        // No modelo do iFood, COMPLEMENTO tambem e produto: cada option
        // aponta para um productId e esse produto precisa estar no array
        // `products` do mesmo PUT. Sem isso vem NotAnUUID em
        // OptionDto.productId e o item inteiro e recusado.
        const opcoesPlanas = (p.grupos_opcoes ?? []).flatMap((g: any) =>
          (g.opcoes ?? []).map((o: any) => ({ grupo: g, opcao: o })),
        );

        const options = opcoesPlanas.map(({ grupo, opcao }) => ({
          id: opcao.id,
          productId: opcao.id,
          name: opcao.nome,
          externalCode: opcao.id,
          status: opcao.disponivel === false ? 'UNAVAILABLE' : 'AVAILABLE',
          price: { value: Number(opcao.preco_adicional ?? 0) },
          optionGroupId: grupo.id,
          optionGroupExternalCode: grupo.id,
          index: 0,
        }));

        const corpo: any = {
          item: {
            id: p.ifood_item_id ?? p.id,
            // productId liga o item ao produto do array `products`. Sem ele o
            // iFood devolve NotAnUUID e o item inteiro e recusado.
            productId: p.ifood_product_id ?? p.id,
            type: 'DEFAULT',
            categoryId,
            // Preco e disponibilidade so vao quando o lojista permitiu. Ha
            // quem mantenha preco maior no iFood por causa da comissao — e
            // sobrescrever isso silenciosamente faria a loja vender no
            // prejuizo. Sem a preferencia, mantem o que ja existe la.
            ...(loja.ifood_sync_disponibilidade
              ? { status: p.disponivel === false ? 'UNAVAILABLE' : 'AVAILABLE' }
              : {}),
            ...(loja.ifood_sync_preco_auto
              ? { price: { value: Number(p.preco ?? 0) } }
              : {}),
            externalCode: p.id,
            index: p.ordem ?? 0,
            shifts: [],
          },
          products: [{
            id: p.ifood_product_id ?? p.id,
            name: p.nome,
            description: p.descricao ?? '',
            externalCode: p.id,
            // O elo dos complementos fica no PRODUTO, nao no item — foi o que
            // custou tres rodadas de "resources are not linked correctly":
            // products[].optionGroups referencia os grupos por id.
            optionGroups: (p.grupos_opcoes ?? []).map((g: any) => ({
              id: g.id,
              min: g.min_escolhas ?? 0,
              max: g.max_escolhas ?? 1,
              index: g.ordem ?? 0,
            })),
            // imagePath NAO aceita URL externa: o iFood espera o caminho de
            // uma imagem hospedada neles, enviada antes por
            // POST /catalog/v2.0/merchants/{m}/image/upload. Mandar a URL do
            // nosso storage devolve InvalidFieldLength e derruba o item
            // inteiro. Fica de fora ate o upload de imagem existir — item sem
            // foto sincroniza; item recusado nao sincroniza nada.
          }],
          optionGroups,
          options,
        };

        // Produto de cada complemento entra no mesmo array `products`.
        corpo.products.push(
          ...opcoesPlanas.map(({ opcao }) => ({
            id: opcao.id,
            name: opcao.nome,
            externalCode: opcao.id,
          })),
        );

        const r = await fetch(`${IFOOD}/catalog/v2.0/merchants/${merchant}/items`, {
          method: 'PUT', headers: auth, body: JSON.stringify(corpo),
        });

        if (r.ok) {
          const salvo = await r.json().catch(() => ({}));
          const itemId = salvo?.item?.id ?? salvo?.id ?? p.ifood_item_id;
          const productId = salvo?.products?.[0]?.id ?? salvo?.productId ?? p.ifood_product_id;
          if (itemId || productId) {
            await supabase.from('produtos')
              .update({ ifood_item_id: itemId ?? null, ifood_product_id: productId ?? null })
              .eq('id', p.id);
          }
          itensEnviados++;
        } else {
          falhas++;
          detalhe.push({ produto: p.nome, status: r.status, erro: (await r.text()).slice(0, 200) });
        }
      }
    }

    const situacao = falhas === 0 ? 'concluido' : (itensEnviados > 0 ? 'parcial' : 'erro');
    await encerrar({
      situacao,
      categorias_enviadas: catsEnviadas,
      itens_enviados: itensEnviados,
      falhas,
      detalhe: detalhe.length ? detalhe.slice(0, 50) : null,
    });

    return json({ ok: falhas === 0, situacao, categorias: catsEnviadas, itens: itensEnviados, falhas, detalhe: detalhe.slice(0, 10) });
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    console.error('Erro no ifood-catalog-sync:', msg);
    await encerrar({ situacao: 'erro', erro: msg.slice(0, 500) });
    return json({ error: msg }, 500);
  }
});
