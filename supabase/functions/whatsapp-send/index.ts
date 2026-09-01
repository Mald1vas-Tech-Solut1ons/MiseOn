import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { checkRateLimit, ipDaRequisicao } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-chat-session",
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

  // Freio de vazao. A funcao ja exige autorizacao propria (abaixo); o limite
  // existe para que tentativa em massa contra essa autorizacao — ou um token
  // vazado — nao vire custo nem volume ilimitado. Em falha de banco o
  // limitador DEIXA PASSAR (ver _shared/rate-limit.ts), entao ele nao vira um
  // novo ponto unico de queda.
  // 60/min por IP: uma loja em hora de pico dispara confirmacao, status e
  // aviso de entrega — bem abaixo disso.
  const rl = await checkRateLimit(`whatsapp-send:${ipDaRequisicao(req)}`, {
    windowMs: 60_000,
    maxRequests: 60,
  });
  if (!rl.allowed) return json({ error: "Muitas requisicoes. Tente em instantes." }, 429);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { loja_id, telefone, texto, template, conversation_id, access_token } = await req.json();

    if (!loja_id || !telefone) {
      return json({ error: "loja_id e telefone são obrigatórios" }, 400);
    }
    if (!texto && !template) {
      return json({ error: "texto ou template é obrigatório" }, 400);
    }

    // ── AUTORIZAÇÃO ────────────────────────────────────────────────────────
    // Esta função dispara mensagem pelo número VERIFICADO do lojista. Ficou um
    // tempo sem checagem nenhuma (verify_jwt=false + nenhuma validação no
    // corpo) e, como `loja_id` é público via `lojas_publicas`, qualquer um na
    // internet mandava WhatsApp em nome do restaurante — caminho curto para a
    // Meta banir o número. Dois chamadores legítimos, e só eles:
    //   1. service role  — chamada function-to-function (chat-ai-reception).
    //   2. JWT de usuário — precisa ter vínculo com a loja (usuarios_loja).
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!bearer) return json({ error: "Não autorizado" }, 401);

    const ehServiceRole = bearer === supabaseServiceKey;

    if (!ehServiceRole) {
      const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
      });
      const { data: { user } } = await supabaseUser.auth.getUser();
      if (!user) return json({ error: "Não autorizado" }, 401);

      const { data: vinculo } = await supabase
        .from("usuarios_loja")
        .select("papel")
        .eq("user_id", user.id)
        .eq("loja_id", loja_id)
        .maybeSingle();
      if (!vinculo) return json({ error: "Sem acesso a esta loja" }, 403);
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

    // O override de token só vale para chamada interna (service role). Vindo do
    // browser seria um jeito de usar esta função como proxy de envio arbitrário.
    const tokenFinal = (ehServiceRole && access_token && String(access_token).trim() !== "")
      ? String(access_token).trim()
      : conexao.access_token;

    const semCredenciais = !conexao.phone_number_id ||
      !tokenFinal ||
      tokenFinal.trim() === "";

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

    // 4. Prepara o payload para a Graph API (garante apenas dígitos no telefone)
    const telLimpo = String(telefone).replace(/\D/g, "");

    let metaPayload: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: telLimpo,
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
        `[WHATSAPP-SIMULADO] WHATSAPP_SIMULACAO=true — envio não realizado. loja=${loja_id} para=${telLimpo}`,
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
        "Authorization": `Bearer ${tokenFinal}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metaPayload),
    });

    const metaData = await metaRes.json();

    if (!metaRes.ok) {
      const detalhe = metaData?.error?.message ?? `HTTP ${metaRes.status}`;

      if (ehErroDeToken(metaRes.status, metaData)) {
        console.error(
          `[WHATSAPP-ERRO] Meta rejeitou o token da loja ${loja_id}: ${detalhe}. ` +
            `Gere um token permanente (System User) no Meta Business e salve em Integração WhatsApp.`,
        );
        await marcarErro(`Token da Meta inválido ou expirado — ${detalhe}`);
        return json({
          error: `Token da Meta inválido ou expirado: ${detalhe}. Gere um token permanente no Meta Business.`,
          code: "TOKEN_INVALIDO",
          details: metaData,
        }, 401);
      }

      console.error("Erro na Meta Graph API:", metaData);
      await marcarErro(detalhe);
      return json({ error: `Erro na Meta: ${detalhe}`, details: metaData }, 400);
    }

    // Envio real deu certo: salva token permanente e reabilita status CONECTADO
    await supabase
      .from("whatsapp_conexoes")
      .update({
        access_token: tokenFinal,
        status: "CONECTADO",
        ultimo_erro: null,
        conectado_em: new Date().toISOString()
      })
      .eq("loja_id", loja_id);

    return json({ success: true, message_id: metaData?.messages?.[0]?.id });
  } catch (error: any) {
    console.error("Erro interno no whatsapp-send:", error);
    return json({ error: error.message }, 500);
  }
});
