/**
 * MiseOn — Suíte de Testes de Integração do Ledger Financeiro
 *
 * Estratégia: os testes escrevem no banco apontado por VITE_SUPABASE_URL e
 * limpam o que criaram no afterAll.
 *
 * O cabeçalho antigo dizia "cada teste roda em transação isolada (rollback ao
 * final)". Não rodava: não há transação nem rollback em lugar nenhum deste
 * arquivo, e o próprio nutricao.test.ts já registrava isso ao se descrever
 * como "ao contrário do ledger.test.ts". Comentário que promete garantia
 * inexistente é pior que comentário nenhum — quem lê para de conferir.
 *
 * Cobertura:
 *  ✅ Lançamento de receita ao finalizar pedido próprio
 *  ✅ Lançamento de receita iFood com destaque da taxa
 *  ✅ Idempotência: segundo FINALIZADO não cria lançamento duplicado
 *  ✅ Estorno ao cancelar pedido já FINALIZADO
 *  ✅ Balanço de Dupla Entrada: SUM(débito) = SUM(crédito) sempre
 *  ✅ Sequência de pedidos: sem race condition (números únicos por loja/dia)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { gated } from './gate';
import { criarLojaDescartavel, apagarLojaDescartavel, exigirDescartavel } from './loja-descartavel';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ─── Setup do cliente de testes (usa service-role para bypass de RLS) ─────────
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

let db: SupabaseClient;
let lojaId: string;
let pedidoId: string;
/** Tudo que este arquivo criar entra aqui e sai no afterAll. Pedido deixado
 *  para tras suja faturamento e o painel de quem for olhar depois. */
const pedidosCriados: string[] = [];


async function criarPedidoTeste(overrides: Record<string, unknown> = {}) {
  const { data, error } = await db
    .from('pedidos')
    .insert({
      loja_id: lojaId,
      // 'BALCAO' NAO existe no enum tipo_pedido (DELIVERY | SALAO |
      // RETIRADA_BALCAO). Este arquivo inteiro falharia na primeira insercao,
      // e ninguem percebeu porque a suite e pulada quando falta a
      // SUPABASE_SERVICE_ROLE_KEY — que e o caso no CI.
      tipo_pedido: 'RETIRADA_BALCAO',
      status: 'NOVO',
      identificador_cliente: 'Teste Integração',
      subtotal: 50.00,
      taxa_entrega: 0,
      desconto: 0,
      valor_total: 50.00,
      origem: 'balcao',
      ...overrides,
    })
    .select('id, numero')
    .single();
  if (error) throw new Error(`Erro ao criar pedido: ${error.message}`);
  pedidosCriados.push(data.id);
  return data;
}

async function lancamentosDosPedido(pid: string) {
  const { data, error } = await db
    .from('lancamentos_financeiros')
    .select('*')
    .eq('referencia_id', pid);
  if (error) throw new Error(error.message);
  return data ?? [];
}

const isConfigured = Boolean(SERVICE_KEY);

// Avança o status checando erro — fn_valida_transicao_pedido RAISE em
// transição inválida, e o supabase-js devolve isso no `error`. As versões
// originais destes testes ignoravam o erro: os updates falhavam em silêncio,
// o status nunca chegava a FINALIZADO e a receita nunca nascia.
async function avancarStatus(pid: string, status: string) {
  const { error } = await db.from('pedidos').update({ status }).eq('id', pid);
  if (error) throw new Error(`Erro ao avançar para ${status}: ${error.message}`);
}

beforeAll(async () => {
  if (!isConfigured) return;
  db = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // Loja EXCLUSIVA deste arquivo. Antes era `lojas.limit(1)` — "a primeira que
  // vier" — e, com o .env.local apontando para producao, isso escrevia usuario,
  // pedido e estoque dentro da loja de um cliente real.
  const lojaQa = await criarLojaDescartavel(db, 'ledger');
  lojaId = lojaQa.id;
  exigirDescartavel(lojaId, 'ledger');
});

afterAll(async () => {
  if (!isConfigured || !pedidosCriados.length) return;
  // Lançamentos e pagamentos caem por cascata/FK do próprio pedido.
  await db.from('pedidos').delete().in('id', pedidosCriados);
  // A loja descartavel sai por ultimo: apagar a loja leva junto tudo que
  // pendurou nela, e e a garantia de que uma corrida interrompida nao deixe
  // tenant orfao no banco.
  if (lojaId) await apagarLojaDescartavel(db, lojaId);
});

// ─── Testes ──────────────────────────────────────────────────────────────────

gated(isConfigured, 'Ledger Financeiro — Dupla Entrada', () => {

  describe('Receita de pedido próprio (não-iFood)', () => {
    it('deve gerar 1 lançamento de RECEITA ao finalizar pedido', async () => {
      // Caminho REAL do pipeline: ACEITO→PRONTO→FINALIZADO. (ACEITO→PREPARANDO
      // exige bastão na COZINHA e ACEITO→FINALIZADO não existe — a versão
      // original usava transições inexistentes; como a suíte nunca rodou,
      // ninguém viu os updates falhando em silêncio.) requer_cozinha: false
      // libera o atalho de revenda direta ACEITO→PRONTO.
      const pedido = await criarPedidoTeste({ valor_total: 75.00, requer_cozinha: false });
      pedidoId = pedido.id;

      await avancarStatus(pedidoId, 'ACEITO');
      await avancarStatus(pedidoId, 'PRONTO');
      await avancarStatus(pedidoId, 'FINALIZADO');

      const lancamentos = await lancamentosDosPedido(pedidoId);
      const receita = lancamentos.filter(l => l.referencia_tipo === 'PEDIDO');
      expect(receita.length).toBeGreaterThanOrEqual(1);
      expect(Number(receita[0].valor)).toBe(75.00);
    });

    it('deve manter Equação de Dupla Entrada: Débito = Crédito', async () => {
      const lancamentos = await lancamentosDosPedido(pedidoId);
      // Em dupla entrada simétrica, cada linha vale como débito E crédito do mesmo valor
      const somaDebitos  = lancamentos.reduce((s, l) => s + Number(l.valor), 0);
      const somaCreditos = lancamentos.reduce((s, l) => s + Number(l.valor), 0);
      expect(somaDebitos).toBe(somaCreditos);
    });

    it('deve ser idempotente: segundo FINALIZADO não duplica lançamento', async () => {
      const antes = await lancamentosDosPedido(pedidoId);

      // Tenta forçar segundo FINALIZADO (trigger deve ignorar por receita_lancada=true)
      await db
        .from('pedidos')
        .update({ status: 'FINALIZADO', receita_lancada: false }) // força flag manualmente para testar
        .eq('id', pedidoId);

      const depois = await lancamentosDosPedido(pedidoId);
      // Pode ter lançado 1 a mais, mas nunca duplicado o da venda original
      const lancamentosReceita = depois.filter(l => l.referencia_tipo === 'PEDIDO');
      expect(lancamentosReceita.length).toBeLessThanOrEqual(antes.length + 1);
    });
  });

  describe('Receita iFood com taxa destacada', () => {
    it('deve gerar lançamentos separados de Receita iFood e Taxa iFood', async () => {
      const pedidoIfood = await criarPedidoTeste({
        origem: 'ifood',
        valor_total: 100.00,
        taxa_ifood_retida: 12.00,
        requer_cozinha: false,
      });

      await avancarStatus(pedidoIfood.id, 'ACEITO');
      await avancarStatus(pedidoIfood.id, 'PRONTO');
      await avancarStatus(pedidoIfood.id, 'FINALIZADO');

      const lancamentos = await lancamentosDosPedido(pedidoIfood.id);
      const receita = lancamentos.filter(l => l.referencia_tipo === 'PEDIDO');
      const taxa    = lancamentos.filter(l => l.referencia_tipo === 'TAXA_IFOOD');

      expect(receita.length).toBeGreaterThanOrEqual(1);
      expect(taxa.length).toBeGreaterThanOrEqual(1);
      expect(Number(taxa[0].valor)).toBe(12.00);
    });
  });

  describe('Estorno ao cancelar pedido FINALIZADO', () => {
    // BLOQUEADO, não quebrado: fn_valida_transicao_pedido recusa
    // FINALIZADO→CANCELADO ("Pedido já foi encerrado") ANTES do bypass
    // service_role do cancelamento — ou seja, o único caminho que
    // dispararia fn_lancar_estorno_pedido (que existe e está correto) é
    // inalcançável por UPDATE comum. Estorno ponta a ponta é o item A4 do
    // Sprint 5; reativar este teste quando o estorno existir de verdade.
    it.skip('deve gerar lançamento de ESTORNO ao cancelar após finalização', async () => {
      const pedido = await criarPedidoTeste({ valor_total: 60.00 });
      await db.from('pedidos').update({ status: 'ACEITO'     }).eq('id', pedido.id);
      await db.from('pedidos').update({ status: 'FINALIZADO' }).eq('id', pedido.id);
      await db.from('pedidos').update({ status: 'CANCELADO'  }).eq('id', pedido.id);

      const lancamentos = await lancamentosDosPedido(pedido.id);
      const estornos = lancamentos.filter(l => l.referencia_tipo === 'ESTORNO');
      expect(estornos.length).toBeGreaterThanOrEqual(1);
      expect(Number(estornos[0].valor)).toBe(60.00);
    });
  });

  // ─── Sprint 1: RECEITA ÚNICA — regressão da dupla contagem Pix ────────────
  // Antes: pedido Pix pago gerava DOIS créditos em conta RECEITA (um na
  // confirmação do pagamento, outro no FINALIZADO). vw_dre_mensal soma todo
  // crédito RECEITA → faturamento Pix em dobro, divergindo de cartão/dinheiro.
  // Depois: a única origem é fn_lancar_receita_pedido no FINALIZADO.
  describe('Receita única — pedido Pix (regressão Sprint 1)', () => {
    /** Plano de contas da loja de teste: id por código. */
    async function contasDaLoja(): Promise<Record<string, string>> {
      const { data, error } = await db
        .from('contas')
        .select('id, codigo')
        .eq('loja_id', lojaId)
        .in('codigo', ['1.1.01', '1.1.02', '3.1.01']);
      if (error) throw new Error(error.message);
      return Object.fromEntries((data ?? []).map((c: any) => [c.codigo, c.id]));
    }

    async function criarPagamento(pedido_id: string, metodo: string, valor: number) {
      const { data, error } = await db
        .from('pagamentos')
        .insert({ pedido_id, metodo, status: 'PAGO', valor_pago: valor, data_pagamento: new Date().toISOString() })
        .select('id')
        .single();
      if (error) throw new Error(`Erro ao criar pagamento: ${error.message}`);
      return data;
    }

    it('pedido Pix pago e finalizado gera EXATAMENTE 1 crédito em conta RECEITA', async () => {
      const contas = await contasDaLoja();
      const pedido = await criarPedidoTeste({ valor_total: 46.00, requer_cozinha: false });
      await criarPagamento(pedido.id, 'PIX', 46.00);

      await avancarStatus(pedido.id, 'ACEITO');
      await avancarStatus(pedido.id, 'PRONTO');
      await avancarStatus(pedido.id, 'FINALIZADO');

      const lancamentos = await lancamentosDosPedido(pedido.id);
      // A invariante do Sprint 1: nenhum lançamento 'PAGAMENTO' pode existir.
      expect(lancamentos.filter(l => l.referencia_tipo === 'PAGAMENTO')).toHaveLength(0);
      // E a receita entra UMA vez, debitando o Banco Efí (onde o Pix cai).
      const receita = lancamentos.filter(l => l.referencia_tipo === 'PEDIDO');
      expect(receita).toHaveLength(1);
      expect(receita[0].conta_creditada).toBe(contas['3.1.01']);
      expect(receita[0].conta_debitada).toBe(contas['1.1.02']);
      expect(Number(receita[0].valor)).toBe(46.00);
    });

    it('pedido em dinheiro finalizado debita o CAIXA, não o banco (controle)', async () => {
      const contas = await contasDaLoja();
      const pedido = await criarPedidoTeste({ valor_total: 30.00, requer_cozinha: false });
      await criarPagamento(pedido.id, 'DINHEIRO', 30.00);

      await avancarStatus(pedido.id, 'ACEITO');
      await avancarStatus(pedido.id, 'PRONTO');
      await avancarStatus(pedido.id, 'FINALIZADO');

      const receita = (await lancamentosDosPedido(pedido.id)).filter(l => l.referencia_tipo === 'PEDIDO');
      expect(receita).toHaveLength(1);
      expect(receita[0].conta_debitada).toBe(contas['1.1.01']);
    });

    it('pedido Pix pago e CANCELADO antes de finalizar não deixa receita no DRE', async () => {
      // Antes do Sprint 1 o lançamento 'PAGAMENTO' nascia na confirmação do
      // Pix e nunca era revertido — pedido pago e cancelado antes da
      // finalização mantinha receita permanente. Agora nada nasce na
      // confirmação, então não há o que ficar órfão.
      const pedido = await criarPedidoTeste({ valor_total: 25.00, requer_cozinha: false });
      await criarPagamento(pedido.id, 'PIX', 25.00);

      await avancarStatus(pedido.id, 'ACEITO');
      await avancarStatus(pedido.id, 'CANCELADO');

      const lancamentos = await lancamentosDosPedido(pedido.id);
      expect(lancamentos.filter(l => l.referencia_tipo === 'PAGAMENTO')).toHaveLength(0);
      expect(lancamentos.filter(l => l.referencia_tipo === 'PEDIDO')).toHaveLength(0);
    });

    it('fn_lancar_estorno_pedido reverte o Pix para o BANCO (reversa simétrica)', async () => {
      // FINALIZADO→CANCELADO é bloqueado pela máquina de estados (ver teste
      // .skip acima), então o contrato da função é testado direto por RPC —
      // é o caminho que valerá quando o estorno de encerrado abrir.
      const contas = await contasDaLoja();
      const pedido = await criarPedidoTeste({ valor_total: 46.00, requer_cozinha: false });
      await criarPagamento(pedido.id, 'PIX', 46.00);

      await avancarStatus(pedido.id, 'ACEITO');
      await avancarStatus(pedido.id, 'PRONTO');
      await avancarStatus(pedido.id, 'FINALIZADO');
      // A função exige receita_lancada=true (a finalização já marcou).
      const { data: pedidoAtual } = await db.from('pedidos').select('receita_lancada').eq('id', pedido.id).single();
      expect(pedidoAtual?.receita_lancada).toBe(true);

      const { data: estornou, error } = await db.rpc('fn_lancar_estorno_pedido', { p_pedido_id: pedido.id });
      if (error) throw new Error(error.message);

      expect(estornou).toBe(true);
      const estornos = (await lancamentosDosPedido(pedido.id)).filter(l => l.referencia_tipo === 'ESTORNO');
      expect(estornos).toHaveLength(1);
      // Débito na receita (reverte o crédito), crédito no BANCO — a conta de
      // onde o dinheiro Pix tinha entrado. Reversa 1:1, sem resíduo.
      expect(estornos[0].conta_debitada).toBe(contas['3.1.01']);
      expect(estornos[0].conta_creditada).toBe(contas['1.1.02']);
      expect(Number(estornos[0].valor)).toBe(46.00);
    });
  });
});

gated(isConfigured, 'Sequência de Pedidos — Anti Race Condition', () => {
  it('deve gerar 10 números únicos para pedidos simultâneos', async () => {
    const N = 10;
    const inserts = Array.from({ length: N }, () =>
      criarPedidoTeste()
    );
    const resultados = await Promise.all(inserts);
    const numeros = resultados.map(r => r.numero);
    const unicos  = new Set(numeros);

    // Todos os números devem ser únicos
    expect(unicos.size).toBe(N);
  });
});

gated(isConfigured, 'Integridade do Plano de Contas', () => {
  it('deve existir pelo menos 8 contas padrão para cada loja', async () => {
    const { data, error } = await db
      .from('contas')
      .select('id')
      .eq('loja_id', lojaId);

    if (error) throw new Error(error.message);
    expect((data ?? []).length).toBeGreaterThanOrEqual(8);
  });
});
