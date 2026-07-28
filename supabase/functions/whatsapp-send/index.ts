import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { loja_id, telefone, texto, template, conversation_id } = await req.json();

    if (!loja_id || !telefone) {
      return json({ error: "loja_id e telefone são obrigatórios" }, 400);
    }
    if (!texto && !template) {
      return json({ error: "texto ou template é obrigatório" }, 400);
    }

    // 1. Busca a conexão da loja
    const { data: conexao, error: conexaoErr } = await supabase
      .from("whatsapp_conexoes")
      .select("phone_number_id, access_token, status")
      .eq("loja_id", loja_id)
      .single();

    if (conexaoErr || !conexao) {
      console.error(`Conexão WhatsApp não encontrada para loja ${loja_id}`);
      return json({ error: "WhatsApp não conectado nesta loja" }, 400);
    }

    if (!conexao.phone_number_id || !conexao.access_token) {
      console.warn(`Tentativa de envio sem credenciais ativas para loja ${loja_id}`);
      return json({ error: "WhatsApp da loja não possui phone_number_id ou access_token configurado" }, 400);
    }

    // 2. Busca configurações da loja
    const { data: lojaConfig } = await supabase
      .from("lojas")
      .select("whatsapp_templates_ativo")
      .eq("id", loja_id)
      .single();

    const usaTemplates = lojaConfig?.whatsapp_templates_ativo ?? false;

    // 3. Checa a janela de 24h, se houver conversation_id
    if (conversation_id) {
      const { data: conv } = await supabase
        .from("chat_conversations")
        .select("wa_janela_expira_em")
        .eq("id", conversation_id)
        .single();

      if (conv?.wa_janela_expira_em) {
        const expirou = new Date(conv.wa_janela_expira_em).getTime() < Date.now();
        if (expirou && !usaTemplates && !template) {
          console.warn(`Janela de 24h expirada para conversa ${conversation_id} na loja ${loja_id} e templates desativados.`);
          return json({ error: "Janela de 24h expirada e templates desativados" }, 403);
        }
      }
    }

    // 4. Prepara o payload para a Graph API
    let metaPayload: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: telefone,
    };

    if (template) {
      metaPayload.type = "template";
      metaPayload.template = template; // Object with name, language, components
    } else {
      metaPayload.type = "text";
      metaPayload.text = { preview_url: true, body: texto };
    }

    // 5. Faz o POST para a Graph API
    const metaUrl = `https://graph.facebook.com/v19.0/${conexao.phone_number_id}/messages`;
    
    const metaRes = await fetch(metaUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${conexao.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metaPayload),
    });

    const metaData = await metaRes.json();

    if (!metaRes.ok) {
      console.error("Erro na Meta Graph API:", metaData);
      return json({ error: "Erro ao enviar na Meta", details: metaData }, 400);
    }

    return json({ success: true, message_id: metaData?.messages?.[0]?.id });
  } catch (error: any) {
    console.error("Erro interno no whatsapp-send:", error);
    return json({ error: error.message }, 500);
  }
});
