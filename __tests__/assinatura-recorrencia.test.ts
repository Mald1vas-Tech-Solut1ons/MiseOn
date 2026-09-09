import { describe, expect, it } from 'vitest';
import {
  normalizarEventoAssinaturaEfi,
  processarHistoricoAssinaturaEfi,
} from '../supabase/functions/_shared/assinatura-recorrencia';

describe('normalizarEventoAssinaturaEfi', () => {
  it('separa evento da assinatura de cobrança e usa os identificadores oficiais', () => {
    expect(normalizarEventoAssinaturaEfi({
      id: 7,
      type: 'subscription_charge',
      identifiers: { subscription_id: 10, charge_id: 20 },
      status: { current: 'paid', previous: 'waiting' },
      value: 16990,
      created_at: '2026-09-09 12:00:00',
    })).toMatchObject({
      chave: 'efi:7', providerEventId: 7, tipo: 'subscription_charge',
      subscriptionId: '10', chargeId: '20', status: 'paid', valorCentavos: 16990,
    });
  });

  it('não transforma id do evento em charge_id', () => {
    const evento = normalizarEventoAssinaturaEfi({
      id: 8, type: 'subscription', identifiers: { subscription_id: 10 },
      status: { current: 'active' },
    });
    expect(evento.chargeId).toBeNull();
    expect(evento.status).toBe('active');
  });

  it('gera chave estável quando um payload legado vier sem id incremental', () => {
    const item = { type: 'subscription', identifiers: { subscription_id: 10 }, status: { current: 'canceled' }, created_at: '2026-09-09 13:00:00' };
    expect(normalizarEventoAssinaturaEfi(item).chave).toBe(normalizarEventoAssinaturaEfi(item).chave);
  });
});

describe('processarHistoricoAssinaturaEfi', () => {
  it('processa em ordem, delega atomicidade ao banco e aciona NFS-e uma vez', async () => {
    const chamadas: any[] = [];
    const nfse: any[] = [];
    const supabase = {
      rpc: async (_nome: string, args: any) => {
        chamadas.push(args);
        return { data: [{ situacao: 'reconhecido', fatura_id: args.p_charge_id === '22' ? 'fat-2' : null, acionar_nfse: args.p_charge_id === '22' }], error: null };
      },
      functions: { invoke: async (nome: string, args: any) => { nfse.push({ nome, args }); return { error: null }; } },
    };
    const itens = [
      { id: 1, type: 'subscription', identifiers: { subscription_id: 10 }, status: { current: 'active' } },
      { id: 2, type: 'subscription_charge', identifiers: { subscription_id: 10, charge_id: 22 }, status: { current: 'paid' }, value: 16990 },
    ];

    await expect(processarHistoricoAssinaturaEfi(supabase, 'token-1', itens))
      .resolves.toEqual({ processados: 2, nfseAcionadas: 1 });
    expect(chamadas.map((c) => c.p_evento_chave)).toEqual(['efi:1', 'efi:2']);
    expect(nfse).toEqual([{ nome: 'fiscal-emitir-nfse', args: { body: { fatura_id: 'fat-2' } } }]);
  });

  it('falha o callback quando a persistência falha, permitindo reentrega', async () => {
    const supabase = { rpc: async () => ({ data: null, error: { message: 'indisponível' } }), functions: { invoke: async () => ({}) } };
    await expect(processarHistoricoAssinaturaEfi(supabase, 'token-1', [{ id: 1 }]))
      .rejects.toThrow('indisponível');
  });
});
