/**
 * MiseOn — S1-C: Estoque — uma fonte de verdade, PEPS de verdade
 *
 * Regressões do Sprint 1 que esta suíte trava:
 *
 *  1. fn_movimentar_estoque (RPC nova): movimentação + saldo + lote nascem
 *     coerentes NUMA transação — antes cada tela do frontend fazia 2 chamadas
 *     soltas (update de saldo por leitura obsoleta + insert de movimentação)
 *     e a falha de uma deixava a outra divergir.
 *  2. SAIDA com sinal NEGATIVO custeia pelo PEPS e consome os lotes reais,
 *     na ordem da COMPRA (ocorrido_em) — não da data do registro. O bug era
 *     duplo: fn_transformar_estoque e KDSProducao gravavam SAIDA positiva
 *     (custo zero, lotes intocados).
 *  3. fn_transformar_estoque conserva valor: o custo consumido da origem é
 *     o custo distribuído entre os destinos (a "regra inegociável" do
 *     cabeçalho de 20260729011500 — que na prática não se cumpria).
 *  4. O estorno de cancelamento devolve o LOTE (com o custo original da
 *     baixa), não só o saldo — antes o insumo voltava a ter saldo sem
 *     lastro de lote e nada detectava.
 *  5. CMV é consumo: entradas com custo NÃO geram lançamento de CMV (o
 *     trigger antigo disparava em qualquer custo_total > 0 e fazia a
 *     entrada de compra abortar a transação — historico NULL). SAIDA
 *     (transferência entre insumos) também não é CMV: o valor reentra
 *     pela ENTRADA do destino.
 *  6. vw_divergencia_saldo_lotes: saldo físico incompatível com saldo de
 *     lotes é DETECTÁVEL — critério de aceitação do sprint.
 *  7. O GATILHO do ledger (trg_lancar_custo_estoque) dispara em TODO consumo
 *     definitivo (S1-D): PERDA sem pedido vira CMV — antes o WHEN filtrava
 *     só BAIXA_VENDA com pedido_id e o descarte por validade sumia do DRE.
 *     O caminho clássico da venda (BAIXA_VENDA com pedido) continua gerando.
 *
 * Como os demais arquivos desta suíte: roda só com SUPABASE_SERVICE_ROLE_KEY
 * (CI sobe o Supabase local). A transformação precisa de usuário logado
 * (fn_tem_papel ignora auth.uid() NULL), então um usuário de teste é criado
 * e virado admin da loja no beforeAll. Tudo que este arquivo cria sai no
 * afterAll.
 */

import { it, expect, beforeAll, afterAll } from 'vitest';
import { gated } from './gate';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const isConfigured = Boolean(SERVICE_KEY);

let db: SupabaseClient;
/** Cliente com sessão de usuário: fn_transformar_estoque exige auth.uid(). */
let dbUsuario: SupabaseClient;
let lojaId: string;
let usuarioId: string;

const SUFIXO = Date.now().toString(36);
/** Descartável e única por execução — só serve para o signIn do usuário de teste. */
const SENHA_TESTE = `s1c-${SUFIXO}`;
const insumoIds: string[] = [];
const pedidosCriados: string[] = [];
const produtosCriados: string[] = [];

/** Marca de teste nos nomes: o afterAll limpa lançamentos CMV por aqui. */
const nomeInsumo = (apelido: string) => `S1C ${SUFIXO} ${apelido}`;

async function criarInsumo(apelido: string, saldoInicial = 0) {
  const { data, error } = await db
    .from('insumos')
    .insert({
      loja_id: lojaId,
      nome: nomeInsumo(apelido),
      unidade_medida: 'un',
      quantidade_atual: saldoInicial,
      preco_embalagem: 0,
      qtd_embalagem: 1,
      ativo: true,
    })
    .select('id, nome, quantidade_atual')
    .single();
  if (error) throw new Error(`Erro ao criar insumo: ${error.message}`);
  insumoIds.push(data.id);
  return data as { id: string; nome: string; quantidade_atual: string | number };
}

/** Entrada transacional — a RPC que o frontend passou a usar. */
async function entrada(
  insumoId: string,
  qtd: number,
  custoTotal: number,
  ocorridoEm: string,
  lote = 'L-01',
) {
  const { data, error } = await db.rpc('fn_movimentar_estoque', {
    p_insumo_id: insumoId,
    p_tipo: 'ENTRADA',
    p_quantidade: qtd,
    p_custo_total: custoTotal,
    p_motivo: `Compra S1C ${SUFIXO}`,
    p_ocorrido_em: ocorridoEm,
    p_lote_fornecedor: lote,
  });
  if (error) throw new Error(`fn_movimentar_estoque (entrada) falhou: ${error.message}`);
  return data as { movimentacao_id: string; custo_total: number | null; saldo: number };
}

async function lotesDo(insumoId: string) {
  const { data, error } = await db
    .from('lotes_estoque')
    .select('id, quantidade_restante, custo_unitario, ocorrido_em')
    .eq('insumo_id', insumoId)
    .order('criado_em', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((l: any) => ({
    id: l.id,
    restante: Number(l.quantidade_restante),
    custoUnitario: Number(l.custo_unitario),
  }));
}

async function movimentacoesDo(insumoId: string) {
  const { data, error } = await db
    .from('movimentacoes_estoque')
    .select('*')
    .eq('insumo_id', insumoId)
    .order('criado_em', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function saldoDe(insumoId: string) {
  const { data, error } = await db.from('insumos').select('quantidade_atual').eq('id', insumoId).single();
  if (error) throw new Error(error.message);
  return Number(data!.quantidade_atual);
}

/** Lançamentos de CMV gerados pelo trigger (débito na conta 4.1.01). */
async function lancamentosCmvDaLoja() {
  const { data: contas, error: errContas } = await db
    .from('contas')
    .select('id')
    .eq('loja_id', lojaId)
    .eq('codigo', '4.1.01');
  if (errContas) throw new Error(errContas.message);
  const idCmv = (contas ?? [])[0]?.id;
  if (!idCmv) return [];
  const { data, error } = await db
    .from('lancamentos_financeiros')
    .select('*')
    .eq('loja_id', lojaId)
    .eq('conta_debitada', idCmv);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function divergenciaDe(insumoId: string) {
  const { data, error } = await db
    .from('vw_divergencia_saldo_lotes')
    .select('*')
    .eq('insumo_id', insumoId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

beforeAll(async () => {
  if (!isConfigured) return;
  db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: loja, error } = await db.from('lojas').select('id').limit(1).single();
  if (error || !loja) throw new Error('Nenhuma loja encontrada no banco de teste. Execute o seed.');
  lojaId = loja.id;

  // Usuário de teste: fn_transformar_estoque valida papel com auth.uid() —
  // chamada service-role não passa por essa validação.
  const email = `s1c-${SUFIXO}@miseon.teste`;
  const { data: user, error: errUser } = await db.auth.admin.createUser({
    email,
    password: SENHA_TESTE,
    email_confirm: true,
  });
  if (errUser || !user.user) throw new Error(`createUser falhou: ${errUser?.message}`);
  usuarioId = user.user.id;

  const { error: errVinculo } = await db
    .from('usuarios_loja')
    .insert({ user_id: usuarioId, loja_id: lojaId, papel: 'admin' });
  if (errVinculo) throw new Error(`usuarios_loja falhou: ${errVinculo.message}`);

  dbUsuario = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { error: errSignIn } = await dbUsuario.auth.signInWithPassword({ email, password: SENHA_TESTE });
  if (errSignIn) throw new Error(`signIn falhou: ${errSignIn.message}`);
});

afterAll(async () => {
  if (!isConfigured) return;
  // Lançamentos de CMV/estorno gerados pelos triggers: sem FK para as linhas
  // de teste, limpar por referência (pedido) e por histórico (nome S1C).
  if (pedidosCriados.length) {
    await db.from('lancamentos_financeiros').delete().in('referencia_id', pedidosCriados);
  }
  await db.from('lancamentos_financeiros').delete().ilike('historico', `CMV — S1C ${SUFIXO}%`);
  // Transformações (a itens de transformação é CASCADE da cabeça).
  await db.from('transformacoes_estoque').delete().ilike('observacao', `S1C ${SUFIXO}%`);
  // Movimentações e lotes antes dos insumos (FK).
  if (insumoIds.length) {
    await db.from('movimentacoes_estoque').delete().in('insumo_id', insumoIds);
    await db.from('lotes_estoque').delete().in('insumo_id', insumoIds);
  }
  if (pedidosCriados.length) await db.from('pedidos').delete().in('id', pedidosCriados);
  if (produtosCriados.length) await db.from('produtos').delete().in('id', produtosCriados);
  if (insumoIds.length) await db.from('insumos').delete().in('id', insumoIds);
  await db.from('usuarios_loja').delete().eq('user_id', usuarioId).eq('loja_id', lojaId);
  await db.auth.admin.deleteUser(usuarioId);
});

gated(isConfigured, 'Estoque — RPC transacional (Sprint 1)', () => {
  it('entrada cria movimentação, lote PEPS e saldo coerentes, na data da compra', async () => {
    const a = await criarInsumo('Entrada A');

    const r = await entrada(a.id, 10, 25, '2026-01-15T12:00:00.000Z', 'L-A');
    expect(Number(r.saldo)).toBe(10);

    const movs = await movimentacoesDo(a.id);
    expect(movs).toHaveLength(1);
    expect(movs[0].tipo).toBe('ENTRADA');
    expect(Number(movs[0].quantidade)).toBe(10);
    expect(Number(movs[0].custo_total)).toBe(25);
    expect(movs[0].lote_fornecedor).toBe('L-A');
    // A fila PEPS anda pela data da COMPRA, não do registro.
    expect(new Date(movs[0].ocorrido_em).toISOString()).toBe('2026-01-15T12:00:00.000Z');

    const lotes = await lotesDo(a.id);
    expect(lotes).toHaveLength(1);
    expect(lotes[0].restante).toBe(10);
    expect(lotes[0].custoUnitario).toBe(2.5);

    expect(await saldoDe(a.id)).toBe(10);
    expect(await divergenciaDe(a.id)).toHaveLength(0);
  });

  it('saída NEGATIVA custeia pelo PEPS na ordem da compra e consome os lotes', async () => {
    const b = await criarInsumo('Baixa B');

    // O lote mais CARO foi registrado PRIMEIRO (criado_em), mas comprado
    // DEPOIS (ocorrido_em em fevereiro). O PEPS tem que consumir o lote de
    // JANEIRO (mais barato) primeiro — se ordenar por criado_em, o custo sai
    // 37.50 em vez de 33.
    await entrada(b.id, 5, 20, '2026-02-10T12:00:00.000Z', 'L-CARO');  // 4,00/un
    await entrada(b.id, 10, 25, '2026-01-15T12:00:00.000Z', 'L-BARATO'); // 2,50/un

    const { data: mov, error } = await db.rpc('fn_movimentar_estoque', {
      p_insumo_id: b.id,
      p_tipo: 'SAIDA',
      p_quantidade: -12,
      p_motivo: `Saida S1C ${SUFIXO}`,
    });
    if (error) throw new Error(`saída falhou: ${error.message}`);

    // 10 un do lote de janeiro (25,00) + 2 un do de fevereiro (8,00).
    expect(Number(mov!.custo_total)).toBe(33);
    expect(Number(mov!.saldo)).toBe(3);

    const lotes = await lotesDo(b.id);
    // L-BARATO (índice 1 na ordem de criado_em) zera; L-CARO fica com 3.
    expect(lotes.find(l => l.restante === 0)).toBeTruthy();
    expect(lotes.reduce((s, l) => s + l.restante, 0)).toBe(3);
    expect(await saldoDe(b.id)).toBe(3);
    expect(await divergenciaDe(b.id)).toHaveLength(0);
  });

  it('SAIDA insuficiente aborta sem sujar o saldo', async () => {
    const c = await criarInsumo('Guarda C');
    await entrada(c.id, 4, 8, '2026-01-15T12:00:00.000Z');

    const { error } = await db.rpc('fn_movimentar_estoque', {
      p_insumo_id: c.id,
      p_tipo: 'SAIDA',
      p_quantidade: -5,
      p_motivo: 'Saida maior que o estoque',
    });
    expect(error).toBeTruthy();

    // Nada aconteceu: nem saldo, nem movimentação — transação inteira.
    expect(await saldoDe(c.id)).toBe(4);
    expect(await movimentacoesDo(c.id)).toHaveLength(1);
  });
});

gated(isConfigured, 'CMV é consumo — nunca entrada (Sprint 1)', () => {
  it('entrada com custo NÃO gera lançamento de CMV (regressão do blocker da compra)', async () => {
    const antes = await lancamentosCmvDaLoja();
    const d = await criarInsumo('Compra D');
    await entrada(d.id, 3, 30, '2026-01-15T12:00:00.000Z');
    const depois = await lancamentosCmvDaLoja();
    // Antes do Sprint 1 o trigger disparava em qualquer custo_total > 0 e
    // ainda abortava a transação (historico NULL) quando não havia pedido.
    expect(depois.length).toBe(antes.length);
  });

  it('PERDA custeada gera CMV com histórico legível (sem pedido)', async () => {
    const e = await criarInsumo('Perda E');
    await entrada(e.id, 6, 12, '2026-01-15T12:00:00.000Z'); // 2,00/un

    const antes = await lancamentosCmvDaLoja();
    const { data: mov, error } = await db.rpc('fn_movimentar_estoque', {
      p_insumo_id: e.id,
      p_tipo: 'PERDA',
      p_quantidade: -2,
      p_motivo: 'Descarte por validade',
    });
    if (error) throw new Error(error.message);
    expect(Number(mov!.custo_total)).toBe(4);

    const depois = await lancamentosCmvDaLoja();
    expect(depois.length).toBe(antes.length + 1);
    const novo = depois.find((l: any) => !antes.some((a: any) => a.id === l.id))!;
    // O blocker: consumo sem pedido_id quebrava o NOT NULL do histórico.
    expect(novo.historico).toBeTruthy();
    expect(Number(novo.valor)).toBe(4);
  });

  it('SAIDA (transferência entre insumos) não é CMV', async () => {
    const f = await criarInsumo('Transf F');
    await entrada(f.id, 5, 10, '2026-01-15T12:00:00.000Z');

    const antes = await lancamentosCmvDaLoja();
    await db.rpc('fn_movimentar_estoque', {
      p_insumo_id: f.id,
      p_tipo: 'SAIDA',
      p_quantidade: -3,
      p_motivo: 'Montagem',
    });
    // O valor reentra pela ENTRADA do destino; contá-lo aqui faria o DRE
    // somar o mesmo valor duas vezes.
    expect((await lancamentosCmvDaLoja()).length).toBe(antes.length);
  });
});

gated(isConfigured, 'Transformação conserva valor (Sprint 1)', () => {
  it('custo consumido da origem = custo distribuído entre os destinos', async () => {
    const origem = await criarInsumo('Desmonte Origem');
    const carne = await criarInsumo('Desmonte Carne');
    const carcaça = await criarInsumo('Desmonte Carcaca');
    // 4 un a 10,00/un: o desmonte tem que distribuir exatamente 40,00.
    await entrada(origem.id, 4, 40, '2026-01-15T12:00:00.000Z');

    const { data, error } = await dbUsuario.rpc('fn_transformar_estoque', {
      p_loja_id: lojaId,
      p_tipo: 'DESMONTE',
      p_origens: [{ insumo_id: origem.id, qtd: 4, fator: 1 }],
      p_destinos: [
        { insumo_id: carne.id, qtd: 2, fator: 1, peso: 2 },
        { insumo_id: carcaça.id, qtd: 2, fator: 1, peso: 2 },
      ],
      p_observacao: `S1C ${SUFIXO}`,
    });
    if (error) throw new Error(`fn_transformar_estoque falhou: ${error.message}`);

    expect(Number(data!.custo_consumido)).toBe(40);
    expect(Number(data!.custo_atribuido)).toBe(40);

    // Origem: saída NEGATIVA custeada, lote consumido, saldo zerado.
    const movsOrigem = await movimentacoesDo(origem.id);
    const saida = movsOrigem.find(m => m.tipo === 'SAIDA')!;
    expect(Number(saida.quantidade)).toBe(-4);
    expect(Number(saida.custo_total)).toBe(40);
    expect(await saldoDe(origem.id)).toBe(0);
    expect((await lotesDo(origem.id)).reduce((s, l) => s + l.restante, 0)).toBe(0);

    // Destinos: lotes com o custo rateado (20,00 / 20,00 — centavo fecha).
    const lotesCarne = await lotesDo(carne.id);
    expect(lotesCarne).toHaveLength(1);
    expect(lotesCarne[0].custoUnitario).toBe(10); // 20,00 por 2 un
    expect(await saldoDe(carne.id)).toBe(2);
    const lotesCarcaca = await lotesDo(carcaça.id);
    expect(lotesCarcaca[0].custoUnitario).toBe(10);
    expect(await divergenciaDe(carne.id)).toHaveLength(0);
    expect(await divergenciaDe(carcaça.id)).toHaveLength(0);
  });
});

gated(isConfigured, 'Estorno devolve o lote, não só o saldo (Sprint 1)', () => {
  it('cancelamento recria o lote com o custo original e sem CMV novo', async () => {
    const g = await criarInsumo('Estorno G');
    await entrada(g.id, 6, 12, '2026-01-15T12:00:00.000Z'); // 2,00/un

    // A baixa tem que vir do CAMINHO REAL da venda (NOVO -> ACEITO dispara
    // fn_baixar_estoque), não de um INSERT em movimentacoes_estoque.
    //
    // Por quê: nenhum gatilho de movimentacoes_estoque mexe em
    // insumos.quantidade_atual NEM consome lote — quem faz as três escritas
    // juntas (movimento + saldo + PEPS) são as RPCs. Com o INSERT direto o
    // cenário nascia impossível: saldo parado em 6 e lote intacto, e o
    // estorno depois criava um lote a mais (10 un para 6 de saldo).
    // Medido no banco: com o ciclo real dá 2/2 após ACEITO e 6/6 após o
    // cancelamento, que é exatamente o que este teste afirma.
    const { data: categoria } = await db
      .from('categorias').select('id').eq('loja_id', lojaId).limit(1).maybeSingle();

    const { data: produto, error: errProd } = await db
      .from('produtos')
      .insert({
        loja_id: lojaId,
        categoria_id: categoria?.id ?? null,
        nome: `Produto Estorno S1C ${SUFIXO}`,
        preco: 8,
        disponivel: true,
        controla_estoque: true,
        estacao_preparo: 'DIRETO',
      })
      .select('id')
      .single();
    if (errProd) throw new Error(`produto falhou: ${errProd.message}`);
    produtosCriados.push(produto.id);

    // 1 produto vendido = 4 un do insumo: é a ficha que define a baixa.
    const { error: errFicha } = await db
      .from('fichas_tecnicas')
      .insert({ produto_id: produto.id, insumo_id: g.id, quantidade_consumida: 4 });
    if (errFicha) throw new Error(`ficha falhou: ${errFicha.message}`);

    const { data: pedido, error: errPedido } = await db
      .from('pedidos')
      .insert({
        loja_id: lojaId,
        tipo_pedido: 'RETIRADA_BALCAO',
        status: 'NOVO',
        identificador_cliente: 'Teste S1C',
        subtotal: 8,
        taxa_entrega: 0,
        desconto: 0,
        valor_total: 8,
        origem: 'balcao',
        requer_cozinha: false,
      })
      .select('id')
      .single();
    if (errPedido) throw new Error(errPedido.message);
    pedidosCriados.push(pedido.id);

    const { error: errItem } = await db.from('itens_pedido').insert({
      pedido_id: pedido.id,
      produto_id: produto.id,
      nome_produto: `Produto Estorno S1C ${SUFIXO}`,
      preco_unitario: 8,
      quantidade: 1,
    });
    if (errItem) throw new Error(`item falhou: ${errItem.message}`);

    // NOVO -> ACEITO: o gatilho baixa 4 un, consome o lote e custeia pelo PEPS.
    const { error: errAceite } = await db
      .from('pedidos').update({ status: 'ACEITO' }).eq('id', pedido.id);
    if (errAceite) throw new Error(`aceite falhou: ${errAceite.message}`);
    expect(await saldoDe(g.id)).toBe(2);

    // O caminho clássico da venda continua passando pelo gatilho novo (S1-D):
    // a baixa custeada de 8,00 gerou o CMV dela no ledger, referenciando o pedido.
    const cmvDaBaixa = (await lancamentosCmvDaLoja()).find(
      (l: any) => l.referencia_id === pedido.id && Number(l.valor) === 8,
    );
    expect(cmvDaBaixa).toBeTruthy();

    const cmvAntes = await lancamentosCmvDaLoja();
    const { error: errCancel } = await db
      .from('pedidos')
      .update({ status: 'CANCELADO', motivo_cancelamento: 'Teste S1C' })
      .eq('id', pedido.id);
    if (errCancel) throw new Error(`cancelamento falhou: ${errCancel.message}`);

    // O estorno é ENTRADA (só ENTRADA abre lote) carregando o custo original.
    const movs = await movimentacoesDo(g.id);
    const estorno = movs.find(m => m.motivo === 'Estorno por cancelamento')!;
    expect(estorno.tipo).toBe('ENTRADA');
    expect(Number(estorno.quantidade)).toBe(4);
    expect(Number(estorno.custo_total)).toBe(8);

    const lotes = await lotesDo(g.id);
    const loteRecriado = lotes.find(l => l.restante === 4)!;
    expect(Number(loteRecriado.custoUnitario)).toBe(2);

    // Saldo físico e saldo de lotes voltam a bater: 6 un de cada lado.
    expect(await saldoDe(g.id)).toBe(6);
    expect(lotes.reduce((s, l) => s + l.restante, 0)).toBe(6);
    expect(await divergenciaDe(g.id)).toHaveLength(0);

    // A entrada do estorno NÃO é CMV (o trigger novo só dispara em consumo).
    expect((await lancamentosCmvDaLoja()).length).toBe(cmvAntes.length);
  });
});

gated(isConfigured, 'Divergência saldo × lotes é DETECTÁVEL (critério S1-C)', () => {
  it('cache de saldo sujo aparece na view e some quando volta a bater', async () => {
    const h = await criarInsumo('Divergencia H');
    await entrada(h.id, 10, 25, '2026-01-15T12:00:00.000Z');

    expect(await divergenciaDe(h.id)).toHaveLength(0);

    // Simula o estrago que os callers deixavam: update de saldo solto,
    // sem movimentação nem lote — o fantasma que ninguém via.
    await db.from('insumos').update({ quantidade_atual: 15 }).eq('id', h.id);
    const linhas = await divergenciaDe(h.id);
    expect(linhas).toHaveLength(1);
    expect(Number(linhas[0].divergencia)).toBe(5);
    expect(Number(linhas[0].saldo_lotes)).toBe(10);

    // A detecção não conserta: mostra. Consertar é voltar a bater.
    await db.from('insumos').update({ quantidade_atual: 10 }).eq('id', h.id);
    expect(await divergenciaDe(h.id)).toHaveLength(0);
  });
});

gated(isConfigured, 'Estoque tem UMA autoridade (Sprint 7)', () => {
  it('reconciliação acerta saldo E lotes contra a contagem, e zera a divergência', async () => {
    const i = await criarInsumo('Reconciliar I');
    await entrada(i.id, 10, 200, '2026-01-15T12:00:00.000Z'); // 20,00/un

    // Fabrica a divergência do jeito que o cadastro antigo fabricava: saldo
    // escrito por fora, lote intacto. (Aqui via service-role, que ignora os
    // grants — é o cenário legado que precisamos saber consertar.)
    await db.from('insumos').update({ quantidade_atual: 25 }).eq('id', i.id);
    expect(await divergenciaDe(i.id)).toHaveLength(1);

    // dbUsuario, não db: a RPC exige papel na loja (fn_tem_papel) e o
    // service-role roda com auth.uid() nulo — mesmo motivo pelo qual
    // fn_transformar_estoque já é testada com o usuário logado.
    const { error } = await dbUsuario.rpc('fn_reconciliar_estoque', {
      p_insumo_id: i.id,
      p_qtd_contada: 15,
      p_observacao: `Contagem S1C ${SUFIXO}`,
    });
    if (error) throw new Error(`fn_reconciliar_estoque falhou: ${error.message}`);

    expect(await saldoDe(i.id)).toBe(15);
    const lotes = await lotesDo(i.id);
    expect(lotes.reduce((s, l) => s + l.restante, 0)).toBe(15);
    // O que importa: os dois lados fecham no mesmo número.
    expect(await divergenciaDe(i.id)).toHaveLength(0);
  });

  it('o ledger e o saldo NÃO são graváveis por fora das RPCs', async () => {
    // Guarda contra regressão de PERMISSÃO, não de código: se alguém
    // reconceder UPDATE/INSERT nessas tabelas, a fábrica de divergência
    // reabre e nada no app acusa. Consultar o catálogo é o único jeito de
    // travar isso — o service-role dos testes ignora grant, então testar
    // "tentando escrever" daria falso verde aqui.
    const { data, error } = await db.rpc('fn_privilegios_de_escrita_estoque');
    if (error) throw new Error(`checagem de privilégios falhou: ${error.message}`);
    expect(data).toEqual([]);
  });
});
