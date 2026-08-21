import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-chat-session',
};

const json = (data: any, init?: ResponseInit) => new Response(JSON.stringify(data), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  ...init
});

const TOKEN_PROD = Deno.env.get('FOCUS_API_TOKEN_PROD') || Deno.env.get('FOCUS_NFE_PROD');
const TOKEN_HOMOLOG = Deno.env.get('FOCUS_API_TOKEN_HOMOLOG') || Deno.env.get('FOCUS_NFE_HOMOLOG');

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { nota_id, justificativa } = await req.json();

    if (!nota_id) {
      return json({ error: 'nota_id é obrigatório' }, { status: 400 });
    }
    if (!justificativa || justificativa.trim().length < 15) {
      return json({ error: 'Justificativa de cancelamento deve possuir no mínimo 15 caracteres' }, { status: 400 });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Não autorizado' }, { status: 401 });

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return json({ error: 'Não autorizado' }, { status: 401 });

    const { data: nota, error: errNota } = await supabaseAdmin
      .from('notas_fiscais')
      .select('*, lojas(*)')
      .eq('id', nota_id)
      .single();

    if (errNota || !nota) {
      return json({ error: 'Nota fiscal não encontrada' }, { status: 404 });
    }

    // Autenticar não basta: era preciso conferir que o usuário é da loja DONA
    // da nota. Sem isso, qualquer pessoa logada na plataforma cancelava nota
    // fiscal de qualquer restaurante — e cancelamento indevido na SEFAZ tem
    // prazo e consequência fiscal, não dá para "desfazer" depois.
    const { data: vinculoNota } = await supabaseAdmin
      .from('usuarios_loja')
      .select('papel')
      .eq('user_id', user.id)
      .eq('loja_id', nota.loja_id)
      .maybeSingle();
    if (!vinculoNota) {
      return json({ error: 'Sem acesso a esta loja' }, { status: 403 });
    }

    const isProd = nota.ambiente === 'producao';
    const isNfce = nota.tipo === 'NFCE';
    const baseUrl = isNfce
      ? (isProd ? 'https://api.focusnfe.com.br/v2/nfce' : 'https://homologacao.focusnfe.com.br/v2/nfce')
      : (isProd ? 'https://api.focusnfe.com.br/v2/nfe' : 'https://homologacao.focusnfe.com.br/v2/nfe');

    const token = isProd ? TOKEN_PROD : TOKEN_HOMOLOG;
    if (!token) {
      const secretVar = isProd ? 'FOCUS_API_TOKEN_PROD ou FOCUS_NFE_PROD' : 'FOCUS_API_TOKEN_HOMOLOG ou FOCUS_NFE_HOMOLOG';
      return json({ error: `Token Focus NFe não configurado nas variáveis de ambiente/secrets (${secretVar}).` }, { status: 500 });
    }
    const chave = nota.chave_nfe || nota.ref;

    // Cancela no Focus NFe API v2
    const res = await fetch(`${baseUrl}/${chave}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${btoa(token + ':')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ justificativa })
    });

    const data = await res.json();
    console.log("Resposta cancelamento Focus NFe:", data);

    if (!res.ok && data.codigo !== 'nfe_ja_cancelada') {
      return json({ error: data.mensagem || 'Falha ao solicitar cancelamento perante a SEFAZ', detail: data }, { status: 400 });
    }

    // Atualiza status no banco de dados
    await supabaseAdmin
      .from('notas_fiscais')
      .update({
        status: 'CANCELADA',
        mensagem_sefaz: `Cancelada: ${justificativa}`
      })
      .eq('id', nota_id);

    if (nota.pedido_id) {
      await supabaseAdmin
        .from('pedidos')
        .update({ nfe_status: 'CANCELADA' })
        .eq('id', nota.pedido_id);
    }

    return json({ success: true, message: 'Nota fiscal cancelada com sucesso na SEFAZ' });

  } catch (err: any) {
    console.error('Crash no cancelamento fiscal:', err);
    return json({ error: err.message || String(err) }, { status: 500 });
  }
});
