import { describe, it, expect } from 'vitest';
import { sugerirCompra, type InsumoGiro } from './compras';
import type { Insumo } from '../types';

const insumo = (over: Partial<Insumo> = {}): Insumo => ({
  id: 'i1',
  nome: 'Alho',
  unidade_medida: 'dente',
  quantidade_atual: 0,
  estoque_minimo: 0,
  preco_embalagem: 30,
  qtd_embalagem: 45,
  ativo: true,
  // Compra o quilo, usa o dente: 1 kg rende 45 dentes.
  detalhes_rendimento: {
    regras: [{ de_qtd: 1, de_unidade: 'kg', para_qtd: 45, para_unidade: 'dente' }],
  },
  ...over,
});

const giro = (consumoDiario: number, extra: Partial<InsumoGiro> = {}): InsumoGiro => ({
  insumo_id: 'i1', loja_id: 'l1', nome: 'Alho', unidade_medida: 'dente',
  quantidade_atual: 0, estoque_minimo: 0, consumo_30d: consumoDiario * 30,
  consumo_diario: consumoDiario, dias_cobertura: null, perda_30d: 0,
  custo_unitario: 0.66, capital_parado: 0, ...extra,
});

describe('sugestão de compra', () => {
  it('não sugere nada quando o saldo cobre o período', () => {
    // 200 dentes parados, gasta 5/dia: cobre 40 dias.
    expect(sugerirCompra(insumo({ quantidade_atual: 200 }), giro(5), 7)).toBeNull();
  });

  it('sugere na unidade de COMPRA, não na de uso', () => {
    // Precisa de 7 dias × 10 dentes = 70 dentes; 1 kg rende 45.
    const s = sugerirCompra(insumo({ quantidade_atual: 0 }), giro(10), 7)!;
    expect(s.unidadeCompra).toBe('kg');
    expect(s.fator).toBe(45);
    expect(s.qtdSugerida).toBe(2); // ceil(70/45) — fornecedor não vende meio quilo
  });

  it('o giro real vence o estoque mínimo esquecido no cadastro', () => {
    // Mínimo diz 10, mas o consumo projetado para 7 dias é 140.
    const s = sugerirCompra(insumo({ quantidade_atual: 0, estoque_minimo: 10 }), giro(20), 7)!;
    expect(s.faltaBase).toBe(140);
  });

  it('o mínimo cadastrado funciona como piso quando o giro é baixo', () => {
    // Consumo de 7 dias = 7 dentes, mas o lojista quer nunca ter menos de 100.
    const s = sugerirCompra(insumo({ quantidade_atual: 0, estoque_minimo: 100 }), giro(1), 7)!;
    expect(s.faltaBase).toBe(100);
  });

  it('item sem giro nenhum ainda é reposto pelo mínimo', () => {
    const s = sugerirCompra(insumo({ quantidade_atual: 5, estoque_minimo: 50 }), undefined, 7)!;
    expect(s.faltaBase).toBe(45);
    expect(s.urgencia).toBe('CRITICO');
  });

  it('marca como zerado o que acabou de verdade', () => {
    expect(sugerirCompra(insumo({ quantidade_atual: 0, estoque_minimo: 50 }), undefined, 7)!.urgencia)
      .toBe('ZERADO');
  });

  it('sem mínimo e sem giro, não há o que sugerir', () => {
    expect(sugerirCompra(insumo({ quantidade_atual: 0 }), undefined, 7)).toBeNull();
  });

  it('insumo sem cadeia de rendimento compra na própria unidade de uso', () => {
    const simples = insumo({ unidade_medida: 'un', quantidade_atual: 0, estoque_minimo: 12, detalhes_rendimento: null });
    const s = sugerirCompra(simples, undefined, 7)!;
    expect(s.unidadeCompra).toBe('un');
    expect(s.fator).toBe(1);
    expect(s.qtdSugerida).toBe(12);
  });

  it('cobre mais dias quando se pede para cobrir mais dias', () => {
    const semana = sugerirCompra(insumo(), giro(10), 7)!;
    const mes = sugerirCompra(insumo(), giro(10), 30)!;
    expect(mes.qtdSugerida).toBeGreaterThan(semana.qtdSugerida);
  });
});

describe('prazo de entrega no ponto de pedido', () => {
  it('soma o prazo do fornecedor ao período coberto', () => {
    // 10 dentes/dia, cobrir 7 dias, fornecedor entrega em 3 → 10 dias, não 7.
    const s = sugerirCompra(insumo(), giro(10, { prazo_entrega_dias: 3 }), 7)!;
    expect(s.faltaBase).toBe(100);
    expect(s.prazoEntrega).toBe(3);
  });

  it('fornecedor mais lento faz comprar mais', () => {
    const rapido = sugerirCompra(insumo(), giro(10, { prazo_entrega_dias: 1 }), 7)!;
    const lento = sugerirCompra(insumo(), giro(10, { prazo_entrega_dias: 5 }), 7)!;
    expect(lento.qtdSugerida).toBeGreaterThan(rapido.qtdSugerida);
  });

  it('avisa quando o estoque acaba antes da entrega chegar', () => {
    // Dura 2 dias, fornecedor leva 4: vai faltar mesmo comprando agora.
    const s = sugerirCompra(
      insumo({ quantidade_atual: 20 }),
      giro(10, { prazo_entrega_dias: 4, dias_cobertura: 2 }),
      7,
    )!;
    expect(s.rupturaAntesDaEntrega).toBe(true);
  });

  it('não alarma quando o saldo atravessa o prazo de entrega', () => {
    // Precisa repor (alvo 90 > saldo 50), mas o que tem dura 5 dias e a
    // entrega leva 2: dá tempo de sobra.
    const s = sugerirCompra(
      insumo({ quantidade_atual: 50 }),
      giro(10, { prazo_entrega_dias: 2, dias_cobertura: 5 }),
      7,
    )!;
    expect(s.rupturaAntesDaEntrega).toBe(false);
  });

  it('sem prazo cadastrado, o comportamento é o de antes', () => {
    const s = sugerirCompra(insumo(), giro(10), 7)!;
    expect(s.prazoEntrega).toBe(0);
    expect(s.faltaBase).toBe(70);
    expect(s.rupturaAntesDaEntrega).toBe(false);
  });

  it('carrega o fornecedor para a tela poder agrupar o pedido', () => {
    const s = sugerirCompra(insumo(), giro(10, {
      fornecedor_padrao_id: 'f1', fornecedor_nome: 'Hortifruti do Zé', prazo_entrega_dias: 2,
    }), 7)!;
    expect(s.fornecedorId).toBe('f1');
    expect(s.fornecedorNome).toBe('Hortifruti do Zé');
  });
});
