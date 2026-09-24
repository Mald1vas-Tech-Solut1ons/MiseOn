import { describe, it, expect } from 'vitest';
import { pareceMesmaRua, haversineKm, numeroNormalizado, chaveEndereco } from './entrega';

// Photon (geocodificador que substituiu o Nominatim em 24/09/2026, depois
// deste bloquear com 403 toda chamada vinda da rede da Supabase) "chuta" uma
// rua parecida em outra cidade quando não acha a rua exata no OSM. Este caso
// real apareceu em produção: "Rua Pedreira do Roque" (Vila Corberi, São
// Paulo) devolveu "Rua Roque Cordeiro" (bairro Pedreira, também São Paulo,
// mas a 272 km) — as duas têm "Roque" no nome, por coincidência.
describe('pareceMesmaRua', () => {
  it('rejeita rua parecida por uma palavra só coincidir (caso real de 272 km de erro)', () => {
    expect(pareceMesmaRua('Rua Pedreira do Roque', 'Rua Roque Cordeiro')).toBe(false);
  });

  it('rejeita rua completamente diferente', () => {
    expect(pareceMesmaRua('Rua Pedreira do Roque', 'Rua José Veríssimo da Costa Pereira')).toBe(false);
  });

  it('aceita a mesma rua, com ou sem acento', () => {
    expect(pareceMesmaRua('Estrada Velha de Bonsucesso', 'Estrada Velha de Bonsucesso')).toBe(true);
    expect(pareceMesmaRua('Avenida Sapopemba', 'avenida sapopemba')).toBe(true);
  });

  it('tolera abreviação de um termo curto quando o resto bate', () => {
    expect(pareceMesmaRua('Rua Cel. Antonio Silva', 'Rua Coronel Antonio Silva')).toBe(true);
  });

  it('rejeita quando falta a maioria das palavras significativas', () => {
    expect(pareceMesmaRua('Avenida Sapopemba', 'Avenida Tiradentes')).toBe(false);
  });

  it('sem nome devolvido, rejeita', () => {
    expect(pareceMesmaRua('Rua Gabriel Vasconcelos', '')).toBe(false);
  });
});

describe('haversineKm', () => {
  it('mede ~0 para o mesmo ponto', () => {
    expect(haversineKm({ lat: -23.45, lng: -46.55 }, { lat: -23.45, lng: -46.55 })).toBeCloseTo(0, 3);
  });

  it('mede a distância aproximada entre loja e o CEP-fallback errado que causou a investigação', () => {
    // lanchepaulista (Guarulhos) até o ponto que a BrasilAPI devolvia para
    // qualquer CEP da cidade — usado para confirmar que a rota real batia.
    const km = haversineKm({ lat: -23.4488726, lng: -46.55428 }, { lat: -23.46278, lng: -46.53333 });
    expect(km).toBeGreaterThan(2);
    expect(km).toBeLessThan(4);
  });
});

describe('numeroNormalizado', () => {
  it('marca SN quando não há número', () => {
    expect(numeroNormalizado({ sem_numero: true })).toBe('SN');
    expect(numeroNormalizado({ numero: '' })).toBe('SN');
  });

  it('mantém o número informado', () => {
    expect(numeroNormalizado({ numero: '265' })).toBe('265');
  });
});

describe('chaveEndereco', () => {
  it('é estável para variação de maiúsculas e espaço', () => {
    const a = chaveEndereco({ cep: '07160-470', logradouro: 'Estrada Velha de Bonsucesso', numero: '120', cidade: 'Guarulhos', uf: 'SP' });
    const b = chaveEndereco({ cep: '07160470', logradouro: '  estrada velha de bonsucesso  ', numero: '120', cidade: 'GUARULHOS', uf: 'sp' });
    expect(a).toBe(b);
  });
});
