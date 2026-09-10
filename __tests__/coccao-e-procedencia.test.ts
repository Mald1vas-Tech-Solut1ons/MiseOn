import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  podeEntrarNaFicha, compradoPronto, grupoDoInsumo, GRUPOS_FICHA,
} from '../src/lib/fichaTecnica';
import type { Insumo } from '../src/types';

const item = (over: Partial<Insumo>): Insumo => ({
  id: 'i', loja_id: 'l', nome: 'X', unidade_medida: 'un',
  quantidade_atual: 1, estoque_minimo: 0, preco_embalagem: 1, qtd_embalagem: 1,
  ativo: true, ...over,
} as Insumo);

const ler = (arquivo: string) =>
  readFileSync(new URL(`../supabase/migrations/${arquivo}`, import.meta.url), 'utf8');

describe('procedência do item na ficha', () => {
  it('queijo ralado de saquinho é comprado pronto, não matéria-prima', () => {
    const revenda = item({ nome: 'Queijo ralado saquinho', tipo_item: 'REVENDA' });
    expect(podeEntrarNaFicha(revenda)).toBe(true);
    expect(compradoPronto(revenda)).toBe(true);
    expect(grupoDoInsumo(revenda)?.chave).toBe('REVENDA');
  });

  it('parmesão ralado pela casa é preparo, com custo de produção', () => {
    const preparo = item({ nome: 'Parmesão ralado', is_preparo: true, tipo_item: 'PREPARO' });
    expect(compradoPronto(preparo)).toBe(false);
    expect(grupoDoInsumo(preparo)?.chave).toBe('PREPARO');
  });

  it('sacola é embalagem, e embalagem não é matéria-prima', () => {
    const sacola = item({ nome: 'Sacola', tipo_item: 'EMBALAGEM' });
    // Entra na ficha (compõe o custo do lote), mas no grupo próprio.
    expect(podeEntrarNaFicha(sacola)).toBe(true);
    expect(grupoDoInsumo(sacola)?.chave).toBe('EMBALAGEM');
    expect(grupoDoInsumo(sacola)?.chave).not.toBe('ALIMENTO');
  });

  it('material de limpeza, EPI e manutenção nunca entram', () => {
    for (const tipo of ['LIMPEZA', 'UNIFORME_EPI', 'MANUTENCAO', 'ESCRITORIO', 'ATIVO_IMOBILIZADO', 'OPERACIONAL', 'OUTROS']) {
      expect(podeEntrarNaFicha(item({ tipo_item: tipo }))).toBe(false);
    }
  });

  it('item legado sem tipo_item continua funcionando', () => {
    expect(podeEntrarNaFicha(item({ tipo_item: undefined }))).toBe(true);
    expect(grupoDoInsumo(item({ tipo_item: undefined }))?.chave).toBe('ALIMENTO');
    expect(grupoDoInsumo(item({ tipo_item: undefined, is_preparo: true }))?.chave).toBe('PREPARO');
  });

  it('todo grupo explica ao lojista o que ele significa', () => {
    for (const g of GRUPOS_FICHA) {
      expect(g.ajuda.length).toBeGreaterThan(20);
      expect(g.tipos.length).toBeGreaterThan(0);
    }
  });
});

describe('perda e ganho de cocção', () => {
  const sql = ler('20260909260000_perda_coccao_e_rendimento_real.sql');

  it('cocção pode render MAIS que o que entrou (arroz hidrata)', () => {
    // O teto de 100% da limpeza não vale aqui: 1 kg de arroz cru dá 2,5 kg.
    expect(sql).toMatch(/rendimento_pct > 0 and rendimento_pct <= 9\.9999/);
    expect(sql).toMatch(/\('COZINHAR', 'arroz',\s+2\.5000/);
  });

  it('calor seco perde peso', () => {
    expect(sql).toMatch(/\('ASSAR',\s+'frango',\s+0\.7000/);
    expect(sql).toMatch(/\('GRELHAR',\s+'hamburguer',\s+0\.7500/);
  });

  it('entra no estoque o que foi pesado, não o que a ficha prometia', () => {
    expect(sql).toContain('p_quantidade_real');
    expect(sql).toContain('quantidade_esperada');
    // Estoque fantasma é o risco que essa distinção elimina.
    expect(sql).toContain('estoque fantasma');
  });

  it('rendimento absurdo é erro de digitação, não cocção', () => {
    expect(sql).toMatch(/v_quantidade > v_esperada \* 10/);
  });

  it('o histórico real fica consultável para a tela', () => {
    expect(sql).toContain('fn_rendimento_real_preparo');
    expect(sql).toContain('media_pct');
  });
});

describe('o classificador aprende, com o erro barato', () => {
  const sql = ler('20260909280000_lexico_aprende_com_a_ia.sql');

  it('só categorias que não são matéria-prima podem ser aprendidas', () => {
    expect(sql).toContain('fn_categoria_aprendivel');
    // Comida fora da lista: classificar limpeza como alimento é risco
    // sanitário; o inverso só tira o item da ficha até alguém corrigir.
    const lista = sql.slice(sql.indexOf('fn_categoria_aprendivel'), sql.indexOf('fn_aprender_termo_lexico'));
    expect(lista).toContain("'Limpeza'");
    expect(lista).toContain("'Embalagem'");
    expect(lista).not.toContain("'Hortifrúti'");
    expect(lista).not.toContain("'Carnes'");
  });

  it('termo curto ou com número é recusado', () => {
    expect(sql).toContain('termo_curto');
    expect(sql).toContain('termo_com_numero');
  });

  it('nunca sobrescreve termo que já existe', () => {
    expect(sql).toContain('ja_existe');
  });

  it('o aprendizado é auditável e reversível', () => {
    expect(sql).toContain('vw_lexico_aprendido');
    expect(sql).toContain('aprendido_de');
    expect(sql).toContain('itens_afetados');
  });

  it('falhar o aprendizado não pode derrubar a importação da nota', () => {
    // A função devolve o motivo em vez de lançar.
    expect(sql).toContain("'aprendido', false");
  });
});

describe('embalagem e descartável no léxico', () => {
  const sql = ler('20260909270000_lexico_embalagem_e_descartavel.sql');

  it('sacola é embalagem', () => {
    expect(sql).toMatch(/\('sacola',\s+'Embalagem'/);
  });

  it('canudo e guardanapo são descartáveis', () => {
    expect(sql).toMatch(/\('canudo',\s+'Descartáveis'/);
    expect(sql).toMatch(/\('guardanapo',\s+'Descartáveis'/);
  });

  it('a decisão do lojista continua intocada', () => {
    expect(sql).toContain("classificacao_origem, '') <> 'USUARIO'");
    expect(sql).toContain('classificacao_revisada, false) = false');
  });
});
