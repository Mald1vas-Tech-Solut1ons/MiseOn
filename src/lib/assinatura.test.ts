import { describe, expect, it } from 'vitest';
import { avaliarAssinatura } from './assinatura';

describe('avaliarAssinatura', () => {
  it('cancelamento preserva o período já pago', () => {
    const futuro = new Date(); futuro.setDate(futuro.getDate() + 10);
    const info = avaliarAssinatura({ status_assinatura: 'cancelada', trial_termina_em: futuro.toISOString() });
    expect(info.emDia).toBe(true);
    expect(info.diasAtraso).toBe(0);
  });

  it('assinatura cancelada passa pela tolerância antes do lockdown', () => {
    const passado = new Date(); passado.setDate(passado.getDate() - 3);
    const info = avaliarAssinatura({ status_assinatura: 'cancelada', trial_termina_em: passado.toISOString() });
    expect(info.emDia).toBe(false);
    expect(info.diasAtraso).toBe(3);
  });

  it('cancelamento sem período conhecido continua conservador', () => {
    expect(avaliarAssinatura({ status_assinatura: 'cancelada' }).diasAtraso).toBe(9999);
  });
});
