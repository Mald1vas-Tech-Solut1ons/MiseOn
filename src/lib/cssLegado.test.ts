import { describe, it, expect } from 'vitest';
// @ts-expect-error — script de build em .mjs, sem tipos; é o alvo do teste.
import { lerCor, escreverCor, resolverColorMix, converterFuncoesDeCor, desembrulharLayers, rebaixar } from '../../scripts/css-legado.mjs';

/**
 * O rebaixador de CSS para navegador antigo (scripts/css-legado.mjs).
 *
 * A conversão de cor é o coração disto: se a matemática errar, o site abre
 * com as cores trocadas em quem já estava com o pior aparelho. Por isso os
 * casos abaixo usam valores que dá para conferir por fora — são cores do
 * tema padrão do Tailwind v4, com o hexadecimal que a documentação publica.
 */

const hex = (css: string) => escreverCor(lerCor(css));

describe('leitura e escrita de cor', () => {
  it('converte oklch para o hexadecimal conhecido do Tailwind', () => {
    expect(hex('oklch(0.708 0 0)')).toBe('#a1a1a1');        // neutral-400
    expect(hex('oklch(62.3% 0.214 259.815)')).toBe('#2b7fff'); // blue-500
  });

  it('converte oklch com alpha para rgba', () => {
    expect(hex('oklch(0.708 0 0 / 0.5)')).toBe('rgba(161,161,161,0.5)');
  });

  it('lê hexadecimal em 3, 6 e 8 dígitos', () => {
    expect(lerCor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(lerCor('#004198')).toEqual({ r: 0, g: 65, b: 152, a: 1 });
    expect(lerCor('#00419880')).toMatchObject({ r: 0, g: 65, b: 152 });
  });

  it('lê rgb e rgba', () => {
    expect(lerCor('rgb(10, 92, 196)')).toEqual({ r: 10, g: 92, b: 196, a: 1 });
    expect(lerCor('rgba(10, 92, 196, 0.4)')).toEqual({ r: 10, g: 92, b: 196, a: 0.4 });
  });

  it('desiste do que só existe em tempo de execução', () => {
    // Chutar um valor aqui seria pintar a tela com número que ninguém mediu.
    expect(lerCor('var(--cor-primaria)')).toBeNull();
    expect(lerCor('currentColor')).toBeNull();
    expect(lerCor('color-mix(in srgb, var(--x) 10%, transparent)')).toBeNull();
  });
});

describe('color-mix()', () => {
  it('resolve mistura de cores estáticas', () => {
    expect(resolverColorMix('a{color:color-mix(in srgb,#ffffff 50%,#000000)}').css)
      .toBe('a{color:#808080}');
  });

  it('trata mistura com transparent como opacidade', () => {
    expect(resolverColorMix('a{color:color-mix(in srgb,#ff0000 20%,transparent)}').css)
      .toBe('a{color:rgba(255,0,0,0.2)}');
  });

  it('completa o peso que falta', () => {
    expect(resolverColorMix('a{color:color-mix(in srgb,#ffffff 25%,#000000)}').css)
      .toBe('a{color:#404040}');
  });

  it('preserva intocado o que depende de var()', () => {
    const entrada = 'a{background:color-mix(in srgb,var(--cor-primaria) 14%,transparent)}';
    const { css, resolvidos, preservados } = resolverColorMix(entrada);
    expect(css).toBe(entrada);
    expect(resolvidos).toBe(0);
    expect(preservados).toBe(1);
  });
});

describe('desembrulho de @layer', () => {
  it('tira o embrulho e mantém a ordem do código', () => {
    const { css, desembrulhados } = desembrulharLayers(
      '@layer base{a{color:red}}@layer utilities{b{color:blue}}',
    );
    expect(css).toBe('a{color:red}b{color:blue}');
    expect(desembrulhados).toBe(2);
  });

  it('remove a declaração de ordem, que não tem bloco', () => {
    expect(desembrulharLayers('@layer components;a{color:red}').css).toBe('a{color:red}');
  });

  it('respeita chaves aninhadas dentro da camada', () => {
    const { css } = desembrulharLayers('@layer base{@media (min-width:40px){a{color:red}}}');
    expect(css).toBe('@media (min-width:40px){a{color:red}}');
  });

  it('não mexe em CSS sem camada', () => {
    expect(desembrulharLayers('a{color:red}').css).toBe('a{color:red}');
  });
});

describe('rebaixamento completo', () => {
  it('não deixa passar nada que o Chrome 92 descartaria em bloco', () => {
    const { css } = rebaixar(
      '@layer theme{:root{--c:oklch(0.708 0 0)}}'
      + '@layer utilities{.x{color:oklch(62.3% 0.214 259.815);background:color-mix(in srgb,#ffffff 50%,#000000)}}',
    );

    expect(css).not.toContain('@layer');
    expect(css).not.toContain('oklch(');
    expect(css).toContain('#a1a1a1');
    expect(css).toContain('#2b7fff');
    expect(css).toContain('#808080');
  });

  it('converte oklab e lab soltos', () => {
    const { convertidos } = converterFuncoesDeCor('a{color:oklab(0.5 0.1 0.1)}b{color:lab(50% 20 30)}');
    expect(convertidos).toBe(2);
  });
});
