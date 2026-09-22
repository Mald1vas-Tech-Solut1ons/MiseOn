/** Campos do tomador da nota da assinatura (`assinatura_dados_cadastro`). */
export type CadastroFiscal = {
  tipo_pessoa: 'PF' | 'PJ' | null; cpf_cnpj: string | null; razao_social_ou_nome: string | null;
  logradouro: string | null; numero: string | null; complemento: string | null; bairro: string | null;
  cidade: string | null; uf: string | null; cep: string | null; email_cobranca: string | null;
};

export const soDigitos = (s: string) => s.replace(/[^0-9]/g, '');

/**
 * O que a NFS-e e a cobrança precisam — o cartão anual exige endereço na Efí.
 * Fora disso, é opcional.
 */
export function cadastroFiscalCompleto(c: Partial<CadastroFiscal> | null | undefined): boolean {
  if (!c) return false;
  const doc = soDigitos(c.cpf_cnpj ?? '');
  return (doc.length === 11 || doc.length === 14)
    && !!c.razao_social_ou_nome?.trim()
    && !!c.logradouro?.trim() && !!c.cidade?.trim() && !!c.uf?.trim()
    && soDigitos(c.cep ?? '').length === 8
    && !!c.email_cobranca?.trim();
}
