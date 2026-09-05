/**
 * MiseOn — S1-B: pedido de mesa via QR pertence à comanda da mesa
 *
 * Regressão do Sprint 1: a reescrita de fn_pedido_mesa_criar (20260904,
 * pedido direto ao KDS com status ACEITO) derrubou a linha que resolvia a
 * comanda — v_comanda nunca era atribuído e o pedido nascia com
 * comanda_id NULL. Consequência: o fechamento da mesa (que agrega pedidos
 * por comanda_id) não via a rodada pedida pelo cliente via QR — a mesa
 * fechava sem cobrar.
 *
 * O que está travado aqui:
 *  • pedido criado pela RPC nasce vinculado à comanda ABERTA da mesa;
 *  • um segundo pedido na mesma mesa REUSA a mesma comanda (obtém-ou-cria,
 *    a mesma RPC que o PDV/garçom usam — fonte única);
 *  • a comanda enxerga as duas rodadas: é ela quem fecha a conta.
 *
 * Como os demais arquivos desta suíte: roda só com SUPABASE_SERVICE_ROLE_KEY
 * (CI sobe o Supabase local; sem a chave o describe inteiro é pulado), e
 * limpa tudo que criou no afterAll.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const isConfigured = Boolean(SERVICE_KEY);

let db: SupabaseClient;
let lojaId: string;
let mesaId: string;
let produtoId: string;
const pedidosCriados: string[] = [];

/** Nome que NÃO bate na heurística de revenda da RPC (coca/suco/água/...). */
const NOME_PRODUTO = 'Burger Regressao Comanda';

async function chamarRpcMesa(itens: unknown[]) {
  const { data, error } = await db.rpc('fn_pedido_mesa_criar', {
    p_loja_id: lojaId,
    p_mesa_id: mesaId,
    p_identificador: 'Cliente QR Teste',
    p_itens: itens,
  });
  if (error) throw new Error(`fn_pedido_mesa_criar falhou: ${error.message}`);
  if (!data || data.length === 0) throw new Error('fn_pedido_mesa_criar não retornou pedido');
  const linha = Array.isArray(data) ? data[0] : data;
  pedidosCriados.push(linha.pedido_id);
  return linha as { pedido_id: string; numero: number };
}

beforeAll(async () => {
  if (!isConfigured) return;
  db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: loja, error } = await db.from('lojas').select('id').limit(1).single();
  if (error || !loja) throw new Error('Nenhuma loja encontrada no banco de teste. Execute o seed.');
  lojaId = loja.id;

  // Mesa com número fora do range operacional (evita colidir com mesas do seed).
  const { data: mesa, error: errMesa } = await db
    .from('mesas')
    .insert({ loja_id: lojaId, numero: 9100 + Math.floor(Math.random() * 800), ativo: true })
    .select('id')
    .single();
  if (errMesa) throw new Error(`Erro ao criar mesa: ${errMesa.message}`);
  mesaId = mesa.id;

  // controla_estoque: false — este teste trata de comanda, não de baixa de insumo.
  const { data: produto, error: errProduto } = await db
    .from('produtos')
    .insert({ loja_id: lojaId, nome: NOME_PRODUTO, preco: 42.00, disponivel: true, controla_estoque: false })
    .select('id')
    .single();
  if (errProduto) throw new Error(`Erro ao criar produto: ${errProduto.message}`);
  produtoId = produto.id;
});

afterAll(async () => {
  if (!isConfigured) return;
  // pedidos antes de comanda/mesa: pedidos.comanda_id é ON DELETE SET NULL,
  // então apagar a comanda primeiro deixaria pedidos órfãos visíveis no painel.
  if (pedidosCriados.length) await db.from('pedidos').delete().in('id', pedidosCriados);
  await db.from('comandas').delete().eq('mesa_id', mesaId);
  await db.from('mesas').delete().eq('id', mesaId);
  await db.from('produtos').delete().eq('id', produtoId);
});

describe.runIf(isConfigured)('Pedido de mesa via QR → comanda (Sprint 1)', () => {
  it('pedido da RPC nasce vinculado à comanda ABERTA da mesa', async () => {
    const { pedido_id } = await chamarRpcMesa([{ produto_id: produtoId, quantidade: 2 }]);

    const { data: pedido, error } = await db
      .from('pedidos')
      .select('id, comanda_id, tipo_pedido, origem, mesa_numero, status')
      .eq('id', pedido_id)
      .single();
    if (error) throw new Error(error.message);

    // A invariante do Sprint 1: comanda_id NUNCA mais pode nascer NULL aqui.
    expect(pedido?.comanda_id).not.toBeNull();

    const { data: comanda, error: errComanda } = await db
      .from('comandas')
      .select('id, status, mesa_id')
      .eq('id', pedido!.comanda_id!)
      .single();
    if (errComanda) throw new Error(errComanda.message);

    expect(comanda?.status).toBe('ABERTA');
    expect(comanda?.mesa_id).toBe(mesaId);
    expect(pedido?.tipo_pedido).toBe('SALAO');
    expect(pedido?.origem).toBe('mesa');
    expect(pedido?.status).toBe('ACEITO');
  });

  it('segunda rodada na mesma mesa REUSA a comanda (obtém-ou-cria)', async () => {
    const antes = await db
      .from('pedidos')
      .select('comanda_id')
      .in('id', pedidosCriados);
    const comandaDaPrimeira = antes.data?.[0]?.comanda_id;
    expect(comandaDaPrimeira).toBeTruthy();

    const { pedido_id } = await chamarRpcMesa([{ produto_id: produtoId, quantidade: 1 }]);

    const { data: pedido } = await db
      .from('pedidos')
      .select('comanda_id')
      .eq('id', pedido_id)
      .single();

    // Duas rodadas, UMA comanda: é o que faz o fechamento cobrar tudo.
    expect(pedido?.comanda_id).toBe(comandaDaPrimeira);
  });

  it('a comanda enxerga as duas rodadas — fechamento não perde dinheiro', async () => {
    const antes = await db
      .from('pedidos')
      .select('comanda_id')
      .in('id', pedidosCriados);
    const comandaId = antes.data?.[0]?.comanda_id;

    const { data: pedidosDaComanda, error } = await db
      .from('pedidos')
      .select('id, valor_total')
      .eq('comanda_id', comandaId);
    if (error) throw new Error(error.message);

    // Este teste criou exatamente 2 pedidos; ambos precisam estar na comanda.
    expect(pedidosDaComanda).toHaveLength(2);
    const total = pedidosDaComanda!.reduce((s, p) => s + Number(p.valor_total), 0);
    expect(total).toBe(42.00 * 2 + 42.00);
  });
});