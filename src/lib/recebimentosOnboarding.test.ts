import { describe, expect, it } from 'vitest';
import { recebimentosConfigurados } from './recebimentosOnboarding';

const contaCompleta = {
  aceita_online: true,
  efi_payee_code: 'favorecido',
  efi_titular_documento: 'documento',
  efi_conta: 'conta',
};

describe('configuração de recebimentos no onboarding', () => {
  it('reconhece Pix e cartão configurados', () => {
    expect(recebimentosConfigurados(contaCompleta)).toBe(true);
  });

  it('não conclui com cadastro parcial ou com cartão bloqueado', () => {
    expect(recebimentosConfigurados({ efi_payee_code: 'favorecido' })).toBe(false);
    expect(recebimentosConfigurados({ ...contaCompleta, efi_conta: null })).toBe(false);
    expect(recebimentosConfigurados({ ...contaCompleta, cartao_online_bloqueado_em: '2026-09-15T12:00:00Z' })).toBe(false);
  });

  it('respeita a opção explícita de não aceitar pagamento online', () => {
    expect(recebimentosConfigurados({ aceita_online: false })).toBe(true);
    expect(recebimentosConfigurados({ aceita_online: null })).toBe(false);
    expect(recebimentosConfigurados(null)).toBe(false);
  });
});
