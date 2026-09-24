import { describe, expect, it } from 'vitest';
import { calcularEntrega, resumoEntrega } from './geo';

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
