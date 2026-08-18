// whatsapp-conectar — configuração self-service da integração WhatsApp do lojista.
// Chamada autenticada a partir do painel admin (supabase.functions.invoke já manda o JWT).
// Só atende se o usuário tiver vínculo com a loja; ações destrutivas exigem papel 'admin'.
// RN-15: access_token e app_secret NUNCA voltam ao frontend — só máscara •••• + últimos 4.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GRAPH = "https://graph.facebook.com/v21.0";
const WEBHOOK_URL =
  "https://zzuxklwhaoisuuvndtfw.supabase.co/functions/v1/whatsapp-webhook";

// App MiseOn na Meta — usado no Embedded Signup (troca do `code` por token).
// São segredos da PLATAFORMA (não do lojista): ficam nos secrets da function.
const META_APP_ID = Deno.env.get("META_APP_ID") ?? "";
const META_APP_SECRET = Deno.env.get("META_APP_SECRET") ?? "";
// Token permanente do System User da plataforma: e ele que fecha a conexao
// quando o popup da Meta nao devolve o `code`.
const SYS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function erro(msg: string, status = 400) {
  return json({ error: msg }, status);
}

// RN-15: nunca expor segredo — só máscara com os últimos 4 caracteres
function mascarar(segredo: string | null | undefined): string | null {
  if (!segredo) return null;
  return "••••" + segredo.slice(-4);
}

function gerarVerifyToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `miseon-wa-${hex}`;
}

// PIN de 6 dígitos exigido pelo POST /{phone_number_id}/register do Cloud API
function gerarPin(): string {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return String(n[0] % 1000000).padStart(6, "0");
}

// Extrai mensagem legível de um erro da Graph API
function msgGraph(data: any): string {
  return data?.error?.message ?? "Erro desconhecido na API da Meta";
}

// (a) Valida o token consultando o número na Graph API
async function validarToken(phoneNumberId: string, accessToken: string) {
  const res = await fetch(
    `${GRAPH}/${phoneNumberId}?fields=display_phone_number,verified_name`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false as const, detalhe: msgGraph(data) };
  }
  return {
    ok: true as const,
    displayPhone: data.display_phone_number ?? null,
    verifiedName: data.verified_name ?? null,
  };
}

// Fecha a conexão de uma loja a partir de uma WABA já compartilhada com o app,
// usando o token permanente do System User. É o mesmo caminho que o webhook
// percorre — aqui ele fica disponível como recuperação manual (`reconciliar`).
async function concluirConexao(
  admin: any,
  wabaId: string,
  lojaId: string,
): Promise<{ ok: boolean; detalhe: string; display?: string | null }> {
  if (!SYS_TOKEN) {
    return { ok: false, detalhe: "WHATSAPP_ACCESS_TOKEN nao configurado nos secrets" };
  }

  const subRes = await fetch(`${GRAPH}/${wabaId}/subscribed_apps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SYS_TOKEN}` },
  });
  const subData = await subRes.json().catch(() => ({}));
  if (!subRes.ok || subData?.success !== true) {
    return { ok: false, detalhe: `subscribed_apps falhou: ${msgGraph(subData)}` };
  }

  const telRes = await fetch(
    `${GRAPH}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`,
    { headers: { Authorization: `Bearer ${SYS_TOKEN}` } },
  );
  const tel = await telRes.json().catch(() => ({}));
  const numeros: Array<{ id: string; display_phone_number?: string; verified_name?: string }> =
    tel?.data ?? [];
  if (!numeros.length) return { ok: false, detalhe: `WABA sem numeros: ${msgGraph(tel)}` };

  const ehTeste = (n: { display_phone_number?: string }) =>
    String(n.display_phone_number ?? "").replace(/\D/g, "").startsWith("1555");
  const numero = numeros.filter((n) => !ehTeste(n))[0] ?? numeros[0];

  const { data: emUso } = await admin
    .from("whatsapp_conexoes")
    .select("loja_id")
    .eq("phone_number_id", String(numero.id))
    .maybeSingle();
  if (emUso && emUso.loja_id !== lojaId) {
    return { ok: false, detalhe: "este numero ja esta conectado a outra loja" };
  }

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

  const { error: eUpsert } = await admin.from("whatsapp_conexoes").upsert({
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

  await admin.from("whatsapp_conexoes_pendentes").delete().eq("loja_id", lojaId);

  return {
    ok: true,
    detalhe: `conectado ao numero ${numero.display_phone_number ?? numero.id}`,
    display: numero.display_phone_number ?? null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { acao, loja_id } = body;
    if (!loja_id) return erro("loja_id é obrigatório");
    if (!acao) return erro("acao é obrigatória");

    // ── Autenticação do lojista (JWT no header Authorization) ──────────────
    // Valida o JWT do lojista usando a SERVICE ROLE (auth.getUser(token)).
    // Motivo: validar via cliente anon depende de SUPABASE_ANON_KEY estar
    // correta no runtime da edge — e ela pode estar desatualizada, o que
    // derrubava qualquer chamada com 401 mesmo com token válido.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jwt) return erro("Não autenticado", 401);
    const { data: { user: caller } } = await admin.auth.getUser(jwt);
    if (!caller) return erro("Não autenticado", 401);

    // SuperAdmin da plataforma opera qualquer loja: as ações manuais (colar
    // credenciais da Meta) saíram do painel do lojista e viraram ferramenta de
    // suporte — o assinante conecta só pelo Embedded Signup.
    const { data: souSuperadmin } = await admin
      .from("plataforma_admins")
      .select("user_id")
      .eq("user_id", caller.id)
      .maybeSingle();

    if (!souSuperadmin) {
      const { data: acesso } = await admin
        .from("usuarios_loja")
        .select("papel")
        .eq("user_id", caller.id)
        .eq("loja_id", loja_id)
        .maybeSingle();
      if (!acesso) return erro("Você não tem acesso a esta loja", 403);

      // ações que alteram a conexão exigem admin da loja
      if (["conectar", "atualizar_token", "desconectar", "devolver_numero", "testar", "trocar_codigo", "iniciar_conexao", "reconciliar"].includes(acao) && acesso.papel !== "admin") {
        return erro("Só o admin da loja pode gerenciar a conexão do WhatsApp", 403);
      }

      // RN: credenciais manuais da Meta são ferramenta de suporte da plataforma.
      // O lojista nunca precisa de conta de desenvolvedor — ele usa o Embedded
      // Signup, que preenche phone_number_id/waba_id/token automaticamente.
      if (["conectar", "atualizar_token"].includes(acao)) {
        return erro(
          "Conexão manual é exclusiva do suporte MiseOn. Use o botão 'Conectar com Facebook'.",
          403,
        );
      }
    }

    const buscarConexao = () =>
      admin.from("whatsapp_conexoes").select("*").eq("loja_id", loja_id).maybeSingle();

    // Desliga a loja de verdade — usado por `desconectar` e por `devolver_numero`:
    //   1. a Meta para de entregar mensagens (DELETE /{waba}/subscribed_apps),
    //      confirmado com um GET em vez de "melhor esforço" mudo;
    //   2. a IA da loja é desligada (nada responde por nenhum canal);
    //   3. a linha some de whatsapp_conexoes — sem ela o webhook descarta o
    //      evento ("loja desconhecida") e o whatsapp-send recusa qualquer envio.
    const desligarConexao = async (conexao: {
      waba_id: string | null;
      access_token: string;
      phone_number_id: string;
    }) => {
      // (1) desinscreve o app da WABA — tenta com o token da loja e, se ele já
      //     não valer, com o token de sistema da plataforma (quando existir).
      const tokensParaTentar = [
        conexao.access_token,
        Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? "",
      ].filter((t): t is string => !!t);

      let desinscrito = false;
      let detalheFalha = "";
      for (const t of tokensParaTentar) {
        try {
          const delRes = await fetch(`${GRAPH}/${conexao.waba_id}/subscribed_apps`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${t}` },
          });
          const delData = await delRes.json().catch(() => ({}));
          if (delRes.ok && delData?.success !== false) {
            // confirma de fato: o app MiseOn não pode mais aparecer na lista
            const listaRes = await fetch(`${GRAPH}/${conexao.waba_id}/subscribed_apps`, {
              headers: { Authorization: `Bearer ${t}` },
            });
            const lista = await listaRes.json().catch(() => ({}));
            const apps: Array<{ whatsapp_business_api_data?: { id?: string } }> = lista?.data ?? [];
            const aindaInscrito = apps.some(
              (a) => String(a?.whatsapp_business_api_data?.id ?? "") === META_APP_ID,
            );
            if (!listaRes.ok) {
              // sem conseguir listar, confiamos no sucesso do DELETE
              desinscrito = true;
              break;
            }
            desinscrito = !aindaInscrito;
            if (desinscrito) break;
            detalheFalha = "a Meta aceitou o pedido mas o app continua inscrito na conta.";
          } else {
            detalheFalha = msgGraph(delData);
          }
        } catch (e) {
          detalheFalha = String((e as Error)?.message ?? e);
        }
      }
      if (!desinscrito) {
        console.warn(`desligarConexao: WABA ${conexao.waba_id} não confirmou a desinscrição: ${detalheFalha}`);
      }

      // (2) desliga a automação da loja — nenhum canal responde sozinho
      const { error: eLoja } = await admin
        .from("lojas")
        .update({ whatsapp_ia_ativo: false, whatsapp_templates_ativo: false })
        .eq("id", loja_id);
      if (eLoja) console.warn("desligarConexao: falha ao desligar a IA da loja:", eLoja.message);

      // (3) apaga a conexão — a partir daqui o webhook descarta tudo desse número
      const { error: eDel } = await admin
        .from("whatsapp_conexoes")
        .delete()
        .eq("loja_id", loja_id);
      if (eDel) throw eDel;

      console.log(
        `desligarConexao: loja ${loja_id} desligada — número ${conexao.phone_number_id}, ` +
        `desinscrição na Meta: ${desinscrito ? "confirmada" : "NÃO confirmada"}`,
      );

      return { desinscrito, detalheFalha };
    };

    // ── status ─────────────────────────────────────────────────────────────
    if (acao === "status") {
      const [{ data: conexao }, { data: loja }, { data: eventos }] = await Promise.all([
        buscarConexao(),
        admin
          .from("lojas")
          .select("whatsapp_ia_ativo, whatsapp_templates_ativo, whatsapp_saudacao")
          .eq("id", loja_id)
          .single(),
        admin
          .from("whatsapp_eventos")
          .select("status, erro, criado_em")
          .eq("loja_id", loja_id)
          .order("criado_em", { ascending: false })
          .limit(5),
      ]);

      return json({
        ok: true,
        conexao: conexao
          ? {
              status: conexao.status,
              display_phone: conexao.display_phone,
              verified_name: conexao.verified_name ?? null,
              phone_number_id: conexao.phone_number_id,
              waba_id: conexao.waba_id,
              conectado_em: conexao.conectado_em,
              ultimo_erro: conexao.ultimo_erro,
              access_token: mascarar(conexao.access_token), // RN-15
              app_secret: mascarar(conexao.app_secret), // RN-15
            }
          : null,
        loja: {
          whatsapp_ia_ativo: loja?.whatsapp_ia_ativo ?? false,
          whatsapp_templates_ativo: loja?.whatsapp_templates_ativo ?? false,
          whatsapp_saudacao: loja?.whatsapp_saudacao ?? "",
        },
        eventos: eventos ?? [],
      });
    }

    // ── diagnostico ── testa toda a pipeline IA em tempo real ──────────────
    if (acao === "diagnostico") {
      const resultados: Record<string, unknown> = {};

      // 1. Verifica conexão WhatsApp
      const { data: conexaoDiag } = await buscarConexao();
      resultados.conexao_status = conexaoDiag?.status ?? "NÃO CONFIGURADO";

      // 2. Verifica toggles de IA
      const { data: lojaDiag } = await admin
        .from("lojas")
        .select("whatsapp_ia_ativo, chat_ia_ativo, nome")
        .eq("id", loja_id)
        .single();
      resultados.whatsapp_ia_ativo = lojaDiag?.whatsapp_ia_ativo ?? false;
      resultados.chat_ia_ativo = lojaDiag?.chat_ia_ativo ?? false;
      resultados.loja_nome = lojaDiag?.nome ?? "—";

      // 3. Verifica se GROQ_API_KEY está configurada
      const groqKey = Deno.env.get("GROQ_API_KEY");
      resultados.groq_configurado = !!groqKey;

      // 4. Testa chamada real ao Groq (sem salvar nada)
      if (groqKey) {
        try {
          const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${groqKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "llama-3.3-70b-versatile",
              messages: [
                { role: "system", content: "Responda apenas: OK" },
                { role: "user", content: "Teste de diagnóstico." },
              ],
              max_tokens: 10,
            }),
          });
          const groqData = await groqRes.json().catch(() => ({}));
          resultados.groq_status = groqRes.ok ? "OK" : "ERRO";
          resultados.groq_resposta = groqData.choices?.[0]?.message?.content?.trim() ?? groqData.error?.message ?? "sem resposta";
        } catch (e) {
          resultados.groq_status = "ERRO";
          resultados.groq_resposta = String(e);
        }
      } else {
        resultados.groq_status = "NÃO CONFIGURADO";
        resultados.groq_resposta = "";
      }

      // 5. Última conversa WhatsApp desta loja
      const { data: ultimaConv } = await admin
        .from("chat_conversations")
        .select("id, ia_ativa, cliente_nome, telefone, criado_em")
        .eq("loja_id", loja_id)
        .eq("canal", "WHATSAPP")
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      resultados.ultima_conversa = ultimaConv
        ? { id: ultimaConv.id, ia_ativa: ultimaConv.ia_ativa, cliente_nome: ultimaConv.cliente_nome }
        : null;

      // 6. Eventos recentes
      const { data: eventosDiag } = await admin
        .from("whatsapp_eventos")
        .select("status, erro, criado_em")
        .eq("loja_id", loja_id)
        .order("criado_em", { ascending: false })
        .limit(3);
      resultados.eventos_recentes = eventosDiag ?? [];

      // 7. Lista de problemas encontrados
      const problemas: string[] = [];
      if (!lojaDiag?.whatsapp_ia_ativo && !lojaDiag?.chat_ia_ativo) {
        problemas.push("IA desligada: ative o toggle 'Atendimento automático com IA' na página de Integração WhatsApp e clique em Salvar.");
      }
      if (!groqKey) {
        problemas.push("GROQ_API_KEY ausente: vá em Supabase Dashboard → Edge Functions → Secrets e adicione GROQ_API_KEY com sua chave do Groq.");
      }
      if (groqKey && resultados.groq_status === "ERRO") {
        problemas.push("GROQ_API_KEY inválida ou expirada: gere uma nova chave em console.groq.com e atualize o secret.");
      }
      if (conexaoDiag?.status !== "CONECTADO") {
        problemas.push(`WhatsApp não está CONECTADO (status: ${resultados.conexao_status}).`);
      }
      if (ultimaConv?.ia_ativa === false) {
        problemas.push("Última conversa com ia_ativa=false (humano assumiu). Abra o Chat e reative a IA nessa conversa.");
      }

      resultados.problemas = problemas;
      resultados.pipeline_ok = problemas.length === 0;

      return json({ ok: true, diagnostico: resultados });
    }

    // ── conectar ───────────────────────────────────────────────────────────
    if (acao === "conectar") {
      const { app_id, phone_number_id, waba_id, access_token, app_secret } = body;
      if (!app_id || !phone_number_id || !waba_id || !access_token || !app_secret) {
        return erro("Preencha todos os campos: App ID, Phone Number ID, WABA ID, Access Token e App Secret.");
      }

      // (a) valida o token na Graph API antes de salvar qualquer coisa
      const validacao = await validarToken(String(phone_number_id), String(access_token));
      if (!validacao.ok) {
        console.warn("conectar: token inválido:", validacao.detalhe);
        return erro(
          "Token inválido ou sem acesso a este número. Gere um novo token em " +
          "App Dashboard → WhatsApp → Configuração da API e tente novamente. " +
          `(Detalhe da Meta: ${validacao.detalhe})`,
        );
      }

      // (b) o número não pode estar conectado a outra loja (RN: 1 número = 1 loja)
      const { data: emUso } = await admin
        .from("whatsapp_conexoes")
        .select("loja_id")
        .eq("phone_number_id", String(phone_number_id))
        .maybeSingle();
      if (emUso && emUso.loja_id !== loja_id) {
        return erro("Este número já está conectado a outra loja.");
      }

      // (c) verify_token aleatório por loja
      const verifyToken = gerarVerifyToken();

      // (d) UPSERT como PENDENTE ANTES de registrar o webhook na Meta —
      //     o handshake GET precisa encontrar o verify_token no banco.
      const { error: eUpsert } = await admin.from("whatsapp_conexoes").upsert({
        loja_id,
        phone_number_id: String(phone_number_id),
        waba_id: String(waba_id),
        display_phone: validacao.displayPhone,
        access_token: String(access_token),
        app_secret: String(app_secret),
        verify_token: verifyToken,
        status: "PENDENTE",
        ultimo_erro: null,
      });
      if (eUpsert) throw eUpsert;

      const marcarErro = async (msg: string) => {
        await admin
          .from("whatsapp_conexoes")
          .update({ status: "ERRO", ultimo_erro: msg })
          .eq("loja_id", loja_id);
      };

      // (e) registra o webhook no app do lojista (app access token = app_id|app_secret)
      const subRes = await fetch(`${GRAPH}/${app_id}/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          object: "whatsapp_business_account",
          callback_url: WEBHOOK_URL,
          verify_token: verifyToken,
          fields: "messages",
          access_token: `${app_id}|${app_secret}`,
        }),
      });
      const subData = await subRes.json().catch(() => ({}));
      if (!subRes.ok || subData?.success !== true) {
        const detalhe = msgGraph(subData);
        console.error("conectar: falha ao registrar webhook:", detalhe);
        await marcarErro(`Falha ao registrar o webhook no app da Meta: ${detalhe}`);
        return erro(
          "Não consegui registrar o webhook no seu app da Meta. " +
          "Confira se o App ID e o App Secret estão corretos (Configurações do app → Básico) " +
          `e tente novamente. (Detalhe da Meta: ${detalhe})`,
        );
      }

      // (f) inscreve o app na WABA — OBRIGATÓRIO: sem isto a Meta não entrega mensagens
      const wabaRes = await fetch(`${GRAPH}/${waba_id}/subscribed_apps`, {
        method: "POST",
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const wabaData = await wabaRes.json().catch(() => ({}));
      if (!wabaRes.ok || wabaData?.success !== true) {
        const detalhe = msgGraph(wabaData);
        console.error("conectar: falha ao inscrever app na WABA:", detalhe);
        await marcarErro(`Falha ao inscrever o app na WABA: ${detalhe}`);
        return erro(
          "Webhook registrado, mas não consegui inscrever o app na sua conta do WhatsApp Business (WABA). " +
          "Confira o WABA ID e se o token tem a permissão whatsapp_business_management. " +
          `(Detalhe da Meta: ${detalhe})`,
        );
      }

      // (g) tudo certo → CONECTADO
      await admin
        .from("whatsapp_conexoes")
        .update({ status: "CONECTADO", conectado_em: new Date().toISOString(), ultimo_erro: null })
        .eq("loja_id", loja_id);

      return json({
        ok: true,
        display_phone: validacao.displayPhone,
        verified_name: validacao.verifiedName,
      });
    }

    // ── atualizar_token ── troca só o token de uma conexão que já existe ───
    // phone_number_id, waba_id e app_secret já estão salvos: quando o token da
    // Meta expira (o temporário dura 24h), o lojista só precisa colar o novo.
    // Um campo, um clique — sem recadastrar as credenciais do app inteiro.
    if (acao === "atualizar_token") {
      const { access_token } = body;
      if (!access_token || !String(access_token).trim()) {
        return erro("Cole o token de acesso gerado no painel da Meta.");
      }

      const { data: conexao } = await buscarConexao();
      if (!conexao) {
        return erro(
          "Esta loja ainda não tem uma conexão. Use o assistente de conexão completo primeiro.",
        );
      }

      const token = String(access_token).trim();

      // (a) valida o token contra o número já cadastrado — nada é salvo antes
      const validacao = await validarToken(conexao.phone_number_id, token);
      if (!validacao.ok) {
        console.warn("atualizar_token: token inválido:", validacao.detalhe);
        return erro(
          "Token inválido ou sem acesso a este número. Confira se ele foi gerado com as " +
          "permissões whatsapp_business_messaging e whatsapp_business_management. " +
          `(Detalhe da Meta: ${validacao.detalhe})`,
        );
      }

      // (b) reforça a inscrição do app na WABA (idempotente — não bloqueia)
      const wabaRes = await fetch(`${GRAPH}/${conexao.waba_id}/subscribed_apps`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const wabaData = await wabaRes.json().catch(() => ({}));
      if (!wabaRes.ok || wabaData?.success !== true) {
        console.warn("atualizar_token: inscrição na WABA falhou:", msgGraph(wabaData));
      }

      const { error: eUpd } = await admin
        .from("whatsapp_conexoes")
        .update({
          access_token: token,
          display_phone: validacao.displayPhone,
          status: "CONECTADO",
          conectado_em: new Date().toISOString(),
          ultimo_erro: null,
        })
        .eq("loja_id", loja_id);
      if (eUpd) throw eUpd;

      return json({
        ok: true,
        display_phone: validacao.displayPhone,
        verified_name: validacao.verifiedName,
      });
    }

    // ── testar ─────────────────────────────────────────────────────────────
    if (acao === "testar") {
      const { data: conexao } = await buscarConexao();
      if (!conexao) return erro("Nenhuma conexão configurada para esta loja.");

      const validacao = await validarToken(conexao.phone_number_id, conexao.access_token);
      if (validacao.ok) {
        await admin
          .from("whatsapp_conexoes")
          .update({ status: "CONECTADO", ultimo_erro: null, display_phone: validacao.displayPhone })
          .eq("loja_id", loja_id);
        return json({
          ok: true,
          mensagem: `Conexão OK — número ${validacao.displayPhone} (${validacao.verifiedName}) respondendo na Meta.`,
        });
      }

      await admin
        .from("whatsapp_conexoes")
        .update({ status: "ERRO", ultimo_erro: `Teste de conexão falhou: ${validacao.detalhe}` })
        .eq("loja_id", loja_id);
      return erro(
        "A conexão falhou no teste. O token pode ter expirado — gere um novo no painel da Meta " +
        `e reconecte. (Detalhe da Meta: ${validacao.detalhe})`,
      );
    }

    // ── desconectar ────────────────────────────────────────────────────────
    // Para o atendimento na hora. O número continua registrado no Cloud API —
    // para devolvê-lo ao WhatsApp comum existe a ação `devolver_numero`.
    if (acao === "desconectar") {
      const { data: conexao } = await buscarConexao();
      if (!conexao) return json({ ok: true, desinscrito: true }); // já estava desconectado

      const { desinscrito, detalheFalha } = await desligarConexao(conexao);

      return json({
        ok: true,
        desinscrito,
        aviso: desinscrito
          ? null
          : "O MiseOn parou de receber e de responder as mensagens deste número agora. " +
            "Só não consegui confirmar com a Meta a remoção do app da conta do WhatsApp Business " +
            `(${detalheFalha || "sem detalhe"}). Para remover também do lado da Meta: Configurações do ` +
            "Business → Contas do WhatsApp → selecione a conta → Apps → remover o MiseOn.",
      });
    }

    // ── devolver_numero ────────────────────────────────────────────────────
    // Desconectar sozinho NÃO devolve o número ao WhatsApp comum: enquanto ele
    // estiver registrado no Cloud API, o app normal recusa o cadastro. Aqui
    // removemos o número da WABA (DELETE /{phone_number_id}) e só então
    // desligamos a loja — assim o dono pode reinstalar o WhatsApp e registrar
    // o número por SMS de novo.
    if (acao === "devolver_numero") {
      const { data: conexao } = await buscarConexao();
      if (!conexao) return erro("Esta loja não tem nenhum número conectado.");

      // (a) remove o número da conta do WhatsApp Business na Meta.
      //     Se isto falhar não apagamos nada: o lojista precisa saber que o
      //     número continua preso ao Cloud API.
      const tokens = [
        conexao.access_token,
        Deno.env.get("WHATSAPP_ACCESS_TOKEN") ?? "",
      ].filter((t): t is string => !!t);

      let removido = false;
      let detalhe = "";
      for (const t of tokens) {
        try {
          const res = await fetch(`${GRAPH}/${conexao.phone_number_id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${t}` },
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data?.success !== false) {
            removido = true;
            break;
          }
          detalhe = msgGraph(data);
        } catch (e) {
          detalhe = String((e as Error)?.message ?? e);
        }
      }

      if (!removido) {
        console.error(
          `devolver_numero: Meta recusou remover ${conexao.phone_number_id}: ${detalhe}`,
        );
        return erro(
          "Não consegui remover o número da conta do WhatsApp Business na Meta, então parei " +
          "aqui — a conexão continua como estava, sem meio-caminho. Você pode remover à mão em " +
          "Configurações do Business → Contas do WhatsApp → Números de telefone → remover o número, " +
          `e depois clicar em Desconectar. (Detalhe da Meta: ${detalhe})`,
        );
      }

      // (b) número já saiu da WABA — agora desliga a loja
      const { desinscrito } = await desligarConexao(conexao);

      console.log(
        `devolver_numero: loja ${loja_id} devolveu o número ${conexao.phone_number_id} ` +
        `(${conexao.display_phone ?? "?"}) — desinscrição: ${desinscrito ? "confirmada" : "NÃO confirmada"}`,
      );

      return json({
        ok: true,
        removido: true,
        desinscrito,
        display_phone: conexao.display_phone ?? null,
        proximo_passo:
          "Número liberado do WhatsApp Business API. Para voltar a usá-lo no WhatsApp comum: " +
          "instale o WhatsApp no celular, informe o número e confirme o código que chegar por SMS. " +
          "Pode levar alguns minutos até a Meta liberar.",
      });
    }

    // ── trocar_codigo (Embedded Signup — lojista clicou "Conectar com Facebook") ──
    // O webhook já existe no nível do APP MiseOn (configurado uma vez no painel
    // da Meta); aqui só descobrimos WABA + número, inscrevemos o app na WABA,
    // registramos o número no Cloud API e gravamos a conexão da loja.
    //
    // phone_number_id/waba_id chegam do sessionInfo do Embedded Signup (fonte
    // mais confiável). Sem eles — fluxo de redirect — caímos no debug_token +
    // listagem de números da WABA.
    if (acao === "trocar_codigo") {
      const { code, redirect_uri } = body;
      const phoneDoSession = body.phone_number_id ? String(body.phone_number_id) : null;
      const wabaDoSession = body.waba_id ? String(body.waba_id) : null;
      if (!code) return erro("Código de autorização ausente.");
      if (!META_APP_ID || !META_APP_SECRET) {
        console.error("trocar_codigo: META_APP_ID/META_APP_SECRET ausentes nos secrets.");
        return erro("A conexão com Facebook ainda não está habilitada. Fale com o suporte MiseOn.", 503);
      }

      // (a) troca o code pelo access token da Meta.
      //     O redirect_uri precisa ser IDÊNTICO ao usado para obter o code:
      //     obrigatório no fluxo de redirect, proibido no popup do SDK. Como o
      //     painel do lojista pode estar com uma versão antiga em cache (e não
      //     mandar o campo), tentamos as variações em vez de falhar por isso.
      const tentativasRedirect: Array<string | null> = [];
      if (redirect_uri) tentativasRedirect.push(String(redirect_uri));
      tentativasRedirect.push(null); // popup do SDK
      for (const padrao of ["https://miseon.app.br/admin/whatsapp", "https://www.miseon.app.br/admin/whatsapp"]) {
        if (!tentativasRedirect.includes(padrao)) tentativasRedirect.push(padrao);
      }

      let token = "";
      let detalheTroca = "";
      for (const tentativa of tentativasRedirect) {
        const paramsTroca: Record<string, string> = {
          client_id: META_APP_ID,
          client_secret: META_APP_SECRET,
          code: String(code),
        };
        if (tentativa) paramsTroca.redirect_uri = tentativa;
        const trocaRes = await fetch(
          `${GRAPH}/oauth/access_token?` + new URLSearchParams(paramsTroca),
        );
        const troca = await trocaRes.json().catch(() => ({}));
        if (trocaRes.ok && troca.access_token) {
          token = String(troca.access_token);
          console.log(`trocar_codigo: code trocado com redirect_uri=${tentativa ?? "(nenhum)"}`);
          break;
        }
        detalheTroca = msgGraph(troca);
        console.warn(
          `trocar_codigo: troca falhou com redirect_uri=${tentativa ?? "(nenhum)"}: ${detalheTroca}`,
        );
      }
      if (!token) {
        console.error("trocar_codigo: nenhuma variação de redirect_uri funcionou:", detalheTroca);
        return erro(
          "A Meta recusou a autorização. Tente conectar novamente — se persistir, fale com o suporte. " +
          `(Detalhe da Meta: ${detalheTroca})`,
        );
      }

      // (b) descobre a WABA: sessionInfo primeiro, debug_token como plano B
      let wabaId: string | null = wabaDoSession;
      if (!wabaId) {
        const dbgRes = await fetch(
          `${GRAPH}/debug_token?input_token=${encodeURIComponent(token)}`,
          { headers: { Authorization: `Bearer ${META_APP_ID}|${META_APP_SECRET}` } },
        );
        const dbg = await dbgRes.json().catch(() => ({}));
        const scopes: Array<{ scope?: string; target_ids?: string[] }> = dbg?.data?.granular_scopes ?? [];
        wabaId = scopes
          .filter((s) => String(s.scope ?? "").startsWith("whatsapp_business"))
          .flatMap((s) => s.target_ids ?? [])[0] ?? null;
        if (!wabaId) {
          console.error("trocar_codigo: nenhuma WABA nos granular_scopes:", JSON.stringify(scopes));
          return erro(
            "Não encontrei uma conta do WhatsApp Business autorizada. " +
            "Refaça a conexão e autorize o acesso ao WhatsApp Business.",
          );
        }
      }

      // (c) descobre o número: sessionInfo primeiro, listagem da WABA como plano B
      let numero: { id: string; display_phone_number?: string; verified_name?: string } | null = null;
      if (phoneDoSession) {
        const numRes = await fetch(
          `${GRAPH}/${phoneDoSession}?fields=id,display_phone_number,verified_name`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const num = await numRes.json().catch(() => ({}));
        if (numRes.ok && num?.id) numero = num;
        else console.warn("trocar_codigo: phone_number_id do sessionInfo não respondeu:", msgGraph(num));
      }
      if (!numero) {
        const telRes = await fetch(
          `${GRAPH}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const tel = await telRes.json().catch(() => ({}));
        const numeros: Array<{ id: string; display_phone_number?: string; verified_name?: string }> =
          tel?.data ?? [];
        if (!numeros.length) {
          console.error("trocar_codigo: WABA sem números:", JSON.stringify(tel));
          return erro("Sua conta do WhatsApp Business não tem um número registrado. Adicione um número e tente novamente.");
        }

        // RN: nunca conectar o NÚMERO DE TESTE da Meta (+1 555-xxx) quando a WABA
        // já tem um número real — o teste só existe no console de desenvolvedor.
        const ehNumeroTeste = (n: { display_phone_number?: string }) =>
          String(n.display_phone_number ?? "").replace(/\D/g, "").startsWith("1555");
        const reais = numeros.filter((n) => !ehNumeroTeste(n));
        if (reais.length > 1) {
          console.warn("trocar_codigo: WABA com vários números reais — usando o primeiro:", JSON.stringify(reais));
        }
        numero = reais[0] ?? numeros[0];
      }

      // (d) o número não pode estar conectado a outra loja (RN: 1 número = 1 loja)
      const { data: emUso } = await admin
        .from("whatsapp_conexoes")
        .select("loja_id")
        .eq("phone_number_id", String(numero.id))
        .maybeSingle();
      if (emUso && emUso.loja_id !== loja_id) {
        return erro("Este número já está conectado a outra loja.");
      }

      // (e) inscreve o app na WABA — OBRIGATÓRIO: sem isto a Meta não entrega mensagens
      const wabaRes = await fetch(`${GRAPH}/${wabaId}/subscribed_apps`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const wabaData = await wabaRes.json().catch(() => ({}));
      if (!wabaRes.ok || wabaData?.success !== true) {
        const detalhe = msgGraph(wabaData);
        console.error("trocar_codigo: falha ao inscrever app na WABA:", detalhe);
        return erro(`A Meta não ativou o recebimento de mensagens. Tente novamente. (Detalhe da Meta: ${detalhe})`);
      }

      // (f) registra o número no Cloud API (melhor esforço).
      //     Sem o register o envio falha com "Phone number not registered"; se o
      //     número já estiver registrado a Meta devolve erro que não deve travar
      //     a conexão — por isso só logamos o aviso.
      const pin = gerarPin();
      let pinSalvo: string | null = null;
      try {
        const regRes = await fetch(`${GRAPH}/${numero.id}/register`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ messaging_product: "whatsapp", pin }),
        });
        const regData = await regRes.json().catch(() => ({}));
        if (regRes.ok && regData?.success === true) pinSalvo = pin;
        else console.warn("trocar_codigo: register do número não concluiu:", msgGraph(regData));
      } catch (e) {
        console.warn("trocar_codigo: register do número falhou (ignorado):", e);
      }

      // (g) grava a conexão já como CONECTADO
      //     app_secret = segredo do app MiseOn: é ele que valida a assinatura
      //     X-Hub-Signature-256 dos webhooks (RN-04), pois o webhook é do nosso app.
      const { error: eUpsert } = await admin.from("whatsapp_conexoes").upsert({
        loja_id,
        phone_number_id: String(numero.id),
        waba_id: String(wabaId),
        display_phone: numero.display_phone_number ?? null,
        verified_name: numero.verified_name ?? null,
        access_token: token,
        app_secret: META_APP_SECRET,
        verify_token: gerarVerifyToken(), // compat: handshake já ocorre no nível do app
        pin_registro: pinSalvo,
        status: "CONECTADO",
        conectado_em: new Date().toISOString(),
        ultimo_erro: null,
      });
      if (eUpsert) throw eUpsert;

      await admin.from("whatsapp_conexoes_pendentes").delete().eq("loja_id", loja_id);

      console.log(
        `trocar_codigo: loja ${loja_id} conectada — waba ${wabaId}, numero ${numero.id} (${numero.display_phone_number ?? "?"})`,
      );

      return json({
        ok: true,
        display_phone: numero.display_phone_number ?? null,
        verified_name: numero.verified_name ?? null,
      });
    }

    // ── iniciar_conexao ────────────────────────────────────────────────────
    // Registra a INTENÇÃO de conectar antes de o popup da Meta abrir. É esta
    // linha que o webhook usa para saber de quem é a conta que a Meta acabou de
    // compartilhar — por isso a conexão se fecha mesmo se o popup morrer.
    if (acao === "iniciar_conexao") {
      const { error: ePend } = await admin
        .from("whatsapp_conexoes_pendentes")
        .upsert({ loja_id, user_id: caller.id, criado_em: new Date().toISOString() });
      if (ePend) throw ePend;
      console.log(`iniciar_conexao: loja ${loja_id} aguardando compartilhamento da Meta`);
      return json({ ok: true });
    }

    // ── reconciliar ────────────────────────────────────────────────────────
    // Rede de segurança manual: pega o evento de conta mais recente que a Meta
    // mandou (últimas 24h) e fecha a conexão desta loja com ele. Serve para
    // quando o webhook chegou antes de existir a intenção pendente.
    if (acao === "reconciliar") {
      const wabaInformada = body.waba_id ? String(body.waba_id) : null;
      let wabaId = wabaInformada;

      if (!wabaId) {
        const limite = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: evento } = await admin
          .from("whatsapp_eventos_meta")
          .select("waba_id, criado_em")
          .not("waba_id", "is", null)
          .gte("criado_em", limite)
          .order("criado_em", { ascending: false })
          .limit(1)
          .maybeSingle();
        wabaId = evento?.waba_id ?? null;
      }

      if (!wabaId) {
        return erro(
          "A Meta ainda não avisou sobre nenhuma conta compartilhada nas últimas 24h. " +
          "Clique em 'Conectar com Facebook' e conclua o compartilhamento.",
        );
      }

      const r = await concluirConexao(admin, wabaId, loja_id);
      if (!r.ok) {
        console.error(`reconciliar: loja ${loja_id}, waba ${wabaId}: ${r.detalhe}`);
        return erro(`Não consegui concluir a conexão. (Detalhe: ${r.detalhe})`);
      }
      console.log(`reconciliar: loja ${loja_id} conectada — ${r.detalhe}`);
      return json({ ok: true, display_phone: r.display ?? null });
    }

    return erro(`Ação desconhecida: ${acao}`);
  } catch (e) {
    console.error(e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
