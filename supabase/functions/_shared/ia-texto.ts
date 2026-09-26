// MiseOn — IA de texto: Groq (Rápida), Gemini (Cota PRO), DeepSeek (Barata/Reserva)
//
// Ordem de fallback exigida pelo usuário (25/09/2026):
// 1. Groq
// 2. Gemini
// 3. DeepSeek
//
// Modelo nunca fixo num nome só — provedor aposenta sem aviso.
//   GROQ_MODEL (secret, opcional)     → gpt-oss-120b → gpt-oss-20b → llama-4-scout
//   GEMINI_MODEL (secret, opcional)   → gemini-1.5-pro → gemini-1.5-flash
//   DEEPSEEK_MODEL (secret, opcional) → deepseek-flash → deepseek-chat

// deno-lint-ignore-file no-explicit-any

export interface Mensagem { role: 'system' | 'user' | 'assistant'; content: string; }

export interface PedidoTexto {
  messages: Mensagem[];
  temperature?: number;
  max_tokens?: number;
  /** Raciocínio antes de responder. Na DeepSeek vem LIGADO por padrão (esforço
   *  alto): medido 24/09/2026, 18 s numa resposta do chat, e o raciocínio é
   *  cobrado como saída. Atendimento não precisa: padrão aqui é desligado. */
  pensar?: boolean;
  /** 'json' pede um objeto JSON válido (response_format dos dois provedores). */
  formato?: 'texto' | 'json';
}

/** Campos que vão no corpo HTTP, sem as opções que são só deste módulo. */
function corpoHttp(pedido: PedidoTexto): Record<string, unknown> {
  const { pensar: _pensar, formato, ...resto } = pedido;
  return formato === 'json' ? { ...resto, response_format: { type: 'json_object' } } : { ...resto };
}

export interface RespostaTexto { texto: string; provedor: 'groq' | 'gemini' | 'deepseek'; modelo: string; }

const unicos = (xs: (string | undefined | null)[]) => [...new Set(xs.filter((x): x is string => !!x))];

const MODELOS_GROQ = () => unicos([
  Deno.env.get('GROQ_MODEL'),
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'meta-llama/llama-4-scout-17b-16e-instruct',
]);
const MODELOS_GEMINI = () => unicos([Deno.env.get('GEMINI_MODEL'), 'gemini-1.5-pro', 'gemini-1.5-flash']);
const MODELOS_DEEPSEEK = () => unicos([Deno.env.get('DEEPSEEK_MODEL'), 'deepseek-flash', 'deepseek-chat']);

/** Erro que significa "troque de modelo", não "desista". */
export function modeloIndisponivel(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes('does not exist') || m.includes('decommission') || m.includes('not found') ||
    m.includes('no longer supported') || m.includes('deprecated') || m.includes('model not exist') ||
    m.includes('invalid model') || m.includes('retired');
}

/** Modelo que raciocina gasta o limite pensando: raciocínio baixo e folga. */
function ajustarGroq(modelo: string, corpo: Record<string, unknown>): Record<string, unknown> {
  if (/gpt-oss/i.test(modelo)) {
    return { ...corpo, reasoning_effort: 'low', max_tokens: Number(corpo.max_tokens ?? 500) + 1500 };
  }
  return { ...corpo };
}

async function tentar(
  url: string, chave: string, modelos: string[], corpo: (m: string) => Record<string, unknown>, provedor: 'groq' | 'gemini' | 'deepseek',
): Promise<{ ok: RespostaTexto } | { erro: string }> {
  let ultimoErro = 'nenhum modelo configurado';
  for (const modelo of modelos) {
    let data: any = {};
    let status = 0;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 45_000);
      const r = await fetch(url, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...corpo(modelo), model: modelo }),
      });
      clearTimeout(t);
      status = r.status;
      data = await r.json().catch(() => ({}));
      if (r.ok && !data.error) {
        const escolha = data.choices?.[0];
        const texto = escolha?.message?.content?.trim();
        if (escolha?.finish_reason === 'length') console.warn(`IA: resposta de ${provedor}/${modelo} cortada pelo limite de tokens`);
        if (texto) return { ok: { texto, provedor, modelo } };
        ultimoErro = 'resposta vazia';
        continue;
      }
    } catch (e) {
      ultimoErro = `${provedor} sem resposta: ${(e as Error).message}`;
      break; // rede/timeout: não adianta trocar de modelo no mesmo provedor
    }
    ultimoErro = String(data.error?.message ?? `HTTP ${status}`);
    if (!modeloIndisponivel(ultimoErro)) break; // chave, saldo, limite: problema do provedor
    console.warn(`IA: ${provedor}/${modelo} indisponível — tentando o próximo`);
  }
  return { erro: `${provedor}: ${ultimoErro}` };
}

/** Gera texto. Lança erro só se DeepSeek E a reserva falharem. */
export async function gerarTexto(pedido: PedidoTexto): Promise<RespostaTexto> {
  const erros: string[] = [];

  const groqKey = Deno.env.get('GROQ_API_KEY');
  if (groqKey) {
    const r = await tentar('https://api.groq.com/openai/v1/chat/completions', groqKey, MODELOS_GROQ(),
      (m) => ajustarGroq(m, corpoHttp(pedido)), 'groq');
    if ('ok' in r) return r.ok;
    erros.push(r.erro);
    console.error(`IA: Groq falhou (${r.erro}) — usando Gemini`);
  } else {
    erros.push('groq: GROQ_API_KEY ausente');
  }

  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (geminiKey) {
    // Gemini suporta o endpoint compatível com OpenAI
    const r = await tentar('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', geminiKey, MODELOS_GEMINI(),
      () => corpoHttp(pedido), 'gemini');
    if ('ok' in r) return r.ok;
    erros.push(r.erro);
    console.error(`IA: Gemini falhou (${r.erro}) — usando DeepSeek`);
  } else {
    erros.push('gemini: GEMINI_API_KEY ausente');
  }

  const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY');
  if (deepseekKey) {
    const r = await tentar('https://api.deepseek.com/chat/completions', deepseekKey, MODELOS_DEEPSEEK(),
      () => ({ ...corpoHttp(pedido), thinking: { type: pedido.pensar ? 'enabled' : 'disabled' } }), 'deepseek');
    if ('ok' in r) return r.ok;
    erros.push(r.erro);
  } else {
    erros.push('deepseek: DEEPSEEK_API_KEY ausente');
  }

  throw new Error(`IA indisponível — ${erros.join(' | ')}`);
}

/** Diagnóstico: chama de verdade com uma pergunta mínima. */
export async function testarIA(): Promise<{ ok: boolean; provedor?: string; modelo?: string; detalhe: string }> {
  try {
    const r = await gerarTexto({ messages: [{ role: 'user', content: 'Responda só: OK' }], max_tokens: 10, temperature: 0 });
    return { ok: true, provedor: r.provedor, modelo: r.modelo, detalhe: r.texto };
  } catch (e) {
    return { ok: false, detalhe: (e as Error).message };
  }
}
