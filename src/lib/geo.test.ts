import { describe, expect, it } from 'vitest';
import { aplicarRegraEntrega, calcularEntrega, resumoEntrega } from './geo';

const loja = {
  lat: -23.5505,
  lng: -46.6333,
  entrega_modo: 'DISTANCIA',
  entrega_taxa_base: 5,
  entrega_taxa_km: 1,
  entrega_raio_km: 10,
  frete_gratis_valor_minimo: 30,
};

describe('calcularEntrega', () => {
  it('calcula pela localização e preserva frete grátis como política comercial', async () => {
    const entrega = await calcularEntrega(loja, {
      geoCliente: { lat: -23.5685, lng: -46.6333 },
      subtotal: 35,
    });

    expect(entrega.origem).toBe('DISTANCIA');
    expect(entrega.distanciaKm).toBeCloseTo(2, 1);
    expect(entrega.taxa).toBe(0);
    expect(entrega.freteGratis).toBe(true);
  });

  it('não troca uma falha de localização por uma taxa de bairro', async () => {
    const entrega = await calcularEntrega(
      { ...loja, lat: null, lng: null },
      { subtotal: 10 },
    );

    expect(entrega.origem).toBe('CONFIGURACAO_PENDENTE');
    expect(entrega.taxa).toBe(0);
  });
});

describe('resumoEntrega: a vitrine anuncia o que o checkout cobra', () => {
  it('por km anuncia o valor base, não "grátis"', () => {
    expect(resumoEntrega(loja)).toEqual({ tipo: 'A_PARTIR_DE', valor: 5 });
  });

  it('sem localização da loja não anuncia entrega', () => {
    expect(resumoEntrega({ ...loja, lat: null, lng: null })).toEqual({ tipo: 'INDISPONIVEL' });
  });

  it('só é grátis quando a regra dá zero de verdade', () => {
    expect(resumoEntrega({ ...loja, entrega_taxa_base: 0, entrega_taxa_km: 0 })).toEqual({ tipo: 'GRATIS' });
  });

  it('faixas: menor valor, medido no início de cada faixa', () => {
    const faixas = [
      { km_ate: 5, taxa_fixa: 9 },
      { km_ate: 2, taxa_fixa: 6 },
      { km_ate: 8, taxa_fixa: null, taxa_por_km: 2 },
    ];
    expect(resumoEntrega({ ...loja, entrega_modo: 'HIBRIDO' }, faixas)).toEqual({ tipo: 'A_PARTIR_DE', valor: 6 });
  });

  it('faixas sem faixa ativa: não anuncia entrega (o servidor recusa)', () => {
    expect(resumoEntrega({ ...loja, entrega_modo: 'HIBRIDO' }, [])).toEqual({ tipo: 'INDISPONIVEL' });
  });

  it('taxa única anuncia o valor único', () => {
    expect(resumoEntrega({ ...loja, entrega_modo: 'FIXA', entrega_taxa_base: 7 })).toEqual({ tipo: 'A_PARTIR_DE', valor: 7 });
  });

  it('faixa inativa não entra na conta', () => {
    const faixas = [{ km_ate: 2, taxa_fixa: 1, ativo: false }, { km_ate: 5, taxa_fixa: 8 }];
    expect(resumoEntrega({ ...loja, entrega_modo: 'HIBRIDO' }, faixas)).toEqual({ tipo: 'A_PARTIR_DE', valor: 8 });
  });
});

describe('aplicarRegraEntrega: mesmos casos de supabase/tests/entrega_regra_e_cotacao.sql', () => {
  const l = { ...loja, entrega_taxa_base: 5, entrega_taxa_km: 2, entrega_raio_km: 6, frete_gratis_valor_minimo: 0 };
  const faixas = [
    { nome: 'Perto', km_ate: 2, taxa_fixa: 6, pedido_minimo: 0 },
    { nome: 'Médio', km_ate: 4, taxa_fixa: 9, pedido_minimo: 30 },
    { nome: 'Longe', km_ate: 6, taxa_fixa: null, taxa_por_km: 3, pedido_minimo: 0 },
  ];

  it('por km: 5 + 2 × 3 = 11; acima do raio, fora', () => {
    expect(aplicarRegraEntrega({ ...l, entrega_modo: 'DISTANCIA' }, [], 3, 50).taxa).toBe(11);
    expect(aplicarRegraEntrega({ ...l, entrega_modo: 'DISTANCIA' }, [], 7, 50).motivo).toBe('FORA_DA_AREA');
  });

  it('taxa única vale em qualquer distância até o raio', () => {
    expect(aplicarRegraEntrega({ ...l, entrega_modo: 'FIXA' }, [], 5.9, 50).taxa).toBe(5);
  });

  it('faixas: vazias = não configurada; fixa, mínimo, por km e fora', () => {
    const h = { ...l, entrega_modo: 'HIBRIDO' };
    expect(aplicarRegraEntrega(h, [], 1, 50).motivo).toBe('ENTREGA_NAO_CONFIGURADA');
    expect(aplicarRegraEntrega(h, faixas, 1.5, 50).taxa).toBe(6);
    expect(aplicarRegraEntrega(h, faixas, 3, 20).motivo).toBe('ABAIXO_DO_MINIMO_DA_FAIXA');
    expect(aplicarRegraEntrega(h, faixas, 3, 30).taxa).toBe(9);
    expect(aplicarRegraEntrega(h, faixas, 5, 50).taxa).toBe(20);
    expect(aplicarRegraEntrega(h, faixas, 6.5, 50).motivo).toBe('FORA_DA_AREA');
  });

  it('frete grátis zera a taxa; sem localização não entrega', () => {
    const r = aplicarRegraEntrega({ ...l, entrega_modo: 'HIBRIDO', frete_gratis_valor_minimo: 40 }, faixas, 1.5, 45);
    expect(r.taxa).toBe(0);
    expect(r.freteGratis).toBe(true);
    expect(aplicarRegraEntrega({ ...l, lat: null }, faixas, 1, 50).motivo).toBe('ENTREGA_NAO_CONFIGURADA');
  });
});
