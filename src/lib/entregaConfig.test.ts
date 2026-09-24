import { describe, expect, it } from 'vitest';
import { faixasParaSalvar, validarConfigEntrega, type ConfigEntregaForm, type FaixaEntregaForm } from './entregaConfig';

const base: ConfigEntregaForm = {
  aceita_entrega: true, entrega_modo: 'HIBRIDO',
  entrega_taxa_base: '', entrega_taxa_km: '', entrega_raio_km: '', frete_gratis_valor_minimo: '',
  lat: '-23.59', lng: '-46.52',
};
const faixa = (km: string, taxa: string, extra: Partial<FaixaEntregaForm> = {}): FaixaEntregaForm => ({
  nome: '', km_ate: km, taxa_fixa: taxa, taxa_por_km: '', pedido_minimo: '0', ordem: 1, ativo: true, ...extra,
});

describe('validarConfigEntrega', () => {
  it('loja que não entrega salva sem nada', () => {
    expect(validarConfigEntrega({ ...base, aceita_entrega: false, lat: '', lng: '' }, [])).toBeNull();
  });

  it('entrega exige a loja localizada no mapa', () => {
    expect(validarConfigEntrega({ ...base, lat: '' }, [faixa('2', '6')])).toMatch(/Localize a loja/);
  });

  it('faixas: pelo menos uma, com km e taxa, sem km repetido', () => {
    expect(validarConfigEntrega(base, [])).toMatch(/pelo menos uma faixa/);
    expect(validarConfigEntrega(base, [faixa('2', '')])).toMatch(/Informe a taxa/);
    expect(validarConfigEntrega(base, [faixa('2', '6'), faixa('2', '8')])).toMatch(/mesma distância/);
    expect(validarConfigEntrega(base, [faixa('2', '6'), faixa('4', '9')])).toBeNull();
  });

  it('taxa única e por km exigem raio e o próprio valor', () => {
    expect(validarConfigEntrega({ ...base, entrega_modo: 'FIXA', entrega_taxa_base: '7' }, [])).toMatch(/até quantos km/);
    expect(validarConfigEntrega({ ...base, entrega_modo: 'FIXA', entrega_raio_km: '5' }, [])).toMatch(/taxa única/);
    expect(validarConfigEntrega({ ...base, entrega_modo: 'FIXA', entrega_raio_km: '5', entrega_taxa_base: '7' }, [])).toBeNull();
    expect(validarConfigEntrega({ ...base, entrega_modo: 'DISTANCIA', entrega_raio_km: '8', entrega_taxa_base: '5' }, [])).toMatch(/por km/);
  });

  it('valor negativo não passa', () => {
    expect(validarConfigEntrega({ ...base, entrega_modo: 'FIXA', entrega_raio_km: '5', entrega_taxa_base: '-1' }, [])).toMatch(/negativos/);
  });
});

describe('faixasParaSalvar', () => {
  it('ordena por distância, descarta inativa e vazia, aceita vírgula', () => {
    const r = faixasParaSalvar([
      faixa('4', '9,50'), faixa('', ''), faixa('2', '6'), faixa('6', '12', { ativo: false }),
    ], 'loja');
    expect(r.map((f) => [f.km_ate, f.taxa_fixa, f.ordem])).toEqual([[2, 6, 1], [4, 9.5, 2]]);
  });

  it('taxa fixa preenchida substitui a antiga por km', () => {
    expect(faixasParaSalvar([faixa('3', '8', { taxa_por_km: '2' })], 'l')[0].taxa_por_km).toBeNull();
  });
});
