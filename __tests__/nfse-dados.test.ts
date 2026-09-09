import { describe, expect, it } from 'vitest';
import { enderecoPrestador, nfseDisponivel } from '../supabase/functions/fiscal-pdf-nfse/dados';

const prestador = {
  razao_social: 'Empresa de Teste Ltda', cnpj: '00000000000000', inscricao_municipal: '123',
  logradouro: 'Avenida de Teste', numero: '42', complemento: 'Sala 8',
  bairro: 'Bairro de Teste', cidade: 'São Paulo', uf: 'SP', cep: '01234000',
};
const emitida = {
  nfse_status: 'emitida', nfse_numero: '123', nfse_codigo_verificacao: 'ABCD',
  nfse_emitida_em: '2026-09-01T12:00:00Z',
};

describe('dados do resumo de NFS-e', () => {
  it('usa endereço completo cadastrado, incluindo complemento e CEP', () => {
    expect(enderecoPrestador(prestador)).toBe(
      'Avenida de Teste, 42 - Sala 8 - Bairro de Teste - São Paulo/SP - CEP: 01234-000',
    );
    expect(enderecoPrestador({ ...prestador, logradouro: 'Rua Alterada', numero: '99' }))
      .toContain('Rua Alterada, 99');
  });
  it('não fabrica dados quando o cadastro está incompleto', () => {
    expect(() => enderecoPrestador({ ...prestador, logradouro: '' })).toThrow('incompleto');
  });
  it('complemento é opcional', () => {
    expect(enderecoPrestador({ ...prestador, complemento: null })).not.toContain('null');
  });
  it('só apresenta nota com emissão, número, código e data registrados', () => {
    expect(nfseDisponivel(emitida)).toBe(true);
    expect(nfseDisponivel({ ...emitida, nfse_codigo_verificacao: null })).toBe(false);
    expect(nfseDisponivel({ ...emitida, nfse_emitida_em: 'inválida' })).toBe(false);
  });
  it.each(['testada_ok', 'cancelada', 'processando', 'erro', 'pendente_configuracao'])(
    '%s não é uma nota emitida, mesmo com número residual', (nfse_status) => {
      expect(nfseDisponivel({ ...emitida, nfse_status })).toBe(false);
    },
  );
});
