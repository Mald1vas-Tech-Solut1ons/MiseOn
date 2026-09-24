import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

import { checkRateLimit, ipDaRequisicao } from '../_shared/rate-limit.ts';
import { gerarTexto } from '../_shared/ia-texto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-chat-session',
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


    const prompt = `Você é um copywriter especialista em gastronomia e food delivery.\n` +
      `Escreva uma descrição extremamente apetitosa, focada em vender e fazer o cliente "salivar", para um produto chamado "${nome_produto}". ` +
      (nome_categoria ? `O produto é da categoria: ${nome_categoria}. ` : '') +
      `A descrição deve ser curta (no máximo 3 linhas), direta, sem emojis exagerados, focando em texturas, sabores e desejo. Não use aspas na resposta.`;

    // Módulo único de IA (DeepSeek, Groq de reserva, modelo em cascata).
    const { texto: respostaTexto } = await gerarTexto({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 150,
    });

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
