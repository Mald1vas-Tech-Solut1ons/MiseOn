// whatsapp-webhook — o "porteiro" da integração WhatsApp (PLANO-WHATSAPP.md §6.2)
// Faz pouco, e rápido: handshake GET, valida HMAC, dedup, enfileira, responde 200.
// PROIBIDO aqui: chamar IA, chamar Graph API ou qualquer I/O lento (RN-02).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// RN-04: HMAC-SHA256 do corpo cru com o app_secret da loja
async function assinaturaValida(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): Promise<boolean> {
  if (!appSecret || appSecret.trim() === "" || appSecret === "SKIP") {
    return true; // Se o app_secret não estiver preenchido, aceita em modo de homologação
  }
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody),
  );
  const esperado = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const recebido = signatureHeader.slice("sha256=".length);
  // comparação em tempo constante
  if (esperado.length !== recebido.length) return false;
  let diff = 0;
  for (let i = 0; i < esperado.length; i++) {
    diff |= esperado.charCodeAt(i) ^ recebido.charCodeAt(i);
  }
  return diff === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // ── GET: handshake de verificação da Meta ────────────────────────────────
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode !== "subscribe" || !token || !challenge) {
      return json({ error: "handshake inválido" }, 400);
    }

    // Fallback: aceita o token fixo da plataforma (WHATSAPP_VERIFY_TOKEN)
    // para permitir a configuração inicial no painel da Meta antes de
    // existir qualquer loja cadastrada em whatsapp_conexoes.
    const platformToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
    if (platformToken && token === platformToken) {
      console.log("Handshake validado pelo token de plataforma (env)");
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // Caminho normal: busca o verify_token por loja na tabela
    const { data: conexao } = await supabase
      .from("whatsapp_conexoes")
      .select("loja_id")
      .eq("verify_token", token)
      .maybeSingle();

    if (!conexao) {
      console.warn("Handshake com verify_token desconhecido");
      return json({ error: "verify_token não confere" }, 403);
    }

    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // ── POST: eventos da Meta ────────────────────────────────────────────────
  if (req.method === "POST") {
    // 1. corpo cru ANTES de qualquer parse (necessário para o HMAC — RN-04)
    const rawBody = await req.text();

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      // corpo inválido: ainda assim 200, para a Meta não desabilitar o webhook
      return json({ ok: true, descartado: "json inválido" });
    }

    // 2. resolve a loja pelo phone_number_id (RN-05)
    const change = payload?.entry?.[0]?.changes?.[0];
    const value = change?.value;
    const phoneNumberId: string | undefined = value?.metadata?.phone_number_id;

    if (!phoneNumberId) {
      // Eventos de conta (account_update / PARTNER_ADDED do Embedded Signup) não
      // trazem phone_number_id — mas trazem o waba_id da conta recém-compartilhada.
      // Guardamos o payload: é com ele que o suporte conclui a conexão quando o
      // popup da Meta não devolve o `code`.
      const wabaId = payload?.entry?.[0]?.id ?? null;
      await supabase.from("whatsapp_eventos_meta").insert({
        waba_id: wabaId ? String(wabaId) : null,
        campo: change?.field ? String(change.field) : null,
        payload,
      });
      console.log(`Evento de conta sem phone_number_id registrado — waba_id: ${wabaId ?? "?"}`);
      return json({ ok: true, descartado: "sem phone_number_id" });
    }

    const { data: conexao, error: conexaoErr } = await supabase
      .from("whatsapp_conexoes")
      .select("loja_id, app_secret")
      .eq("phone_number_id", phoneNumberId)
      .maybeSingle();

    if (conexaoErr || !conexao) {
      console.warn(`phone_number_id desconhecido: ${phoneNumberId}`);
      // 200 proposital: não ensinar a Meta/atacante quais IDs existem
      return json({ ok: true, descartado: "loja desconhecida" });
    }

    // 3. valida assinatura (RN-04) — falha = 401, sem gravar nada
    const assinatura = req.headers.get("x-hub-signature-256");
    const ok = await assinaturaValida(rawBody, assinatura, conexao.app_secret);
    if (!ok) {
      console.warn(`Assinatura inválida para loja ${conexao.loja_id}`);
      return json({ error: "assinatura inválida" }, 401);
    }

    // 4. enfileira mensagens (RN-03: dedup por wa_message_id)
    //    status updates (entregue/lido) não viram evento — só mensagens.
    const mensagens: any[] = value?.messages ?? [];
    let enfileiradas = 0;
    let duplicadas = 0;

    for (const msg of mensagens) {
      const waMessageId: string | undefined = msg?.id;
      if (!waMessageId) continue;

      const { error: insertErr } = await supabase
        .from("whatsapp_eventos")
        .insert({
          loja_id: conexao.loja_id,
          wa_message_id: waMessageId,
          payload: {
            message: msg,
            contacts: value?.contacts ?? [],
            metadata: value?.metadata ?? {},
          },
        });

      if (insertErr) {
        // 23505 = unique violation → duplicata da Meta, descarte silencioso
        if (insertErr.code === "23505") duplicadas++;
        else console.error("Erro ao enfileirar:", insertErr.message);
      } else {
        enfileiradas++;
      }
    }

    // 5. dispara o worker SEM aguardar e retorna 200 (RN-02)
    if (enfileiradas > 0) {
      const workerUrl = `${supabaseUrl}/functions/v1/whatsapp-worker`;
      fetch(workerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ loja_id: conexao.loja_id }),
      }).catch((e) => console.error("Falha ao disparar worker:", e));
      // rede de segurança: pg_cron varre PENDENTE órfão a cada minuto (§6.3)
    }

    return json({ ok: true, enfileiradas, duplicadas });
  }

  return json({ error: "método não suportado" }, 405);
});
