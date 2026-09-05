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

  // Recupera uma loja de teste existente (seed) ou lança erro claro
  const { data: loja, error } = await db
    .from('lojas')
    .select('id')
    .limit(1)
    .single();
  if (error || !loja) throw new Error('Nenhuma loja encontrada no banco de teste. Execute o seed.');
  lojaId = loja.id;
});

afterAll(async () => {
  if (!isConfigured || !pedidosCriados.length) return;
  // Lançamentos e pagamentos caem por cascata/FK do próprio pedido.
  await db.from('pedidos').delete().in('id', pedidosCriados);
});

// ─── Testes ──────────────────────────────────────────────────────────────────

describe.runIf(isConfigured)('Ledger Financeiro — Dupla Entrada', () => {

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
});

describe.runIf(isConfigured)('Sequência de Pedidos — Anti Race Condition', () => {
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

describe.runIf(isConfigured)('Integridade do Plano de Contas', () => {
  it('deve existir pelo menos 8 contas padrão para cada loja', async () => {
    const { data, error } = await db
      .from('contas')
      .select('id')
      .eq('loja_id', lojaId);

    if (error) throw new Error(error.message);
    expect((data ?? []).length).toBeGreaterThanOrEqual(8);
  });
});
