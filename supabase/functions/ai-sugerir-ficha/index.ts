import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

import { checkRateLimit, ipDaRequisicao } from '../_shared/rate-limit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-chat-session',
};

// A IA nunca inventa insumo_id: só pode escolher entre os ids que a loja
// mandou. O que ela "quer" sugerir mas não existe no estoque vai em
// insumos_faltando (nome), pro lojista decidir se cadastra.
const PROMPT_FICHA = (nomeProduto: string, nomeCategoria: string | undefined, descricao: string | undefined, insumos: { id: string; nome: string; unidade_medida: string }[]) => `
Você é um chef que monta fichas técnicas de restaurante brasileiro.

Produto: "${nomeProduto}"${nomeCategoria ? `\nCategoria: ${nomeCategoria}` : ''}${descricao ? `\nDescrição: ${descricao}` : ''}

Insumos já cadastrados nesta loja (escolha SOMENTE entre estes ids — nunca invente um id novo):
${insumos.map((i) => `- id="${i.id}" nome="${i.nome}" unidade="${i.unidade_medida}"`).join('\n')}

Monte a ficha técnica (quanto de cada insumo é consumido para produzir UMA unidade vendida deste produto).
Regras:
- Use apenas insumo_id da lista acima.
- "quantidade" é sempre na unidade do próprio insumo (respeite a coluna "unidade" de cada um).
- Se faltar um ingrediente óbvio que não está cadastrado, coloque o nome dele em "insumos_faltando" (não invente id pra ele).
- Se nenhum insumo da lista servir, devolva "itens": [].

Responda em JSON estrito, sem texto fora do JSON, neste formato:
{"itens": [{"insumo_id": "...", "quantidade": 0}], "insumos_faltando": ["..."]}
`.trim();

const PROMPT_EXTRAS = (nomeProduto: string, nomeCategoria: string | undefined, descricao: string | undefined) => `
Você é um consultor de cardápio para food service brasileiro.

Produto: "${nomeProduto}"${nomeCategoria ? `\nCategoria: ${nomeCategoria}` : ''}${descricao ? `\nDescrição: ${descricao}` : ''}

Sugira de 1 a 3 grupos de personalização típicos deste tipo de prato (ex.: ponto da carne, tamanho, borda, adicionais/extras — o que fizer sentido pra ESTE produto específico, não uma lista genérica).
Para cada grupo:
- "min_escolhas": 0 = opcional, 1 = obrigatório escolher.
- "max_escolhas": 1 = o cliente marca só uma opção (vira botão único); maior que 1 = pode marcar várias juntas ao mesmo tempo — use isso em grupos de "extras/adicionais" onde faz sentido combinar mais de um.
- "max_escolhas" nunca pode ser maior que o número de opções do grupo.
- "opcoes": nome curto + "preco_adicional" em reais (número, use 0 quando for grátis, ex. ponto da carne).

Responda em JSON estrito, sem texto fora do JSON, neste formato:
{"grupos": [{"nome": "...", "min_escolhas": 0, "max_escolhas": 1, "opcoes": [{"nome": "...", "preco_adicional": 0}]}]}
`.trim();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const clientIp = ipDaRequisicao(req);
  const rl = await checkRateLimit(`ai-ficha:${clientIp}`, { windowMs: 60000, maxRequests: 10 });
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em breve.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 429,
    });
  }

  try {
    const { tipo, nome_produto, nome_categoria, descricao, insumos } = await req.json();
    if (!nome_produto) throw new Error('nome_produto é obrigatório.');
    if (tipo !== 'ficha_tecnica' && tipo !== 'extras') throw new Error('tipo precisa ser "ficha_tecnica" ou "extras".');
    if (tipo === 'ficha_tecnica' && (!Array.isArray(insumos) || insumos.length === 0)) {
      throw new Error('Cadastre insumos em Estoque antes de pedir sugestão de ficha técnica.');
    }

    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!jwt) throw new Error('Usuário não autenticado. Por favor, faça login novamente.');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: userError } = await admin.auth.getUser(jwt);
    if (userError || !user) throw new Error('Sessão de usuário expirada ou inválida. Recarregue a página e faça login novamente.');

    const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY');
    if (!deepseekKey) {
      throw new Error('Chave DEEPSEEK_API_KEY não configurada no Supabase (Secrets). Adicione DEEPSEEK_API_KEY no painel do Supabase.');
    }

    const prompt = tipo === 'ficha_tecnica'
      ? PROMPT_FICHA(nome_produto, nome_categoria, descricao, insumos)
      : PROMPT_EXTRAS(nome_produto, nome_categoria, descricao);

    const modelo = Deno.env.get('DEEPSEEK_MODEL') || 'deepseek-chat';
    const deepseekResponse = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${deepseekKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelo,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
      }),
    });

    const aiData = await deepseekResponse.json();
    if (aiData.error) {
      throw new Error(`Erro do DeepSeek: ${aiData.error.message || JSON.stringify(aiData.error)}`);
    }

    const texto = aiData.choices?.[0]?.message?.content?.trim();
    if (!texto) throw new Error('A IA não devolveu sugestão.');

    let sugestao: unknown;
    try {
      sugestao = JSON.parse(texto);
    } catch {
      throw new Error('A IA devolveu um formato inesperado. Tente novamente.');
    }

    return new Response(JSON.stringify({ sugestao }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Erro na Edge Function ai-sugerir-ficha:', error);
    return new Response(JSON.stringify({ error: error.message || 'Erro interno' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});
