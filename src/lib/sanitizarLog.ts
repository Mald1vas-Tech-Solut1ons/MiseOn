export function sanitizarLog(texto: string): string {
  return texto
    .replace(/https?:\/\/[^\s<>"']+/gi, (valor) => {
      try { const url = new URL(valor); return url.origin + url.pathname; } catch { return '[URL]'; }
    })
    .replace(/((?:access_token|refresh_token|id_token|provider_token|provider_refresh_token|token_hash|code|password|authorization)\s*[=:]\s*)[^\s&,;]+/gi, '$1[REMOVIDO]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[TOKEN REMOVIDO]');
}
