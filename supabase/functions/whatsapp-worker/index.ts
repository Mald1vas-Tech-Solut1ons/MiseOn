// whatsapp-worker — processa a fila whatsapp_eventos (PLANO-WHATSAPP.md §6.3)
// Consome PENDENTE com FOR UPDATE SKIP LOCKED (via RPC), resolve/cria a conversa
// (canal=WHATSAPP), grava a mensagem do cliente no ChatAdmin, renova a janela de
// 24h e aplica rate limit em Postgres (RN-11). A chamada da IA entra no E3.
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

// Extrai um texto legível da mensagem, qualquer que seja o tipo
function textoDaMensagem(msg: any): string {
  switch (msg?.type) {
    case "text":
      return msg?.text?.body ?? "";
    case "image":
      return `[imagem] ${msg?.image?.caption ?? ""}`.trim();
    case "audio":
    case "voice":
      return "[áudio]";
    case "video":
      return `[vídeo] ${msg?.video?.caption ?? ""}`.trim();
    case "document":
      return `[documento] ${msg?.document?.filename ?? ""}`.trim();
    case "location":
      return `[localização] ${msg?.location?.latitude},${msg?.location?.longitude}`;
    case "sticker":
      return "[figurinha]";
    case "button":
      return msg?.button?.text ?? "[botão]";
    case "interactive":
      return msg?.interactive?.button_reply?.title ??
        msg?.interactive?.list_reply?.title ?? "[resposta interativa]";
    default:
      return `[${msg?.type ?? "tipo desconhecido"}]`;
  }
}

// RN-11: rate limit em Postgres — 10 msgs/min por telefone, 300/h por loja.
// Edge Function é multi-isolate: Map in-memory NÃO limita nada.
async function bateuRateLimit(
  supabase: any,
  chave: string,
  janelaSegundos: number,
  teto: number,
): Promise<boolean> {
  const agora = new Date();
  const { data } = await supabase
    .from("whatsapp_rate_limit")
    .select("janela_ini, contador")
    .eq("chave", chave)
    .maybeSingle();

  if (!data) {
    await supabase.from("whatsapp_rate_limit").insert({
      chave,
      janela_ini: agora.toISOString(),
      contador: 1,
    });
    return false;
  }

  const ini = new Date(data.janela_ini).getTime();
  const expirou = agora.getTime() - ini > janelaSegundos * 1000;

  if (expirou) {
    await supabase
      .from("whatsapp_rate_limit")
      .update({ janela_ini: agora.toISOString(), contador: 1 })
      .eq("chave", chave);
    return false;
  }

  const novo = (data.contador ?? 0) + 1;
  await supabase
    .from("whatsapp_rate_limit")
    .update({ contador: novo })
    .eq("chave", chave);
  return novo > teto;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "método não suportado" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let lojaFiltro: string | null = null;
  try {
    const body = await req.json();
    lojaFiltro = body?.loja_id ?? null;
  } catch { /* corpo vazio: varre tudo (chamada do pg_cron) */ }

  // Claim atômico: PENDENTE → PROCESSANDO com SKIP LOCKED (evita processamento
  // duplo entre isolates — §6.3)
  const { data: eventos, error: claimErr } = await supabase.rpc(
    "fn_whatsapp_claim_eventos",
    { p_loja_id: lojaFiltro, p_limite: 10 },
  );

  if (claimErr) {
    console.error("Erro no claim:", claimErr.message);
    return json({ error: claimErr.message }, 500);
  }
  if (!eventos || eventos.length === 0) {
    return json({ ok: true, processados: 0 });
  }

  let processados = 0;
  let erros = 0;

  for (const evento of eventos) {
    try {
      const msg = evento.payload?.message;
      const contato = evento.payload?.contacts?.[0];
      const telefone: string | undefined = msg?.from;
      if (!telefone) throw new Error("evento sem remetente");

      // RN-11: excedeu → silêncio (registra, não gasta processamento)
      const excedeuTel = await bateuRateLimit(
        supabase, `tel:${telefone}`, 60, 10,
      );
      const excedeuLoja = await bateuRateLimit(
        supabase, `loja:${evento.loja_id}`, 3600, 300,
      );
      if (excedeuTel || excedeuLoja) {
        console.warn(`Rate limit: tel=${telefone} loja=${evento.loja_id}`);
        await supabase
          .from("whatsapp_eventos")
          .update({
            status: "OK",
            erro: "descartado por rate limit (RN-11)",
            processado_em: new Date().toISOString(),
          })
          .eq("id", evento.id);
        continue;
      }

      // Resolve ou cria a conversa (canal=WHATSAPP, única por loja+telefone)
      const nomeContato: string | null =
        evento.payload?.contacts?.[0]?.profile?.name ?? null;
      let conversationId: string;
      const { data: existente } = await supabase
        .from("chat_conversations")
        .select("id, cliente_nome")
        .eq("loja_id", evento.loja_id)
        .eq("telefone", telefone)
        .eq("canal", "WHATSAPP")
        .maybeSingle();

      if (existente) {
        conversationId = existente.id;
        // Preenche o nome se a conversa ainda não tinha (ex.: criada antes do E5)
        if (!existente.cliente_nome && nomeContato) {
          await supabase
            .from("chat_conversations")
            .update({ cliente_nome: nomeContato })
            .eq("id", conversationId);
        }
      } else {
        const { data: nova, error: novaErr } = await supabase
          .from("chat_conversations")
          .insert({
            loja_id: evento.loja_id,
            canal: "WHATSAPP",
            telefone,
            cliente_nome: nomeContato,
            ia_ativa: true,
            wa_janela_expira_em: new Date(
              Date.now() + 24 * 3600 * 1000,
            ).toISOString(),
          })
          .select("id")
          .single();

        if (novaErr) {
          // corrida entre isolates: outro worker criou primeiro → relê
          if (novaErr.code === "23505") {
            const { data: releitura } = await supabase
              .from("chat_conversations")
              .select("id")
              .eq("loja_id", evento.loja_id)
              .eq("telefone", telefone)
              .eq("canal", "WHATSAPP")
              .single();
            conversationId = releitura.id;
          } else {
            throw new Error("criar conversa: " + novaErr.message);
          }
        } else {
          conversationId = nova.id;
        }
      }

      // Renova a janela de 24h (RN-09)
      await supabase
        .from("chat_conversations")
        .update({
          wa_janela_expira_em: new Date(
            Date.now() + 24 * 3600 * 1000,
          ).toISOString(),
        })
        .eq("id", conversationId);

      // Grava a mensagem do cliente → aparece no ChatAdmin (aceite do E2)
      const { data: msgGravada, error: msgErr } = await supabase
        .from("chat_messages")
        .insert({
          conversation_id: conversationId,
          remetente_tipo: "CLIENTE",
          conteudo: textoDaMensagem(msg),
        })
        .select("id")
        .single();
      if (msgErr) throw new Error("gravar mensagem: " + msgErr.message);

      // E3: Chama a IA (chat-ai-reception) que fará o roteamento para whatsapp-send
      const aiUrl = Deno.env.get("SUPABASE_URL") + "/functions/v1/chat-ai-reception";
      // Disparamos sem aguardar a resposta (fire-and-forget) para liberar o worker mais rápido
      fetch(aiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ conversation_id: conversationId })
      }).catch(e => console.error("Erro ao chamar chat-ai-reception:", e));

      // Notificação em tempo real para o painel (nova mensagem do cliente)
      const channel = supabase.channel(`admin-alerts-${evento.loja_id}`);
      await channel.send({
        type: 'broadcast',
        event: 'new_chat_message',
        payload: {
          conversation_id: conversationId,
          // ID da mensagem, não da conversa: o painel deduplica por ele. Com o
          // id da conversa, só a 1ª mensagem de cada cliente virava notificação.
          message_id: msgGravada?.id ?? null,
          loja_id: evento.loja_id,
          canal: "WHATSAPP",
          cliente_nome: nomeContato || telefone,
          message: textoDaMensagem(msg)
        }
      });
      supabase.removeChannel(channel);

      await supabase
        .from("whatsapp_eventos")
        .update({ status: "OK", processado_em: new Date().toISOString() })
        .eq("id", evento.id);
      processados++;
    } catch (e) {
      erros++;
      const tentativas = (evento.tentativas ?? 0) + 1;
      await supabase
        .from("whatsapp_eventos")
        .update({
          status: tentativas >= 3 ? "ERRO" : "PENDENTE",
          tentativas,
          erro: String(e?.message ?? e).slice(0, 500),
        })
        .eq("id", evento.id);
      console.error(`Evento ${evento.id} falhou (${tentativas}/3):`, e);
    }
  }

  return json({ ok: true, processados, erros });
});
