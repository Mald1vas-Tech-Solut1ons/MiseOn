// MiseOn — Edge Function: estimativa nutricional por IA (caminho ④, ADR-04 papel 3)
//
// Quando não há código de barras, a Open Food Facts não achou nada, e não
// dá tempo/vontade de fotografar (insumo in natura sem embalagem, por
// exemplo), o Gemini estima a partir do NOME do insumo e do seu
// conhecimento geral — é o último degrau da cascata do §5.1, não o primeiro.
//
// Isto é DIFERENTE do OCR (NUT-11): ali o Gemini LÊ um rótulo real; aqui ele
// CHUTA com base em padrão. Por isso o modelo é o Flash cheio (ADR-04: "erro
// caro"), a confiança sai sempre baixa (0.3), e a Home do produto NUNCA conta
// isso para o nível 2 do selo (que exige confiança ≥ 0,7 — ver §4.1).
//
// ADR-03 continua valendo integralmente: o schema não tem — e não pode ter —
// um jeito de dizer "não contém alérgeno".

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
const erro = (msg: string, status = 400) => json({ error: msg }, { status });

// ADR-04: "estimativa livre" é o papel de erro mais caro — Flash cheio, não Lite.
// gemini-2.0-flash (cota zero sem billing) e gemini-1.5-flash (não existe mais
// nesta chave) já foram tentados e falharam em produção — confirmado via
// ListModels. Alias "latest" em vez de versão fixa: Google aponta pro modelo
// certo por trás, e paramos de quebrar a cada deprecação silenciosa deles.
const MODELO = 'gemini-flash-latest';

// Confiança fixa e baixa: nunca sobe sozinha, e nunca alcança o piso de 0,7
// que o nível 2 do selo exige (§4.1) — estimativa de IA nunca é "rastreado".
const CONFIANCA_ESTIMATIVA = 0.3;

const CODIGOS_NUTRIENTES = [
  'ENERGIA_KCAL', 'CARBOIDRATOS', 'ACUCARES_TOTAIS', 'ACUCARES_ADICIONADOS',
  'PROTEINAS', 'GORDURAS_TOTAIS', 'GORDURAS_SATURADAS', 'GORDURAS_TRANS',
  'COLESTEROL', 'FIBRAS_ALIMENTARES', 'SODIO',
];

const ALERGENOS_CANONICOS: Record<string, string> = {
  'gluten': 'Trigo/Glúten', 'trigo': 'Trigo/Glúten', 'glúten': 'Trigo/Glúten',
  'centeio': 'Centeio', 'cevada': 'Cevada', 'aveia': 'Aveia',
  'crustaceos': 'Crustáceos', 'crustáceos': 'Crustáceos',
  'ovo': 'Ovos', 'ovos': 'Ovos',
  'peixe': 'Peixes', 'peixes': 'Peixes',
  'amendoim': 'Amendoim',
  'soja': 'Soja',
  'leite': 'Leite', 'lactose': 'Leite',
  'castanha': 'Castanhas/Nozes', 'castanhas': 'Castanhas/Nozes', 'nozes': 'Castanhas/Nozes', 'amendoas': 'Castanhas/Nozes',
  'latex': 'Látex natural', 'látex': 'Látex natural',
};

function normalizarAlergenos(lista: unknown): string[] {
  if (!Array.isArray(lista)) return [];
  const vistos = new Set<string>();
  for (const item of lista) {
    const chave = String(item ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const canonico = ALERGENOS_CANONICOS[chave] ?? ALERGENOS_CANONICOS[String(item ?? '').toLowerCase()];
    if (canonico) vistos.add(canonico);
  }
  return Array.from(vistos);
}

const SCHEMA_RESPOSTA = {
  type: 'OBJECT',
  properties: {
    estimavel: { type: 'BOOLEAN' },
    motivo_nao_estimavel: { type: 'STRING', nullable: true },
    base_unidade: { type: 'STRING', enum: ['G', 'ML'] },
    nutrientes: {
      type: 'OBJECT',
      properties: Object.fromEntries(CODIGOS_NUTRIENTES.map((c) => [c, { type: 'NUMBER', nullable: true }])),
    },
    alergenos_contem: { type: 'ARRAY', items: { type: 'STRING' } },
    alergenos_pode_conter: { type: 'ARRAY', items: { type: 'STRING' } },
    justificativa: { type: 'STRING' },
  },
  required: ['estimavel', 'base_unidade', 'nutrientes', 'alergenos_contem', 'alergenos_pode_conter', 'justificativa'],
};

function montarPrompt(nome: string, categoria: string | null) {
  return `Você é um nutricionista estimando composição de alimentos a partir só do NOME de um insumo —
sem embalagem, sem foto, sem base de dados. Isto é uma ESTIMATIVA de baixa confiança, nunca uma medição.

Insumo: "${nome}"${categoria ? `\nCategoria no cadastro do lojista: "${categoria}"` : ''}

Regras rígidas:
- Estime os valores TÍPICOS por 100 g (ou 100 ml se for claramente líquido) usando seu conhecimento geral
  sobre alimentos parecidos (ex.: "tomate" → valores típicos de tomate cru).
- Se o nome for vago demais para estimar com qualquer segurança (ex.: "diversos", "outros", um nome que não
  identifica um alimento), marque estimavel=false e explique em motivo_nao_estimavel. Não invente.
- Se não tiver confiança razoável sobre um nutriente específico, retorne null nesse campo — não complete.
- Em alergenos_contem, liste só o que é estruturalmente esperado pelo tipo do alimento (ex.: "Leite" para queijo,
  "Trigo/Glúten" para farinha de trigo). Em alergenos_pode_conter, contaminação cruzada típica da categoria.
- NUNCA afirme que um alérgeno está ausente — se não é claramente esperado, simplesmente não o liste.
- Em justificativa, diga em uma frase em que você baseou a estimativa (ex.: "valores típicos de arroz
  branco cozido, composição geral semelhante entre marcas").`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { insumo_id } = await req.json();
    if (!insumo_id) return erro('insumo_id é obrigatório');

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: { user: caller } } = await supabaseAuth.auth.getUser();
    if (!caller) return erro('Não autenticado', 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: insumo } = await admin
      .from('insumos').select('id, loja_id, nome, categoria_insumo').eq('id', insumo_id).maybeSingle();
    if (!insumo) return erro('Insumo não encontrado', 404);

    const { data: acesso } = await admin
      .from('usuarios_loja').select('papel').eq('user_id', caller.id).eq('loja_id', insumo.loja_id).maybeSingle();
    if (!acesso || !['admin', 'operador'].includes(acesso.papel)) {
      return erro('Sem permissão nesta loja', 403);
    }

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) return erro('Chave do Gemini não configurada no servidor', 500);

    const respGemini = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: montarPrompt(insumo.nome, insumo.categoria_insumo ?? null) }] }],
          generationConfig: {
            temperature: 0.2, // baixa, mas não zero — isto é estimativa, não leitura literal
            responseMimeType: 'application/json',
            responseSchema: SCHEMA_RESPOSTA,
          },
        }),
      },
    );

    const dataGemini = await respGemini.json();
    if (dataGemini.error) {
      // Nem 2.0-flash nem 1.5-flash existem nesta chave — em vez de adivinhar
      // mais um nome, pergunta ao próprio Google quais modelos ela realmente
      // enxerga, e devolve a lista pra decidir com dado real, não achismo.
      if (/not found|not supported/i.test(dataGemini.error.message)) {
        try {
          const rModelos = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
          const dModelos = await rModelos.json();
          const suportados = (dModelos.models ?? [])
            .filter((m: any) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
            .map((m: any) => m.name);
          return erro(`Gemini: ${dataGemini.error.message} | Modelos disponíveis nesta chave: ${suportados.join(', ') || 'nenhum retornado'}`, 502);
        } catch {
          // segue pro erro original se a própria consulta de modelos falhar
        }
      }
      return erro(`Gemini: ${dataGemini.error.message}`, 502);
    }

    const textoResposta = dataGemini.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textoResposta) return erro('Gemini não retornou estimativa', 502);

    let estimativa: any;
    try {
      estimativa = JSON.parse(textoResposta);
    } catch {
      return erro('Resposta do Gemini fora do formato esperado', 502);
    }

    if (!estimativa.estimavel) {
      return json({
        estimavel: false,
        motivo: estimativa.motivo_nao_estimavel || 'Nome genérico demais para estimar — tente renomear o insumo ou fotografar o rótulo.',
      });
    }

    // Validação de domínio ANTES de tocar o banco — mesma régua do OCR (NUT-11).
    const nutrientesBrutos = estimativa.nutrientes ?? {};
    const nutrientes: Record<string, number> = {};
    for (const codigo of CODIGOS_NUTRIENTES) {
      const v = nutrientesBrutos[codigo];
      if (v === null || v === undefined) continue;
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) nutrientes[codigo] = n;
    }
    if (nutrientes.ENERGIA_KCAL == null) {
      return json({ estimavel: false, motivo: 'Não consegui estimar nem o valor energético com segurança — melhor fotografar o rótulo ou cadastrar à mão.' });
    }

    const alergenosContem = normalizarAlergenos(estimativa.alergenos_contem);
    const alergenosPodeConter = normalizarAlergenos(estimativa.alergenos_pode_conter)
      .filter((a) => !alergenosContem.includes(a));
    const baseUnidade = estimativa.base_unidade === 'ML' ? 'ml' : 'g';

    const { error: erroSalvar } = await admin.from('insumos_nutricao').upsert({
      insumo_id: insumo.id,
      loja_id: insumo.loja_id,
      base_qtd: 100,
      base_unidade: baseUnidade,
      nutrientes,
      alergenos_contem: alergenosContem,
      alergenos_pode_conter: alergenosPodeConter,
      origem: 'IA',
      confianca: CONFIANCA_ESTIMATIVA,
      revisado: false,
      ia_modelo: MODELO,
      ia_justificativa: estimativa.justificativa || 'Estimativa por IA a partir do nome do insumo.',
      ia_payload: estimativa,
      atualizado_em: new Date().toISOString(),
    });
    if (erroSalvar) return erro(`Falha ao gravar estimativa: ${erroSalvar.message}`, 500);

    return json({
      estimavel: true,
      base_qtd: 100,
      base_unidade: baseUnidade,
      nutrientes,
      alergenos_contem: alergenosContem,
      alergenos_pode_conter: alergenosPodeConter,
      justificativa: estimativa.justificativa,
      confianca: CONFIANCA_ESTIMATIVA,
      revisado: false,
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
});
