/**
 * Contrato da tela de ESTAÇÕES E FLUXOS do KDS (/admin/kds/estacoes).
 *
 * A tela escreve direto nas tabelas, com a sessão do lojista — não há Edge
 * Function no meio. Então o que precisa estar provado é exatamente isto: que o
 * dono da loja consegue criar, renomear, reordenar e apagar; e que ninguém de
 * fora da loja consegue.
 *
 * Até 11/09/2026 não existia UM ÚNICO INSERT de estação no frontend: as 8
 * lojas em produção tinham as mesmas "Cozinha" e "Bar" vindas do seed. Uma
 * tela nova sem este teste seria só mais uma promessa.
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { gated } from './gate';
import { criarLojaDescartavel, apagarLojaDescartavel, exigirDescartavel } from './loja-descartavel';

const URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const PUBLIC_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? '';
// Sem chave anônima não há cliente do lojista — e testar RLS com service role
// é falso-verde esperando a vez.
const configured = Boolean(SERVICE_KEY && PUBLIC_KEY);

const senha = `Teste-${crypto.randomUUID()}-aA1!`;
const senhaIntrusa = `Teste-${crypto.randomUUID()}-aA1!`;

let admin: SupabaseClient;
let dono: SupabaseClient;
let intruso: SupabaseClient;
let lojaId = '';
let lojaAlheiaId = '';
let donoId = '';
let intrusoId = '';

beforeAll(async () => {
  if (!configured) return;
  admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });

  const loja = await criarLojaDescartavel(admin, 'kds-config');
  lojaId = loja.id;
  exigirDescartavel(lojaId, 'kds-config');

  const outra = await criarLojaDescartavel(admin, 'kds-config-alheia');
  lojaAlheiaId = outra.id;

  const sufixo = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const { data: criadoDono, error: e1 } = await admin.auth.admin.createUser({
    email: `kdscfg-dono-${sufixo}@example.test`, password: senha, email_confirm: true,
  });
  if (e1 || !criadoDono.user) throw new Error(e1?.message ?? 'falha ao criar dono');
  donoId = criadoDono.user.id;
  await admin.from('usuarios_loja').insert({ user_id: donoId, loja_id: lojaId, papel: 'admin' });

  dono = createClient(URL, PUBLIC_KEY, { auth: { persistSession: false } });
  const { error: e2 } = await dono.auth.signInWithPassword({
    email: `kdscfg-dono-${sufixo}@example.test`, password: senha,
  });
  if (e2) throw new Error(e2.message);

  // Alguém que opera OUTRA loja. É o vizinho, não um anônimo: é esse o caso que
  // um erro de policy deixa passar.
  const { data: criadoIntruso, error: e3 } = await admin.auth.admin.createUser({
    email: `kdscfg-intruso-${sufixo}@example.test`, password: senhaIntrusa, email_confirm: true,
  });
  if (e3 || !criadoIntruso.user) throw new Error(e3?.message ?? 'falha ao criar intruso');
  intrusoId = criadoIntruso.user.id;
  await admin.from('usuarios_loja').insert({ user_id: intrusoId, loja_id: lojaAlheiaId, papel: 'admin' });

  intruso = createClient(URL, PUBLIC_KEY, { auth: { persistSession: false } });
  const { error: e4 } = await intruso.auth.signInWithPassword({
    email: `kdscfg-intruso-${sufixo}@example.test`, password: senhaIntrusa,
  });
  if (e4) throw new Error(e4.message);
});

afterAll(async () => {
  if (!configured) return;
  if (donoId) await admin.auth.admin.deleteUser(donoId).catch(() => {});
  if (intrusoId) await admin.auth.admin.deleteUser(intrusoId).catch(() => {});
  if (lojaAlheiaId) await apagarLojaDescartavel(admin, lojaAlheiaId);
  if (lojaId) await apagarLojaDescartavel(admin, lojaId);
});

gated(configured, 'Estações e fluxos do KDS — o que a tela precisa poder fazer', () => {
  it('o dono cria a ilha, o fluxo, reordena as etapas e apaga', async () => {
    // 1. Criar — era isto que não existia em lugar nenhum do frontend.
    const { data: ilha, error: erroIlha } = await dono.from('kds_estacoes').insert({
      loja_id: lojaId, nome: 'Ilha de Massas', cor: '#0EA5E9', ativo: true, ordem: 0,
    }).select('id, nome, cor, ordem').single();
    expect(erroIlha).toBeNull();
    expect(ilha!.nome).toBe('Ilha de Massas');

    // 2. Fluxo com etapas livres — o que torna a ilha diferente das outras.
    const etapas = [
      { id: 'massa', nome: 'Cozinhar massa', ordem: 0 },
      { id: 'molho', nome: 'Finalizar molho', ordem: 1 },
      { id: 'montar', nome: 'Montar prato', ordem: 2 },
    ];
    const { data: fluxo, error: erroFluxo } = await dono.from('kds_workflows').insert({
      loja_id: lojaId, estacao_id: ilha!.id, nome: 'Fluxo Massas', etapas,
    }).select('id, etapas').single();
    expect(erroFluxo).toBeNull();
    expect(fluxo!.etapas).toHaveLength(3);

    // 3. Reordenar: a tela grava `ordem` pela posição na lista, e é a `ordem`
    //    que desenha as colunas do KDS. Trocar duas etapas tem que persistir.
    const trocadas = [
      { id: 'molho', nome: 'Finalizar molho', ordem: 0 },
      { id: 'massa', nome: 'Cozinhar massa', ordem: 1 },
      { id: 'montar', nome: 'Montar prato', ordem: 2 },
    ];
    const { error: erroUpdate } = await dono.from('kds_workflows')
      .update({ etapas: trocadas }).eq('id', fluxo!.id);
    expect(erroUpdate).toBeNull();

    const { data: relido } = await dono.from('kds_workflows')
      .select('etapas').eq('id', fluxo!.id).single();
    expect((relido!.etapas as typeof trocadas)[0].id).toBe('molho');

    // 4. Renomear e desativar a ilha.
    const { error: erroRename } = await dono.from('kds_estacoes')
      .update({ nome: 'Ilha de Massas e Risotos', ativo: false }).eq('id', ilha!.id);
    expect(erroRename).toBeNull();

    // 5. Apagar — a tela apaga o fluxo antes da estação.
    await dono.from('kds_workflows').delete().eq('id', fluxo!.id);
    const { error: erroDelete } = await dono.from('kds_estacoes').delete().eq('id', ilha!.id);
    expect(erroDelete).toBeNull();

    const { data: sobrou } = await admin.from('kds_estacoes').select('id').eq('id', ilha!.id);
    expect(sobrou).toHaveLength(0);
  });

  it('quem opera OUTRA loja não enxerga nem altera a ilha desta', async () => {
    const { data: ilha } = await admin.from('kds_estacoes').insert({
      loja_id: lojaId, nome: 'Sobremesas', cor: '#EC4899', ativo: true, ordem: 1,
    }).select('id').single();

    // Não lê.
    const { data: lidas } = await intruso.from('kds_estacoes').select('id').eq('id', ilha!.id);
    expect(lidas ?? []).toHaveLength(0);

    // Não altera: sem linha visível, o UPDATE não atinge nada — e o nome
    // continua o original quando lido com service role.
    await intruso.from('kds_estacoes').update({ nome: 'INVADIDA' }).eq('id', ilha!.id);
    const { data: depois } = await admin.from('kds_estacoes').select('nome').eq('id', ilha!.id).single();
    expect(depois!.nome).toBe('Sobremesas');

    // Não apaga.
    await intruso.from('kds_estacoes').delete().eq('id', ilha!.id);
    const { data: aindaExiste } = await admin.from('kds_estacoes').select('id').eq('id', ilha!.id);
    expect(aindaExiste).toHaveLength(1);

    await admin.from('kds_estacoes').delete().eq('id', ilha!.id);
  });

  it('a ilha aceita quantas etapas a cozinha precisar — não são só três', async () => {
    const { data: ilha } = await dono.from('kds_estacoes').insert({
      loja_id: lojaId, nome: 'Confeitaria', cor: '#EAB308', ativo: true, ordem: 2,
    }).select('id').single();

    const seis = Array.from({ length: 6 }, (_, i) => ({
      id: `etapa-${i}`, nome: `Etapa ${i + 1}`, ordem: i,
    }));
    const { data: fluxo, error } = await dono.from('kds_workflows').insert({
      loja_id: lojaId, estacao_id: ilha!.id, nome: 'Fluxo Confeitaria', etapas: seis,
    }).select('etapas').single();

    expect(error).toBeNull();
    expect(fluxo!.etapas).toHaveLength(6);

    await dono.from('kds_workflows').delete().eq('estacao_id', ilha!.id);
    await dono.from('kds_estacoes').delete().eq('id', ilha!.id);
  });
});
