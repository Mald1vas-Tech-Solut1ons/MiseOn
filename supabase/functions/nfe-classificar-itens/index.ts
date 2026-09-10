/**
 * Classifica com IA os itens da nota que o catálogo determinístico não
 * reconheceu.
 *
 * ─── A DIVISÃO DE TRABALHO ────────────────────────────────────────────────
 * O catálogo (src/lib/catalogoInsumos.ts) resolve o que se repete toda semana:
 * tomate, cebola, arroz, leite. É instantâneo, de graça e sempre igual — e por
 * isso é ele quem decide primeiro. Só o que sobra chega aqui.
 *
 * O que sobra é a cauda longa do varejo brasileiro: "APP1 CX MOLHO SHOYU
 * SAKURA 5L", "REQ CREM TIROLEZ CP 200G", "DET LIQ YPE CLEAR NEUTRO". Nomes que
 * nenhuma lista fixa cobre, porque cada rede abrevia do seu jeito. Para isso a
 * IA é a ferramenta certa: ela lê "REQ CREM" e entende requeijão cremoso.
 *
 * ─── O QUE ELA PODE E O QUE NÃO PODE DECIDIR ──────────────────────────────
 * Pode: o que o item É (gênero), em que unidade se compra, qual a variedade,
 * qual a marca, qual a categoria, e quanto vem na embalagem quando isso está
 * escrito na descrição.
 *
 * NÃO pode: mexer em quantidade, preço ou valor da nota. Esses vêm do
 * documento fiscal e são verdade — deixar a IA "corrigir" um valor seria trocar
 * um dado assinado pela SEFAZ por um palpite. Por isso eles nem entram na
 * resposta: o schema não tem onde colocá-los.
 *
 * ─── E O QUE ELA ENSINA ───────────────────────────────────────────────────
 * Termo de não-alimento classificado com confiança é promovido ao léxico
 * (`fn_aprender_termo_lexico`). Da segunda nota em diante o mesmo item resolve
 * deterministicamente, de graça e auditável — e um aprendizado errado aparece
 * em `vw_lexico_aprendido` com a descrição de origem, pronto para ser removido.
 * Comida NUNCA é aprendida: classificar limpeza como alimento é risco
 * sanitário, o inverso só tira o item da ficha até alguém corrigir.
 *
 * A taxonomia de categorias vem do banco (`fn_categorias_classificacao`), não
 * de uma lista fixa aqui: foi uma lista fixa desatualizada que deixou "Sacola"
 * ser classificada como ingrediente.
 *
 * Tudo volta como SUGESTÃO, marcada como tal na tela, e o lojista confirma.
 */
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

/** Mesma cascata da leitura de cupom: modelo hospedado cai sem avisar. */
const MODELOS = ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.1-pro-preview'];

/** Teto por chamada. Cupom de atacado tem 53 itens; o lote cabe inteiro. */
const MAX_ITENS = 80;

const UNIDADES_VALIDAS = ['kg', 'g', 'L', 'ml', 'un'];

const SCHEMA = {
  type: 'object',
  properties: {
    itens: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          indice: { type: 'integer' },
          genero_slug: { type: 'string', nullable: true },
          nome: { type: 'string' },
          unidade: { type: 'string' },
          variedade: { type: 'string', nullable: true },
          marca: { type: 'string', nullable: true },
          categoria: { type: 'string' },
          conteudo_qtd: { type: 'number', nullable: true },
          conteudo_unidade: { type: 'string', nullable: true },
          confianca: { type: 'string' },
        },
        required: ['indice', 'nome', 'unidade', 'categoria', 'confianca'],
      },
    },
  },
  required: ['itens'],
};

interface ItemEntrada {
  indice: number;
  descricao: string;
  unidade: string;
  /** NCM da nota. Verdade fiscal: a IA nao contradiz, so complementa. */
  ncm?: string | null;
}

interface CategoriaDominio {
  categoria: string;
  tipo_item: string;
  entra_ficha_tecnica: boolean;
  aprendivel: boolean;
}

function montarPrompt(
  itens: ItemEntrada[],
  generos: { slug: string; nome: string; unidade: string }[],
  categorias: CategoriaDominio[],
) {
  const lista = itens
    .map((i) => {
      const ncm = i.ncm ? `, NCM ${i.ncm}` : '';
      return `${i.indice}. "${i.descricao}" (unidade na nota: ${i.unidade || '?'}${ncm})`;
    })
    .join('\n');

  const catalogo = generos.map((g) => `${g.slug} = ${g.nome} (${g.unidade})`).join('\n');

  // A taxonomia sai do banco, nao de uma lista fixa aqui: quando o dominio
  // ganha uma categoria, o prompt acompanha sem deploy desta funcao.
  const taxonomia = categorias
    .map((c) => `- ${c.categoria}: ${c.entra_ficha_tecnica ? 'entra na ficha tecnica do prato' : 'NAO entra na ficha tecnica'} (tipo ${c.tipo_item})`)
    .join('\n');

  return `Você organiza o estoque de um restaurante brasileiro. Recebeu itens de um cupom fiscal
de supermercado, escritos com as abreviações do mercado, e precisa dizer O QUE CADA UM É.

ITENS:
${lista}

GÊNEROS JÁ CADASTRADOS NO SISTEMA (use o slug quando o item for um deles):
${catalogo}

Para cada item, devolva:
- indice: o número do item na lista acima. Devolva TODOS, sem pular nenhum.
- genero_slug: o slug da lista acima quando o item pertencer àquele gênero. Null quando não
  pertencer a nenhum. "REQ CREM TIROLEZ 200G" é requeijão; se houver slug de requeijão, use.
- nome: o nome limpo do gênero, em português corrente, sem abreviação, sem marca, sem tamanho.
  "APP1 PEITO FGO CONG C OSSO" vira "Peito de frango". "DET LIQ YPE CLEAR" vira "Detergente".
- unidade: em que unidade esse item é COMPRADO e CONTROLADO no estoque. Só pode ser uma destas:
  ${UNIDADES_VALIDAS.join(', ')}.
  Regra: o que se pesa é kg (carne, hortifrúti, queijo em peça, frios). O que é líquido é L
  (leite, óleo, água sanitária, suco a granel). O que se conta é un (ovo, pão, lata, garrafa,
  descartável). NUNCA devolva "caixa", "fardo", "pacote", "bandeja": embalagem não é unidade de
  estoque, é como o item veio.
- variedade: o tipo dentro do gênero, quando a descrição disser. "TOMATE ITALIANO" → "Italiano".
  "ARROZ PARBOILIZADO" → "Parboilizado". Null quando não houver.
- marca: o fabricante, quando a descrição disser. "ARROZ TIO JOAO" → "Tio João". "YPE" → "Ypê".
  Escreva a marca com acentuação correta. Null quando não houver.
- categoria: EXATAMENTE uma das categorias listadas abaixo, escrita igual, com acento.
  Esta e a decisao mais importante: ela define se o item pode virar ingrediente de
  um prato. Errar aqui coloca sabao em pó na receita.

CATEGORIAS VALIDAS:
${taxonomia}

  Como escolher:
  - o que se come ou se bebe vai para a categoria de alimento correspondente;
  - o que LIMPA o ambiente ou o equipamento (detergente, desinfetante, sabao, alvejante,
    esponja, saco de lixo, inseticida) e Limpeza;
  - o que serve a HIGIENE das pessoas (papel higienico, sabonete, alcool em gel,
    papel toalha) e Higiene;
  - o que EMBALA ou transporta o pedido (sacola, marmitex, pote, tampa, filme, papel
    aluminio, caixa de pizza, etiqueta) e Embalagem;
  - o que o cliente USA e joga fora (copo, canudo, guardanapo, talher descartavel) e
    Descartáveis;
  - ferramenta, peca, lampada, parafuso, material de escritorio e papelaria vao para
    Manutenção;
  - utensilio de cozinha, panela, faca, luva, touca e avental vao para Utensílios;
  - so use Outros quando nenhuma das anteriores servir. Outros nao e atalho.
- conteudo_qtd e conteudo_unidade: quanto vem DENTRO de uma embalagem, quando a descrição disser.
  "ARROZ 5KG" → 5 e "kg". "OVOS PVC 20UN" → 20 e "un". "AGUA SANIT 2L" → 2 e "L".
  "REFRI 12X1L" → 12 e "L". Null nos dois quando a descrição não disser.
- confianca: "alta" quando o nome do produto é claro; "media" quando você deduziu de abreviação;
  "baixa" quando é chute.

REGRAS RÍGIDAS:
- Não invente quantidade comprada, preço ou valor. Esses dados vêm da nota e não são seu assunto.
- Não traduza para outro idioma. Tudo em português do Brasil.
- Quando houver NCM, ele e verdade fiscal e manda: capitulo 34 e Limpeza, 39 e 48 sao
  embalagem/descartavel, 22 e Bebidas, 02 e Carnes, 03 e Pescados, 07 e 08 sao Hortifrúti,
  04 e Laticínios, 19 e Padaria. Nao contradiga o NCM; use a descricao para refinar
  dentro dele.
- Item que não é comida nem insumo de cozinha (revista, pilha, brinquedo) também deve ser
  classificado na categoria mais proxima — quem decide se entra no estoque é o lojista.
- Devolva exatamente um objeto por item recebido, com o mesmo índice.

Responda apenas o JSON do schema.`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { loja_id, itens, generos } = await req.json();

    if (!loja_id) return erro('loja_id é obrigatório');
    if (!Array.isArray(itens) || itens.length === 0) return erro('Nenhum item para classificar');
    if (itens.length > MAX_ITENS) return erro(`Máximo de ${MAX_ITENS} itens por chamada`);

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: { user: caller } } = await supabaseAuth.auth.getUser();
    if (!caller) return erro('Não autenticado', 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: acesso } = await admin
      .from('usuarios_loja').select('papel').eq('user_id', caller.id).eq('loja_id', loja_id).maybeSingle();
    if (!acesso || !['admin', 'operador'].includes(acesso.papel)) {
      return erro('Sem permissão nesta loja', 403);
    }

    // A taxonomia e a do banco. Duplicar a lista aqui seria criar uma segunda
    // verdade que envelhece sozinha -- foi assim que "Sacola" virou ingrediente.
    const { data: catRaw } = await admin.rpc('fn_categorias_classificacao');
    const categorias = (Array.isArray(catRaw) ? catRaw : []) as CategoriaDominio[];
    if (categorias.length === 0) return erro('Taxonomia de categorias indisponível', 500);
    const categoriasValidas = new Set(categorias.map((c) => c.categoria));
    const aprendiveis = new Set(categorias.filter((c) => c.aprendivel).map((c) => c.categoria));

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) return erro('Chave do Gemini não configurada no servidor', 500);

    const entrada: ItemEntrada[] = itens.map((i: ItemEntrada, idx: number) => ({
      indice: Number.isFinite(i?.indice) ? i.indice : idx,
      descricao: String(i?.descricao ?? '').slice(0, 200),
      unidade: String(i?.unidade ?? '').slice(0, 10),
      ncm: i?.ncm ? String(i.ncm).replace(/\D/g, '').slice(0, 8) || null : null,
    })).filter((i: ItemEntrada) => i.descricao.trim());

    if (entrada.length === 0) return erro('Nenhum item com descrição para classificar');

    const corpo = JSON.stringify({
      contents: [{ parts: [{ text: montarPrompt(entrada, Array.isArray(generos) ? generos : [], categorias) }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: SCHEMA,
      },
    });

    let resposta: { candidates?: unknown[] } | null = null;
    let modeloUsado = '';
    let ultimoErro = '';

    for (const modelo of MODELOS) {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${geminiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corpo },
      );
      const dados = await r.json();
      if (!dados.error) {
        resposta = dados;
        modeloUsado = modelo;
        break;
      }
      ultimoErro = dados.error.message ?? `HTTP ${r.status}`;
      if (![404, 429, 503].includes(r.status)) break;
    }

    if (!resposta) return erro(`Gemini: ${ultimoErro}`, 502);

    const texto = (resposta as { candidates?: { content?: { parts?: { text?: string }[] } }[] })
      .candidates?.[0]?.content?.parts?.[0]?.text;
    if (!texto) return erro('A IA não devolveu classificação', 502);

    let lido: { itens?: Record<string, unknown>[] };
    try {
      lido = JSON.parse(texto);
    } catch {
      return erro('Resposta da IA fora do formato esperado', 502);
    }

    // Sanitização: a unidade é o campo que vai para `insumos.unidade_medida`,
    // que tem chave estrangeira. Uma unidade inventada aqui derrubaria a nota
    // inteira lá na frente — exatamente o bug que originou este trabalho.
    const classificados = (lido.itens ?? []).map((c) => {
      const unidade = String(c.unidade ?? '').trim();
      return {
        indice: Number(c.indice),
        genero_slug: c.genero_slug ? String(c.genero_slug).trim() : null,
        nome: String(c.nome ?? '').trim().slice(0, 120),
        unidade: UNIDADES_VALIDAS.includes(unidade) ? unidade : 'un',
        variedade: c.variedade ? String(c.variedade).trim().slice(0, 60) : null,
        marca: c.marca ? String(c.marca).trim().slice(0, 60) : null,
        categoria: categoriasValidas.has(String(c.categoria ?? '').trim())
          ? String(c.categoria).trim()
          : 'Outros',
        conteudo_qtd: Number(c.conteudo_qtd) > 0 ? Number(c.conteudo_qtd) : null,
        conteudo_unidade: c.conteudo_unidade ? String(c.conteudo_unidade).trim() : null,
        confianca: ['alta', 'media', 'baixa'].includes(String(c.confianca))
          ? String(c.confianca) : 'media',
      };
    }).filter((c) => Number.isFinite(c.indice) && c.nome);

    // O sistema aprende: termo de nao-alimento classificado com confianca vira
    // regra deterministica. Da proxima nota em diante, resolve sem IA, de graca
    // e auditavel. Falha aqui nunca derruba a importacao da nota.
    const aprendidos: { termo: string; categoria: string }[] = [];
    for (const c of classificados) {
      if (!aprendiveis.has(c.categoria) || c.confianca === 'baixa') continue;
      try {
        const { data } = await admin.rpc('fn_aprender_termo_lexico', {
          p_termo: c.nome,
          p_categoria: c.categoria,
          p_descricao_origem: entrada.find((i) => i.indice === c.indice)?.descricao ?? null,
          p_loja_id: loja_id,
        });
        const r = data as { aprendido?: boolean } | null;
        if (r?.aprendido) aprendidos.push({ termo: c.nome, categoria: c.categoria });
      } catch (e) {
        console.error('aprendizado do lexico falhou (seguindo sem ele):', e);
      }
    }

    return json({ itens: classificados, ia_modelo: modeloUsado, aprendidos });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
});
