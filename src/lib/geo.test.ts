import { describe, expect, it } from 'vitest';
import { calcularEntrega } from './geo';

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
