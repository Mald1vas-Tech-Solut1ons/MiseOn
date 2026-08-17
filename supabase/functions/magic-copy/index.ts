import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Auditoria, achado 06: sem isto a função era um proxy Gemini público.
    // Só usuário autenticado com vínculo em alguma loja consome IA.
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Não autenticado.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { nome, categoria } = await req.json()
    if (!nome) throw new Error('Nome do produto não fornecido.')

    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiKey) throw new Error('Chave da API do Gemini não configurada no servidor.')

    const prompt = `Você é um copywriter especialista em gastronomia e food delivery.\n` +
      `Escreva uma descrição extremamente apetitosa, focada em vender e fazer o cliente "salivar", para um produto chamado "${nome}". ` +
      (categoria ? `O produto é da categoria: ${categoria}. ` : '') +
      `A descrição deve ser curta (no máximo 3 linhas), direta, sem emojis exagerados, focando em texturas, sabores e desejo. Não use aspas na resposta.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
        }
      }),
    });

    const aiData = await response.json();
    if (aiData.error) throw new Error(aiData.error.message || 'Erro no Gemini.');
    
    const texto = aiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Descrição não gerada.';

    return new Response(JSON.stringify({ descricao: texto }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
