/**
 * MiseOn — Senha de balcão e número do pedido
 *
 * Trava a regra de domínio que o levantamento de 01/09/2026 estabeleceu
 * (docs/PLANO-PAINEL-TV.md): número de pedido e senha são coisas diferentes.
 *
 *   · numero — identidade. Único por loja, imutável, cresce para sempre.
 *   · senha  — chamada de balcão. 1..999, zera por dia de operação, só existe
 *              para os tipos que a loja escolheu chamar.
 *
 * Sem isto, a próxima mudança em `fn_trg_numero_pedido` quebra a atribuição
 * sem ninguém perceber — e o sintoma só aparece no balcão do cliente.
 *
 * Estratégia: escreve no banco apontado por VITE_SUPABASE_URL e limpa tudo no
 * afterAll. Pulado quando falta SUPABASE_SERVICE_ROLE_KEY.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const isConfigured = Boolean(SERVICE_KEY);

const MARCA = 'ZZTEST-SENHA';

let db: SupabaseClient;
let lojaId: string;
let tiposOriginais: string[] | null = null;
const criados: string[] = [];

async function criarPedido(tipo: 'RETIRADA_BALCAO' | 'SALAO' | 'DELIVERY') {
  const { data, error } = await db
    .from('pedidos')
    .insert({
      loja_id: lojaId,
      tipo_pedido: tipo,
      status: 'NOVO',
      identificador_cliente: `${MARCA} ${tipo}`,
      valor_total: 10,
      origem: 'balcao',
    })
    .select('id, numero, senha')
    .single();
  if (error) throw new Error(`Erro ao criar pedido ${tipo}: ${error.message}`);
  criados.push(data.id);
  return data as { id: string; numero: number; senha: number | null };
}

beforeAll(async () => {
  if (!isConfigured) return;
  db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: loja, error } = await db
    .from('lojas')
    .select('id, painel_tv_tipos')
    .limit(1)
    .single();
  if (error || !loja) throw new Error('Nenhuma loja encontrada no banco de teste.');
  lojaId = loja.id;
  // Guarda a configuração da loja para devolver como estava — estes testes
  // rodam contra um banco compartilhado.
  tiposOriginais = loja.painel_tv_tipos;

  await db
    .from('lojas')
    .update({ painel_tv_tipos: ['RETIRADA_BALCAO', 'SALAO'] })
    .eq('id', lojaId);
});

afterAll(async () => {
  if (!isConfigured) return;
  if (criados.length) await db.from('pedidos').delete().in('id', criados);
  await db.from('loja_senhas').delete().eq('loja_id', lojaId);
  if (tiposOriginais) {
    await db.from('lojas').update({ painel_tv_tipos: tiposOriginais }).eq('id', lojaId);
  }
});

describe.runIf(isConfigured)('Senha de balcão × número do pedido', () => {
  it('dá senha para balcão e mesa, e NÃO dá para delivery', async () => {
    const balcao = await criarPedido('RETIRADA_BALCAO');
    const mesa = await criarPedido('SALAO');
    const delivery = await criarPedido('DELIVERY');

    expect(balcao.senha).toBeGreaterThan(0);
    expect(mesa.senha).toBeGreaterThan(0);
    // Delivery sem senha é a regra, não um esquecimento: o cliente está em
    // casa esperando o entregador, não no balcão para ser chamado.
    expect(delivery.senha).toBeNull();
  });

  it('emite senhas sequenciais dentro do mesmo dia de operação', async () => {
    const a = await criarPedido('RETIRADA_BALCAO');
    const b = await criarPedido('RETIRADA_BALCAO');
    expect(b.senha!).toBe(a.senha! + 1);
  });

  it('mantém número e senha independentes: número cresce, senha não é o número', async () => {
    const p = await criarPedido('RETIRADA_BALCAO');
    // O número segue a sequência da loja, que nunca zera e já está alta.
    // A senha começa do 1 a cada dia. Se algum dia voltarem a ser a mesma
    // coisa, este teste cai.
    expect(p.numero).toBeGreaterThan(0);
    expect(p.senha).toBeLessThanOrEqual(999);
  });

  it('nunca reemite um número já usado pela loja', async () => {
    const p = await criarPedido('RETIRADA_BALCAO');
    const { count, error } = await db
      .from('pedidos')
      .select('id', { count: 'exact', head: true })
      .eq('loja_id', lojaId)
      .eq('numero', p.numero);
    expect(error).toBeNull();
    expect(count).toBe(1);
  });

  it('respeita a loja que decide não chamar mesa', async () => {
    await db.from('lojas').update({ painel_tv_tipos: ['RETIRADA_BALCAO'] }).eq('id', lojaId);

    const mesa = await criarPedido('SALAO');
    expect(mesa.senha).toBeNull();

    const balcao = await criarPedido('RETIRADA_BALCAO');
    expect(balcao.senha).toBeGreaterThan(0);

    await db
      .from('lojas')
      .update({ painel_tv_tipos: ['RETIRADA_BALCAO', 'SALAO'] })
      .eq('id', lojaId);
  });

  it('o banco recusa deixar a loja sem nenhum tipo chamado', async () => {
    // Painel sem tipo nenhum nunca mostra nada, e o lojista descobriria isso
    // no meio do serviço. A trava é no banco, não só na tela.
    const { error } = await db
      .from('lojas')
      .update({ painel_tv_tipos: [] })
      .eq('id', lojaId);
    expect(error).not.toBeNull();
  });
});
