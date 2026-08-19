// MiseOn — Rate limiter compartilhado entre Edge Functions.
//
// A versão anterior guardava a contagem num `Map` do módulo. Em Deno serverless
// isso não limita nada: cada isolate carrega o módulo de novo e ganha o próprio
// contador, então o teto de 10/min virava 10 × (isolates vivos) — e sob ataque,
// que é exatamente quando a plataforma cria mais isolates, o teto subia junto.
// O Map também nunca removia chave expirada, crescendo enquanto o isolate vivia.
//
// Agora o contador mora no Postgres (`fn_rate_limit_consumir`), que é o único
// ponto que todos os isolates enxergam. O UPSERT toma lock da linha, então duas
// invocações simultâneas não perdem contagem.
//
// Em falha de banco a decisão é DEIXAR PASSAR: se o Postgres está fora, estas
// funções já não conseguem concluir o trabalho delas de qualquer forma, e negar
// aqui trocaria um limite furado por uma indisponibilidade total do checkout.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

export interface RateLimitOptions {
  windowMs?: number;    // Janela em ms (padrão: 60000 = 1min)
  maxRequests?: number; // Máximo de requisições por janela (padrão: 10)
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

let cliente: ReturnType<typeof createClient> | null = null;
function getCliente() {
  if (!cliente) {
    cliente = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );
  }
  return cliente;
}

/**
 * `x-forwarded-for` chega como "cliente, proxy1, proxy2". Sem recortar, cada
 * combinação de proxies vira uma chave diferente e o mesmo cliente ganha vários
 * contadores. O primeiro elemento é o mais próximo do originador.
 */
export function ipDaRequisicao(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  const primeiro = xff.split(",")[0]?.trim();
  return primeiro || "desconhecido";
}

export async function checkRateLimit(
  key: string,
  options: RateLimitOptions = {},
): Promise<RateLimitResult> {
  const windowMs = options.windowMs ?? 60_000;
  const maxRequests = options.maxRequests ?? 10;

  try {
    const { data, error } = await getCliente().rpc("fn_rate_limit_consumir", {
      p_chave: key,
      p_janela_seg: Math.max(1, Math.round(windowMs / 1000)),
      p_max: maxRequests,
    });

    if (error) throw error;

    const resetEm = data?.reset_em ? Date.parse(data.reset_em) : Date.now() + windowMs;
    return {
      allowed: data?.permitido !== false,
      remaining: Number(data?.restante ?? 0),
      resetMs: Math.max(0, resetEm - Date.now()),
    };
  } catch (e) {
    console.error("rate-limit indisponível, liberando a requisição:", e);
    return { allowed: true, remaining: maxRequests, resetMs: 0 };
  }
}
