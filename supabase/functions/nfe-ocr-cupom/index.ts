/**
 * Importa os itens de um cupom fiscal a partir da FOTO do papel, sem passar
 * pela SEFAZ.
 *
 * Por que existe: a consulta da SEFAZ-SP depende do hash que só existe dentro
 * do QR Code, e nem sempre há QR legível — cupom amassado, impressão fraca,
 * papel térmico apagado. Pior: nota "emitida em contingência, pendente de
 * autorização" pode nem estar disponível para consulta no momento da compra.
 * O papel, porém, sempre traz a lista de itens impressa.
 *
 * Devolve exatamente o mesmo formato da nfe-importar-qrcode, para cair no mesmo
 * fluxo de De-Para e entrada de estoque que já existe no painel.
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

/**
 * Cascata de modelos, em ordem de preferência.
 *
 * ─── POR QUE MAIS DE UM ───────────────────────────────────────────────────
 * Esta função nasceu apontando para `gemini-2.5-pro`, que o Google fechou para
 * novos projetos: a chamada volta 404 e a leitura do cupom morre inteira.
 * Modelo hospedado é dependência que muda sem aviso — e quando muda, quem está
 * com a sacola na mão no meio da rua é o lojista.
 *
 * A cascata cobre os três modos de falha reais, todos observados na prática:
 *   404  o modelo foi descontinuado ou renomeado;
 *   503  pico de demanda ("high demand", resposta do próprio Google);
 *   429  cota estourada na janela.
 *
 * ─── POR QUE FLASH E NÃO PRO ──────────────────────────────────────────────
 * Medido com cupom de 8 itens: o flash leu 8/8 com descrição, quantidade,
 * unidade, valores, CNPJ, data e chave corretos. Não há precisão a ganhar
 * pagando mais — e importação de nota é operação de todo dia, não eventual.
 */
const MODELOS = ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.1-pro-preview'];

const SCHEMA_RESPOSTA = {
  type: 'object',
  properties: {
    emitente: {
      type: 'object',
      properties: {
        razao_social: { type: 'string' },
        cnpj: { type: 'string', nullable: true },
      },
      required: ['razao_social'],
    },
    data_emissao: { type: 'string', nullable: true },
    chave: { type: 'string', nullable: true },
    valor_total: { type: 'number', nullable: true },
    valor_produtos: { type: 'number', nullable: true },
    desconto: { type: 'number', nullable: true },
    itens: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          num_item: { type: 'integer' },
          descricao: { type: 'string' },
          codigo_fornecedor: { type: 'string', nullable: true },
          qtd: { type: 'number' },
          unidade: { type: 'string' },
          valor_unitario: { type: 'number' },
          valor_total: { type: 'number' },
        },
        required: ['num_item', 'descricao', 'qtd', 'unidade', 'valor_unitario', 'valor_total'],
      },
    },
  },
  required: ['emitente', 'itens'],
};

const PROMPT = `Você está lendo a foto de um cupom fiscal brasileiro (NFC-e) de supermercado.

Extraia TODOS os itens da lista de produtos, na ordem impressa. Cada linha de item costuma ter:
  <numero> <codigo> <DESCRICAO> <quantidade> <unidade> <valor unitario> <valor total>
Exemplo real: "53 956228 APP1 OVOS EXTRA BRANCO PV 2,000 BD 9,90 17,80"
  → num_item 53, codigo_fornecedor "956228", descricao "APP1 OVOS EXTRA BRANCO PV",
    qtd 2, unidade "BD", valor_unitario 9.90, valor_total 17.80

Regras rígidas:
- Números brasileiros: vírgula é decimal e ponto é milhar. "1.234,56" vale 1234.56.
- Copie a descrição EXATAMENTE como impressa, com as abreviações. Não corrija, não traduza,
  não complete palavras, não invente marca.
- Unidade é a sigla impressa (UN, KG, FR, BD, PC, CX, L, PT...). Em minúsculas na resposta.
- Se uma linha estiver ilegível ou cortada pela borda da foto, NÃO a inclua. É melhor faltar
  item do que inventar valor.
- Não invente itens que não estão na imagem. Não repita item.
- valor_total do item é o valor da linha, já com a quantidade multiplicada.
- Se aparecerem "total de itens", "valor total", CNPJ, nome do mercado, data/hora e a chave de
  acesso de 44 dígitos, preencha os campos correspondentes. Se não aparecer, deixe nulo.
- O rodapé costuma trazer três linhas de dinheiro: "produtos" (soma das linhas), "Desconto" e
  "Valor total" (o que foi pago). Preencha valor_produtos com a primeira, desconto com a segunda
  e valor_total com a terceira. Sem desconto no cupom, deixe desconto nulo.
  O desconto muda o custo do estoque: não o ignore e não o invente.
- data_emissao no formato ISO (aaaa-mm-ddThh:mm:ss) quando a data estiver visível.

Responda apenas o JSON do schema.`;

interface ItemOcr {
  num_item: number;
  descricao: string;
  codigo_fornecedor?: string | null;
  qtd: number;
  unidade: string;
  valor_unitario: number;
  valor_total: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { loja_id, fotos_base64, mime_type } = await req.json();
    const fotos: string[] = Array.isArray(fotos_base64) ? fotos_base64 : [fotos_base64].filter(Boolean);

    if (!loja_id) return erro('loja_id é obrigatório');
    if (fotos.length === 0) return erro('Envie ao menos uma foto do cupom');
    if (fotos.length > 6) return erro('Envie no máximo 6 fotos por cupom');

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

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) return erro('Chave do Gemini não configurada no servidor', 500);

    const partes: unknown[] = [{ text: PROMPT }];
    for (const foto of fotos) {
      partes.push({ inline_data: { mime_type: mime_type || 'image/jpeg', data: foto } });
    }

    const corpo = JSON.stringify({
      contents: [{ parts: partes }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: SCHEMA_RESPOSTA,
      },
    });

    let dataGemini: { error?: { message?: string }; candidates?: unknown[] } | null = null;
    let modeloUsado = '';
    let ultimoErro = '';

    for (const modelo of MODELOS) {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${geminiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corpo },
      );
      const dados = await resp.json();

      if (!dados.error) {
        dataGemini = dados;
        modeloUsado = modelo;
        break;
      }

      ultimoErro = dados.error.message ?? `HTTP ${resp.status}`;
      // Modelo fora do ar, cheio ou aposentado: o próximo da fila pode servir.
      // Qualquer outro erro é da requisição em si — insistir só perde tempo.
      if (![404, 429, 503].includes(resp.status)) break;
    }

    if (!dataGemini) return erro(`Gemini: ${ultimoErro}`, 502);

    const textoResposta = (dataGemini as any).candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textoResposta) return erro('A IA não conseguiu ler nada nessa foto do cupom', 502);

    let leitura: {
      emitente?: { razao_social?: string; cnpj?: string | null };
      data_emissao?: string | null;
      chave?: string | null;
      valor_total?: number | null;
      valor_produtos?: number | null;
      desconto?: number | null;
      itens?: ItemOcr[];
    };
    try {
      leitura = JSON.parse(textoResposta);
    } catch {
      return erro('Resposta da IA fora do formato esperado', 502);
    }

    const itens = (leitura.itens ?? [])
      .filter((i) => i?.descricao?.trim() && Number.isFinite(i.qtd))
      .map((i, idx) => ({
        num_item: i.num_item ?? idx + 1,
        descricao: i.descricao.trim(),
        // Cupom não imprime EAN, só o código interno do mercado — que sozinho
        // não identifica produto entre CNPJs diferentes. Ver chaveDoItem no
        // ModalImportarNFCe: o De-Para escopa esse código pelo CNPJ.
        gtin: null,
        codigo_fornecedor: i.codigo_fornecedor?.toString().trim() || null,
        qtd: Number(i.qtd) || 0,
        unidade: (i.unidade || 'un').toLowerCase(),
        valor_unitario: Number(i.valor_unitario) || 0,
        valor_total: Number(i.valor_total) || (Number(i.qtd) || 0) * (Number(i.valor_unitario) || 0),
      }));

    if (itens.length === 0) {
      // Zero itens com rodapé legível tem causa conhecida: a foto pegou a parte
      // de baixo do cupom — totais, QR, forma de pagamento — e a lista de
      // produtos ficou fora do quadro. Dizer isso, com os números que foram
      // lidos, é o que faz a segunda tentativa dar certo. "Nenhum item
      // reconhecido" mandaria o lojista repetir exatamente o mesmo erro.
      const totalLido = Number(leitura.valor_total) || 0;
      const achouRodape = totalLido > 0 || !!leitura.emitente?.cnpj || !!leitura.data_emissao;

      if (achouRodape) {
        const resumo = [
          totalLido > 0 ? `total de R$ ${totalLido.toFixed(2).replace('.', ',')}` : '',
          leitura.data_emissao ? `emitida em ${String(leitura.data_emissao).slice(0, 10).split('-').reverse().join('/')}` : '',
        ].filter(Boolean).join(', ');

        return erro(
          `Li o rodapé desta nota${resumo ? ` (${resumo})` : ''}, mas a LISTA DE PRODUTOS não aparece ` +
          'nesta foto — ela fica na parte de cima do cupom. Fotografe a parte de cima e envie de novo; ' +
          'se o cupom for longo, mande em partes que eu junto tudo.',
          422,
        );
      }

      return erro(
        'Nenhum item foi reconhecido nessa foto. Fotografe a lista de produtos de perto, ' +
        'com o cupom esticado e sem sombra — se o cupom for longo, mande em partes.',
        422,
      );
    }

    const chaveLida = (leitura.chave ?? '').replace(/\D/g, '');

    return json({
      origem: 'OCR_FOTO',
      chave: chaveLida.length === 44 ? chaveLida : '',
      uf: 'BR',
      emitente: {
        razao_social: leitura.emitente?.razao_social?.trim() || 'Mercado / Fornecedor',
        cnpj: leitura.emitente?.cnpj?.replace(/\D/g, '') || null,
      },
      data_emissao: leitura.data_emissao ?? null,
      valor_total: Number(leitura.valor_total) || itens.reduce((acc, i) => acc + i.valor_total, 0),
      valor_produtos: Number(leitura.valor_produtos) || undefined,
      // O desconto da nota é rateado entre os itens no momento de gravar o
      // custo. Sem ele, o CMV nasce acima do que a compra custou.
      desconto: Number(leitura.desconto) > 0 ? Number(leitura.desconto) : undefined,
      itens,
      ia_modelo: modeloUsado,
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  }
});
