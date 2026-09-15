interface ConfiguracaoRecebimentos {
  aceita_online?: boolean | null;
  efi_payee_code?: string | null;
  efi_titular_documento?: string | null;
  efi_conta?: string | null;
  cartao_online_bloqueado_em?: string | null;
}

/** Checklist de configuração; não substitui a confirmação de uma cobrança. */
export function recebimentosConfigurados(loja: ConfiguracaoRecebimentos | null | undefined): boolean {
  if (!loja) return false;
  if (loja.aceita_online === false) return true;
  const cartaoOk = !!loja.efi_payee_code && !loja.cartao_online_bloqueado_em;
  const pixOk = !!(loja.efi_titular_documento && loja.efi_conta);
  return cartaoOk && pixOk;
}
