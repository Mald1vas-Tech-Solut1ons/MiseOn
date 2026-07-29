/**
 * Importador da base de referência nutricional — USDA FoodData Central.
 *
 * Por que USDA e não TACO/TBCA: os dados do USDA são domínio público (CC0),
 * uso comercial livre e API gratuita. A TACO é obra registrada sob a Lei
 * 9.610/98 e a TBCA exige licença paga para uso em outra ferramenta — as duas
 * são melhores para comida brasileira, e entram depois, com licença na mão.
 * Ver docs/PLANO-NUTRICIONAL.md §5.
 *
 * O de-para de nutrientes NÃO está aqui: ele é lido de public.nutrientes
 * (coluna usda_nutrient_number). Trocar ou estender a fonte é mudar dado, não
 * código.
 *
 * Uso:
 *   node scripts/importar-usda.mjs                 # tudo, com a chave do ambiente
 *   node scripts/importar-usda.mjs --limite 10     # amostra
 *   node scripts/importar-usda.mjs --forcar        # reimporta o que já existe
 *
 * Chave: USDA_API_KEY no ambiente ou em .env.local. Sem ela, cai em DEMO_KEY,
 * que funciona para provar o caminho mas é limitada (~30 req/h). A gratuita sai
 * em 30 segundos em https://fdc.nal.usda.gov/api-key-signup/
 */

import fs from 'node:fs';
import path from 'node:path';

const PROJECT_REF = 'zzuxklwhaoisuuvndtfw';
const FONTE = 'USDA_FDC';
const FONTE_VERSAO = 'FoodData Central 2026-07 (SR Legacy + Foundation)';
const LICENCA = 'CC0-1.0';
const FONTE_URL = 'https://fdc.nal.usda.gov/';

// ── Catálogo de alimentos: o que uma cozinha brasileira realmente compra ─────
// `pt` é o termo que o lojista digita; `q` é a busca no USDA; `grupo` organiza
// a UI. A tradução é humana de propósito — deixar a IA traduzir "patinho"
// resultaria em "duckling".
const ALIMENTOS = [
  // Carnes e ovos
  ['Peito de frango cru', 'chicken breast raw boneless skinless', 'Carnes'],
  ['Coxa de frango crua', 'chicken thigh raw', 'Carnes'],
  ['Carne moída bovina', 'ground beef raw', 'Carnes'],
  ['Patinho bovino', 'beef top round raw', 'Carnes'],
  ['Acém bovino', 'beef chuck raw', 'Carnes'],
  ['Contrafilé', 'beef strip loin raw', 'Carnes'],
  ['Costela suína', 'pork spareribs raw', 'Carnes'],
  ['Lombo suíno', 'pork loin raw', 'Carnes'],
  ['Bacon', 'bacon pork cured raw', 'Carnes'],
  ['Linguiça de porco', 'pork sausage fresh raw', 'Carnes'],
  ['Presunto', 'ham sliced', 'Carnes'],
  ['Peito de peru defumado', 'turkey breast smoked', 'Carnes'],
  ['Filé de tilápia', 'tilapia raw', 'Pescados'],
  ['Salmão', 'salmon atlantic raw', 'Pescados'],
  ['Camarão', 'shrimp raw', 'Pescados'],
  ['Ovo de galinha', 'egg whole raw fresh', 'Ovos'],

  // Laticínios
  ['Leite integral', 'milk whole 3.25% fat', 'Laticínios'],
  ['Leite desnatado', 'milk nonfat skim', 'Laticínios'],
  ['Creme de leite', 'cream heavy whipping', 'Laticínios'],
  ['Queijo muçarela', 'cheese mozzarella whole milk', 'Laticínios'],
  ['Queijo prato', 'cheese gouda', 'Laticínios'],
  ['Queijo parmesão', 'cheese parmesan grated', 'Laticínios'],
  ['Cream cheese', 'cheese cream', 'Laticínios'],
  ['Manteiga', 'butter salted', 'Laticínios'],
  ['Iogurte natural', 'yogurt plain whole milk', 'Laticínios'],
  ['Leite condensado', 'milk condensed sweetened', 'Laticínios'],

  // Grãos, cereais e panificação
  ['Arroz branco cru', 'rice white long grain raw', 'Grãos'],
  ['Arroz integral cru', 'rice brown long grain raw', 'Grãos'],
  ['Feijão carioca cru', 'beans pinto mature seeds raw', 'Grãos'],
  ['Feijão preto cru', 'beans black mature seeds raw', 'Grãos'],
  ['Lentilha crua', 'lentils raw', 'Grãos'],
  ['Grão de bico cru', 'chickpeas garbanzo raw', 'Grãos'],
  ['Macarrão cru', 'pasta dry enriched', 'Massas'],
  ['Farinha de trigo', 'wheat flour white all-purpose enriched', 'Farináceos'],
  ['Farinha de mandioca', 'cassava flour', 'Farináceos'],
  ['Fubá de milho', 'cornmeal yellow degermed', 'Farináceos'],
  ['Aveia em flocos', 'oats rolled', 'Farináceos'],
  ['Pão francês', 'bread french or vienna', 'Panificação'],
  ['Pão de forma', 'bread white commercially prepared', 'Panificação'],
  ['Amido de milho', 'cornstarch', 'Farináceos'],

  // Hortaliças e tubérculos
  ['Tomate', 'tomatoes red ripe raw', 'Hortaliças'],
  ['Cebola', 'onions raw', 'Hortaliças'],
  ['Alho', 'garlic raw', 'Hortaliças'],
  ['Batata inglesa', 'potatoes flesh and skin raw', 'Tubérculos'],
  ['Batata doce', 'sweet potato raw unprepared', 'Tubérculos'],
  ['Mandioca', 'cassava raw', 'Tubérculos'],
  ['Cenoura', 'carrots raw', 'Hortaliças'],
  ['Alface', 'lettuce green leaf raw', 'Hortaliças'],
  ['Repolho', 'cabbage raw', 'Hortaliças'],
  ['Pimentão verde', 'peppers sweet green raw', 'Hortaliças'],
  ['Abobrinha', 'squash summer zucchini raw', 'Hortaliças'],
  ['Brócolis', 'broccoli raw', 'Hortaliças'],
  ['Couve', 'kale raw', 'Hortaliças'],
  ['Beterraba', 'beets raw', 'Hortaliças'],
  ['Pepino', 'cucumber with peel raw', 'Hortaliças'],
  ['Milho verde', 'corn sweet yellow raw', 'Hortaliças'],
  ['Champignon', 'mushrooms white raw', 'Hortaliças'],
  ['Azeitona verde', 'olives green pickled', 'Hortaliças'],

  // Frutas
  ['Banana', 'bananas raw', 'Frutas'],
  ['Laranja', 'oranges raw navels', 'Frutas'],
  ['Limão', 'lemons raw without peel', 'Frutas'],
  ['Maçã', 'apples raw with skin', 'Frutas'],
  ['Abacaxi', 'pineapple raw', 'Frutas'],
  ['Manga', 'mangos raw', 'Frutas'],
  ['Mamão', 'papayas raw', 'Frutas'],
  ['Morango', 'strawberries raw', 'Frutas'],
  ['Abacate', 'avocados raw', 'Frutas'],
  ['Uva', 'grapes red or green raw', 'Frutas'],
  ['Maracujá', 'passion fruit purple raw', 'Frutas'],

  // Óleos e gorduras
  ['Óleo de soja', 'oil soybean salad or cooking', 'Óleos'],
  ['Azeite de oliva', 'oil olive salad or cooking', 'Óleos'],
  ['Margarina', 'margarine regular hard', 'Óleos'],
  ['Banha de porco', 'lard', 'Óleos'],

  // Açúcares, molhos e condimentos
  ['Açúcar refinado', 'sugars granulated', 'Açúcares'],
  ['Açúcar mascavo', 'sugars brown', 'Açúcares'],
  ['Mel', 'honey', 'Açúcares'],
  ['Sal refinado', 'salt table', 'Condimentos'],
  ['Molho de tomate', 'tomato sauce canned', 'Molhos'],
  ['Extrato de tomate', 'tomato paste canned', 'Molhos'],
  ['Ketchup', 'catsup', 'Molhos'],
  ['Maionese', 'mayonnaise regular', 'Molhos'],
  ['Mostarda', 'mustard prepared yellow', 'Molhos'],
  ['Molho shoyu', 'soy sauce made from soy and wheat', 'Molhos'],
  ['Vinagre', 'vinegar distilled', 'Condimentos'],
  ['Leite de coco', 'coconut milk canned', 'Molhos'],

  // Outros
  ['Chocolate em pó', 'cocoa dry powder unsweetened', 'Outros'],
  ['Castanha de caju', 'nuts cashew nuts raw', 'Oleaginosas'],
  ['Amendoim', 'peanuts all types raw', 'Oleaginosas'],
  ['Coco ralado', 'nuts coconut meat dried desiccated', 'Oleaginosas'],
];

// ── Infra ───────────────────────────────────────────────────────────────────

function lerEnvLocal(chave) {
  try {
    const txt = fs.readFileSync(path.resolve('.env.local'), 'utf8');
    const m = txt.match(new RegExp(`^${chave}=(.*)$`, 'm'));
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
  } catch {
    return null;
  }
}

const PAT = process.env.SUPABASE_ACCESS_TOKEN || lerEnvLocal('SUPABASE_ACCESS_TOKEN');
const USDA_KEY = process.env.USDA_API_KEY || lerEnvLocal('USDA_API_KEY') || 'DEMO_KEY';

if (!PAT) {
  console.error('SUPABASE_ACCESS_TOKEN ausente (ambiente ou .env.local).');
  process.exit(1);
}

/** Executa SQL via Management API. Segue o procedimento já usado no projeto. */
async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`SQL ${r.status}: ${txt.slice(0, 400)}`);
  return JSON.parse(txt);
}

/** Literal SQL a partir de qualquer valor JSON-serializável. */
const lit = (v) => `'${JSON.stringify(v).replace(/'/g, "''")}'`;

const dormir = (ms) => new Promise((res) => setTimeout(res, ms));

// ── Importação ──────────────────────────────────────────────────────────────

async function buscarPorTipo(termo, dataType) {
  const url =
    'https://api.nal.usda.gov/fdc/v1/foods/search' +
    `?query=${encodeURIComponent(termo)}` +
    `&dataType=${encodeURIComponent(dataType)}` +
    '&pageSize=5' +
    `&api_key=${USDA_KEY}`;

  const r = await fetch(url);
  if (r.status === 429) throw new Error('RATE_LIMIT');
  if (!r.ok) throw new Error(`USDA ${r.status}`);
  const d = await r.json();
  return d.foods ?? [];
}

/** Quantas palavras do termo de busca aparecem na descrição do alimento. */
function pontuarRelevancia(termo, descricao) {
  const desc = descricao.toLowerCase();
  const palavras = termo.toLowerCase().split(/\s+/).filter((p) => p.length > 2);
  return palavras.filter((p) => desc.includes(p)).length;
}

/**
 * O endpoint de busca do USDA rankeia por relevância textual geral, não por
 * cobertura de palavras-chave — "cassava flour" pode devolver "Cassava, raw"
 * na frente de "Flour, cassava", e "coconut milk" pode devolver "coconut
 * cream" na frente. Por isso não confiamos no primeiro resultado: juntamos
 * candidatos de SR Legacy e Foundation, exigimos energia (Foundation às
 * vezes só publica nutrientes de laudo e omite energia), e escolhemos o de
 * maior sobreposição de palavras com o termo buscado. Empate favorece
 * SR Legacy, que tem o perfil de nutrientes mais completo.
 */
async function buscarNoUsda(termo) {
  const [srLegacy, foundation] = await Promise.all([
    buscarPorTipo(termo, 'SR Legacy'),
    buscarPorTipo(termo, 'Foundation'),
  ]);

  const candidatos = [
    ...srLegacy.map((f) => ({ f, prioridade: 1 })),
    ...foundation.map((f) => ({ f, prioridade: 0 })),
  ].filter(({ f }) =>
    (f.foodNutrients ?? []).some((n) => String(n.nutrientNumber) === '208' && n.value != null)
  );

  if (!candidatos.length) return null;

  candidatos.sort((a, b) => {
    const scoreA = pontuarRelevancia(termo, a.f.description);
    const scoreB = pontuarRelevancia(termo, b.f.description);
    if (scoreA !== scoreB) return scoreB - scoreA;
    return b.prioridade - a.prioridade;
  });

  return candidatos[0].f;
}

async function main() {
  const args = process.argv.slice(2);
  const limite = args.includes('--limite') ? Number(args[args.indexOf('--limite') + 1]) : Infinity;
  const forcar = args.includes('--forcar');

  if (USDA_KEY === 'DEMO_KEY') {
    console.warn('⚠  Usando DEMO_KEY (limite ~30 req/h). Chave própria: https://fdc.nal.usda.gov/api-key-signup/\n');
  }

  // O de-para vem do banco, não do código.
  const catalogo = await sql(
    `select codigo, usda_nutrient_number from public.nutrientes where usda_nutrient_number is not null and ativo;`
  );
  const porNumero = new Map(catalogo.map((n) => [String(n.usda_nutrient_number), n.codigo]));
  console.log(`Catálogo: ${porNumero.size} nutrientes mapeados para o USDA.`);

  const jaImportados = forcar
    ? new Set()
    : new Set(
        (await sql(`select nome_pt from public.alimentos_referencia where fonte = '${FONTE}';`))
          .map((r) => r.nome_pt)
      );

  const pendentes = ALIMENTOS.filter(([pt]) => !jaImportados.has(pt)).slice(0, limite);
  console.log(`${ALIMENTOS.length} no catálogo · ${jaImportados.size} já importados · ${pendentes.length} nesta rodada.\n`);

  const registros = [];
  const falhas = [];

  for (const [pt, q, grupo] of pendentes) {
    try {
      const food = await buscarNoUsda(q);
      if (!food) {
        falhas.push([pt, 'sem resultado no USDA']);
        console.log(`  ✗ ${pt} — sem resultado`);
        continue;
      }

      const nutrientes = {};
      for (const n of food.foodNutrients ?? []) {
        const codigo = porNumero.get(String(n.nutrientNumber));
        // null e undefined ficam de fora de propósito: campo ausente é ausente,
        // não zero. Zero significa "medido e deu zero".
        if (codigo && n.value !== null && n.value !== undefined) {
          nutrientes[codigo] = Number(n.value);
        }
      }

      if (!('ENERGIA_KCAL' in nutrientes)) {
        falhas.push([pt, 'sem valor energético']);
        console.log(`  ✗ ${pt} — veio sem kcal, descartado`);
        continue;
      }

      registros.push({
        fonte: FONTE,
        fonte_versao: FONTE_VERSAO,
        fonte_url: `${FONTE_URL}food-details/${food.fdcId}/nutrients`,
        licenca: LICENCA,
        codigo_fonte: String(food.fdcId),
        nome: food.description,
        nome_pt: pt,
        grupo,
        nutrientes,
      });
      console.log(`  ✓ ${pt} → ${food.description} (${Object.keys(nutrientes).length} nutrientes)`);

      await dormir(250); // educação com a API pública
    } catch (e) {
      if (e.message === 'RATE_LIMIT') {
        console.error('\n⚠  Limite da API atingido. O que já veio será gravado; rode de novo depois.');
        break;
      }
      falhas.push([pt, e.message]);
      console.log(`  ✗ ${pt} — ${e.message}`);
    }
  }

  // Dois termos em português podem cair no mesmo fdcId (a busca do USDA é por
  // relevância textual, não por identidade). Nesse caso o segundo mapeamento
  // está errado — "farinha de mandioca" com o perfil de "mandioca crua" seria
  // dado nutricional inventado sob um rótulo falso. Vira falha explícita, nunca
  // inserção silenciosa.
  const vistos = new Map();
  const unicos = [];
  for (const reg of registros) {
    const chave = `${reg.fonte}:${reg.codigo_fonte}`;
    if (vistos.has(chave)) {
      falhas.push([reg.nome_pt, `mesmo alimento USDA que "${vistos.get(chave)}" (fdcId ${reg.codigo_fonte}) — verificar termo de busca`]);
      console.log(`  ✗ ${reg.nome_pt} — colidiu com "${vistos.get(chave)}" no mesmo fdcId, descartado`);
      continue;
    }
    vistos.set(chave, reg.nome_pt);
    unicos.push(reg);
  }
  registros.length = 0;
  registros.push(...unicos);

  if (registros.length) {
    await sql(`
      insert into public.alimentos_referencia
        (fonte, fonte_versao, fonte_url, licenca, codigo_fonte, nome, nome_pt, grupo, nutrientes)
      select fonte, fonte_versao, fonte_url, licenca, codigo_fonte, nome, nome_pt, grupo, nutrientes
      from jsonb_to_recordset(${lit(registros)}::jsonb) as t(
        fonte text, fonte_versao text, fonte_url text, licenca text, codigo_fonte text,
        nome text, nome_pt text, grupo text, nutrientes jsonb
      )
      on conflict (fonte, codigo_fonte) do update set
        nome_pt = excluded.nome_pt,
        grupo = excluded.grupo,
        nutrientes = excluded.nutrientes,
        fonte_versao = excluded.fonte_versao,
        atualizado_em = now();
    `);
  }

  const total = (await sql('select count(*)::int as n from public.alimentos_referencia;'))[0].n;
  console.log(`\nGravados nesta rodada: ${registros.length} · Falhas: ${falhas.length} · Total na base: ${total}`);
  if (falhas.length) {
    console.log('\nFalhas (nenhuma foi preenchida por chute — ficaram de fora):');
    falhas.forEach(([pt, motivo]) => console.log(`  - ${pt}: ${motivo}`));
  }
}

main().catch((e) => {
  console.error('ERRO:', e.message);
  process.exit(1);
});
