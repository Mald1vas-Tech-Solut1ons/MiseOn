// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { FotoProduto } from './fotoProduto';
import { FotoIlustrativaContext } from './fotoIlustrativaContext';
import { obterFotoProduto } from './fotoProdutoUtils';

const renderizar = (ui: React.ReactElement, demonstracao: boolean) =>
  render(<FotoIlustrativaContext.Provider value={demonstracao}>{ui}</FotoIlustrativaContext.Provider>);

describe('foto de produto: ilustrativa só em loja de demonstração', () => {
  it('loja real sem foto mostra espaço reservado, nunca foto de banco de imagens', () => {
    const { container } = renderizar(
      <FotoProduto src="" nome="Baguete de salame 15 cm (lanche do dia)" alt="Baguete" />, false);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-sem-foto="true"]')).not.toBeNull();
  });

  it('sem o contexto, erra para o lado honesto', () => {
    const { container } = render(<FotoProduto src="" nome="X-Bacon" alt="X-Bacon" />);
    expect(container.querySelector('img')).toBeNull();
  });

  it('loja de demonstração sem foto usa a ilustrativa', () => {
    const { container } = renderizar(<FotoProduto src="" nome="X-Bacon" alt="X-Bacon" />, true);
    expect(container.querySelector('img')?.getAttribute('src')).toMatch(/unsplash/);
  });

  it('foto própria sempre vence', () => {
    const { container } = renderizar(
      <FotoProduto src="https://exemplo.com/minha.jpg" nome="X-Bacon" alt="X-Bacon" />, true);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://exemplo.com/minha.jpg');
  });

  it('obterFotoProduto não inventa foto', () => {
    expect(obterFotoProduto({ imagem_url: undefined })).toBe('');
    expect(obterFotoProduto({ imagem_url: '' })).toBe('');
  });
});
