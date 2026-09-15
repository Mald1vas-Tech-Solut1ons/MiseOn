/** Capturado antes de o SDK consumir o fragmento da URL. Nunca guarda tokens. */
export function interpretarCallback(url: URL) {
  const hash = new URLSearchParams(url.hash.slice(1));
  const recovery = hash.get('type') === 'recovery' || url.searchParams.get('type') === 'recovery';
  return {
    recovery,
    erro: hash.has('error') || hash.has('error_code') || url.searchParams.has('error') || url.searchParams.has('error_code'),
    portal: url.searchParams.get('portal') === 'superadmin' ? 'superadmin' : 'admin',
    // PKCE volta à rota explícita; uma sessão Google comum não autoriza esse formulário.
    recuperacaoSolicitada: recovery || (url.pathname === '/redefinir-senha' && url.searchParams.has('code')),
  };
}

export const callbackInicial = interpretarCallback(new URL(
  typeof window === 'undefined' ? 'https://localhost/' : window.location.href,
));
let recuperacao = callbackInicial.recuperacaoSolicitada && !callbackInicial.erro;
export const emRecuperacao = () => recuperacao;
export function registrarEventoAuth(evento: string) {
  if (evento === 'PASSWORD_RECOVERY') recuperacao = true;
  if (evento === 'SIGNED_OUT') recuperacao = false;
}
