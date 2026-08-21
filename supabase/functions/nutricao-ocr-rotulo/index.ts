// MiseOn — Edge Function: OCR de rótulo nutricional via Gemini (NUT-11)
//
// Caminho ② do PLANO-NUTRICIONAL §5.1: o lojista fotografa a tabela
// nutricional de um insumo sem código de barras reconhecido (in natura tem
// embalagem própria às vezes, ou o EAN não bateu no Open Food Facts). Cinco
// segundos de foto valem mais que digitar 12 campos.
//
// ADR-03 (inegociável): o schema de resposta não tem — e nunca pode ter — um
// jeito de dizer "não contém alérgeno". Só existem duas listas: o que a
// embalagem AFIRMA conter, e o que ela avisa que PODE conter (contaminação
// cruzada). Ausência de um alérgeno nas duas listas fica como NÃO AVALIADO.
//
// ADR-04: Gemini Flash-Lite, responseSchema (nunca texto livre), temperature 0.
// ADR-02: toda saída é sugestão. revisado=false sempre — humano publica.

import { createClient } from 'jsr:@supabase/supabase-js@2';

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
const erro = (msg: string, status = 400) => json({ error: msg }, { status });

// ADR-04: OCR de rótulo é o papel barato — Flash-Lite, não o Flash cheio.
// Lista real de modelos desta chave confirmada via ListModels (mesmo
// diagnóstico do nutricao-estimar-ia). Alias "latest" em vez de versão fixa,
// pelo mesmo motivo: para de quebrar a cada deprecação silenciosa do Google.
const MODELO = 'gemini-flash-lite-latest';

const CODIGOS_NUTRIENTES = [
  'ENERGIA_KCAL', 'CARBOIDRATOS', 'ACUCARES_TOTAIS', 'ACUCARES_ADICIONADOS',
  'PROTEINAS', 'GORDURAS_TOTAIS', 'GORDURAS_SATURADAS', 'GORDURAS_TRANS',
  'COLESTEROL', 'FIBRAS_ALIMENTARES', 'SODIO',
];

// Vocabulário canônico (RDC 26/2015) — o mesmo de ModalNutricaoInsumo.tsx.
// O modelo escreve em português livre; normalizamos para não gravar string
// solta que a UI depois não reconhece.
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
    legivel: { type: 'BOOLEAN' },
    motivo_ilegivel: { type: 'STRING', nullable: true },
    base_declarada: { type: 'STRING', enum: ['PORCAO', '100G', '100ML'] },
    peso_porcao_g: { type: 'NUMBER', nullable: true },
    nutrientes: {
      type: 'OBJECT',
      properties: Object.fromEntries(CODIGOS_NUTRIENTES.map((c) => [c, { type: 'NUMBER', nullable: true }])),
    },
    alergenos_contem: { type: 'ARRAY', items: { type: 'STRING' } },
    alergenos_pode_conter: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['legivel', 'base_declarada', 'nutrientes', 'alergenos_contem', 'alergenos_pode_conter'],
};

const PROMPT = `Você é um leitor de rótulos nutricionais brasileiros (padrão ANVISA IN 75/2020).
Leia a tabela de informação nutricional na imagem e extraia os valores exatamente como impressos.

Regras rígidas:
- Se um valor não estiver legível ou não constar na tabela, retorne null nesse campo. NUNCA estime ou complete.
- Se a tabela declarar valores "por porção", marque base_declarada="PORCAO" e informe peso_porcao_g se a embalagem
  disser o peso da porção em gramas. Se a tabela já for "por 100 g" ou "por 100 ml", marque 100G ou 100ML.
- Em alergenos_contem, liste APENAS o que a embalagem afirma conter explicitamente (ex.: "contém glúten").
- Em alergenos_pode_conter, liste avisos de contaminação cruzada (ex.: "pode conter traços de amendoim").
- Nunca escreva que um alérgeno NÃO está presente — se não houver menção, simplesmente não o liste em nenhuma lista.
- Se a foto estiver ilegível (tremida, reflexo, corte), marque legivel=false e explique o motivo em motivo_ilegivel.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { insumo_id, foto_base64, mime_type } = await req.json();
    if (!insumo_id || !foto_base64) return erro('insumo_id e foto_base64 são obrigatórios');

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: { user: caller } } = await supabaseAuth.auth.getUser();
    if (!caller) return erro('Não autenticado', 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: insumo } = await admin.from('insumos').select('id, loja_id, nome').eq('id', insumo_id).maybeSingle();
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
          contents: [{
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: mime_type || 'image/jpeg', data: foto_base64 } },
            ],
          }],
          generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json',
            responseSchema: SCHEMA_RESPOSTA,
          },
        }),
      },
    );

    const dataGemini = await respGemini.json();
    if (dataGemini.error) return erro(`Gemini: ${dataGemini.error.message}`, 502);

    const textoResposta = dataGemini.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textoResposta) return erro('Gemini não retornou leitura da imagem', 502);

    let leitura: any;
    try {
      leitura = JSON.parse(textoResposta);
    } catch {
      return erro('Resposta do Gemini fora do formato esperado', 502);
    }

    if (!leitura.legivel) {
      return json({ legivel: false, motivo: leitura.motivo_ilegivel || 'Foto ilegível — tente novamente com mais luz e sem reflexo.' });
    }

    // Validação de domínio ANTES de tocar o banco — nunca confiar na saída de IA sozinha.
    const nutrientesBrutos = leitura.nutrientes ?? {};
    const nutrientes: Record<string, number> = {};
    for (const codigo of CODIGOS_NUTRIENTES) {
      const v = nutrientesBrutos[codigo];
      if (v === null || v === undefined) continue;
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) nutrientes[codigo] = n;
    }
    if (nutrientes.ENERGIA_KCAL == null) {
      return json({ legivel: false, motivo: 'Não consegui ler o valor energético — sem ele não dá para validar o resto. Tente outra foto.' });
    }

    const calculado = (nutrientes.CARBOIDRATOS ?? 0) * 4 + (nutrientes.PROTEINAS ?? 0) * 4 + (nutrientes.GORDURAS_TOTAIS ?? 0) * 9;
    const sanidadeOk = calculado === 0 ? null : Math.abs(calculado - nutrientes.ENERGIA_KCAL) <= nutrientes.ENERGIA_KCAL * 0.2;

    const alergenosContem = normalizarAlergenos(leitura.alergenos_contem);
    const alergenosPodeConter = normalizarAlergenos(leitura.alergenos_pode_conter)
      .filter((a) => !alergenosContem.includes(a)); // "contém" já é mais forte que "pode conter"

    const baseUnidade = leitura.base_declarada === '100ML' ? 'ml' : 'g';
    const baseQtd = leitura.base_declarada === 'PORCAO' && leitura.peso_porcao_g > 0 ? leitura.peso_porcao_g : 100;

    // Evidência: a foto vira o que sustenta a revisão humana (§8.2 momento 2).
    const caminhoFoto = `${insumo.loja_id}/${insumo.id}/${Date.now()}.jpg`;
    const bytes = Uint8Array.from(atob(foto_base64), (c) => c.charCodeAt(0));
    const { error: erroUpload } = await admin.storage
      .from('nutricao-evidencias')
      .upload(caminhoFoto, bytes, { contentType: mime_type || 'image/jpeg', upsert: true });
    const fotoUrl = erroUpload ? null : caminhoFoto;

    const { error: erroSalvar } = await admin.from('insumos_nutricao').upsert({
      insumo_id: insumo.id,
      loja_id: insumo.loja_id,
      base_qtd: baseQtd,
      base_unidade: baseUnidade,
      nutrientes,
      alergenos_contem: alergenosContem,
      alergenos_pode_conter: alergenosPodeConter,
      origem: 'ROTULO_FOTO',
      fonte_url: fotoUrl ? `nutricao-evidencias/${fotoUrl}` : null,
      confianca: sanidadeOk === false ? 0.5 : 0.8,
      revisado: false,
      ia_modelo: MODELO,
      ia_justificativa: sanidadeOk === false
        ? 'Soma dos macros não bate com a energia declarada dentro de ±20% — confira a foto.'
        : 'Leitura direta do rótulo fotografado.',
      ia_payload: leitura,
      atualizado_em: new Date().toISOString(),
    });
    if (erroSalvar) return erro(`Falha ao gravar sugestão: ${erroSalvar.message}`, 500);

    return json({
      legivel: true,
      base_qtd: baseQtd,
      base_unidade: baseUnidade,
      nutrientes,
      alergenos_contem: alergenosContem,
      alergenos_pode_conter: alergenosPodeConter,
      sanidade_energetica: sanidadeOk,
      revisado: false,
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
});
