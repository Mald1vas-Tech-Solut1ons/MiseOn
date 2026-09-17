// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FerramentaPage from './FerramentaPage';
import FerramentasHub from './FerramentasHub';

vi.mock('../../components/LanguageToggle', () => ({ default: () => null }));
vi.mock('../../components/MiseOnLogo', () => ({ default: () => null }));
vi.mock('../../components/FooterSEO', () => ({ default: () => null }));
vi.mock('../../components/SEO', () => ({ default: () => null }));

afterEach(cleanup);

const preencher = (rotulo: string, valor: string) =>
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });

it('hub lista as três ferramentas com link', () => {
  render(<MemoryRouter><FerramentasHub /></MemoryRouter>);
  expect(document.querySelector('a[href="/ferramentas/calculadora-cmv"]')).not.toBeNull();
  expect(document.querySelector('a[href="/ferramentas/preco-ifood"]')).not.toBeNull();
  expect(document.querySelector('a[href="/ferramentas/markup-preco-de-venda"]')).not.toBeNull();
});

it('CMV do mês aparece quando os quatro campos estão preenchidos', () => {
  render(<MemoryRouter><FerramentaPage slug="calculadora-cmv" /></MemoryRouter>);
  expect(screen.getByText('Preencha os campos para ver o resultado.')).toBeTruthy();
  preencher('Estoque inicial (R$)', '5.000');
  preencher('Compras do período (R$)', '20.000');
  preencher('Estoque final (R$)', '4.000');
  preencher('Faturamento do período (R$)', '60.000');
  expect(screen.getByText('35%')).toBeTruthy();
  // o resultado viaja: botão de compartilhar com o link da página
  const share = document.querySelector('a[href^="https://wa.me/?text="]') as HTMLAnchorElement;
  expect(decodeURIComponent(share.href)).toContain('miseon.app.br/ferramentas/calculadora-cmv');
});

it('preço no iFood usa o plano pré-selecionado e mostra o preço sugerido', () => {
  render(<MemoryRouter><FerramentaPage slug="preco-ifood" /></MemoryRouter>);
  preencher('Preço no balcão (R$)', '100');
  // Plano Entrega: 23% + 3,5% → 100 / 0,735
  expect(screen.getByText(/136,05/)).toBeTruthy();
  expect(screen.getByText(/73,50/)).toBeTruthy();
});

it('markup explica quando a conta não fecha em vez de inventar preço', () => {
  render(<MemoryRouter><FerramentaPage slug="markup-preco-de-venda" /></MemoryRouter>);
  preencher('Custo do produto (R$)', '10');
  preencher('Despesas fixas (% do faturamento)', '50');
  preencher('Despesas variáveis (% da venda)', '30');
  preencher('Lucro desejado (%)', '20');
  expect(screen.getByText(/não existe preço que feche essa conta/)).toBeTruthy();
});
