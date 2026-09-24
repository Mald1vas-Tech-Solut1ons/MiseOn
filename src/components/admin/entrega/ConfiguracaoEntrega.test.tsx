// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

vi.mock('../../../lib/supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }));
vi.mock('../../../contexts/I18nContext', () => ({ useI18n: () => ({ tDynamic: (s: string) => s, t: (s: string) => s }) }));
// Leaflet não roda em jsdom; o mapa só aparece com a loja localizada.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="mapa">{children}</div>,
  TileLayer: () => null, Marker: () => null, Circle: () => <i data-testid="circulo" />, useMap: () => ({ fitBounds: () => {} }),
}));

import { ConfiguracaoEntrega } from './ConfiguracaoEntrega';
import type { ConfigEntregaForm, FaixaEntregaForm } from '../../../lib/entregaConfig';

function Montar({ inicial }: { inicial: Partial<ConfigEntregaForm> }) {
  const [config, setConfig] = useState<ConfigEntregaForm>({
    aceita_entrega: true, entrega_modo: 'HIBRIDO', entrega_taxa_base: '', entrega_taxa_km: '',
    entrega_raio_km: '', frete_gratis_valor_minimo: '', lat: '', lng: '', ...inicial,
  });
  const [faixas, setFaixas] = useState<FaixaEntregaForm[]>([]);
  return (
    <ConfiguracaoEntrega
      enderecoLoja="Av. Sapopemba, 7750 - São Paulo"
      config={config}
      onAceitaEntrega={(v) => setConfig((c) => ({ ...c, aceita_entrega: v }))}
      onModo={(m) => setConfig((c) => ({ ...c, entrega_modo: m }))}
      onCampo={(k, v) => setConfig((c) => ({ ...c, [k]: v }))}
      onLocalizacao={(la, ln) => setConfig((c) => ({ ...c, lat: String(la), lng: String(ln) }))}
      faixas={faixas}
      onFaixas={setFaixas}
    />
  );
}

describe('ConfiguracaoEntrega', () => {
  afterEach(cleanup);
  it('loja sem localização avisa que o cardápio não oferece entrega', () => {
    render(<Montar inicial={{}} />);
    expect(screen.getByText(/Loja ainda sem localização/)).toBeTruthy();
    expect(screen.queryByTestId('mapa')).toBeNull();
  });

  it('faixas é o padrão; adicionar faixa desenha o círculo no mapa', () => {
    render(<Montar inicial={{ lat: '-23.59', lng: '-46.52' }} />);
    expect(screen.getByRole('radio', { name: /Por faixas de distância/ }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByText('Adicionar faixa'));
    expect(screen.getAllByLabelText('Até (km)')).toHaveLength(1);
    expect(screen.getAllByTestId('circulo')).toHaveLength(1);
    expect(screen.getByText(/A última faixa é o limite/)).toBeTruthy();
  });

  it('taxa única mostra só taxa e limite em km', () => {
    render(<Montar inicial={{ lat: '-23.59', lng: '-46.52' }} />);
    fireEvent.click(screen.getByRole('radio', { name: /Taxa única/ }));
    expect(screen.getByText('Taxa de entrega (R$)')).toBeTruthy();
    expect(screen.queryByText('Adicionar faixa')).toBeNull();
  });

  it('desligar a entrega esconde a configuração', () => {
    render(<Montar inicial={{ lat: '-23.59', lng: '-46.52' }} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(screen.queryByText(/Como você cobra a entrega/)).toBeNull();
  });
});
