/** Contrato de segurança do pareamento de TV por código curto. */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { gated } from './gate';

const URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const PUBLIC_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? SERVICE_KEY;
const configured = Boolean(SERVICE_KEY && PUBLIC_KEY);
// Senha do usuario descartavel que a suite cria e apaga. Gerada por execucao:
// literal em repositorio publico e barrado pelo guarda de segredos do repo
// (scripts/verificar-segredos.mjs) — e com razao, mesmo sendo dado de teste.
const password = `Teste-${crypto.randomUUID()}-aA1!`;

let service: SupabaseClient;
let publico: SupabaseClient;
let admin: SupabaseClient;
let lojaId = '';
let slug = '';
let userId = '';
let codigo = '';
let segredo = '';
let sessao = '';

beforeAll(async () => {
  if (!configured) return;
  service = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });
  publico = createClient(URL, PUBLIC_KEY, { auth: { persistSession: false } });

  const { data: loja, error: lojaError } = await service.from('lojas').select('id, slug').limit(1).single();
  if (lojaError || !loja) throw new Error('Banco de teste sem loja disponível.');
  lojaId = loja.id;
  slug = loja.slug;

  const email = `tv-pairing-${Date.now()}@example.test`;
  const { data: criado, error: userError } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (userError || !criado.user) throw new Error(userError?.message ?? 'Falha ao criar admin de teste.');
  userId = criado.user.id;
  const { error: vinculoError } = await service.from('usuarios_loja').insert({ user_id: userId, loja_id: lojaId, papel: 'admin' });
  if (vinculoError) throw new Error(vinculoError.message);

  admin = createClient(URL, PUBLIC_KEY, { auth: { persistSession: false } });
  const { error: loginError } = await admin.auth.signInWithPassword({ email, password });
  if (loginError) throw new Error(loginError.message);
});

afterAll(async () => {
  if (!configured) return;
  if (codigo) await service.from('tv_pareamentos').delete().eq('codigo', codigo);
  if (userId) {
    await service.from('usuarios_loja').delete().eq('user_id', userId).eq('loja_id', lojaId);
    await service.auth.admin.deleteUser(userId);
  }
});

gated(configured, 'Pareamento seguro de TV', () => {
  it('cria código curto sem expor a tabela e exige o segredo do navegador', async () => {
    const { data, error } = await publico.rpc('fn_tv_pareamento_criar');
    expect(error).toBeNull();
    const criado = (data as { codigo: string; segredo: string }[])[0];
    codigo = criado.codigo;
    segredo = criado.segredo;
    expect(codigo).toMatch(/^[23456789A-HJ-NP-Z]{6}$/);
    expect(segredo.length).toBeGreaterThanOrEqual(40);

    const { error: leituraDireta } = await publico.from('tv_pareamentos').select('*');
    expect(leituraDireta).not.toBeNull();

    const { error: segredoErrado } = await publico.rpc('fn_tv_pareamento_consultar', {
      p_codigo: codigo,
      p_segredo: 'segredo-errado',
    });
    expect(segredoErrado).not.toBeNull();
  });

  it('admin autoriza modo e a TV recebe só uma sessão limitada', async () => {
    const { error } = await admin.rpc('fn_tv_pareamento_autorizar', {
      p_loja_id: lojaId,
      p_codigo: codigo,
      p_modo: 'SENHAS',
    });
    expect(error).toBeNull();

    const { data, error: consultaError } = await publico.rpc('fn_tv_pareamento_consultar', {
      p_codigo: codigo,
      p_segredo: segredo,
    });
    expect(consultaError).toBeNull();
    const resposta = (data as { status: string; slug: string; modo: string; sessao_token: string }[])[0];
    expect(resposta).toMatchObject({ status: 'AUTORIZADO', slug, modo: 'SENHAS' });
    expect(resposta.sessao_token).toMatch(/^[0-9a-f-]{36}$/i);
    sessao = resposta.sessao_token;
  });

  it('isola a sessão por loja/slug e permite revogação imediata', async () => {
    const { error: outroSlug } = await publico.rpc('fn_painel_tv_senhas_sessao', {
      p_slug: `outra-${slug}`,
      p_sessao: sessao,
    });
    expect(outroSlug).not.toBeNull();

    const { error: slugCorreto } = await publico.rpc('fn_painel_tv_senhas_sessao', {
      p_slug: slug,
      p_sessao: sessao,
    });
    expect(slugCorreto).toBeNull();

    const { data: revogadas, error: revogarError } = await admin.rpc('fn_tv_sessoes_revogar', { p_loja_id: lojaId });
    expect(revogarError).toBeNull();
    expect(Number(revogadas)).toBeGreaterThanOrEqual(1);

    const { data: aposRevogar, error: consultaError } = await publico.rpc('fn_tv_pareamento_consultar', {
      p_codigo: codigo,
      p_segredo: segredo,
    });
    expect(consultaError).toBeNull();
    expect((aposRevogar as { status: string }[])[0].status).toBe('REVOGADO');
  });
});
