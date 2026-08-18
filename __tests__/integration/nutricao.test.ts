/**
 * MiseOn — Golden tests do motor de cálculo nutricional (NUT-07)
 *
 * Cobertura exigida pelo docs/PLANO-NUTRICIONAL.md §9 (NUT-07) e §10:
 *  ✅ Preparo aninhado 3 níveis normaliza pelo rendimento (produto→molho→massa→farinha)
 *  ✅ Ciclo na ficha não derruba o cálculo — status SEM_DADOS com erro identificado
 *  ✅ Unidade 'un' sem peso médio não vira regra de três
 *  ✅ Unidade 'L' sem densidade não vira regra de três
 *  ✅ Insumo sem nenhum cadastro nutricional entra em insumos_faltantes
 *  ✅ fn_simular_nutricao (lenient) inclui dado não revisado; o canônico não
 *
 * Cada teste cria seus próprios insumos com nome prefixado "[TESTE NUT]" e
 * limpa tudo no afterAll — ao contrário do ledger.test.ts, resíduo aqui
 * apareceria na tela de Estoque do lojista, então não fica para trás.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

let db: SupabaseClient;
let lojaId: string;
const insumosCriados: string[] = [];
const produtosCriados: string[] = [];

const isConfigured = Boolean(SUPABASE_URL && SERVICE_KEY);

beforeAll(async () => {
  if (!isConfigured) return;
  db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: loja, error } = await db.from('lojas').select('id').limit(1).single();
  if (error || !loja) throw new Error('Nenhuma loja encontrada para rodar os testes.');
  lojaId = loja.id;
});

afterAll(async () => {
  if (!isConfigured) return;
  if (produtosCriados.length) await db.from('produtos').delete().in('id', produtosCriados);
  if (insumosCriados.length) await db.from('insumos').delete().in('id', insumosCriados);
});

// Sufixo aleatório: "Tomate", "Queijo" etc. já existem no catálogo real da
// loja de teste — sem isso, uq_insumos_loja_nome_ativo rejeita a inserção.
const sufixoTeste = () => Math.random().toString(36).slice(2, 8);

async function criarInsumo(overrides: Record<string, unknown>) {
  const { data, error } = await db
    .from('insumos')
    .insert({
      loja_id: lojaId,
      unidade_medida: 'g',
      ativo: true,
      ...overrides,
      nome: `[TESTE NUT ${sufixoTeste()}] ${overrides.nome ?? 'insumo'}`,
    })
    .select('id')
    .single();
  if (error) throw new Error(`Erro ao criar insumo de teste: ${error.message}`);
  insumosCriados.push(data.id);
  return data.id as string;
}

async function criarNutricao(insumoId: string, overrides: Record<string, unknown>) {
  const { error } = await db.from('insumos_nutricao').insert({
    insumo_id: insumoId,
    loja_id: lojaId,
    origem: 'MANUAL',
    revisado: true,
    ...overrides,
  });
  if (error) throw new Error(`Erro ao criar nutrição de teste: ${error.message}`);
}

async function criarFichaPreparo(preparoId: string, insumoId: string, quantidade: number) {
  const { error } = await db
    .from('fichas_preparos')
    .insert({ loja_id: lojaId, preparo_id: preparoId, insumo_id: insumoId, quantidade });
  if (error) throw new Error(`Erro ao criar ficha_preparo: ${error.message}`);
}

async function calcular(linhas: Array<{ insumo_id: string; quantidade: number }>, incluirNaoRevisado = false) {
  const { data, error } = await db.rpc(
    incluirNaoRevisado ? 'fn_simular_nutricao' : 'fn_calcular_nutricao_receita',
    incluirNaoRevisado
      ? { p_linhas: linhas, p_loja_id: lojaId }
      : { p_linhas: linhas, p_loja_id: lojaId, p_incluir_nao_revisado: false },
  );
  if (error) throw new Error(`Erro na RPC: ${error.message}`);
  return data as {
    status: string;
    erro?: string;
    nutrientes: Record<string, number>;
    massa_g: number;
    cobertura_pct: number;
    insumos_faltantes: Array<{ insumo_id: string; nome: string; motivo: string }>;
  };
}

describe.runIf(isConfigured)('Motor de cálculo nutricional — NUT-05/06/07', () => {
  describe('Preparo aninhado em 3 níveis', () => {
    it('normaliza cada nível pelo próprio rendimento (produto → molho → massa → farinha)', async () => {
      // Muitos inserts sequenciais de setup (rede real, não banco local) —
      // o timeout padrão de 5s do vitest é curto demais para esta cadeia.
      const farinha = await criarInsumo({ nome: 'Farinha', unidade_medida: 'g' });
      await criarNutricao(farinha, { nutrientes: { ENERGIA_KCAL: 364, PROTEINAS: 10 } });

      const tomate = await criarInsumo({ nome: 'Tomate', unidade_medida: 'g' });
      await criarNutricao(tomate, { nutrientes: { ENERGIA_KCAL: 20, PROTEINAS: 1 } });

      const azeite = await criarInsumo({ nome: 'Azeite', unidade_medida: 'ml' });
      await criarNutricao(azeite, { base_unidade: 'ml', nutrientes: { ENERGIA_KCAL: 884, GORDURAS_TOTAIS: 100 } });

      // Nível 3 (mais fundo): preparo "Massa" consome só farinha, 1:1.
      const massa = await criarInsumo({
        nome: 'Massa', unidade_medida: 'g', is_preparo: true, rendimento_padrao_kg: 1000,
      });
      await criarFichaPreparo(massa, farinha, 1000);

      // Nível 2: preparo "Molho" consome tomate + azeite + a Massa (preparo dentro de preparo).
      const molho = await criarInsumo({
        nome: 'Molho', unidade_medida: 'g', is_preparo: true, rendimento_padrao_kg: 2000,
      });
      await criarFichaPreparo(molho, tomate, 1500);
      await criarFichaPreparo(molho, azeite, 100);
      await criarFichaPreparo(molho, massa, 500);

      // Nível 1: produto consome 250g do Molho — exatamente o exemplo do PLANO §10.
      const resultado = await calcular([{ insumo_id: molho, quantidade: 250 }]);

      expect(resultado.status).toBe('COMPLETO');
      expect(resultado.massa_g).toBeCloseTo(262.5, 1); // 187.5 tomate + 12.5 azeite + 62.5 massa
      expect(resultado.cobertura_pct).toBe(100);
      expect(resultado.nutrientes.ENERGIA_KCAL).toBeCloseTo(375.5, 1);
      expect(resultado.nutrientes.PROTEINAS).toBeCloseTo(8.125, 2);
      expect(resultado.nutrientes.GORDURAS_TOTAIS).toBeCloseTo(12.5, 1);
    }, 20000);
  });

  describe('Ciclo na ficha', () => {
    it('não derruba o cálculo — encerra com status SEM_DADOS e erro identificado', async () => {
      const a = await criarInsumo({ nome: 'Preparo A', unidade_medida: 'g', is_preparo: true, rendimento_padrao_kg: 100 });
      const b = await criarInsumo({ nome: 'Preparo B', unidade_medida: 'g', is_preparo: true, rendimento_padrao_kg: 100 });
      await criarFichaPreparo(a, b, 50);
      await criarFichaPreparo(b, a, 50); // A consome B consome A

      const resultado = await calcular([{ insumo_id: a, quantidade: 10 }]);

      expect(resultado.status).toBe('SEM_DADOS');
      expect(resultado.erro).toBe('ciclo_detectado');
    });
  });

  describe('Unidade sem massa universal', () => {
    it('"un" sem peso médio entra em insumos_faltantes com o motivo — nenhuma massa inventada', async () => {
      const ovo = await criarInsumo({ nome: 'Ovo', unidade_medida: 'un' });
      await criarNutricao(ovo, { nutrientes: { ENERGIA_KCAL: 70 } }); // sem peso_medio_un_g

      const resultado = await calcular([{ insumo_id: ovo, quantidade: 3 }]);

      expect(resultado.status).toBe('SEM_DADOS'); // único insumo, sem massa calculável
      expect(resultado.massa_g).toBe(0);
      expect(resultado.insumos_faltantes).toHaveLength(1);
      expect(resultado.insumos_faltantes[0].motivo).toBe('peso médio não informado');
    });

    it('"L" sem densidade (quando a nutrição está em massa) também não vira regra de três', async () => {
      const leite = await criarInsumo({ nome: 'Leite', unidade_medida: 'L' });
      await criarNutricao(leite, { base_unidade: 'g', nutrientes: { ENERGIA_KCAL: 61 } }); // sem densidade_g_ml

      const resultado = await calcular([{ insumo_id: leite, quantidade: 0.5 }]);

      expect(resultado.status).toBe('SEM_DADOS');
      expect(resultado.insumos_faltantes[0].motivo).toContain('densidade não informada');
    });
  });

  describe('Insumo sem nenhum cadastro nutricional', () => {
    it('entra em insumos_faltantes com "sem dado nutricional"', async () => {
      const desconhecido = await criarInsumo({ nome: 'Sem Cadastro', unidade_medida: 'g' });

      const resultado = await calcular([{ insumo_id: desconhecido, quantidade: 100 }]);

      // Massa é conhecida (100 g, unidade dimensional) — o que falta é nutrição,
      // não massa. Por isso PARCIAL (cobertura 0%), não SEM_DADOS: esse status
      // é reservado para quando a MASSA em si é indeterminável (ciclo, sem ponte).
      expect(resultado.status).toBe('PARCIAL');
      expect(resultado.cobertura_pct).toBe(0);
      expect(resultado.insumos_faltantes[0].motivo).toBe('sem dado nutricional');
    });
  });

  describe('ADR-02 — revisão obrigatória para publicar', () => {
    it('fn_simular_nutricao (lenient) inclui dado não revisado; o canônico exclui', async () => {
      const naoRevisado = await criarInsumo({ nome: 'Nao Revisado', unidade_medida: 'g' });
      await criarNutricao(naoRevisado, { revisado: false, nutrientes: { ENERGIA_KCAL: 50 } });

      const preview = await calcular([{ insumo_id: naoRevisado, quantidade: 100 }], true);
      expect(preview.status).toBe('COMPLETO');
      expect(preview.nutrientes.ENERGIA_KCAL).toBeCloseTo(50, 4);

      const canonico = await calcular([{ insumo_id: naoRevisado, quantidade: 100 }], false);
      expect(canonico.status).toBe('PARCIAL'); // massa conhecida, cobertura 0% — não SEM_DADOS
      expect(canonico.cobertura_pct).toBe(0);
      expect(canonico.insumos_faltantes[0].motivo).toBe('aguardando revisão');
    });
  });

  describe('fn_recalcular_nutricao_produto — integração de ponta a ponta', () => {
    it('lê a ficha técnica salva do produto e retorna o mesmo resultado do motor', async () => {
      const queijo = await criarInsumo({ nome: 'Queijo', unidade_medida: 'g' });
      await criarNutricao(queijo, { nutrientes: { ENERGIA_KCAL: 300, PROTEINAS: 25 } });

      const { data: produto, error: erroProduto } = await db
        .from('produtos')
        .insert({
          loja_id: lojaId,
          nome: '[TESTE NUT] Produto com Queijo',
          preco: 10,
          categoria_id: null,
        })
        .select('id')
        .single();
      if (erroProduto) throw new Error(erroProduto.message);
      produtosCriados.push(produto.id);

      const { error: erroFicha } = await db
        .from('fichas_tecnicas')
        .insert({ produto_id: produto.id, insumo_id: queijo, quantidade_consumida: 50 });
      if (erroFicha) throw new Error(erroFicha.message);

      const { data, error } = await db.rpc('fn_recalcular_nutricao_produto', { p_produto_id: produto.id });
      if (error) throw new Error(error.message);

      expect(data.status).toBe('COMPLETO');
      expect(data.nutrientes.ENERGIA_KCAL).toBeCloseTo(150, 4); // 50g de 300kcal/100g
      expect(data.nutrientes.PROTEINAS).toBeCloseTo(12.5, 4);
    });
  });
});
