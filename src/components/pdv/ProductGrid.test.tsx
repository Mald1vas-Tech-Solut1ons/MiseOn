// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProductGrid } from './ProductGrid';

vi.mock('../../contexts/I18nContext', () => ({
  useI18n: () => ({ tDynamic: (texto: string) => texto }),
}));

vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
});

afterEach(cleanup);

const base = {
  busca: '',
  setBusca: vi.fn(),
  categorias: [],
  catAtiva: 'TODAS',
  setCatAtiva: vi.fn(),
  produtosVisiveis: [],
  tocarProduto: vi.fn(),
};

describe('ProductGrid', () => {
  it('distingue falha de consulta de um catálogo realmente vazio', () => {
    render(<ProductGrid {...base} carregando={false} erro="Falha ao consultar produtos." />);

    expect(screen.getByRole('alert').textContent).toContain('O catálogo do PDV não pôde ser carregado');
    expect(screen.queryByText('Nenhum produto encontrado para esta categoria ou busca.')).toBeNull();
  });

  it('permite repetir a consulta depois de uma falha', () => {
    const tentarNovamente = vi.fn();
    render(<ProductGrid {...base} carregando={false} erro="Rede indisponível." onTentarNovamente={tentarNovamente} />);

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(tentarNovamente).toHaveBeenCalledTimes(1);
  });

  it('mostra estado vazio somente quando a consulta terminou sem erro', () => {
    render(<ProductGrid {...base} carregando={false} erro={undefined} />);

    expect(screen.getByText('Nenhum produto encontrado para esta categoria ou busca.')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
