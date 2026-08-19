import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

import { checkRateLimit, ipDaRequisicao } from '../_shared/rate-limit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Rate Limiting (máx 10 por min)
  const clientIp = ipDaRequisicao(req);
  const rl = await checkRateLimit(`ai-desc:${clientIp}`, { windowMs: 60000, maxRequests: 10 });
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em breve.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 429,
    });
  }

  try {
    const { nome_produto, nome_categoria } = await req.json();
    if (!nome_produto) throw new Error('nome_produto é obrigatório.');

    // Autenticação Supabase
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!jwt) throw new Error('Usuário não autenticado. Por favor, faça login novamente.');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);
    
    const { data: { user }, error: userError } = await admin.auth.getUser(jwt);
    if (userError || !user) throw new Error('Sessão de usuário expirada ou inválida. Recarregue a página e faça login novamente.');


    const groqKey = Deno.env.get('GROQ_API_KEY');
    if (!groqKey) {
      throw new Error('Chave GROQ_API_KEY não configurada no Supabase (Secrets). Adicione GROQ_API_KEY no painel do Supabase.');
    }

    const prompt = `Você é um copywriter especialista em gastronomia e food delivery.\n` +
      `Escreva uma descrição extremamente apetitosa, focada em vender e fazer o cliente "salivar", para um produto chamado "${nome_produto}". ` +
      (nome_categoria ? `O produto é da categoria: ${nome_categoria}. ` : '') +
      `A descrição deve ser curta (no máximo 3 linhas), direta, sem emojis exagerados, focando em texturas, sabores e desejo. Não use aspas na resposta.`;

    // Modelos em ordem de preferencia. O Groq aposenta modelo sem aviso, entao a
    // lista mistura geracoes e o GROQ_MODEL permite fixar um sem novo deploy.
    const modelos = [
      Deno.env.get('GROQ_MODEL') ?? '',
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
      'meta-llama/llama-4-scout-17b-16e-instruct',
      'qwen/qwen3-32b',
    ].filter(Boolean);
    let respostaTexto = '';
    let ultimoErro = '';

    for (const model of modelos) {
      try {
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 150
          })
        });

        const aiData = await groqResponse.json();
        if (aiData.error) {
          ultimoErro = aiData.error.message || JSON.stringify(aiData.error);
          console.warn(`Erro no modelo ${model}:`, ultimoErro);
          continue;
        }

        const texto = aiData.choices?.[0]?.message?.content?.trim();
        if (texto) {
          respostaTexto = texto;
          break;
        }
      } catch (err: any) {
        ultimoErro = err.message || String(err);
        console.warn(`Exceção ao chamar modelo ${model}:`, ultimoErro);
      }
    }

    if (!respostaTexto) {
      throw new Error(ultimoErro ? `Erro do Groq: ${ultimoErro}` : 'Não foi possível gerar a descrição.');
    }

    return new Response(JSON.stringify({ texto: respostaTexto }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Erro na Edge Function ai-gerar-descricao:', error);
    return new Response(JSON.stringify({ error: error.message || 'Erro interno' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});
