import { describe, expect, it } from 'vitest';
import { cadastroFiscalCompleto } from './cadastroFiscal';

const completo = {
  tipo_pessoa: 'PJ' as const, cpf_cnpj: '12.345.678/0001-90', razao_social_ou_nome: 'Pastel do Ze LTDA',
  logradouro: 'Rua A', numero: '10', complemento: null, bairro: 'Centro',
  cidade: 'São Paulo', uf: 'SP', cep: '01000-000', email_cobranca: 'dono@exemplo.com',
};

describe('cadastro fiscal da assinatura', () => {
  it('aceita CNPJ e CPF com máscara', () => {
    expect(cadastroFiscalCompleto(completo)).toBe(true);
    expect(cadastroFiscalCompleto({ ...completo, tipo_pessoa: 'PF', cpf_cnpj: '123.456.789-01' })).toBe(true);
  });
  it('conta criada pelo cadastro novo (sem fiscal) não está completa', () => {
    expect(cadastroFiscalCompleto({ ...completo, cpf_cnpj: null, razao_social_ou_nome: null })).toBe(false);
    expect(cadastroFiscalCompleto(null)).toBe(false);
  });
  it('documento, CEP e endereço precisam fazer sentido', () => {
    expect(cadastroFiscalCompleto({ ...completo, cpf_cnpj: '123' })).toBe(false);
    expect(cadastroFiscalCompleto({ ...completo, cep: '0100' })).toBe(false);
    expect(cadastroFiscalCompleto({ ...completo, cidade: ' ' })).toBe(false);
  });
});
