// chat-ai-reception — IA de atendimento consultiva e humanizada WhatsApp/Site do MiseOn
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { checkRateLimit, ipDaRequisicao } from "../_shared/rate-limit.ts";
import { cotarEntrega, descreverRegraEntrega } from "../_shared/entrega.ts";
// IA de texto: DeepSeek, com a Groq só de reserva (decisão de 24/09/2026).
import { gerarTexto, type Mensagem } from "../_shared/ia-texto.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-chat-session",
};

function ok(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { ...CORS, "Content-Type": "application/json" } });
}
function erro(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabaseUrl  = Deno.env.get("SUPABASE_URL")!;
  const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Rate limit por IP. Esta função é aberta de propósito (chat da vitrine é
  // anônimo) e cada chamada custa uma inferência de IA — sem freio, um
  // script simples torra a cota e a fatura de IA. A chamada interna do
  // whatsapp-worker vem com service role e passa sem limite.
  const ehChamadaInterna =
    (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim() === serviceKey;
  if (!ehChamadaInterna) {
    const ip = ipDaRequisicao(req);
    const rl = await checkRateLimit(`chat-ia:${ip}`, { windowMs: 60_000, maxRequests: 20 });
    if (!rl.allowed) return erro("Muitas mensagens em sequência. Aguarde um instante.", 429);
  }

  if (!Deno.env.get("DEEPSEEK_API_KEY") && !Deno.env.get("GROQ_API_KEY")) {
    console.error("Nenhuma chave de IA configurada (DEEPSEEK_API_KEY)");
    return erro("IA não configurada", 503);
  }

  const db = createClient(supabaseUrl, serviceKey);

  try {
    const { conversation_id } = await req.json().catch(() => ({}));
    if (!conversation_id) return erro("conversation_id obrigatório");

    // ── 1. Busca a conversa ──────────────────────────────────────────────────
    const { data: conv, error: convErr } = await db
      .from("chat_conversations")
      .select("id, loja_id, ia_ativa, telefone, canal, cliente_nome, atribuicao_token")
      .eq("id", conversation_id)
      .single();

    if (convErr || !conv) {
      console.error("Conversa não encontrada:", convErr?.message, "id:", conversation_id);
      return erro("Conversa não encontrada", 404);
    }

    // ── 2. Busca dados da loja ──────────────────────────────────────────────
    const { data: loja, error: lojaErr } = await db
      .from("lojas")
      .select("nome, segmento_negocio, slug, aberto_manual, chat_ia_ativo, whatsapp_ia_ativo, whatsapp_saudacao")
      .eq("id", conv.loja_id)
      .single();

    if (lojaErr || !loja) {
      console.error("Loja não encontrada:", lojaErr?.message, "loja_id:", conv.loja_id);
      return erro("Loja não encontrada", 404);
    }

    // ── E5: Gera token de atribuição e salva na conversa ────────────────────
    const waToken = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    await db
      .from("chat_conversations")
      .update({ atribuicao_token: waToken })
      .eq("id", conversation_id);

    const lojaSlug     = loja.slug || "";
    const linkCardapio = lojaSlug ? `https://miseon.app.br/${lojaSlug}?wa=${waToken}` : `https://miseon.app.br?wa=${waToken}`;

    // ── 3. Verifica se IA está ativa ──────────────────────────────────────
    const iaGlobal   = conv.canal === "WHATSAPP"
      ? (loja.whatsapp_ia_ativo === true || loja.chat_ia_ativo === true)
      : (loja.chat_ia_ativo === true);
    const iaConversa = conv.ia_ativa !== false;

    if (!iaGlobal || !iaConversa) {
      console.log(`IA desativada: canal=${conv.canal} global=${iaGlobal} conversa=${conv.ia_ativa}`);
      const { data: recentes } = await db
        .from("chat_messages")
        .select("remetente_tipo")
        .eq("conversation_id", conversation_id)
        .order("criado_em", { ascending: false })
        .limit(2);

      const primeiraMsg = recentes && recentes.length <= 1;
      if (primeiraMsg && conv.canal === "WHATSAPP" && conv.telefone) {
        const cortesia = `Olá! Bem-vindo(a) ao *${loja.nome}* 👋\n\nUm de nossos atendentes vai responder em breve!\n\n🛒 Confira nosso cardápio digital:\n${linkCardapio}`;
        await db.from("chat_messages").insert({ conversation_id, remetente_tipo: "SISTEMA", conteudo: cortesia });
        fetch(`${supabaseUrl}/functions/v1/whatsapp-send`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ loja_id: conv.loja_id, telefone: conv.telefone, texto: cortesia, conversation_id }),
        }).catch((e) => console.error("whatsapp-send cortesia:", e));
      }
      return ok({ skipped: true, motivo: iaGlobal ? "handoff_humano" : "ia_global_desligada" });
    }

    // ── 4. Busca histórico de mensagens ───────────────────────────────────
    const { data: msgsRaw, error: msgsErr } = await db
      .from("chat_messages")
      .select("remetente_tipo, conteudo")
      .eq("conversation_id", conversation_id)
      .order("criado_em", { ascending: false })
      .limit(30);

    if (msgsErr || !msgsRaw || msgsRaw.length === 0) {
      console.error("Msgs não encontradas:", msgsErr?.message);
      return erro("Mensagens não encontradas");
    }

    // A IA precisa do histórico em ordem cronológica (mais antiga -> mais nova)
    const msgs = [...msgsRaw].reverse();

    const ultima = msgs[msgs.length - 1];
    if (ultima.remetente_tipo !== "CLIENTE") {
      console.log("Última mensagem não é do cliente, ignorando.");
      return ok({ skipped: true, motivo: "ultima_nao_e_cliente" });
    }

    // ── 5. Detecta alergia → handoff seguro ──────────────────────────────
    const textoUltima = (ultima.conteudo || "").toLowerCase();
    const alergias    = ["alérgic", "alergia", "celíac", "intoler", "lactose", "glúten", "amendoim", "camarão", "frutos do mar"];
    const temAlergia  = alergias.some((kw) => textoUltima.includes(kw));
    if (temAlergia) {
      await db.from("chat_conversations").update({ ia_ativa: false }).eq("id", conversation_id);
    }

    // ── 6. Verifica horário ───────────────────────────────────────────────
    // A mesma regra que o pedido usa (fn_loja_aberta): o cálculo local não
    // entendia turno que passa da meia-noite. E a IA recebe a grade de
    // horários — sem ela, inventava ("seg a sáb, 11h às 22h", medido 24/09).
    const [{ data: abertaSrv }, { data: grade }] = await Promise.all([
      db.rpc("fn_loja_aberta", { p_loja_id: conv.loja_id }),
      db.from("horarios_funcionamento").select("dia_semana, abre, fecha").eq("loja_id", conv.loja_id).order("dia_semana").order("abre"),
    ]);
    const lojaAberta = abertaSrv === true;
    const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const horariosTexto = grade?.length
      ? DIAS.map((nome, d) => {
          const turnos = grade.filter((h: any) => h.dia_semana === d)
            .map((h: any) => `${String(h.abre).slice(0, 5)} às ${String(h.fecha).slice(0, 5)}`);
          return `• ${nome}: ${turnos.length ? turnos.join(" e ") : "fechado"}`;
        }).join("\n")
      : "Horários não cadastrados: não informe horário, peça para o cliente conferir no cardápio.";

    // ── 7. Busca cardápio agrupado + regra de entrega ─────────────────────
    const [{ data: cats }, { data: prods }, regraEntrega] = await Promise.all([
      db.from("categorias").select("id, nome, ordem").eq("loja_id", conv.loja_id).order("ordem"),
      db.from("produtos").select("id, nome, preco, disponivel, descricao, categoria_id, tipo_venda, preco_por_quilo, destaque, grupos_opcoes(nome, opcoes(nome, preco_adicional))").eq("loja_id", conv.loja_id).order("nome"),
      descreverRegraEntrega(db, conv.loja_id).catch(() => "A taxa de entrega é calculada no cardápio pelo endereço."),
    ]);

    // Monta cardápio rico e estruturado
    let cardapio = "Cardápio não cadastrado.";
    if (prods && prods.length > 0) {
      const map: Record<string, any[]> = {};
      for (const p of prods) { const k = p.categoria_id ?? "__"; if (!map[k]) map[k] = []; map[k].push(p); }
      const lines: string[] = [];
      if (cats) {
        for (const c of cats) {
          const itens = map[c.id]; if (!itens?.length) continue;
          lines.push(`\n*${c.nome.toUpperCase()}*`);
          for (const p of itens) {
            const esg = p.disponivel === false ? " ❌ (ESGOTADO NO MOMENTO)" : "";
            const dsc = p.descricao ? ` - ${p.descricao}` : "";
            const prc = p.tipo_venda === 'POR_PESO' ? `R$ ${Number(p.preco_por_quilo).toFixed(2)}/kg` : `R$ ${Number(p.preco).toFixed(2)}`;
            const dest = p.destaque ? " ⭐ [Mais Pedido]" : "";
            lines.push(`• ${p.nome}${dest}${dsc}: ${prc}${esg}`);
          }
        }
      }
      const semCat = map["__"];
      if (semCat?.length) {
        lines.push(`\n*CARDÁPIO GERAL*`);
        for (const p of semCat) {
          const esg = p.disponivel === false ? " ❌ (ESGOTADO NO MOMENTO)" : "";
          const dsc = p.descricao ? ` - ${p.descricao}` : "";
          const prc = p.tipo_venda === 'POR_PESO' ? `R$ ${Number(p.preco_por_quilo).toFixed(2)}/kg` : `R$ ${Number(p.preco).toFixed(2)}`;
          lines.push(`• ${p.nome}${dsc}: ${prc}${esg}`);
        }
      }
      if (lines.length) cardapio = lines.join("\n");
    }

    // Entrega: a MESMA regra do checkout (fn_entrega_regra). Até 23/09/2026 o
    // chat lia uma tabela de bairros que o checkout ignorava — informava um
    // preço e o caixa cobrava outro. Se o cliente mandou CEP, cota de verdade.
    let taxasTexto = regraEntrega;
    // O CEP pode ter vindo algumas mensagens antes ("e que horas abrem?"):
    // usa a mensagem mais recente do cliente que tenha CEP.
    const comCep = [...msgs].reverse()
      .find((m: any) => m.remetente_tipo === "CLIENTE" && /\b\d{5}-?\d{3}\b/.test(m.conteudo || ""));
    const cotacaoTexto = comCep ? await cotacaoDaMensagem(db, conv.loja_id, comCep.conteudo) : null;
    if (cotacaoTexto) taxasTexto += "\n\n" + cotacaoTexto;
    taxasTexto += "\nNunca pergunte ao cliente a distância em km: quem mede é o sistema, pelo CEP e número.";
    taxasTexto += "\nNunca invente taxa: sem CEP e número, explique a regra acima e peça o CEP. O valor final aparece no cardápio ao informar o endereço.";

    // ── 8. System prompt humanizado & consultivo ──────────────────────────
    const primeiroNome = (conv.cliente_nome ?? "").trim().split(/\s+/)[0] || "";
    const saudacaoLoja = (loja.whatsapp_saudacao ?? "").trim();

    const system = `Você é o atendente virtual do *${loja.nome}* (${loja.segmento_negocio || "restaurante"}) no WhatsApp.
Sua missão é dar um atendimento HUMANIZADO, CALOROSO, CONSULTIVO E DE ALTA CONVERSÃO DE VENDAS.

PERSONALIDADE:
• Fala como um garçom/atendente experiente de balcão no Brasil: simpático, acolhedor, prestativo e especialista no cardápio.
• NUNCA seja robótico, frio ou mecânico.
• NUNCA responda apenas mandando o link seco! Isso afasta o cliente.
${primeiroNome ? `• O cliente se chama ${primeiroNome}. Trate-o pelo primeiro nome de forma natural.` : "• Seja cortês e acolhedor."}
${saudacaoLoja ? `• Tom preferido da casa: "${saudacaoLoja}"` : ""}

SITUAÇÃO DA LOJA AGORA:
${lojaAberta
  ? "🟢 ABERTA e pronta para receber pedidos!"
  : "🔴 FECHADA no momento. Avise gentilmente o horário de funcionamento e informe que o cliente pode deixar o pedido agendado no link do cardápio."}

HORÁRIO DE FUNCIONAMENTO (use exatamente este; nunca invente outro):
${horariosTexto}

━━━ CARDÁPIO OFICIAL DA LOJA ━━━
${cardapio}

━━━ ENTREGA & TAXAS ━━━
${taxasTexto}

🔗 LINK DE PEDIDO COM ATRIBUIÇÃO: ${linkCardapio}

COMO RESPONDER AS DUVIDAS E ATENDER:
1. PERGUNTAS SOBRE ITENS, INGREDIENTES E NUTRIÇÃO / FIT:
   - Se o cliente perguntar se tem opções leves, sem lactose, proteicas, vegetarianas ou sobre ingredientes de algum prato, responda com propriedade baseado nos itens e descrições do cardápio.
   - Destaque pratos com frango, saladas, sucos, baguetes ou itens artesanais conforme a dúvida.
2. SUGESTÕES CONSULTIVAS DE VENDAS:
   - Quando o cliente quiser pedir ou estiver em dúvida, sugira 2 ou 3 opções deliciosas do cardápio (incluindo preço e uma breve descrição apetitosa de 1 frase).
   - Ofereça acompanhamentos ou bebidas para harmonizar ("Quer um suco ou refrigerante bem gelado para acompanhar?").
3. COMO USAR O LINK DO CARDÁPIO:
   - Sempre integre o link de forma natural no final da conversa como a ferramenta perfeita para o cliente personalizar o pedido, escolher adicionais e finalizar.
   - Exemplo de fluxo: "Hoje nosso destaques são o X por R$ YY e o Y por R$ ZZ! 😋 Você pode escolher seus adicionais e finalizar rapidinho por aqui: ${linkCardapio}\n\nPrefere entrega ou retirada?"
4. DADOS FALTANTES OU REQUISITO DE HUMANO:
   - Itens ESGOTADOS: Ofereça a melhor alternativa disponível na hora.
   - Alergias graves/severas ou reclamações: Responda com empatia e acione o atendente humano.
5. REGRAS DE FORMATO:
   - Texto bem formatado com negritos em nomes de pratos.
   - Tamanho ideal: 3 a 6 linhas bem distribuídas em parágrafos curtos.
   - Use emojis com bom gosto (2 a 4 por mensagem).
   - Finalize com 1 pergunta curta e direta para dar sequência à conversa.
   - NUNCA invente preços ou pratos fora da lista acima.`;

    const historico: Mensagem[] = msgs.map((m: any) => ({
      role: m.remetente_tipo === "CLIENTE" ? "user" : "assistant",
      content: m.conteudo,
    }));

    // ── 9. Chama a IA (DeepSeek; Groq de reserva) ─────────────────────────
    const { texto: textoIa, provedor, modelo } = await gerarTexto({
      messages: [{ role: "system", content: system }, ...historico],
      temperature: 0.65,
      max_tokens: 500,
    });
    if (provedor !== "deepseek") console.warn(`IA: chat respondido pela reserva (${provedor}/${modelo})`);

    let resposta = textoIa;

    if (temAlergia) {
      resposta += "\n\n⚠️ *Atenção:* Mencionou restrição alimentar — um atendente humano assume agora por segurança.";
    }

    // ── 10. Salva no banco ────────────────────────────────────────────────
    const { error: insErr } = await db.from("chat_messages").insert({
      conversation_id,
      remetente_tipo: "SISTEMA",
      conteudo: resposta,
    });
    if (insErr) throw new Error("Erro ao salvar resposta: " + insErr.message);

    // ── 11. Envia pelo WhatsApp ───────────────────────────────────────────
    if (conv.canal === "WHATSAPP" && conv.telefone) {
      const waSend = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ loja_id: conv.loja_id, telefone: conv.telefone, texto: resposta, conversation_id }),
      });
      if (!waSend.ok) {
        const wErr = await waSend.text();
        console.error("whatsapp-send falhou:", waSend.status, wErr);
      } else {
        console.log("whatsapp-send OK");
      }
    }

    // ── 12. Notifica painel admin ─────────────────────────────────────────
    const ch = db.channel(`admin-alerts-${conv.loja_id}`);
    await ch.send({
      type: "broadcast",
      event: temAlergia ? "chat_handoff" : "chat_ia_answered",
      payload: { conversation_id, loja_id: conv.loja_id },
    });
    db.removeChannel(ch);

    console.log(`IA respondeu conv=${conversation_id} canal=${conv.canal} token=${waToken}`);
    return ok({ success: true, handoff: temAlergia, token: waToken });

  } catch (e: any) {
    console.error("chat-ai-reception ERRO:", e?.message ?? e);
    return erro(e?.message ?? "Erro interno", 500);
  }
});

/**
 * Se a mensagem do cliente traz um CEP, cota a entrega com a regra da loja.
 * A rua vem do CEP (ViaCEP); o número, se ele escreveu. Sem número, a cotação
 * vale pelo centro do CEP e o texto avisa que é aproximada.
 */
async function cotacaoDaMensagem(db: any, lojaId: string, texto: string): Promise<string | null> {
  const cep = texto.match(/\b(\d{5})-?(\d{3})\b/);
  if (!cep) return null;
  const cepLimpo = cep[1] + cep[2];
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const via = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null);
    clearTimeout(t);
    if (!via || via.erro) return `O cliente informou o CEP ${cep[0]}, mas ele não foi encontrado. Peça para conferir.`;

    const semCep = texto.replace(cep[0], " ");
    const num = semCep.match(/(?:n[ºo°.]?\s*|n[uú]mero\s*|,\s*)(\d{1,6})\b/i)?.[1] ?? null;
    const c = await cotarEntrega(db, lojaId, {
      cep: cepLimpo, logradouro: via.logradouro || via.bairro || via.localidade,
      numero: num, sem_numero: !num, bairro: via.bairro, cidade: via.localidade, uf: via.uf,
    }, 0);

    const onde = `${via.logradouro || "CEP " + cep[0]}${num ? ", " + num : ""} (${via.bairro || via.localidade})`;
    const brl = (n: number) => `R$ ${Number(n).toFixed(2).replace(".", ",")}`;
    const kmTxt = c.distancia_km != null ? `${String(c.distancia_km).replace(".", ",")} km${c.metodo === "ROTA" ? " pela rua" : " (estimado)"}` : "";
    const aprox = num ? "" : " Valor APROXIMADO pelo centro do CEP: peça o número para confirmar.";
    if (c.atende) {
      return `COTAÇÃO REAL para ${onde}: ${kmTxt}, taxa ${c.taxa ? brl(c.taxa) : "grátis"}.${aprox} Use exatamente este valor.`;
    }
    return `COTAÇÃO REAL para ${onde}: ${c.mensagem ?? "a loja não entrega neste endereço"}. Ofereça a retirada no balcão.`;
  } catch (e) {
    console.error("cotacaoDaMensagem:", (e as Error).message);
    return null;
  }
}
