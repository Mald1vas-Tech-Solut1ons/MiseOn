// MiseOn — Edge Function: ifood-catalog-import
//
// POR QUE ISTO EXISTE:
// O `ifood-catalog-sync` já empurra o cardápio do MiseOn → iFood.
// Esta função inverte o sentido: lê o catálogo que o lojista MANTÉM no iFood
// e importa para o MiseOn — categorias, produtos, adicionais e preços.
//
// É o maior acelerador de implantação disponível: um lojista que já tem
// cardápio no iFood não precisa redigitar nada. Dias viram minutos.
//
// Fluxo:
//   GET /catalog/v2.0/merchants/{m}/catalogs
//   GET /catalog/v2.0/merchants/{m}/catalogs/{c}/categories?include_items=true
//   → mapeia para categorias + produtos + grupos_opcoes + opcoes no MiseOn
//
// A função retorna um DIFF (novo/atualizado/sem_alteracao) sem gravar nada.
// O front chama novamente com `confirmar: true` para persistir.
//
// Idempotência: produtos são casados pelo `externalCode` (pdv_code) do iFood.
// Sem externalCode, o nome é usado como fallback para evitar duplicatas.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { checkRateLimit, ipDaRequisicao } from '../_shared/rate-limit.ts';

const IFOOD = 'https://merchant-api.ifood.com.br';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

interface IfoodOption {
  id: string;
  name: string;
  externalCode?: string;
  price?: { value?: number };
  status?: string;
}

interface IfoodOptionGroup {
  id: string;
  name: string;
  externalCode?: string;
  min?: number;
  max?: number;
  index?: number;
  optionIds?: string[];
}

interface IfoodProduct {
  id: string;
  name: string;
  description?: string;
  externalCode?: string;
  imagePath?: string;
  optionGroups?: IfoodOptionGroup[];
}

interface IfoodItem {
  id: string;
  externalCode?: string;
  status?: string;
  price?: { value?: number };
  productId?: string;
  products?: IfoodProduct[];
  optionGroups?: IfoodOptionGroup[];
  options?: IfoodOption[];
}

interface IfoodCategory {
  id: string;
  name: string;
  externalCode?: string;
  status?: string;
  items?: IfoodItem[];
}

interface DiffItem {
  acao: 'NOVO' | 'ATUALIZADO' | 'SEM_ALTERACAO';
  nome: string;
  preco: number;
  categoria: string;
  pdv_code?: string;
  produto_id_existente?: string;
  imagem_url?: string;
  descricao?: string;
  opcoes_count: number;
}

interface DiffResult {
  categorias: { nome: string; acao: 'NOVA' | 'EXISTENTE'; categoria_id_existente?: string }[];
  produtos: DiffItem[];
  resumo: { novos: number; atualizados: number; sem_alteracao: number; categorias_novas: number };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  // Rate limit: importação é operação pesada e rara. 5/min por IP.
  const rl = await checkRateLimit(`ifood-catalog-import:${ipDaRequisicao(req)}`, {
    windowMs: 60_000,
    maxRequests: 5,
  });
  if (!rl.allowed) return json({ error: 'Muitas requisições. Tente em instantes.' }, 429);

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const body = await req.json().catch(() => ({}));
  const { loja_id, confirmar = false } = body;

  if (!loja_id) return json({ error: 'loja_id obrigatório' }, 400);

  // ── AUTORIZAÇÃO ───────────────────────────────────────────────────────
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!bearer) return json({ error: 'Não autorizado' }, 401);

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
      return json({ error: 'Só o administrador da loja pode importar o cardápio' }, 403);
    }
  }

  const clientId = Deno.env.get('IFOOD_CLIENT_ID');
  const clientSecret = Deno.env.get('IFOOD_CLIENT_SECRET');
  if (!clientId || !clientSecret) return json({ error: 'Credenciais iFood ausentes no servidor' }, 500);

  const { data: loja } = await supabase
    .from('lojas')
    .select('id, ifood_merchant_id')
    .eq('id', loja_id).maybeSingle();

  if (!loja?.ifood_merchant_id) {
    return json({ error: 'Loja sem iFood conectado. Vincule sua loja na aba Conexão.' }, 422);
  }

  const merchant = loja.ifood_merchant_id;

  try {
    const token = await getPlatformToken(clientId, clientSecret);
    const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    // ── 1. Descobrir o catálogo de DELIVERY ──────────────────────────────
    const resCat = await fetch(`${IFOOD}/catalog/v2.0/merchants/${merchant}/catalogs`, { headers: auth });
    if (!resCat.ok) {
      const err = (await resCat.text()).slice(0, 300);
      return json({ error: `Falha ao listar catálogos iFood (${resCat.status}): ${err}` }, 502);
    }
    const catalogos = await resCat.json();
    const catalogo = (Array.isArray(catalogos) ? catalogos : []).find(
      (c: any) => c.context?.includes?.('DELIVERY') || c.catalogContext === 'DELIVERY',
    ) ?? (Array.isArray(catalogos) ? catalogos[0] : null);

    if (!catalogo?.catalogId) {
      return json({ error: 'Nenhum catálogo disponível para esta loja no iFood' }, 422);
    }

    // ── 2. Buscar categorias + itens ─────────────────────────────────────
    const resCats = await fetch(
      `${IFOOD}/catalog/v2.0/merchants/${merchant}/catalogs/${catalogo.catalogId}/categories?include_items=true`,
      { headers: auth },
    );
    if (!resCats.ok) {
      const err = (await resCats.text()).slice(0, 300);
      return json({ error: `Falha ao buscar categorias iFood (${resCats.status}): ${err}` }, 502);
    }
    const categorias: IfoodCategory[] = await resCats.json();

    // ── 3. Carregar estado atual do MiseOn para calcular o diff ──────────
    const { data: produtosExistentes } = await supabase
      .from('produtos')
      .select('id, nome, preco, pdv_code, categoria_id, categorias(nome)')
      .eq('loja_id', loja_id);

    const { data: categoriasExistentes } = await supabase
      .from('categorias')
      .select('id, nome')
      .eq('loja_id', loja_id);

    const mapPdvCode = new Map<string, any>(
      (produtosExistentes ?? [])
        .filter((p) => p.pdv_code)
        .map((p) => [p.pdv_code!, p]),
    );
    const mapNome = new Map<string, any>(
      (produtosExistentes ?? []).map((p) => [p.nome.toLowerCase().trim(), p]),
    );
    const mapCategoriaNome = new Map<string, any>(
      (categoriasExistentes ?? []).map((c) => [c.nome.toLowerCase().trim(), c]),
    );

    // ── 4. Calcular DIFF ─────────────────────────────────────────────────
    const diff: DiffResult = {
      categorias: [],
      produtos: [],
      resumo: { novos: 0, atualizados: 0, sem_alteracao: 0, categorias_novas: 0 },
    };

    const mapIfoodOptions = new Map<string, IfoodOption>();

    for (const cat of categorias) {
      const catNome = cat.name?.trim() ?? '';
      const catExistente = mapCategoriaNome.get(catNome.toLowerCase());

      diff.categorias.push({
        nome: catNome,
        acao: catExistente ? 'EXISTENTE' : 'NOVA',
        categoria_id_existente: catExistente?.id,
      });
      if (!catExistente) diff.resumo.categorias_novas++;

      // Indexar todas as options globalmente (iFood separa options por lista)
      for (const item of cat.items ?? []) {
        for (const opt of item.options ?? []) {
          mapIfoodOptions.set(opt.id, opt);
        }
      }

      for (const item of cat.items ?? []) {
        if (!item.products?.length) continue;
        const produto = item.products[0];
        const nome = produto.name?.trim() ?? '';
        const preco = item.price?.value ?? 0;
        const pdvCode = item.externalCode ?? produto.externalCode ?? item.id;
        const descricao = produto.description?.trim() ?? '';
        const imagemUrl = produto.imagePath ?? null;

        // Contar opções
        let opcoesCount = 0;
        for (const og of item.optionGroups ?? []) {
          opcoesCount += og.optionIds?.length ?? 0;
        }

        const existentePorCode = pdvCode ? mapPdvCode.get(pdvCode) : null;
        const existentePorNome = mapNome.get(nome.toLowerCase().trim());
        const existente = existentePorCode ?? existentePorNome;

        let acao: DiffItem['acao'];
        if (!existente) {
          acao = 'NOVO';
          diff.resumo.novos++;
        } else if (
          Math.abs(Number(existente.preco) - preco) > 0.01 ||
          (pdvCode && existente.pdv_code !== pdvCode)
        ) {
          acao = 'ATUALIZADO';
          diff.resumo.atualizados++;
        } else {
          acao = 'SEM_ALTERACAO';
          diff.resumo.sem_alteracao++;
        }

        diff.produtos.push({
          acao,
          nome,
          preco,
          categoria: catNome,
          pdv_code: pdvCode,
          produto_id_existente: existente?.id,
          descricao: descricao || undefined,
          imagem_url: imagemUrl ?? undefined,
          opcoes_count: opcoesCount,
        });
      }
    }

    // ── 5. Se só quer a prévia, retorna o diff ───────────────────────────
    if (!confirmar) {
      return json({ ok: true, diff, catalogo_id: catalogo.catalogId });
    }

    // ── 6. CONFIRMAR: persistir no banco ─────────────────────────────────
    let gravados = 0;
    let falhas = 0;

    for (const cat of categorias) {
      const catNome = cat.name?.trim() ?? '';
      let categoriaId: string;

      // Criar categoria se não existe
      const catExistente = mapCategoriaNome.get(catNome.toLowerCase());
      if (catExistente) {
        categoriaId = catExistente.id;
      } else {
        const { data: novaCat, error: errCat } = await supabase
          .from('categorias')
          .insert({ loja_id, nome: catNome, ativo: true, ifood_category_id: cat.id })
          .select('id').single();
        if (errCat || !novaCat) { falhas++; continue; }
        categoriaId = novaCat.id;
        mapCategoriaNome.set(catNome.toLowerCase(), { id: categoriaId, nome: catNome });
      }

      for (const item of cat.items ?? []) {
        if (!item.products?.length) continue;
        const produto = item.products[0];
        const nome = produto.name?.trim() ?? '';
        const preco = item.price?.value ?? 0;
        const pdvCode = item.externalCode ?? produto.externalCode ?? item.id;
        const descricao = produto.description?.trim() || null;

        const existentePorCode = pdvCode ? mapPdvCode.get(pdvCode) : null;
        const existentePorNome = mapNome.get(nome.toLowerCase().trim());
        const existente = existentePorCode ?? existentePorNome;

        if (existente) {
          // Atualizar produto existente
          const { error } = await supabase
            .from('produtos')
            .update({
              nome,
              preco,
              descricao,
              pdv_code: pdvCode,
              categoria_id: categoriaId,
              ...(produto.imagePath ? { imagem_url: produto.imagePath } : {}),
            })
            .eq('id', existente.id);
          if (error) falhas++;
          else {
            gravados++;
            mapPdvCode.set(pdvCode, { ...existente, id: existente.id });
          }
        } else {
          // Criar produto novo
          const { data: novoProd, error } = await supabase
            .from('produtos')
            .insert({
              loja_id,
              categoria_id: categoriaId,
              nome,
              preco,
              descricao,
              pdv_code: pdvCode,
              disponivel: item.status !== 'UNAVAILABLE',
              ...(produto.imagePath ? { imagem_url: produto.imagePath } : {}),
            })
            .select('id').single();

          if (error || !novoProd) { falhas++; continue; }
          gravados++;

          // Criar grupos de opções e opções
          for (const og of item.optionGroups ?? []) {
            const { data: novoGrupo } = await supabase
              .from('grupos_opcoes')
              .insert({
                produto_id: novoProd.id,
                loja_id,
                nome: og.name,
                min_escolhas: og.min ?? 0,
                max_escolhas: og.max ?? 1,
                ordem: og.index ?? 0,
              })
              .select('id').single();

            if (!novoGrupo) continue;

            for (const optId of og.optionIds ?? []) {
              const opt = mapIfoodOptions.get(optId);
              if (!opt) continue;
              await supabase.from('adicionais').insert({
                grupo_id: novoGrupo.id,
                loja_id,
                nome: opt.name,
                preco_adicional: opt.price?.value ?? 0,
                disponivel: opt.status !== 'UNAVAILABLE',
              });
            }
          }
        }
      }
    }

    return json({
      ok: falhas === 0,
      gravados,
      falhas,
      resumo: diff.resumo,
    });

  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    console.error('Erro no ifood-catalog-import:', msg);
    return json({ error: msg }, 500);
  }
});
