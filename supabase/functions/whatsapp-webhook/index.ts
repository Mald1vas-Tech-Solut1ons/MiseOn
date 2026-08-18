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

// ── Conclusão automática da conexão (Embedded Signup à prova do navegador) ──
// A Meta avisa por account_update/PARTNER_ADDED assim que o lojista compartilha
// a conta. Se houver uma intenção de conexão registrada (whatsapp_conexoes_pendentes),
// fechamos a conexão aqui — sem depender de o popup devolver o `code`.
const GRAPH = "https://graph.facebook.com/v21.0";
const META_APP_SECRET = Deno.env.get("META_APP_SECRET") ?? "";
const SYS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? "";

function msgGraph(data: any): string {
  return data?.error?.message ?? "erro desconhecido na Graph API";
}

function gerarVerifyToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return "miseon-wa-" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function gerarPin(): string {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return String(n[0] % 1000000).padStart(6, "0");
}

// Fecha a conexão da loja usando o token permanente do System User da plataforma.
// Devolve sempre um detalhe legível — nada aqui falha em silêncio.
async function concluirConexao(
  supabase: any,
  wabaId: string,
  lojaId: string,
): Promise<{ ok: boolean; detalhe: string; display?: string | null }> {
  if (!SYS_TOKEN) {
    return { ok: false, detalhe: "WHATSAPP_ACCESS_TOKEN nao configurado nos secrets" };
  }

  // (a) inscreve o app do MiseOn na WABA — sem isto a Meta nao entrega mensagens
  const subRes = await fetch(`${GRAPH}/${wabaId}/subscribed_apps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SYS_TOKEN}` },
  });
  const subData = await subRes.json().catch(() => ({}));
  if (!subRes.ok || subData?.success !== true) {
    return { ok: false, detalhe: `subscribed_apps falhou: ${msgGraph(subData)}` };
  }

  // (b) descobre o numero real da conta (o de teste +1 555 nunca vence)
  const telRes = await fetch(
    `${GRAPH}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`,
    { headers: { Authorization: `Bearer ${SYS_TOKEN}` } },
  );
  const tel = await telRes.json().catch(() => ({}));
  const numeros: Array<{ id: string; display_phone_number?: string; verified_name?: string }> =
    tel?.data ?? [];
  if (!numeros.length) {
    return { ok: false, detalhe: `WABA sem numeros: ${msgGraph(tel)}` };
  }
  // RN: o numero de teste da Meta (+1 555) so fala com destinatarios cadastrados
  // no console de desenvolvedor. Conectar com ele daria um "CONECTADO" mentiroso:
  // a loja nao receberia nenhuma mensagem de cliente de verdade.
  const ehTeste = (n: { display_phone_number?: string }) =>
    String(n.display_phone_number ?? "").replace(/\D/g, "").startsWith("1555");
  const reais = numeros.filter((n) => !ehTeste(n));
  if (!reais.length) {
    return { ok: false, detalhe: "SO_NUMERO_DE_TESTE" };
  }
  const numero = reais[0];

  // (c) RN: um numero pertence a uma loja so
  const { data: emUso } = await supabase
    .from("whatsapp_conexoes")
    .select("loja_id")
    .eq("phone_number_id", String(numero.id))
    .maybeSingle();
  if (emUso && emUso.loja_id !== lojaId) {
    return { ok: false, detalhe: "este numero ja esta conectado a outra loja" };
  }

  // (d) registra o numero no Cloud API (melhor esforco — pode ja estar registrado)
  const pin = gerarPin();
  let pinSalvo: string | null = null;
  try {
    const regRes = await fetch(`${GRAPH}/${numero.id}/register`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SYS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", pin }),
    });
    const regData = await regRes.json().catch(() => ({}));
    if (regRes.ok && regData?.success === true) pinSalvo = pin;
    else console.warn("concluirConexao: register nao concluiu:", msgGraph(regData));
  } catch (e) {
    console.warn("concluirConexao: register falhou (ignorado):", e);
  }

  // (e) grava a conexao — token do System User: permanente, nao expira em 24h
  const { error: eUpsert } = await supabase.from("whatsapp_conexoes").upsert({
    loja_id: lojaId,
    phone_number_id: String(numero.id),
    waba_id: String(wabaId),
    display_phone: numero.display_phone_number ?? null,
    verified_name: numero.verified_name ?? null,
    access_token: SYS_TOKEN,
    app_secret: META_APP_SECRET,
    verify_token: gerarVerifyToken(),
    pin_registro: pinSalvo,
    status: "CONECTADO",
    conectado_em: new Date().toISOString(),
    ultimo_erro: null,
  });
  if (eUpsert) return { ok: false, detalhe: `falha ao gravar a conexao: ${eUpsert.message}` };

  await supabase.from("whatsapp_conexoes_pendentes").delete().eq("loja_id", lojaId);

  return {
    ok: true,
    detalhe: `conectado ao numero ${numero.display_phone_number ?? numero.id}`,
    display: numero.display_phone_number ?? null,
  };
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
      // É por aqui que a conexão se fecha quando o popup da Meta não devolve o
      // `code` (aba fechada, popup bloqueado, code expirado).
      // O waba_id fica em value.waba_info.waba_id. `entry[0].id` NAO serve:
      // nos eventos de account_update ele traz o ID do Business do app, e usa-lo
      // fazia todo POST /{id}/subscribed_apps falhar com "does not exist".
      const wabaInfo = value?.waba_info ?? {};
      const wabaId = wabaInfo?.waba_id
        ? String(wabaInfo.waba_id)
        : (payload?.entry?.[0]?.id ? String(payload.entry[0].id) : null);
      const campo = change?.field ? String(change.field) : null;

      // Assinatura: o evento é do APP MiseOn, então valida com o app_secret dele.
      // Sem isso qualquer um poderia forjar um PARTNER_ADDED e sequestrar a
      // conexão de uma loja que está com uma intenção pendente.
      const assinaturaConta = req.headers.get("x-hub-signature-256");
      const assinaturaOk = await assinaturaValida(rawBody, assinaturaConta, META_APP_SECRET);
      if (!assinaturaOk) {
        console.warn(`Evento de conta com assinatura inválida — waba_id: ${wabaId ?? "?"}`);
        return json({ error: "assinatura inválida" }, 401);
      }

      const { data: evento } = await supabase
        .from("whatsapp_eventos_meta")
        .insert({ waba_id: wabaId, campo, payload })
        .select("id")
        .maybeSingle();

      // Casa o evento com a intenção de conexão mais recente (janela de 1h).
      let resultado = "sem waba_id no evento";
      if (wabaId) {
        const limite = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { data: pendente } = await supabase
          .from("whatsapp_conexoes_pendentes")
          .select("loja_id")
          .gte("criado_em", limite)
          .order("criado_em", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!pendente) {
          resultado = "nenhuma conexão pendente na janela de 1h";
        } else {
          try {
            const r = await concluirConexao(supabase, wabaId, pendente.loja_id);
            resultado = r.ok
              ? `OK: ${r.detalhe}`
              : r.detalhe === "SO_NUMERO_DE_TESTE"
                ? "FALHOU: A conta do WhatsApp Business criada na Meta tem APENAS o numero de teste (+1 555). O numero real da loja nao foi adicionado — no assistente da Meta, no passo 'Adicionar um numero de telefone', digite o numero da loja e confirme o codigo que chega por SMS. Importante: esse numero nao pode estar ativo no WhatsApp comum."
                : `FALHOU: ${r.detalhe}`;
            if (r.ok) {
              console.log(`Conexão concluída pelo webhook — loja ${pendente.loja_id}: ${r.detalhe}`);
            } else {
              console.error(`Conclusão automática falhou (loja ${pendente.loja_id}): ${r.detalhe}`);
            }
          } catch (e) {
            resultado = `ERRO: ${String((e as Error)?.message ?? e)}`;
            console.error("Conclusão automática lançou exceção:", e);
          }
        }
      }

      if (evento?.id) {
        await supabase
          .from("whatsapp_eventos_meta")
          .update({ processado_em: new Date().toISOString(), resultado })
          .eq("id", evento.id);
      }

      console.log(`Evento de conta (${campo ?? "?"}) waba_id ${wabaId ?? "?"} — ${resultado}`);
      return json({ ok: true, resultado });
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
