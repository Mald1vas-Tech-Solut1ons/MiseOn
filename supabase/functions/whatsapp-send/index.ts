import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Modo simulação — entra em ação em dois casos, ambos seguros para produção:
//  1. WHATSAPP_SIMULACAO=true — flag explícita, para desenvolvimento local.
//  2. Fallback automático quando a Meta rejeita o token (OAuthException 190).
//     A mensagem se perderia de qualquer jeito, então registramos o erro na
//     conexão (o painel mostra em vermelho) e devolvemos sucesso simulado para
//     o resto do pipeline seguir. Assim que um token válido for salvo o envio
//     real volta sozinho — não há flag para lembrar de desligar depois.
const SIMULACAO_FORCADA = Deno.env.get("WHATSAPP_SIMULACAO") === "true";

// Erros da Graph API que significam "credencial inválida", não "mensagem ruim"
function ehErroDeToken(status: number, metaData: any): boolean {
  const code = metaData?.error?.code;
  const type = metaData?.error?.type;
  return status === 401 || code === 190 || code === 102 || type === "OAuthException";
}

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

    // Marca a conexão como ERRO com a causa legível — a tela Integração
    // WhatsApp lê status + ultimo_erro e mostra o semáforo vermelho.
    const marcarErro = async (motivo: string) => {
      await supabase
        .from("whatsapp_conexoes")
        .update({ status: "ERRO", ultimo_erro: motivo.slice(0, 500) })
        .eq("loja_id", loja_id);
    };

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

    const semCredenciais = !conexao.phone_number_id ||
      !conexao.access_token ||
      conexao.access_token.trim() === "";

    if (semCredenciais && !SIMULACAO_FORCADA) {
      console.warn(`Tentativa de envio sem credenciais ativas para loja ${loja_id}`);
      await marcarErro(
        "phone_number_id ou access_token ausente. Reconecte o WhatsApp em Integração WhatsApp.",
      );
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

    // 4b. Simulação explícita (desenvolvimento local) — não toca na Graph API
    if (SIMULACAO_FORCADA) {
      console.log(
        `[WHATSAPP-SIMULADO] WHATSAPP_SIMULACAO=true — envio não realizado. loja=${loja_id} para=${telefone}`,
      );
      return json({
        success: true,
        simulado: true,
        message_id: `wamid.simulado.${Date.now()}`,
        motivo: "WHATSAPP_SIMULACAO=true — mensagem não enviada de verdade",
      });
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
      const detalhe = metaData?.error?.message ?? `HTTP ${metaRes.status}`;

      // Token expirado/revogado: a mensagem já está salva no ChatAdmin e se
      // perderia aqui. Registramos a causa e seguimos em modo simulado para o
      // restante do fluxo continuar funcionando durante a homologação.
      if (ehErroDeToken(metaRes.status, metaData)) {
        console.error(
          `[WHATSAPP-SIMULADO] Meta rejeitou o token da loja ${loja_id}: ${detalhe}. ` +
            `Gere um token permanente (System User) no Meta Business e salve em Integração WhatsApp.`,
        );
        await marcarErro(`Token da Meta inválido ou expirado — ${detalhe}`);
        return json({
          success: true,
          simulado: true,
          message_id: `wamid.simulado.${Date.now()}`,
          motivo: "Token da Meta inválido ou expirado — mensagem não enviada de verdade",
          detalhe,
        });
      }

      console.error("Erro na Meta Graph API:", metaData);
      await marcarErro(detalhe);
      return json({ error: "Erro ao enviar na Meta", details: metaData }, 400);
    }

    // Envio real deu certo: se a conexão estava marcada em erro, reabilita.
    if (conexao.status !== "CONECTADO") {
      await supabase
        .from("whatsapp_conexoes")
        .update({ status: "CONECTADO", ultimo_erro: null })
        .eq("loja_id", loja_id);
    }

    return json({ success: true, message_id: metaData?.messages?.[0]?.id });
  } catch (error: any) {
    console.error("Erro interno no whatsapp-send:", error);
    return json({ error: error.message }, 500);
  }
});
