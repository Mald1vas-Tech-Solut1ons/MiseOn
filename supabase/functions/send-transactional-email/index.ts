// MiseOn — Worker de e-mail.
//
// Duas ações:
//   { acao: 'processar' }  → drena a fila (chamado por cron/webhook, service role)
//   { acao: 'teste', ... } → envia um exemplo para o admin conferir o template
//
// Diferença central para a versão anterior: o destinatário vem da fila,
// não do JWT de quem chamou. Sem isso era impossível avisar o cliente
// final (que não tem conta) ou reagir a webhook de pagamento (que não
// tem JWT).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.14';
import { montarEmail, EVENTOS, SITE, type Loja } from './render.ts';

// Eventos cujo conteúdo é montado a partir do pedido no instante do
// envio — no INSERT os itens ainda não existem em itens_pedido.
const EVENTOS_DE_PEDIDO = new Set([
  'pedido-recebido',
  'pedido-a-caminho',
  'pedido-entregue',
  'pagamento-confirmado',
]);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const SMTP_HOST = Deno.env.get('SMTP_HOST') ?? 'smtppro.zoho.com';
const SMTP_PORT = Number(Deno.env.get('SMTP_PORT') ?? '465');
const SMTP_USER = Deno.env.get('SMTP_USER')!;
const SMTP_PASS = Deno.env.get('SMTP_PASS')!;
const REMETENTE_EMAIL = Deno.env.get('EMAIL_FROM') ?? SMTP_USER;
const REMETENTE_NOME = Deno.env.get('EMAIL_FROM_NAME') ?? 'MiseOn';

// Token dedicado só para drenar a fila. Menor privilégio: se vazar, o
// estrago é disparar e-mails já aprovados — a service role key daria o
// banco inteiro. Por isso o agendador não conhece a service key.
const EMAIL_WORKER_TOKEN = Deno.env.get('EMAIL_WORKER_TOKEN');

/** Comparação em tempo constante: não revela o segredo pelo tempo de resposta. */
function tokenConfere(recebido: string | null, esperado: string) {
  if (!recebido) return false;
  const a = new TextEncoder().encode(recebido);
  const b = new TextEncoder().encode(esperado);
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a[i] ^ b[i];
  return diferenca === 0;
}

const MAX_TENTATIVAS = 4;
const LOTE = 20;

function transportador() {
  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error(
      'Credenciais de envio ausentes. Defina os secrets SMTP_USER e SMTP_PASS na função.',
    );
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

const admin = () => createClient(SUPABASE_URL, SERVICE_KEY);

const lojasCache = new Map<string, Loja>();
async function carregarLoja(db: ReturnType<typeof admin>, lojaId: string): Promise<Loja> {
  const cached = lojasCache.get(lojaId);
  if (cached) return cached;
  const { data } = await db
    .from('lojas')
    .select('id, nome, slug, logo_url, telefone, whatsapp, endereco, cor_primaria, chat_ia_ativo')
    .eq('id', lojaId)
    .maybeSingle();
  const loja = (data ?? { nome: 'Sua loja' }) as Loja;
  lojasCache.set(lojaId, loja);
  return loja;
}

async function urlDescadastro(db: ReturnType<typeof admin>, lojaId: string, email: string) {
  const { data } = await db
    .from('email_consentimentos')
    .select('descadastro_token')
    .eq('loja_id', lojaId)
    .eq('email', email.toLowerCase())
    .maybeSingle();
  return data?.descadastro_token ? `${SITE}/email/descadastro?t=${data.descadastro_token}` : '';
}

/**
 * Monta os dados do e-mail na hora do envio.
 * Toda URL é derivada de SITE (secret) + id real — link em e-mail não
 * tem como ser corrigido depois de enviado, então nada é escrito à mão.
 */
async function hidratar(db: ReturnType<typeof admin>, item: any, loja: Loja) {
  const base: Record<string, any> = {};
  const daLoja = loja.slug ? `${SITE}/${loja.slug}` : '';

  if (EVENTOS_DE_PEDIDO.has(item.evento) && item.referencia_id) {
    const { data } = await db.rpc('fn_email_pedido_payload', { p_pedido_id: item.referencia_id });
    Object.assign(base, data ?? {});
    base.acompanhar_url = `${SITE}/pedido/${item.referencia_id}`;
    if (item.evento === 'pedido-entregue' && daLoja) base.pedir_novamente_url = daLoja;
  }

  if (item.evento === 'carrinho-abandonado' && daLoja) base.carrinho_url = daLoja;
  if (item.evento === 'cupom-disponivel' && daLoja) base.cardapio_url = daLoja;
  if (item.evento === 'acesso-equipe') base.login_url = `${SITE}/admin/login`;
  if (item.evento === 'boas-vindas-loja') base.login_url = `${SITE}/admin`;

  // O que veio explícito na fila vence o que foi derivado.
  return { ...base, ...(item.payload ?? {}) };
}

/** Envia um item já reservado e registra o desfecho. */
async function despachar(db: ReturnType<typeof admin>, smtp: any, item: any) {
  const loja = await carregarLoja(db, item.loja_id);
  const descadastro =
    item.classe === 'MARKETING' ? await urlDescadastro(db, item.loja_id, item.destinatario) : '';

  const dados = await hidratar(db, item, loja);
  const { assunto, html, texto } = await montarEmail(item.evento, dados, loja, {
    descadastro_url: descadastro,
  });

  // O nome visível é o da loja; o endereço técnico continua sendo o da
  // plataforma. É assim que o cliente reconhece quem está falando.
  // Exceção: nota-fiscal-assinatura é a MiseOn cobrando a loja, não a loja
  // falando com o cliente dela — o remetente vira a própria MiseOn.
  const remetenteVisivel = item.evento === 'nota-fiscal-assinatura'
    ? REMETENTE_NOME
    : `${loja.nome ?? REMETENTE_NOME} via MiseOn`;
  const info = await smtp.sendMail({
    from: `"${remetenteVisivel}" <${REMETENTE_EMAIL}>`,
    to: item.destinatario,
    subject: assunto,
    html,
    text: texto,
    ...(descadastro
      ? { list: { unsubscribe: { url: descadastro, comment: 'Cancelar ofertas desta loja' } } }
      : {}),
  });

  await db
    .from('email_fila')
    .update({ status: 'ENVIADO', atualizado_em: new Date().toISOString() })
    .eq('id', item.id);

  await db.from('email_log').insert({
    loja_id: item.loja_id,
    fila_id: item.id,
    evento: item.evento,
    classe: item.classe,
    template_type: item.evento,
    recipient: item.destinatario,
    status: 'sent',
    message_id: info.messageId,
    metadata: item.payload,
  });
}

async function falhou(db: ReturnType<typeof admin>, item: any, erro: string) {
  const tentativas = (item.tentativas ?? 0) + 1;
  const desistiu = tentativas >= MAX_TENTATIVAS;
  // Backoff: 2min, 8min, 32min — falha transitória de SMTP se resolve sozinha.
  const espera = Math.pow(4, tentativas) * 30_000;

  await db
    .from('email_fila')
    .update({
      status: desistiu ? 'FALHOU' : 'PENDENTE',
      tentativas,
      ultimo_erro: erro.slice(0, 500),
      agendado_para: new Date(Date.now() + espera).toISOString(),
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', item.id);

  if (desistiu) {
    await db.from('email_log').insert({
      loja_id: item.loja_id,
      fila_id: item.id,
      evento: item.evento,
      classe: item.classe,
      template_type: item.evento,
      recipient: item.destinatario,
      status: 'failed',
      error_message: erro.slice(0, 500),
      metadata: item.payload,
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const body = await req.json().catch(() => ({}));
    const acao = body.acao ?? 'processar';
    const db = admin();

    // ── Envio de exemplo, para o admin conferir o template ────
    if (acao === 'teste') {
      const authHeader = req.headers.get('Authorization') ?? '';
      const comoUsuario = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await comoUsuario.auth.getUser();
      if (!user) return json({ error: 'Não autenticado' }, 401);

      const { loja_id, evento, destinatario } = body;
      if (!loja_id || !evento) return json({ error: 'loja_id e evento são obrigatórios' }, 400);
      if (!EVENTOS[evento]) return json({ error: `Evento desconhecido: ${evento}` }, 400);

      const { data: acesso } = await db
        .from('usuarios_loja').select('papel')
        .eq('user_id', user.id).eq('loja_id', loja_id).maybeSingle();
      if (acesso?.papel !== 'admin') {
        return json({ error: 'Só o admin da loja pode disparar e-mail de teste' }, 403);
      }

      const para = destinatario ?? user.email;
      const loja = await carregarLoja(db, loja_id);
      const { assunto, html, texto } = await montarEmail(evento, body.dados ?? {}, loja, {
        descadastro_url: `${SITE}/email/descadastro?t=exemplo`,
      });

      if (body.somente_html) return json({ ok: true, assunto, html });

      const info = await transportador().sendMail({
        from: `"${loja.nome ?? REMETENTE_NOME} via MiseOn" <${REMETENTE_EMAIL}>`,
        to: para,
        subject: `[TESTE] ${assunto}`,
        html,
        text: texto,
      });
      return json({ ok: true, destinatario: para, message_id: info.messageId });
    }

    // ── Drenagem da fila ──────────────────────────────────────
    // A função roda com verify_jwt desligado para o agendador poder
    // chamar por token dedicado, então cada ação autentica a si mesma.
    //
    //   'processar' → agendador, token de worker, drena todas as lojas
    //   'drenar'    → painel aberto na loja, JWT do usuário, só a loja dele
    if (acao !== 'processar' && acao !== 'drenar') {
      return json({ error: 'Ação desconhecida' }, 400);
    }

    let escopoLoja: string | null = null;

    if (acao === 'drenar') {
      const comoUsuario = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      });
      const { data: { user } } = await comoUsuario.auth.getUser();
      if (!user) return json({ error: 'Não autenticado' }, 401);

      const { loja_id } = body;
      if (!loja_id) return json({ error: 'loja_id obrigatório' }, 400);

      const { data: vinculo } = await db
        .from('usuarios_loja').select('papel')
        .eq('user_id', user.id).eq('loja_id', loja_id).maybeSingle();
      if (!vinculo) return json({ error: 'Sem acesso a esta loja' }, 403);

      escopoLoja = loja_id;
    } else {
      // Token ausente na configuração e token errado respondem igual:
      // a diferença revelaria o estado do serviço a quem sonda de fora.
      // O motivo real fica só no log.
      if (!EMAIL_WORKER_TOKEN) {
        console.error('EMAIL_WORKER_TOKEN não definido — drenagem desabilitada.');
      }
      if (!EMAIL_WORKER_TOKEN || !tokenConfere(req.headers.get('x-worker-token'), EMAIL_WORKER_TOKEN)) {
        return json({ error: 'Não autorizado' }, 401);
      }
    }

    // Carrinho abandonado é o único evento sem ator: ninguém clica
    // em "abandonar". A varredura roda junto com a drenagem.
    const { data: carrinhos } = await db.rpc('fn_email_varrer_carrinhos', { p_minutos: 45 });

    const { data: itens, error } = await db.rpc('fn_email_reservar', {
      p_limite: LOTE,
      p_loja: escopoLoja,
    });
    if (error) throw error;
    if (!itens?.length) return json({ ok: true, processados: 0, carrinhos_detectados: carrinhos ?? 0 });

    const smtp = transportador();
    let enviados = 0;
    let falhas = 0;
    const errosDetalhados: Array<{ id: string; erro: string }> = [];

    for (const item of itens) {
      try {
        await despachar(db, smtp, item);
        enviados++;
      } catch (e) {
        falhas++;
        const msgErro = String((e as Error)?.message ?? e);
        errosDetalhados.push({ id: item.id, erro: msgErro });
        console.error(`Falha no item ${item.id} (${item.evento}):`, e);
        await falhou(db, item, msgErro);
      }
    }

    return json({
      ok: true,
      processados: itens.length,
      enviados,
      falhas,
      erros: errosDetalhados,
      carrinhos_detectados: carrinhos ?? 0,
    });
  } catch (e) {
    console.error('Worker de e-mail falhou:', e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
