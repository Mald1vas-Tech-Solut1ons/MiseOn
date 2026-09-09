// Assistente de ficha de producao. A IA sugere um rascunho; nunca movimenta
// estoque, cria conversao ou grava rendimento sem confirmacao do usuario.
//
// Modelo: deepseek-v4-flash, confirmado em 09/09/2026 pelo GET /models da
// propria chave de producao (a lista atual e v4-flash, v4-pro e
// v4-flash-vision-exp). Se um dia sumir, listar de novo antes de chutar nome.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { checkRateLimit, ipDaRequisicao } from '../_shared/rate-limit.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json' },
});

// Espelha src/lib/unidades.ts: a IA so pode devolver unidade que a tela aceita.
const UNIDADES = new Set(['kg', 'g', 'L', 'ml', 'un', 'fatias', 'porção', 'peça', 'dente', 'maço', 'cabeça', 'folha', 'rodela', 'posta', 'filé', 'ramo', 'cubo']);
const numeroPositivo = (valor: unknown): number | null => {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const limite = await checkRateLimit(`preparo-ia:${ipDaRequisicao(req)}`, { windowMs: 60000, maxRequests: 8 });
  if (!limite.allowed) return json({ error: 'Limite de sugestões atingido. Tente novamente em instantes.' }, 429);

  try {
    const { loja_id, insumo_id, objetivo } = await req.json();
    if (!loja_id || !insumo_id) return json({ error: 'Loja e matéria-prima são obrigatórias.' }, 400);

    const auth = req.headers.get('Authorization') ?? '';
    const cliente = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await cliente.auth.getUser();
    if (!user) return json({ error: 'Sessão expirada.' }, 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const [{ data: acesso }, { data: insumo }] = await Promise.all([
      admin.from('usuarios_loja').select('papel').eq('user_id', user.id).eq('loja_id', loja_id).maybeSingle(),
      admin.from('insumos').select('id, loja_id, nome, unidade_medida, categoria_insumo').eq('id', insumo_id).eq('loja_id', loja_id).maybeSingle(),
    ]);
    if (!acesso || !['admin', 'operador'].includes(acesso.papel)) return json({ error: 'Sem permissão nesta loja.' }, 403);
    if (!insumo) return json({ error: 'Matéria-prima não encontrada.' }, 404);

    const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
    if (!apiKey) return json({ error: 'Assistente de produção ainda não foi configurado no servidor.' }, 503);

    const prompt = `Responda somente em JSON. Você auxilia uma cozinha profissional a RASCUNHAR uma ficha de manipulação.
Matéria-prima: ${JSON.stringify(insumo.nome)}
Unidade atual de estoque: ${JSON.stringify(insumo.unidade_medida)}
Categoria: ${JSON.stringify(insumo.categoria_insumo ?? '')}
Objetivo informado pelo usuário: ${JSON.stringify(objetivo ?? 'sugira uma manipulação comum e útil')}

Retorne exatamente estas chaves:
{"nome_resultado":"string","unidade_resultado":"kg|g|L|ml|un|fatias|porção|peça|dente|maço|cabeça|folha|rodela|posta|filé|ramo|cubo","quantidade_consumida":number,"quantidade_resultado":number,"validade_horas":number|null,"passos":[{"texto":"string","minutos":number|null,"fogo":boolean}],"justificativa":"string"}

Regras:
- quantidade_consumida está na unidade atual de estoque, deve ser uma base de lote fácil de medir e MAIOR QUE ZERO;
- quantidade_resultado é apenas uma referência inicial plausível, deve ser MAIOR QUE ZERO e nunca deve ser apresentada como medição;
- não converta massa em contagem como se fosse universal: explique na justificativa que calibre, corte e perda precisam ser medidos pelo usuário;
- se o objetivo for só higienizar/cortar, preserve o ingrediente no nome do resultado;
- não invente temperatura, legislação ou validade longa; quando incerto use null;
- passos é o modo de preparo que a cozinha vai seguir em tela cheia: de 2 a 8 etapas, cada texto no imperativo, curto e executável na bancada (higienizar, cortar, refogar, resfriar, embalar, etiquetar);
- minutos só quando a etapa realmente precisa de cronômetro (cozimento, resfriamento, descanso); caso contrário use null;
- fogo é true SOMENTE quando a etapa mantém chama ou forno ligado — é o que vira custo de gás;
- justificativa em português, curta, incluindo o alerta de confirmação do rendimento real.`;

    const resposta = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: Deno.env.get('DEEPSEEK_MODEL') || 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: 'Você é um chef de produção e responde JSON válido, sem markdown.' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        thinking: { type: 'disabled' },
        temperature: 0.2,
        max_tokens: 1200,
      }),
    });
    const payload = await resposta.json();
    if (!resposta.ok || payload.error) {
      console.error('preparo-sugerir deepseek:', payload?.error ?? resposta.status);
      return json({ error: 'A IA não respondeu agora. Preencha a ficha manualmente ou tente de novo.' }, 502);
    }

    let sugestao: Record<string, unknown>;
    try {
      sugestao = JSON.parse(payload.choices?.[0]?.message?.content || '{}');
    } catch {
      return json({ error: 'A IA retornou uma sugestão incompleta. Tente novamente.' }, 502);
    }

    const unidade = String(sugestao.unidade_resultado ?? '');
    if (!UNIDADES.has(unidade)) return json({ error: 'A sugestão trouxe uma unidade não suportada.' }, 502);
    const consumida = numeroPositivo(sugestao.quantidade_consumida);
    const produzida = numeroPositivo(sugestao.quantidade_resultado);
    if (!consumida || !produzida) return json({ error: 'A sugestão não trouxe um rendimento válido.' }, 502);

    // O roteiro e rascunho: texto vazio, etapa demais ou minutos absurdos sao
    // podados aqui para a tela nunca receber lixo.
    const passos = (Array.isArray(sugestao.passos) ? sugestao.passos : [])
      .map((item: unknown) => {
        const passo = item as { texto?: unknown; minutos?: unknown; fogo?: unknown };
        const texto = String(passo?.texto ?? '').trim().slice(0, 280);
        const minutos = numeroPositivo(passo?.minutos);
        return texto
          ? { texto, minutos: minutos && minutos <= 1440 ? minutos : null, fogo: passo?.fogo === true }
          : null;
      })
      .filter((passo): passo is { texto: string; minutos: number | null; fogo: boolean } => passo !== null)
      .slice(0, 12);

    return json({
      nome_resultado: String(sugestao.nome_resultado || `${insumo.nome} manipulado`).slice(0, 120),
      unidade_resultado: unidade,
      quantidade_consumida: consumida,
      quantidade_resultado: produzida,
      validade_horas: numeroPositivo(sugestao.validade_horas),
      passos,
      justificativa: String(sugestao.justificativa || 'Confirme o rendimento real antes de salvar.').slice(0, 500),
      origem: 'IA_SUGESTAO',
    });
  } catch (e) {
    console.error('preparo-sugerir:', e);
    return json({ error: 'Não foi possível gerar a sugestão agora.' }, 500);
  }
});
