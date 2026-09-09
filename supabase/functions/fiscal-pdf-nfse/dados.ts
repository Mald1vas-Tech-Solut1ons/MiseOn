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

export interface EmissorSnapshot {
  emissor_snapshot_em?: string | null;
  emissor_razao_social?: string | null;
  emissor_cnpj?: string | null;
  emissor_inscricao_municipal?: string | null;
  emissor_logradouro?: string | null;
  emissor_numero?: string | null;
  emissor_complemento?: string | null;
  emissor_bairro?: string | null;
  emissor_cidade?: string | null;
  emissor_uf?: string | null;
  emissor_cep?: string | null;
}

/**
 * Nota emitida após este incremento carrega o snapshot do prestador tirado
 * na hora da emissão — o PDF nunca muda depois, mesmo que o cadastro da
 * MiseOn seja corrigido. Nota emitida antes (emissor_snapshot_em nulo) não
 * tem essa foto: cair para o cadastro atual é a única fonte disponível, mas
 * o PDF precisa dizer isso em vez de fingir que era o cadastro da época.
 */
export function prestadorParaExibir(
  fatura: EmissorSnapshot,
  cadastroAtual: PrestadorNfse,
): { prestador: PrestadorNfse; snapshotHistorico: boolean } {
  if (fatura.emissor_snapshot_em && fatura.emissor_razao_social?.trim()) {
    return {
      snapshotHistorico: true,
      prestador: {
        razao_social: fatura.emissor_razao_social,
        cnpj: fatura.emissor_cnpj ?? '',
        inscricao_municipal: fatura.emissor_inscricao_municipal ?? '',
        logradouro: fatura.emissor_logradouro ?? '',
        numero: fatura.emissor_numero ?? '',
        complemento: fatura.emissor_complemento,
        bairro: fatura.emissor_bairro ?? '',
        cidade: fatura.emissor_cidade ?? '',
        uf: fatura.emissor_uf ?? '',
        cep: fatura.emissor_cep ?? '',
      },
    };
  }
  return { snapshotHistorico: false, prestador: cadastroAtual };
}
