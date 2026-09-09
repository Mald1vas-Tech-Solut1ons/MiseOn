import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ler = (arquivo: string) => readFileSync(new URL(`../supabase/migrations/${arquivo}`, import.meta.url), 'utf8');

describe('seed profissional de tomate', () => {
  for (const arquivo of [
    '20260903100000_seed_por_segmento.sql',
    '20260903110000_seed_por_segmento_completo.sql',
  ]) {
    it(`${arquivo} armazena tomate em unidade física`, () => {
      const sql = ler(arquivo);
      expect(sql).not.toMatch(/\('Tomate',\s*'fatias'/);
      expect(sql).toMatch(/\('Tomate',\s*'kg'/);
    });
  }

  it('não interpreta duas fatias como dois quilos na ficha inicial', () => {
    const sql = ler('20260903110000_seed_por_segmento_completo.sql');
    expect(sql).not.toContain("('X-Salada','Tomate',2)");
    expect(sql).toContain("('X-Salada','Tomate',0.040)");
  });

  it('migração só corrige automaticamente item sem histórico operacional', () => {
    const sql = ler('20260909210000_tomate_unidade_fisica_no_seed.sql');
    expect(sql).toContain('public.movimentacoes_estoque');
    expect(sql).toContain('public.lotes_estoque');
    expect(sql).toContain('public.fatores_conversao');
    expect(sql).toContain("set quantidade_consumida = 0.040");
  });
});
