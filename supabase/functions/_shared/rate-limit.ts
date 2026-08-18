// MiseOn — Shared Rate Limiter para Edge Functions
// Armazena contagem em memória por janela de tempo deslizante.

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitOptions {
  windowMs?: number;    // Janela de tempo em ms (padrão: 60000ms = 1min)
  maxRequests?: number; // Máximo de requisições por janela (padrão: 10)
}

export function checkRateLimit(
  key: string,
  options: RateLimitOptions = {}
): { allowed: boolean; remaining: number; resetMs: number } {
  const windowMs = options.windowMs ?? 60000;
  const maxRequests = options.maxRequests ?? 10;
  const now = Date.now();

  const state = rateLimitMap.get(key) ?? { count: 0, resetAt: now + windowMs };

  if (now > state.resetAt) {
    state.count = 1;
    state.resetAt = now + windowMs;
  } else {
    state.count++;
  }

  rateLimitMap.set(key, state);

  const allowed = state.count <= maxRequests;
  const remaining = Math.max(0, maxRequests - state.count);
  const resetMs = Math.max(0, state.resetAt - now);

  return { allowed, remaining, resetMs };
}
