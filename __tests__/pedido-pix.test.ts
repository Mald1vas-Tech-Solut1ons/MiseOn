/**
 * Testes da confirmação de pagamento Pix de PEDIDO (cliente pagando a loja).
 *
 * A regra roda em dois lugares — `pix-webhook` (aviso da Efí) e
 * `pix-criar-cobranca` ação 'status' (a tela perguntando) — então precisa ser
 * idempotente: os dois podem chegar juntos no mesmo pagamento.
 *
 * O que está travado aqui:
 *   • só confirma com cobrança CONCLUIDA e valor >= total do pedido;
 *   • confirmar duas vezes NÃO duplica lançamento no ledger;
 *   • pedido que já saiu de NOVO não volta para ACEITO por cima.
 */
import { describe, it, expect } from 'vitest';
import { confirmarPagamentoPedido } from '../supabase/functions/_shared/pedido-pix';

type Row = Record<string, any>;
type Banco = Record<string, Row[]>;

/** Fake do cliente Supabase com a semântica que a função usa de verdade:
 *  await direto devolve LISTA, maybeSingle devolve um objeto. */
function fakeSupabase(banco: Banco) {
  class Builder {
    private op: 'select' | 'update' | 'insert' = 'select';
    private patch: Row = {};
    private filtros: [string, any][] = [];
    constructor(private tabela: string) {}

    select() { return this; }
    update(patch: Row) { this.op = 'update'; this.patch = patch; return this; }
    insert(linha: Row) { this.op = 'insert'; this.patch = linha; return this; }
    eq(coluna: string, valor: any) { this.filtros.push([coluna, valor]); return this; }

    private executar() {
      banco[this.tabela] ??= [];
      if (this.op === 'insert') {
        banco[this.tabela].push({ ...this.patch });
        return { data: [this.patch], error: null };
      }
      // Filtro ANTES do patch: é o que faz o update condicional virar trava.
      const alvo = banco[this.tabela].filter((r) => this.filtros.every(([c, v]) => r[c] === v));
      if (this.op === 'update') alvo.forEach((r) => Object.assign(r, this.patch));
      return { data: alvo, error: null };
    }

    maybeSingle() { const { data } = this.executar(); return Promise.resolve({ data: data[0] ?? null, error: null }); }
    single() { return this.maybeSingle(); }
    then(ok: any, falha?: any) { return Promise.resolve(this.executar()).then(ok, falha); }
  }

  return { from: (tabela: string) => new Builder(tabela) };
}

const TXID = 'fc95cd32801249b4aface06fceb969d3002';
const LOJA = '34004cf0-6b5a-485b-9bf4-079aaad9aa47';
const PEDIDO = 'ped-1';

const cobConcluida = (valor: string) => ({ status: 'CONCLUIDA', valor: { original: valor }, pix: [{ valor }] });

function bancoBase(over: { pagamento?: Row; pedido?: Row } = {}): Banco {
  const pedido = { loja_id: LOJA, numero: 4, valor_total: 46, status: 'NOVO', ...over.pedido };
  return {
    pagamentos: [{
      pedido_id: PEDIDO, metodo: 'PIX', status: 'PENDENTE', gateway_txid: TXID,
      data_pagamento: null, pedidos: pedido, ...over.pagamento,
    }],
    pedidos: [{ id: PEDIDO, ...pedido }],
    contas: [
      { id: 'conta-efi', codigo: '1.1.02', loja_id: LOJA },
      { id: 'conta-receita', codigo: '3.1.01', loja_id: LOJA },
    ],
    lancamentos_financeiros: [],
  };
}

describe('confirmarPagamentoPedido', () => {
  it('confirma, lança no ledger e move o pedido para ACEITO', async () => {
    const banco = bancoBase();

    const r = await confirmarPagamentoPedido(fakeSupabase(banco), TXID, cobConcluida('46.00'));

    expect(r.pago).toBe(true);
    expect(banco.pagamentos[0].status).toBe('PAGO');
    expect(banco.pedidos[0].status).toBe('ACEITO');
    expect(banco.lancamentos_financeiros).toHaveLength(1);
    expect(banco.lancamentos_financeiros[0]).toMatchObject({
      valor: 46, conta_debitada: 'conta-efi', conta_creditada: 'conta-receita', referencia_id: PEDIDO,
    });
  });

  it('webhook repetido não duplica lançamento no ledger', async () => {
    const banco = bancoBase();
    const sb = fakeSupabase(banco);

    await confirmarPagamentoPedido(sb, TXID, cobConcluida('46.00'));
    const r2 = await confirmarPagamentoPedido(sb, TXID, cobConcluida('46.00'));

    expect(r2).toEqual({ pago: true, pedido_id: PEDIDO, motivo: 'ja_processado' });
    expect(banco.lancamentos_financeiros).toHaveLength(1);
  });

  it('pagamento parcial não confirma o pedido', async () => {
    const banco = bancoBase();

    const r = await confirmarPagamentoPedido(fakeSupabase(banco), TXID, cobConcluida('10.00'));

    expect(r).toEqual({ pago: false, motivo: 'valor_menor' });
    expect(banco.pagamentos[0].status).toBe('PENDENTE');
    expect(banco.pedidos[0].status).toBe('NOVO');
    expect(banco.lancamentos_financeiros).toHaveLength(0);
  });

  it('cobrança ainda ATIVA não mexe em nada', async () => {
    const banco = bancoBase();

    const r = await confirmarPagamentoPedido(fakeSupabase(banco), TXID, { status: 'ATIVA' });

    expect(r).toEqual({ pago: false, motivo: 'nao_concluida' });
    expect(banco.pagamentos[0].status).toBe('PENDENTE');
  });

  it('txid sem pagamento correspondente é ignorado', async () => {
    const banco = bancoBase();

    const r = await confirmarPagamentoPedido(fakeSupabase(banco), 'txid-de-outro-lugar', cobConcluida('46.00'));

    expect(r).toEqual({ pago: false, motivo: 'sem_pagamento' });
    expect(banco.pedidos[0].status).toBe('NOVO');
  });

  it('pedido que já saiu de NOVO não é reescrito para ACEITO', async () => {
    const banco = bancoBase({ pedido: { status: 'EM_PREPARO' } });

    const r = await confirmarPagamentoPedido(fakeSupabase(banco), TXID, cobConcluida('46.00'));

    expect(r.pago).toBe(true);
    expect(banco.pagamentos[0].status).toBe('PAGO');
    expect(banco.pedidos[0].status).toBe('EM_PREPARO');
  });

  it('pagamento já marcado PAGO é reconhecido sem reprocessar', async () => {
    const banco = bancoBase({ pagamento: { status: 'PAGO' } });

    const r = await confirmarPagamentoPedido(fakeSupabase(banco), TXID, cobConcluida('46.00'));

    expect(r).toEqual({ pago: true, pedido_id: PEDIDO, motivo: 'ja_processado' });
    expect(banco.lancamentos_financeiros).toHaveLength(0);
  });
});
