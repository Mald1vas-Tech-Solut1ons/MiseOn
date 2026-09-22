// Gera uma folha de estilo IRMÃ, rebaixada, para navegador antigo — e aponta
// o HTML para ela. Roda depois do prerender.
//
// POR QUE ISTO EXISTE
// Em 22/09/2026, num totem H2150B (Android 11, Chrome 92, sem Google Play
// Services) a home e o Kiosk abriram como HTML cru na frente de um parceiro
// comercial. A causa foi medida, não deduzida: o CSS que o Tailwind v4 gera
// embrulha praticamente tudo em `@layer` (Chrome 99) e pinta em `oklch()` e
// `color-mix()` (Chrome 111). Num navegador anterior a isso, `@layer` é
// at-rule desconhecida — e at-rule desconhecida leva o BLOCO INTEIRO junto.
// A folha não degrada; ela some.
//
// A varredura do bundle publicado mostrou que o estrago é estreito. Só quatro
// recursos barram o Chrome 92:
//
//     @layer         5 blocos     Chrome 99
//     color-mix()    1774 usos    Chrome 111
//     oklch()        159 usos     Chrome 111
//     lab()/oklab()  15 usos      Chrome 111
//
// Todo o resto que o bundle usa já existia: :is(), :where(), @property,
// inset, aspect-ratio, backdrop-filter, max(). Zero :has(), zero @container,
// zero aninhamento nativo. Ou seja: o layout inteiro sobrevive — o que morre
// é embrulho e cor, e os dois são convertíveis por conta.
//
// O QUE ESTE SCRIPT FAZ, E O QUE ELE SE RECUSA A FAZER
// Converte só o que é determinístico: desembrulha os @layer preservando a
// ordem do código (que é a ordem de cascata que o Tailwind já pretendia),
// e resolve as funções de cor cujos operandos são estáticos. O que depende de
// `var()` em tempo de execução — 860 dos 1774 color-mix() — ele NÃO chuta:
// deixa passar. Nesses casos o Chrome 92 descarta a declaração sozinho, uma a
// uma, e o elemento fica sem aquele tom. Perde-se brilho, não se perde tela.
// Inventar uma cor de substituição seria pintar por cima de um número que
// ninguém mediu.
//
// RISCO PARA QUEM JÁ FUNCIONA: NENHUM
// Este arquivo só é baixado por quem reprova no teste de suporte do
// index.html. Navegador moderno nunca pede por ele.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '..', 'dist');
const PLACEHOLDER = '/css-legado.css';

// ─── conversão de cor ──────────────────────────────────────────────────────

const NOMEADAS = {
  transparent: { r: 0, g: 0, b: 0, a: 0 },
  white: { r: 255, g: 255, b: 255, a: 1 },
  black: { r: 0, g: 0, b: 0, a: 1 },
  red: { r: 255, g: 0, b: 0, a: 1 },
};

const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

/** Componente linear-sRGB → sRGB com gama, em byte. */
function gama(c) {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(limitar(v, 0, 1) * 255);
}

/** Oklab → sRGB. Matrizes da especificação CSS Color 4. */
function oklabParaRgb(L, a, b, alpha) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return {
    r: gama(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: gama(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: gama(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    a: alpha,
  };
}

/** CIE Lab (D50) → sRGB, com adaptação de Bradford para D65. */
function labParaRgb(L, A, B, alpha) {
  const fy = (L + 16) / 116;
  const fx = fy + A / 500;
  const fz = fy - B / 200;
  const e = 216 / 24389;
  const k = 24389 / 27;
  const f = (t) => (t ** 3 > e ? t ** 3 : (116 * t - 16) / k);
  // Branco D50 de referência.
  const X = f(fx) * 0.3457 / 0.3585;
  const Y = L > k * e ? ((L + 16) / 116) ** 3 : L / k;
  const Z = f(fz) * (1 - 0.3457 - 0.3585) / 0.3585;

  // Bradford D50 → D65, depois XYZ → sRGB linear.
  const x = 0.9554734 * X - 0.0230985 * Y + 0.0632593 * Z;
  const y = -0.0283697 * X + 1.0099954 * Y + 0.0210413 * Z;
  const z = 0.0123143 * X - 0.0205350 * Y + 1.3304071 * Z;

  return {
    r: gama(3.2409699 * x - 1.5373832 * y - 0.4986108 * z),
    g: gama(-0.9692436 * x + 1.8759675 * y + 0.0415551 * z),
    b: gama(0.0556301 * x - 0.2039770 * y + 1.0569715 * z),
    a: alpha,
  };
}

/** Lê "50% 0.1 250 / 0.5" respeitando barras e espaços. */
function argumentosDeCor(corpo) {
  const [antes, depoisDaBarra] = corpo.split('/');
  const partes = antes.trim().split(/[\s,]+/).filter(Boolean);
  const alpha = depoisDaBarra === undefined
    ? 1
    : depoisDaBarra.trim().endsWith('%')
      ? parseFloat(depoisDaBarra) / 100
      : parseFloat(depoisDaBarra);
  return { partes, alpha: Number.isFinite(alpha) ? alpha : 1 };
}

const comoNumero = (txt, escalaPercentual = 1) =>
  txt.endsWith('%') ? (parseFloat(txt) / 100) * escalaPercentual : parseFloat(txt);

/**
 * Interpreta uma cor CSS estática. Devolve null para qualquer coisa que
 * dependa de tempo de execução (var(), currentColor) — o chamador então
 * desiste da conversão em vez de inventar valor.
 */
export function lerCor(texto) {
  const t = texto.trim().toLowerCase();
  if (!t || t.includes('var(') || t === 'currentcolor') return null;
  if (NOMEADAS[t]) return { ...NOMEADAS[t] };

  const hex = /^#([0-9a-f]{3,8})$/.exec(t);
  if (hex) {
    const h = hex[1];
    const dobrar = (c) => parseInt(c + c, 16);
    if (h.length === 3 || h.length === 4) {
      return {
        r: dobrar(h[0]), g: dobrar(h[1]), b: dobrar(h[2]),
        a: h.length === 4 ? dobrar(h[3]) / 255 : 1,
      };
    }
    if (h.length === 6 || h.length === 8) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
      };
    }
    return null;
  }

  const fn = /^(rgba?|oklch|oklab|lab)\(([^)]*)\)$/.exec(t);
  if (!fn) return null;
  const [, nome, corpo] = fn;
  const { partes, alpha } = argumentosDeCor(corpo);

  if (nome === 'rgb' || nome === 'rgba') {
    const [r, g, b, a] = partes;
    if (r === undefined || g === undefined || b === undefined) return null;
    return {
      r: Math.round(comoNumero(r, 255)),
      g: Math.round(comoNumero(g, 255)),
      b: Math.round(comoNumero(b, 255)),
      a: a === undefined ? alpha : comoNumero(a),
    };
  }

  const [p1, p2, p3] = partes;
  if (p1 === undefined || p2 === undefined || p3 === undefined) return null;

  if (nome === 'oklch') {
    const L = comoNumero(p1);
    const C = parseFloat(p2);
    const H = (parseFloat(p3) * Math.PI) / 180;
    if (![L, C, H].every(Number.isFinite)) return null;
    return oklabParaRgb(L, C * Math.cos(H), C * Math.sin(H), alpha);
  }
  if (nome === 'oklab') {
    const L = comoNumero(p1);
    if (!Number.isFinite(L)) return null;
    return oklabParaRgb(L, parseFloat(p2), parseFloat(p3), alpha);
  }
  // lab(): L vem em 0–100.
  const L = p1.endsWith('%') ? parseFloat(p1) : parseFloat(p1);
  if (!Number.isFinite(L)) return null;
  return labParaRgb(L, parseFloat(p2), parseFloat(p3), alpha);
}

export function escreverCor({ r, g, b, a }) {
  const arredondado = Math.round(a * 1000) / 1000;
  if (arredondado >= 1) {
    const hex = (n) => limitar(Math.round(n), 0, 255).toString(16).padStart(2, '0');
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  }
  return `rgba(${limitar(Math.round(r), 0, 255)},${limitar(Math.round(g), 0, 255)},${limitar(Math.round(b), 0, 255)},${arredondado})`;
}

// ─── varredura do CSS ──────────────────────────────────────────────────────

/** Acha o `)` que fecha o `(` aberto em `inicio`, ignorando aspas. */
function fimDoParenteses(css, inicio) {
  let profundidade = 0;
  let aspas = null;
  for (let i = inicio; i < css.length; i++) {
    const c = css[i];
    if (aspas) {
      if (c === aspas && css[i - 1] !== '\\') aspas = null;
      continue;
    }
    if (c === '"' || c === "'") { aspas = c; continue; }
    if (c === '(') profundidade++;
    else if (c === ')') { profundidade--; if (profundidade === 0) return i; }
  }
  return -1;
}

/** Divide os argumentos de uma função no nível mais externo. */
function dividirArgumentos(corpo) {
  const saida = [];
  let atual = '';
  let profundidade = 0;
  for (const c of corpo) {
    if (c === '(') profundidade++;
    if (c === ')') profundidade--;
    if (c === ',' && profundidade === 0) { saida.push(atual); atual = ''; continue; }
    atual += c;
  }
  saida.push(atual);
  return saida.map((s) => s.trim()).filter(Boolean);
}

/**
 * Resolve color-mix() de operandos estáticos. Mistura em sRGB — a diferença
 * para oklab é sutil e este arquivo só é lido por navegador que, sem ele, não
 * mostraria cor nenhuma.
 */
export function resolverColorMix(css) {
  let saida = '';
  let i = 0;
  let resolvidos = 0;
  let preservados = 0;

  while (i < css.length) {
    const achou = css.indexOf('color-mix(', i);
    if (achou === -1) { saida += css.slice(i); break; }

    const abre = css.indexOf('(', achou);
    const fecha = fimDoParenteses(css, abre);
    if (fecha === -1) { saida += css.slice(i); break; }

    saida += css.slice(i, achou);
    const inteiro = css.slice(achou, fecha + 1);
    const argumentos = dividirArgumentos(css.slice(abre + 1, fecha));

    // Forma: color-mix(in <espaço>, <cor> <p>%, <cor> [<p>%])
    const substituto = (() => {
      if (argumentos.length !== 3 || !argumentos[0].startsWith('in ')) return null;

      const ler = (arg) => {
        const m = /^(.*?)(?:\s+([0-9.]+)%)?$/.exec(arg.trim());
        if (!m) return null;
        const cor = lerCor(m[1]);
        return cor ? { cor, peso: m[2] === undefined ? null : parseFloat(m[2]) } : null;
      };

      const a = ler(argumentos[1]);
      const b = ler(argumentos[2]);
      if (!a || !b) return null;

      let pa = a.peso;
      let pb = b.peso;
      if (pa === null && pb === null) { pa = 50; pb = 50; }
      else if (pa === null) pa = 100 - pb;
      else if (pb === null) pb = 100 - pa;
      const soma = pa + pb;
      if (soma <= 0) return null;
      const wa = pa / soma;
      const wb = pb / soma;

      // Premultiplicado, que é como a especificação manda misturar com alpha.
      const alpha = a.cor.a * wa + b.cor.a * wb;
      const canal = (k) => (alpha === 0
        ? 0
        : (a.cor[k] * a.cor.a * wa + b.cor[k] * b.cor.a * wb) / alpha);

      return escreverCor({ r: canal('r'), g: canal('g'), b: canal('b'), a: alpha });
    })();

    if (substituto) { saida += substituto; resolvidos++; }
    else { saida += inteiro; preservados++; }

    i = fecha + 1;
  }

  return { css: saida, resolvidos, preservados };
}

/** Converte oklch()/oklab()/lab() soltos em rgb. */
export function converterFuncoesDeCor(css) {
  let convertidos = 0;
  const saida = css.replace(/\b(oklch|oklab|lab)\(([^()]*)\)/g, (inteiro) => {
    const cor = lerCor(inteiro);
    if (!cor) return inteiro;
    convertidos++;
    return escreverCor(cor);
  });
  return { css: saida, convertidos };
}

/**
 * Desembrulha os blocos @layer, preservando a ordem do código.
 *
 * Achatar camadas muda a semântica da cascata no caso geral. Aqui não muda na
 * prática: o Tailwind emite theme → base → utilities exatamente nessa ordem, e
 * é essa a prioridade que as camadas existiam para declarar. No Chrome 92 a
 * alternativa não é "cascata diferente", é "nenhuma regra".
 */
export function desembrulharLayers(css) {
  let saida = '';
  let i = 0;
  let desembrulhados = 0;

  while (i < css.length) {
    const achou = css.indexOf('@layer', i);
    if (achou === -1) { saida += css.slice(i); break; }

    saida += css.slice(i, achou);

    // `@layer a, b;` — declaração de ordem, sem bloco: some.
    const pontoEVirgula = css.indexOf(';', achou);
    const abre = css.indexOf('{', achou);
    if (abre === -1 || (pontoEVirgula !== -1 && pontoEVirgula < abre)) {
      i = pontoEVirgula + 1;
      continue;
    }

    let profundidade = 0;
    let fecha = -1;
    for (let j = abre; j < css.length; j++) {
      if (css[j] === '{') profundidade++;
      else if (css[j] === '}') { profundidade--; if (profundidade === 0) { fecha = j; break; } }
    }
    if (fecha === -1) { saida += css.slice(achou); break; }

    saida += css.slice(abre + 1, fecha);
    desembrulhados++;
    i = fecha + 1;
  }

  return { css: saida, desembrulhados };
}

export function rebaixar(css) {
  const layers = desembrulharLayers(css);
  const mix = resolverColorMix(layers.css);
  const cores = converterFuncoesDeCor(mix.css);
  return {
    css: cores.css,
    relatorio: {
      layersDesembrulhados: layers.desembrulhados,
      mixResolvidos: mix.resolvidos,
      mixPreservados: mix.preservados,
      coresConvertidas: cores.convertidos,
    },
  };
}

// ─── execução ──────────────────────────────────────────────────────────────

async function principal() {
  const assets = path.join(DIST, 'assets');
  const arquivos = await readdir(assets);
  const principalCss = arquivos.find((f) => /^index-.*\.css$/.test(f));
  if (!principalCss) throw new Error('não achei o CSS de entrada em dist/assets');

  const original = await readFile(path.join(assets, principalCss), 'utf-8');
  const { css, relatorio } = rebaixar(original);

  const restante = {
    layer: (css.match(/@layer/g) || []).length,
    oklch: (css.match(/oklch\(/g) || []).length,
    colorMix: (css.match(/color-mix\(/g) || []).length,
  };
  if (restante.layer > 0 || restante.oklch > 0) {
    throw new Error(
      `o CSS legado ainda tem @layer (${restante.layer}) ou oklch() (${restante.oklch}) — `
      + 'seriam descartados pelo Chrome 92 e a folha não serviria para nada',
    );
  }

  const hash = createHash('sha256').update(css).digest('hex').slice(0, 8);
  const nome = `css-legado-${hash}.css`;
  await writeFile(path.join(assets, nome), css, 'utf-8');

  // Aponta todo HTML servido para o arquivo com hash.
  const htmls = [];
  async function varrer(dir) {
    for (const entrada of await readdir(dir, { withFileTypes: true })) {
      const alvo = path.join(dir, entrada.name);
      if (entrada.isDirectory()) await varrer(alvo);
      else if (entrada.name.endsWith('.html')) htmls.push(alvo);
    }
  }
  await varrer(DIST);

  let apontados = 0;
  for (const arquivo of htmls) {
    const html = await readFile(arquivo, 'utf-8');
    if (!html.includes(PLACEHOLDER)) continue;
    await writeFile(arquivo, html.split(PLACEHOLDER).join(`/assets/${nome}`), 'utf-8');
    apontados++;
  }

  if (apontados === 0) {
    throw new Error(
      `nenhum HTML de dist/ referencia ${PLACEHOLDER} — o detector do index.html sumiu `
      + 'e navegador antigo voltaria a abrir a página crua',
    );
  }

  const kb = (n) => `${Math.round(n / 1024)} KB`;
  console.log(`  ✓ ${nome} (${kb(css.length)}, de ${kb(original.length)})`);
  console.log(`    @layer desembrulhados: ${relatorio.layersDesembrulhados}`);
  console.log(`    color-mix() resolvidos: ${relatorio.mixResolvidos} · preservados (dependem de var()): ${relatorio.mixPreservados}`);
  console.log(`    oklch()/lab() convertidos para rgb: ${relatorio.coresConvertidas}`);
  console.log(`    HTML apontando para a folha legada: ${apontados}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal().catch((erro) => {
    console.error(erro);
    process.exit(1);
  });
}
