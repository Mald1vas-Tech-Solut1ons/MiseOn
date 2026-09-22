import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * A cortina de navegador antigo do index.html.
 *
 * Em 22/09/2026 um totem H2150B recém-aberto mostrou a home como HTML cru na
 * frente de um parceiro comercial. Não era cache: o CSS do Tailwind v4 usa
 * color-mix() e oklch() em toda cor, e num navegador anterior ao Chrome 111 a
 * folha inteira é descartada.
 *
 * Estes testes prendem a cortina no lugar. O que eles protegem não é o texto
 * do aviso — é a condição do @supports continuar apontando para as MESMAS
 * funções que o bundle publicado exige, e a cortina continuar fora do #root,
 * onde o prerender não a alcança.
 */

const RAIZ = process.cwd();
const html = readFileSync(path.join(RAIZ, 'index.html'), 'utf-8');

describe('cortina de navegador incompatível', () => {
  it('existe no index.html', () => {
    expect(html).toContain('id="navegador-incompativel"');
  });

  it('só desaparece para quem entende oklch() e color-mix()', () => {
    const gate = html.match(/@supports\s*\(([^{]+)\)\s*\{\s*#navegador-incompativel\s*\{\s*display:\s*none/);
    expect(gate, 'o @supports que esconde a cortina sumiu ou mudou de forma').not.toBeNull();

    const condicao = gate![1];
    expect(condicao).toContain('oklch(');
    expect(condicao).toContain('color-mix(');
  });

  it('fica fora do #root, que o prerender reescreve', () => {
    // scripts/prerender.mjs troca o conteúdo de <div id="root">…</div> em cada
    // rota e o esvazia no app.html. Dentro dele, a cortina não sobreviveria.
    const fimDoRoot = html.indexOf('</div>', html.indexOf('<div id="root">'));
    const posicaoDaCortina = html.indexOf('id="navegador-incompativel"');

    expect(posicaoDaCortina).toBeGreaterThan(fimDoRoot);
  });

  it('é desenhada sem depender do CSS do app nem de JavaScript', () => {
    // O ponto da cortina é aparecer exatamente onde o resto falha: se ela
    // usasse classe do Tailwind, morreria junto; se dependesse do bundle,
    // nunca rodaria, porque o JS também não é interpretado.
    const inicio = html.indexOf('<div id="navegador-incompativel">');
    const bloco = html.slice(inicio, html.indexOf('<script', inicio));
    expect(bloco).not.toContain('className');
    expect(bloco).not.toContain('<script');
  });
});

describe('resgate do navegador antigo', () => {
  it('pede a folha legada pelo caminho que o build substitui', () => {
    // scripts/css-legado.mjs troca este texto pelo arquivo com hash em todo
    // HTML de dist/ — e quebra o build se não achar nenhum.
    expect(html).toContain("folha.href = '/css-legado.css'");
  });

  it('só levanta a cortina se a folha virou regra de verdade', () => {
    // O rewrite "/(.*)" → "/app" do vercel.json devolve HTML com status 200
    // para arquivo inexistente, e o link dispara onload assim mesmo. Sem esta
    // conferência, navegador antigo ficava sem estilo E sem aviso.
    const script = html.slice(html.indexOf('folha.onload'), html.indexOf('</script>', html.indexOf('folha.onload')));
    expect(script).toContain('folha.sheet');
    expect(script).toContain('cssRules.length');
    expect(script).toMatch(/if\s*\(!virouCss\)\s*return/);
  });

  it('cobre as duas APIs que faltam no Chrome 92', () => {
    // Medidas no bundle publicado: Object.hasOwn (6 usos, Chrome 93) e
    // structuredClone (1 uso, Chrome 98).
    expect(html).toContain('Object.hasOwn');
    expect(html).toContain('structuredClone');
  });

  it('roda antes do bundle, em script clássico', () => {
    // Script de módulo é adiado; este precisa aplicar os polyfills antes.
    const posResgate = html.indexOf('Object.hasOwn');
    const posBundle = html.indexOf('<script type="module"');
    expect(posResgate).toBeGreaterThan(-1);
    expect(posResgate).toBeLessThan(posBundle);
  });
});

describe('o piso do @supports corresponde ao CSS publicado', () => {
  const dir = path.join(RAIZ, 'dist', 'assets');
  const cssPrincipal = existsSync(dir)
    ? readdirSync(dir).find((f) => /^index-.*\.css$/.test(f))
    : undefined;

  it.skipIf(!cssPrincipal)('o bundle realmente usa as funções que a cortina testa', () => {
    const css = readFileSync(path.join(dir, cssPrincipal!), 'utf-8');

    // Se um dia o CSS deixar de exigir isto, a cortina passa a barrar
    // navegador que conseguiria abrir o site — e é este teste que avisa.
    expect(css).toContain('color-mix(');
    expect(css).toContain('oklch(');
  });
});
