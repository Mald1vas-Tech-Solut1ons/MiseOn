let memoria: string | null = null;
export function obterSessaoChat(): string {
  try {
    const valor = localStorage.getItem('miseon_chat_session');
    if (valor && !valor.startsWith('sess_')) return valor;
  } catch { /* Navegadores com storage bloqueado usam a sessão em memória. */ }
  memoria ??= crypto.randomUUID();
  try { localStorage.setItem('miseon_chat_session', memoria); } catch { /* memória */ }
  return memoria;
}

/** Apenas REST precisa da credencial; não acrescentar header aos provedores OAuth. */
export function fetchComSessaoChat(baseUrl: string): typeof fetch {
  return (input, init) => {
    const destino = new URL(input instanceof Request ? input.url : String(input));
    if (destino.origin !== new URL(baseUrl).origin || !destino.pathname.startsWith('/rest/v1/')) {
      return fetch(input, init);
    }
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set('x-chat-session', obterSessaoChat());
    return fetch(input, { ...init, headers });
  };
}
