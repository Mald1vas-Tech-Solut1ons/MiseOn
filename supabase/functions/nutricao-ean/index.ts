// MiseOn — Edge Function: nutrição por código de barras (NUT-10)
//
// Caminho ① do PLANO-NUTRICIONAL §5.1: o lojista (ou a conferência de compra,
// NUT-09) já tem o GTIN do produto. Em vez de digitar a tabela nutricional,
// buscamos no Open Food Facts (ODbL, atribuição obrigatória) e devolvemos uma
// SUGESTÃO — nunca gravamos como revisado. ADR-02: humano publica.
//
// Cache: platform-wide em alimentos_referencia (fonte='ROTULO_FABRICANTE',
// codigo_fonte=gtin). Duas lojas que compram o mesmo produto de fabricante
// não pagam a chamada externa duas vezes — e a proveniência (fonte_url) vai
// junto, o que é exigência de licença (ODbL) e de defensabilidade (ADR-06).
//
// R-05 (risco de licença): consumimos por *lookup* e gravamos o valor como
// dado do insumo do lojista, com atribuição — não redistribuímos a base do
// Open Food Facts como base. A fronteira jurídica exata fica para antes do GA.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...cors, ...(init.headers ?? {}) },
  });

function erro(msg: string, status = 400) {
  return json({ error: msg }, { status });
}

// De-para: chave do Open Food Facts (sempre por 100 g/ml, exceto energia) →
// código do catálogo public.nutrientes. `off_para_mg` marca os campos que a
// OFF publica em gramas mas nosso catálogo declara em miligramas (SODIO).
const MAPA_NUTRIENTES: Array<{ off: string; codigo: string; off_para_mg?: boolean }> = [
  { off: 'energy-kcal_100g', codigo: 'ENERGIA_KCAL' },
  { off: 'carbohydrates_100g', codigo: 'CARBOIDRATOS' },
  { off: 'sugars_100g', codigo: 'ACUCARES_TOTAIS' },
  { off: 'proteins_100g', codigo: 'PROTEINAS' },
  { off: 'fat_100g', codigo: 'GORDURAS_TOTAIS' },
  { off: 'saturated-fat_100g', codigo: 'GORDURAS_SATURADAS' },
  { off: 'trans-fat_100g', codigo: 'GORDURAS_TRANS' },
  { off: 'cholesterol_100g', codigo: 'COLESTEROL', off_para_mg: true },
  { off: 'fiber_100g', codigo: 'FIBRAS_ALIMENTARES' },
  { off: 'sodium_100g', codigo: 'SODIO', off_para_mg: true },
];

// Taxonomia da OFF (inglês, com prefixo "en:") → o vocabulário do MiseOn
// (RDC 26/2015, mesmo usado em ModalNutricaoInsumo.tsx). Só entra em
// alergenos_contem o que a OFF afirma explicitamente — omissão nunca vira
// "não contém" (ADR-03).
const MAPA_ALERGENOS: Record<string, string> = {
  'en:gluten': 'Trigo/Glúten',
  'en:wheat': 'Trigo/Glúten',
  'en:rye': 'Centeio',
  'en:barley': 'Cevada',
  'en:oats': 'Aveia',
  'en:crustaceans': 'Crustáceos',
  'en:eggs': 'Ovos',
  'en:fish': 'Peixes',
  'en:peanuts': 'Amendoim',
  'en:soybeans': 'Soja',
  'en:milk': 'Leite',
  'en:nuts': 'Castanhas/Nozes',
  'en:latex-natural-rubber': 'Látex natural',
};

function mapearNutrientes(nutriments: Record<string, unknown>) {
  const nutrientes: Record<string, number> = {};
  for (const { off, codigo, off_para_mg } of MAPA_NUTRIENTES) {
    const v = nutriments[off];
    if (v === null || v === undefined) continue; // ausente é ausente — nunca zero (ADR-06)
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    nutrientes[codigo] = off_para_mg ? n * 1000 : n;
  }
  return nutrientes;
}

function mapearAlergenos(tags: string[] | undefined) {
  const contem = new Set<string>();
  for (const tag of tags ?? []) {
    const nome = MAPA_ALERGENOS[tag];
    if (nome) contem.add(nome);
  }
  return Array.from(contem);
}

// Σ(macro × fator energético) deve bater com a kcal declarada, ±20% — mesmo
// princípio de sanidade do OCR (NUT-11). Aqui só sinaliza; nunca descarta.
function sanidadeEnergetica(n: Record<string, number>): boolean | null {
  if (n.ENERGIA_KCAL == null) return null;
  const calc = (n.CARBOIDRATOS ?? 0) * 4 + (n.PROTEINAS ?? 0) * 4 + (n.GORDURAS_TOTAIS ?? 0) * 9;
  if (calc === 0) return null;
  return Math.abs(calc - n.ENERGIA_KCAL) <= n.ENERGIA_KCAL * 0.2;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { insumo_id, gtin } = await req.json();
    if (!insumo_id || !gtin) return erro('insumo_id e gtin são obrigatórios');
    const gtinLimpo = String(gtin).replace(/\D/g, '');
    if (gtinLimpo.length < 8) return erro('GTIN inválido — precisa ter ao menos 8 dígitos');

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: { user: caller } } = await supabaseAuth.auth.getUser();
    if (!caller) return erro('Não autenticado', 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: insumo } = await admin
      .from('insumos').select('id, loja_id, nome').eq('id', insumo_id).maybeSingle();
    if (!insumo) return erro('Insumo não encontrado', 404);

    const { data: acesso } = await admin
      .from('usuarios_loja').select('papel').eq('user_id', caller.id).eq('loja_id', insumo.loja_id).maybeSingle();
    if (!acesso || !['admin', 'operador'].includes(acesso.papel)) {
      return erro('Sem permissão nesta loja', 403);
    }

    // 1) Cache local: já buscamos este GTIN para QUALQUER loja antes?
    let referencia = (
      await admin.from('alimentos_referencia')
        .select('*').eq('fonte', 'ROTULO_FABRICANTE').eq('codigo_fonte', gtinLimpo).maybeSingle()
    ).data;

    if (!referencia) {
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${gtinLimpo}.json`);
      if (!r.ok) return erro('Open Food Facts indisponível no momento', 502);
      const off = await r.json();

      if (off.status !== 1 || !off.product) {
        return json({ encontrado: false, motivo: 'Produto não está no Open Food Facts — tente a foto do rótulo.' });
      }

      const nutriments = off.product.nutriments ?? {};
      const nutrientes = mapearNutrientes(nutriments);
      if (Object.keys(nutrientes).length === 0 || nutrientes.ENERGIA_KCAL == null) {
        return json({ encontrado: false, motivo: 'Produto encontrado, mas sem tabela nutricional legível na base.' });
      }

      // Base: OFF expressa "_100g" mesmo para líquidos na maioria dos casos;
      // só troca para ml quando o produto declara volume como quantidade.
      const baseUnidade = /\bml\b|litro/i.test(off.product.quantity ?? '') ? 'ml' : 'g';

      const { data: novaRef, error: erroRef } = await admin
        .from('alimentos_referencia')
        .insert({
          fonte: 'ROTULO_FABRICANTE',
          fonte_versao: `Open Food Facts — consulta ${new Date().toISOString().slice(0, 10)}`,
          fonte_url: `https://world.openfoodfacts.org/product/${gtinLimpo}`,
          licenca: 'ODbL-1.0',
          codigo_fonte: gtinLimpo,
          nome: off.product.product_name || off.product.brands || `Produto ${gtinLimpo}`,
          nome_pt: off.product.product_name_pt || off.product.product_name || null,
          base_qtd: 100,
          base_unidade: baseUnidade,
          nutrientes,
          alergenos_contem: mapearAlergenos(off.product.allergens_tags),
        })
        .select('*').single();
      if (erroRef) return erro(`Falha ao gravar base de referência: ${erroRef.message}`, 500);
      referencia = novaRef;
    }

    const sanidadeOk = sanidadeEnergetica(referencia.nutrientes as Record<string, number>);

    // 2) Sugestão para ESTE insumo desta loja — sempre não revisada (ADR-02).
    const { error: erroSugestao } = await admin.from('insumos_nutricao').upsert({
      insumo_id: insumo.id,
      loja_id: insumo.loja_id,
      base_qtd: referencia.base_qtd,
      base_unidade: referencia.base_unidade,
      nutrientes: referencia.nutrientes,
      alergenos_contem: referencia.alergenos_contem,
      alergenos_pode_conter: [],
      origem: 'ROTULO_EAN',
      fonte_ref: referencia.id,
      fonte_versao: referencia.fonte_versao,
      fonte_url: referencia.fonte_url,
      confianca: sanidadeOk === false ? 0.5 : 0.85,
      revisado: false,
      atualizado_em: new Date().toISOString(),
    });
    if (erroSugestao) return erro(`Falha ao gravar sugestão: ${erroSugestao.message}`, 500);

    // GTIN aprendido: se o insumo ainda não tinha, grava — próxima compra já
    // reconhece o produto sem digitar nada (fecha o laço com NUT-09).
    await admin.from('insumos').update({ gtin: gtinLimpo }).eq('id', insumo.id).is('gtin', null);

    return json({
      encontrado: true,
      nome_referencia: referencia.nome,
      base_qtd: referencia.base_qtd,
      base_unidade: referencia.base_unidade,
      nutrientes: referencia.nutrientes,
      alergenos_contem: referencia.alergenos_contem,
      fonte_url: referencia.fonte_url,
      sanidade_energetica: sanidadeOk,
      revisado: false,
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
});
