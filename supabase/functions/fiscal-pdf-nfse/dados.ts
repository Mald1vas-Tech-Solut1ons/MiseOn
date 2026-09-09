/** Dados cadastrais vêm da mesma configuração usada pelo emissor. */
export interface PrestadorNfse {
  razao_social: string;
  cnpj: string;
  inscricao_municipal: string;
  logradouro: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
}

export function enderecoPrestador(prestador: PrestadorNfse): string {
  const obrigatorios = ['razao_social', 'cnpj', 'inscricao_municipal', 'logradouro',
    'numero', 'bairro', 'cidade', 'uf', 'cep'] as const;
  if (obrigatorios.some((campo) => !prestador[campo]?.trim())) {
    throw new Error('Cadastro fiscal do prestador incompleto');
  }
  const cep = prestador.cep.replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2');
  return `${prestador.logradouro}, ${prestador.numero}${prestador.complemento?.trim() ? ` - ${prestador.complemento.trim()}` : ''} - ${prestador.bairro} - ${prestador.cidade}/${prestador.uf} - CEP: ${cep}`;
}

export function nfseDisponivel(fatura: {
  nfse_status: string;
  nfse_numero?: string | null;
  nfse_codigo_verificacao?: string | null;
  nfse_emitida_em?: string | null;
}): boolean {
  return fatura.nfse_status === 'emitida' && !!fatura.nfse_numero?.trim()
    && !!fatura.nfse_codigo_verificacao?.trim() && !!fatura.nfse_emitida_em
    && Number.isFinite(Date.parse(fatura.nfse_emitida_em));
}
