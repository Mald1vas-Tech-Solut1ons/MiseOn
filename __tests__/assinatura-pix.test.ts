/**
 * Testes da confirmação de pagamento Pix da assinatura (loja pagando a MiseOn).
 *
 * Esta regra roda em dois lugares — no `pix-webhook`, quando a Efí avisa, e na
 * `saas-pix` (ação 'status'), quando a tela pergunta — então ela precisa ser
 * idempotente de verdade: webhook repete, e a tela consulta a cada 10s.
 *
 * O que está travado aqui:
 *   • só confirma com cobrança CONCLUIDA e valor suficiente;
 *   • confirmar duas vezes NÃO estende o vencimento duas vezes;
 *   • renovar adiantado não queima os dias já pagos;
 *   • loja vitalícia não é rebaixada para 'ativa' ao pagar.
 */
import { describe, it, expect } from 'vitest';
import { aplicarPagamentoAssinatura, valorPagoDaCobranca } from '../supabase/functions/_shared/assinatura-pix';

type Row = Record<string, any>;
type Banco = Record<string, Row[]>;

/** Fake mínimo do cliente Supabase: só o que a função realmente usa. */
function fakeSupabase(banco: Banco) {
  const invocacoes: { name: string; args: unknown }[] = [];

  class Builder {
    private op: 'select' | 'update' = 'select';
    private patch: Row = {};
    private filtros: [string, any][] = [];
    constructor(private tabela: string) {}

    select() { return this; }
    update(patch: Row) { this.op = 'update'; this.patch = patch; return this; }
    eq(coluna: string, valor: any) { this.filtros.push([coluna, valor]); return this; }
    gte() { return this; }
    order() { return this; }
    limit() { return this; }

    private executar() {
      // O filtro é aplicado ANTES do patch — é isso que faz o update
      // condicional ('...eq(status, pendente)') funcionar como trava.
      const alvo = (banco[this.tabela] ?? []).filter((r) => this.filtros.every(([c, v]) => r[c] === v));
      if (this.op === 'update') alvo.forEach((r) => Object.assign(r, this.patch));
      return { data: alvo[0] ?? null, error: null };
    }

    maybeSingle() { return Promise.resolve(this.executar()); }
    single() { return this.maybeSingle(); }
    then(ok: any, falha?: any) { return Promise.resolve(this.executar()).then(ok, falha); }
  }

  return {
    from: (tabela: string) => new Builder(tabela),
    functions: {
      invoke: (name: string, args: unknown) => {
        invocacoes.push({ name, args });
        return Promise.resolve({ data: null, error: null });
      },
    },
    _invocacoes: invocacoes,
  };
}

const TXID = 'saase048e6acf0d84492a80827f58abc123';
const LOJA = 'e048e6ac-f0d8-4492-a808-27f581404dec';

const cobConcluida = (valor: string) => ({ status: 'CONCLUIDA', valor: { original: valor }, pix: [{ valor }] });

function bancoBase(over: { fatura?: Row; loja?: Row } = {}): Banco {
  return {
    faturas_assinatura: [{
      id: 'fat-1', loja_id: LOJA, ciclo: 'mensal', valor_cobrado: 161.4,
      status_cobranca: 'pendente', efi_charge_id: TXID, data_pagamento: null,
      ...over.fatura,
    }],
    lojas: [{ id: LOJA, status_assinatura: 'trial', trial_termina_em: null, ...over.loja }],
  };
}

describe('valorPagoDaCobranca', () => {
  it('soma os pix recebidos em vez de confiar no valor original', () => {
    expect(valorPagoDaCobranca({ valor: { original: '161.40' }, pix: [{ valor: '100.00' }, { valor: '61.40' }] })).toBe(161.4);
  });

  it('cai para o valor original quando a Efí ainda não listou os pix', () => {
    expect(valorPagoDaCobranca({ valor: { original: '161.40' }, pix: [] })).toBe(161.4);
  });
});

describe('aplicarPagamentoAssinatura', () => {
  it('confirma, marca a fatura como paga e ativa a loja por 1 mês', async () => {
    const banco = bancoBase();
    const sb = fakeSupabase(banco);

    const r = await aplicarPagamentoAssinatura(sb, TXID, cobConcluida('161.40'));

    expect(r.confirmado).toBe(true);
    expect(banco.faturas_assinatura[0].status_cobranca).toBe('pago');
    expect(banco.lojas[0].status_assinatura).toBe('ativa');

    const venc = new Date(banco.lojas[0].trial_termina_em);
    const esperado = new Date(); esperado.setMonth(esperado.getMonth() + 1);
    expect(Math.abs(venc.getTime() - esperado.getTime())).toBeLessThan(60_000);

    // a NFS-e da fatura é disparada junto (sem bloquear o pagamento)
    expect(sb._invocacoes.map((i) => i.name)).toContain('fiscal-emitir-nfse');
  });

  it('plano anual estende 12 meses', async () => {
    const banco = bancoBase({ fatura: { ciclo: 'anual', valor_cobrado: 1708.86 } });
    await aplicarPagamentoAssinatura(fakeSupabase(banco), TXID, cobConcluida('1708.86'));

    const venc = new Date(banco.lojas[0].trial_termina_em);
    const esperado = new Date(); esperado.setMonth(esperado.getMonth() + 12);
    expect(Math.abs(venc.getTime() - esperado.getTime())).toBeLessThan(60_000);
  });

  it('não estende duas vezes quando o webhook repete', async () => {
    const banco = bancoBase();
    const sb = fakeSupabase(banco);

    await aplicarPagamentoAssinatura(sb, TXID, cobConcluida('161.40'));
    const vencimentoAposPrimeira = banco.lojas[0].trial_termina_em;

    const r2 = await aplicarPagamentoAssinatura(sb, TXID, cobConcluida('161.40'));

    expect(r2).toEqual({ confirmado: true, motivo: 'ja_processada' });
    expect(banco.lojas[0].trial_termina_em).toBe(vencimentoAposPrimeira);
    expect(sb._invocacoes.filter((i) => i.name === 'fiscal-emitir-nfse')).toHaveLength(1);
  });

  it('renovação adiantada soma em cima do vencimento futuro, sem perder dias', async () => {
    const futuro = new Date(); futuro.setDate(futuro.getDate() + 20);
    const banco = bancoBase({ loja: { status_assinatura: 'ativa', trial_termina_em: futuro.toISOString() } });

    await aplicarPagamentoAssinatura(fakeSupabase(banco), TXID, cobConcluida('161.40'));

    const venc = new Date(banco.lojas[0].trial_termina_em);
    const esperado = new Date(futuro); esperado.setMonth(esperado.getMonth() + 1);
    expect(Math.abs(venc.getTime() - esperado.getTime())).toBeLessThan(60_000);
  });

  it('loja vitalícia continua vitalícia depois de pagar', async () => {
    const banco = bancoBase({ loja: { status_assinatura: 'vitalicio' } });

    const r = await aplicarPagamentoAssinatura(fakeSupabase(banco), TXID, cobConcluida('161.40'));

    expect(r.confirmado).toBe(true);
    expect(banco.lojas[0].status_assinatura).toBe('vitalicio');
  });

  it('não ativa nada enquanto a cobrança não está CONCLUIDA', async () => {
    const banco = bancoBase();
    const r = await aplicarPagamentoAssinatura(fakeSupabase(banco), TXID, { status: 'ATIVA' });

    expect(r).toEqual({ confirmado: false, motivo: 'nao_concluida' });
    expect(banco.faturas_assinatura[0].status_cobranca).toBe('pendente');
    expect(banco.lojas[0].status_assinatura).toBe('trial');
  });

  it('não ativa quando o valor pago é menor que a fatura', async () => {
    const banco = bancoBase();
    const r = await aplicarPagamentoAssinatura(fakeSupabase(banco), TXID, cobConcluida('10.00'));

    expect(r).toEqual({ confirmado: false, motivo: 'valor_menor' });
    expect(banco.faturas_assinatura[0].status_cobranca).toBe('pendente');
  });

  it('ignora txid que não tem fatura correspondente', async () => {
    const banco = bancoBase();
    const r = await aplicarPagamentoAssinatura(fakeSupabase(banco), 'saasoutroqualquer0000000000000', cobConcluida('161.40'));

    expect(r).toEqual({ confirmado: false, motivo: 'sem_fatura' });
    expect(banco.lojas[0].status_assinatura).toBe('trial');
  });
});
