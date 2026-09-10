/** Sprint 18 — contrato SQL de modificadores, rodadas e avanço do KDS. */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { gated } from './gate';

const URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const configured = Boolean(SERVICE_KEY);
// Senha do usuario descartavel que a suite cria e apaga. Gerada por execucao:
// literal em repositorio publico e barrado pelo guarda de segredos do repo
// (scripts/verificar-segredos.mjs) — e com razao, mesmo sendo dado de teste.
const password = `Teste-${crypto.randomUUID()}-aA1!`;

let admin: SupabaseClient;
let operador: SupabaseClient;
let lojaId = '';
let userId = '';
let pedidoId = '';
let estacaoId = '';
let workflowId = '';
let produtoId = '';
let outroProdutoId = '';
let grupoId = '';
let opcaoId = '';
let opcao2Id = '';
let item1Id = '';
let ticket1Id = '';
const estacoesExtras: string[] = [];
const workflowsExtras: string[] = [];
const ticketsExtras: string[] = [];
const pedidosExtras: string[] = [];
const comandasExtras: string[] = [];

async function inserirItem(): Promise<string> {
  const { data, error } = await admin.from('itens_pedido').insert({
    pedido_id: pedidoId,
    produto_id: produtoId,
    nome_produto: 'NOME ADULTERADO',
    preco_unitario: 0.01,
    quantidade: 1,
    observacao: 'Ponto da carne: ao ponto',
  }).select('id').single();
  if (error) throw new Error(error.message);
  return data.id;
}

async function selecionar(itemId: string, id = opcaoId) {
  return admin.from('itens_pedido_opcoes').insert({
    item_id: itemId,
    opcao_id: id,
    nome_opcao: 'NOME ADULTERADO',
    preco_adicional: 0.01,
  }).select('id, nome_opcao, preco_adicional').single();
}

beforeAll(async () => {
  if (!configured) return;
  admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: loja, error: lojaError } = await admin.from('lojas').select('id').limit(1).single();
  if (lojaError || !loja) throw new Error('Banco local sem loja de seed.');
  lojaId = loja.id;

  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const email = `kds18-${suffix}@example.test`;
  const { data: created, error: userError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (userError || !created.user) throw new Error(userError?.message ?? 'Falha ao criar operador');
  userId = created.user.id;
  const { error: roleError } = await admin.from('usuarios_loja').insert({
    user_id: userId, loja_id: lojaId, papel: 'operador',
  });
  if (roleError) throw new Error(roleError.message);
  operador = createClient(URL, process.env.VITE_SUPABASE_ANON_KEY ?? SERVICE_KEY, {
    auth: { persistSession: false },
  });
  const { error: loginError } = await operador.auth.signInWithPassword({ email, password });
  if (loginError) throw new Error(loginError.message);

  const { data: estacao, error: estacaoError } = await admin.from('kds_estacoes').insert({
    loja_id: lojaId, nome: `Chapa Sprint 18 ${suffix}`, ativo: true, ordem: 900,
  }).select('id').single();
  if (estacaoError) throw new Error(estacaoError.message);
  estacaoId = estacao.id;
  const etapas = [
    { id: 'fila', nome: 'Fila', ordem: 0 },
    { id: 'preparo', nome: 'Preparo', ordem: 1 },
    { id: 'expedicao', nome: 'Expedicao', ordem: 2 },
  ];
  const { data: workflow, error: workflowError } = await admin.from('kds_workflows').insert({
    loja_id: lojaId, estacao_id: estacaoId, nome: 'Fluxo Sprint 18', etapas,
  }).select('id').single();
  if (workflowError) throw new Error(workflowError.message);
  workflowId = workflow.id;

  const { data: produtos, error: produtoError } = await admin.from('produtos').insert([
    { loja_id: lojaId, nome: `Burger Sprint 18 ${suffix}`, preco: 31.9, disponivel: true,
      controla_estoque: false, estacao_kds_id: estacaoId, workflow_kds_id: workflowId },
    { loja_id: lojaId, nome: `Outro Sprint 18 ${suffix}`, preco: 20, disponivel: true,
      controla_estoque: false, estacao_kds_id: estacaoId, workflow_kds_id: workflowId },
  ]).select('id, nome');
  if (produtoError || !produtos) throw new Error(produtoError?.message ?? 'Falha ao criar produtos');
  produtoId = produtos.find((p) => p.nome.startsWith('Burger Sprint 18'))!.id;
  outroProdutoId = produtos.find((p) => p.nome.startsWith('Outro Sprint 18'))!.id;

  const { data: grupo, error: grupoError } = await admin.from('grupos_opcoes').insert({
    produto_id: produtoId, nome: 'Ponto da carne', min_escolhas: 1, max_escolhas: 2,
  }).select('id').single();
  if (grupoError) throw new Error(grupoError.message);
  grupoId = grupo.id;
  const { data: opcoes, error: opcoesError } = await admin.from('opcoes').insert([
    { grupo_id: grupoId, nome: 'Ao ponto', preco_adicional: 3.5, disponivel: true },
    { grupo_id: grupoId, nome: 'Bem passado', preco_adicional: 4.5, disponivel: true },
    { grupo_id: grupoId, nome: 'Indisponivel', preco_adicional: 99, disponivel: false },
  ]).select('id, nome');
  if (opcoesError || !opcoes) throw new Error(opcoesError?.message ?? 'Falha ao criar opcoes');
  opcaoId = opcoes.find((o) => o.nome === 'Ao ponto')!.id;
  opcao2Id = opcoes.find((o) => o.nome === 'Bem passado')!.id;

  const { data: pedido, error: pedidoError } = await admin.from('pedidos').insert({
    loja_id: lojaId, tipo_pedido: 'SALAO', origem: 'garcom_mobile', status: 'ACEITO',
    identificador_cliente: 'Mesa Sprint 18', subtotal: 0, taxa_entrega: 0,
    desconto: 0, valor_total: 0, requer_cozinha: true, estacao_atual: 'COZINHA',
  }).select('id').single();
  if (pedidoError) throw new Error(pedidoError.message);
  pedidoId = pedido.id;
});

afterAll(async () => {
  if (!configured) return;
  if (pedidoId) await admin.from('pedidos').delete().eq('id', pedidoId);
  if (pedidosExtras.length) await admin.from('pedidos').delete().in('id', pedidosExtras);
  if (comandasExtras.length) await admin.from('comandas').delete().in('id', comandasExtras);
  if (ticketsExtras.length) await admin.from('kds_tickets').delete().in('id', ticketsExtras);
  if (workflowId) await admin.from('produtos').delete().in('id', [produtoId, outroProdutoId]);
  if (workflowsExtras.length) await admin.from('kds_workflows').delete().in('id', workflowsExtras);
  if (estacoesExtras.length) await admin.from('kds_estacoes').delete().in('id', estacoesExtras);
  if (workflowId) await admin.from('kds_workflows').delete().eq('id', workflowId);
  if (estacaoId) await admin.from('kds_estacoes').delete().eq('id', estacaoId);
  if (userId) {
    await admin.from('usuarios_loja').delete().eq('user_id', userId);
    await admin.auth.admin.deleteUser(userId);
  }
});

gated(configured, 'Sprint 18 — KDS por rodada e modificadores', () => {
  it('nao despacha item com minimo obrigatorio incompleto e ignora preco/nome adulterados', async () => {
    item1Id = await inserirItem();
    const { data: item } = await admin.from('itens_pedido')
      .select('nome_produto, preco_unitario').eq('id', item1Id).single();
    expect(item?.nome_produto).toContain('Burger Sprint 18');
    expect(Number(item?.preco_unitario)).toBe(31.9);
    const { count } = await admin.from('kds_tickets').select('*', { count: 'exact', head: true })
      .eq('pedido_id', pedidoId);
    expect(count).toBe(0);
  });

  it('recusa opcao de outro produto, indisponivel, duplicada e acima do maximo', async () => {
    const { data: grupoOutro } = await admin.from('grupos_opcoes').insert({
      produto_id: outroProdutoId, nome: 'Outro grupo', min_escolhas: 0, max_escolhas: 1,
    }).select('id').single();
    const { data: opcaoOutro } = await admin.from('opcoes').insert({
      grupo_id: grupoOutro!.id, nome: 'Intrusa', preco_adicional: 1, disponivel: true,
    }).select('id').single();
    const cruzada = await selecionar(item1Id, opcaoOutro!.id);
    expect(cruzada.error?.message).toContain('nao pertence');

    const { data: indisponivel } = await admin.from('opcoes').select('id')
      .eq('grupo_id', grupoId).eq('disponivel', false).single();
    const semEstoque = await selecionar(item1Id, indisponivel!.id);
    expect(semEstoque.error?.message).toContain('indisponivel');

    const primeira = await selecionar(item1Id);
    expect(primeira.error).toBeNull();
    expect(primeira.data?.nome_opcao).toBe('Ao ponto');
    expect(Number(primeira.data?.preco_adicional)).toBe(3.5);
    const repetida = await selecionar(item1Id);
    expect(repetida.error).not.toBeNull();
    expect((await selecionar(item1Id, opcao2Id)).error).toBeNull();

    const { data: terceira } = await admin.from('opcoes').insert({
      grupo_id: grupoId, nome: 'Mal passado', preco_adicional: 2, disponivel: true,
    }).select('id').single();
    expect((await selecionar(item1Id, terceira!.id)).error?.message).toContain('maxima');

    await admin.from('produtos').update({ disponivel: false }).eq('id', outroProdutoId);
    const produtoIndisponivel = await admin.from('itens_pedido').insert({
      pedido_id: pedidoId, produto_id: outroProdutoId, nome_produto: 'x',
      preco_unitario: 0.01, quantidade: 1,
    });
    expect(produtoIndisponivel.error?.message).toContain('indisponivel');
  });

  it('RPC do garcom rejeita minimo obrigatorio ausente e desfaz a gravacao inteira', async () => {
    const { data: comanda } = await admin.from('comandas').insert({
      loja_id: lojaId, status: 'ABERTA', taxa_servico_pct: 0,
    }).select('id').single();
    comandasExtras.push(comanda!.id);
    const tentativa = await operador.rpc('fn_lancar_item_avulso_comanda', {
      p_loja_id: lojaId, p_comanda_id: comanda!.id, p_produto_id: produtoId,
      p_nome_produto: null, p_preco_unitario: 0.01, p_quantidade: 1,
      p_observacao: null, p_opcoes: [],
    });
    expect(tentativa.error?.message).toContain('obrigatorias');
    const { count } = await admin.from('pedidos').select('*', { count: 'exact', head: true })
      .eq('comanda_id', comanda!.id);
    expect(count).toBe(0);
  });

  it('apos gravar opcoes cria snapshot estruturado e sincroniza remocao no ticket ativo', async () => {
    const { data: ticket, error } = await admin.from('kds_tickets')
      .select('id, rodada_numero, itens, workflow_snapshot, status')
      .eq('pedido_id', pedidoId).single();
    if (error) throw new Error(error.message);
    ticket1Id = ticket.id;
    expect(ticket.rodada_numero).toBe(1);
    expect(ticket.workflow_snapshot).toHaveLength(3);
    expect(ticket.itens[0].observacao).toBe('Ponto da carne: ao ponto');
    expect(ticket.itens[0].modificadores).toEqual(expect.arrayContaining([
      expect.objectContaining({ opcao_id: opcaoId, grupo_nome: 'Ponto da carne', nome: 'Ao ponto' }),
    ]));

    const { data: linha2 } = await admin.from('itens_pedido_opcoes').select('id')
      .eq('item_id', item1Id).eq('opcao_id', opcao2Id).single();
    expect((await admin.from('itens_pedido_opcoes').delete().eq('id', linha2!.id)).error).toBeNull();
    const { data: atualizado } = await admin.from('kds_tickets').select('itens').eq('id', ticket1Id).single();
    expect(atualizado!.itens[0].opcoes).toEqual(['Ao ponto']);
  });

  it('agrega itens novos no ticket ativo exatamente uma vez', async () => {
    const item2 = await inserirItem();
    expect((await selecionar(item2)).error).toBeNull();
    const { data: ticket } = await admin.from('kds_tickets').select('itens').eq('id', ticket1Id).single();
    expect(ticket!.itens.map((i: { item_pedido_id: string }) => i.item_pedido_id).sort())
      .toEqual([item1Id, item2].sort());
    const { count } = await admin.from('kds_ticket_itens').select('*', { count: 'exact', head: true })
      .eq('ticket_id', ticket1Id);
    expect(count).toBe(2);
  });

  it('entra na ultima etapa sem concluir e so o avancar seguinte marca PRONTO', async () => {
    // Mantem outra estacao ativa: assim esta estacao pode concluir e receber
    // rodada 2 sem que o pedido inteiro mude para PRONTO.
    const suffix = `bloqueio-${Date.now()}`;
    const { data: estacao } = await admin.from('kds_estacoes').insert({
      loja_id: lojaId, nome: `Estacao ${suffix}`, ativo: true, ordem: 949,
    }).select('id').single();
    estacoesExtras.push(estacao!.id);
    const etapas = [{ id: 'espera', nome: 'Espera', ordem: 0 }];
    const { data: workflow } = await admin.from('kds_workflows').insert({
      loja_id: lojaId, estacao_id: estacao!.id, nome: `Fluxo ${suffix}`, etapas,
    }).select('id').single();
    workflowsExtras.push(workflow!.id);
    const { data: bloqueio } = await admin.from('kds_tickets').insert({
      pedido_id: pedidoId, loja_id: lojaId, estacao_id: estacao!.id,
      workflow_id: workflow!.id, workflow_snapshot: etapas, rodada_numero: 1, itens: [],
    }).select('id').single();
    ticketsExtras.push(bloqueio!.id);

    expect((await operador.rpc('fn_avancar_kds_ticket', { p_ticket_id: ticket1Id })).data)
      .toMatchObject({ etapa_atual: 1, status: 'PREPARANDO' });
    expect((await operador.rpc('fn_avancar_kds_ticket', { p_ticket_id: ticket1Id })).data)
      .toMatchObject({ etapa_atual: 2, status: 'PREPARANDO' });
    expect((await operador.rpc('fn_avancar_kds_ticket', { p_ticket_id: ticket1Id })).data)
      .toMatchObject({ etapa_atual: 2, status: 'PRONTO' });
    const { data: pedido } = await admin.from('pedidos').select('status').eq('id', pedidoId).single();
    expect(pedido?.status).toBe('PREPARANDO');
  });

  it('nova rodada nao altera nem reabre ticket concluido', async () => {
    const item3 = await inserirItem();
    expect((await selecionar(item3)).error).toBeNull();
    const { data: tickets } = await admin.from('kds_tickets')
      .select('id, rodada_numero, status, itens').eq('pedido_id', pedidoId)
      .eq('estacao_id', estacaoId).order('rodada_numero');
    expect(tickets).toHaveLength(2);
    expect(tickets![0]).toMatchObject({ id: ticket1Id, rodada_numero: 1, status: 'PRONTO' });
    expect(tickets![0].itens).toHaveLength(2);
    expect(tickets![1]).toMatchObject({ rodada_numero: 2, status: 'AGUARDANDO' });
    expect(tickets![1].itens[0].item_pedido_id).toBe(item3);

    const alteracaoTardia = await admin.from('itens_pedido_opcoes').update({ nome_opcao: 'Cru' })
      .eq('item_id', item1Id).eq('opcao_id', opcaoId);
    expect(alteracaoTardia.error?.message).toContain('producao concluida');
  });

  it('pedido inteiramente PRONTO nao recebe trabalho pendente: garcom abre novo pedido na comanda', async () => {
    const { data: comanda, error: comandaError } = await admin.from('comandas').insert({
      loja_id: lojaId, status: 'ABERTA', taxa_servico_pct: 0,
    }).select('id').single();
    if (comandaError) throw new Error(comandaError.message);
    comandasExtras.push(comanda.id);

    const { data: pronto, error: prontoError } = await admin.from('pedidos').insert({
      loja_id: lojaId, comanda_id: comanda.id, tipo_pedido: 'SALAO', origem: 'garcom_mobile',
      status: 'PRONTO', identificador_cliente: 'Rodada pronta', subtotal: 0,
      taxa_entrega: 0, desconto: 0, valor_total: 0, requer_cozinha: false,
      estacao_atual: 'BALCAO',
    }).select('id').single();
    if (prontoError) throw new Error(prontoError.message);
    pedidosExtras.push(pronto.id);

    const insercaoDireta = await admin.from('itens_pedido').insert({
      pedido_id: pronto.id, produto_id: produtoId, nome_produto: 'x',
      preco_unitario: 0.01, quantidade: 1,
    });
    expect(insercaoDireta.error?.message).toContain('nova rodada');

    const lancamento = await operador.rpc('fn_lancar_item_avulso_comanda', {
      p_loja_id: lojaId, p_comanda_id: comanda.id, p_produto_id: produtoId,
      p_nome_produto: null, p_preco_unitario: 0.01, p_quantidade: 1,
      p_observacao: 'Ao ponto', p_opcoes: [{ id: opcaoId }],
    });
    if (lancamento.error) throw new Error(lancamento.error.message);
    const novoPedidoId = lancamento.data.pedido_id as string;
    pedidosExtras.push(novoPedidoId);
    expect(novoPedidoId).not.toBe(pronto.id);

    const { data: pedidos } = await admin.from('pedidos').select('id, status, comanda_id')
      .in('id', [pronto.id, novoPedidoId]).order('criado_em');
    expect(pedidos?.find((p) => p.id === pronto.id)?.status).toBe('PRONTO');
    expect(pedidos?.find((p) => p.id === novoPedidoId)).toMatchObject({
      comanda_id: comanda.id, status: 'PREPARANDO',
    });
    const { count } = await admin.from('kds_tickets').select('*', { count: 'exact', head: true })
      .eq('pedido_id', novoPedidoId).in('status', ['AGUARDANDO', 'PREPARANDO']);
    expect(count).toBe(1);
  });

  it('snapshot do workflow nao muda retroativamente', async () => {
    const novas = [{ id: 'unica', nome: 'Nova etapa', ordem: 0 }];
    expect((await admin.from('kds_workflows').update({ etapas: novas }).eq('id', workflowId)).error).toBeNull();
    const { data: rodada2 } = await admin.from('kds_tickets').select('workflow_snapshot')
      .eq('pedido_id', pedidoId).eq('rodada_numero', 2).single();
    expect(rodada2!.workflow_snapshot).toHaveLength(3);
  });

  it('expedicao converge entre dispositivos sem finalizar pedido ou comanda', async () => {
    const antes = await admin.from('pedidos').select('status, comanda_id').eq('id', pedidoId).single();
    const primeira = await operador.rpc('fn_expedir_kds_pedido', { p_pedido_id: pedidoId });
    expect(primeira.error).toBeNull();
    expect(primeira.data).toMatchObject({ tickets_expedidos: 1 });
    const segunda = await operador.rpc('fn_expedir_kds_pedido', { p_pedido_id: pedidoId });
    expect(segunda.data).toMatchObject({ tickets_expedidos: 0 });

    const { data: expedido } = await admin.from('kds_tickets')
      .select('expedido_em, expedido_por').eq('id', ticket1Id).single();
    expect(expedido?.expedido_em).toBeTruthy();
    expect(expedido?.expedido_por).toBe(userId);
    const depois = await admin.from('pedidos').select('status, comanda_id').eq('id', pedidoId).single();
    expect(depois.data).toEqual(antes.data);
  });

  it('rejeita Ponto da carne como etapa nova sem alterar workflow existente', async () => {
    const antes = await admin.from('kds_workflows').select('etapas').eq('id', workflowId).single();
    const erro = await admin.from('kds_workflows').update({
      etapas: [{ id: 'ponto', nome: '  PONTO   DA CÁRNE ', ordem: 0 }],
    }).eq('id', workflowId);
    expect(erro.error?.message).toContain('modificador');
    const depois = await admin.from('kds_workflows').select('etapas').eq('id', workflowId).single();
    expect(depois.data?.etapas).toEqual(antes.data?.etapas);
  });

  it.each([1, 2])('workflow com %i etapa(s) exige avanço somente depois de entrar na ultima', async (total) => {
    const suffix = `${total}-${Date.now()}`;
    const { data: estacao } = await admin.from('kds_estacoes').insert({
      loja_id: lojaId, nome: `Estacao ${suffix}`, ativo: true, ordem: 950 + total,
    }).select('id').single();
    estacoesExtras.push(estacao!.id);
    const etapas = Array.from({ length: total }, (_, i) => ({ id: `e${i}`, nome: `Etapa ${i}`, ordem: i }));
    const { data: workflow } = await admin.from('kds_workflows').insert({
      loja_id: lojaId, estacao_id: estacao!.id, nome: `Fluxo ${suffix}`, etapas,
    }).select('id').single();
    workflowsExtras.push(workflow!.id);
    const { data: ticket } = await admin.from('kds_tickets').insert({
      pedido_id: pedidoId, loja_id: lojaId, estacao_id: estacao!.id,
      workflow_id: workflow!.id, workflow_snapshot: etapas, rodada_numero: 1, itens: [],
    }).select('id').single();
    ticketsExtras.push(ticket!.id);

    for (let i = 1; i < total; i += 1) {
      const passo = await operador.rpc('fn_avancar_kds_ticket', { p_ticket_id: ticket!.id });
      expect(passo.data).toMatchObject({ etapa_atual: i, status: 'PREPARANDO' });
    }
    const conclusao = await operador.rpc('fn_avancar_kds_ticket', { p_ticket_id: ticket!.id });
    expect(conclusao.data).toMatchObject({ etapa_atual: total - 1, status: 'PRONTO' });
  });
});
