// Token de acesso individual ao PDF da NFS-e da assinatura (Sprint 15A).
// Gerado em fiscal-emitir-nfse na hora da emissão; validado em fiscal-pdf-nfse.
// Só o hash SHA-256 é persistido — o token em claro existe apenas na URL
// entregue ao assinante (e-mail / painel), nunca no banco.

export function gerarTokenAcesso(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Compara o hash do token recebido com o hash salvo e confere a validade. Nunca aceita token sem expiração registrada. */
export function tokenAutoriza(
  fatura: { nfse_acesso_token_hash?: string | null; nfse_acesso_token_expira_em?: string | null },
  hashRecebido: string,
): boolean {
  if (!fatura.nfse_acesso_token_hash || fatura.nfse_acesso_token_hash !== hashRecebido) return false;
  if (!fatura.nfse_acesso_token_expira_em) return false;
  return Date.parse(fatura.nfse_acesso_token_expira_em) > Date.now();
}
