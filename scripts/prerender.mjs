// Gera HTML estático para as rotas públicas de marketing depois do
// `vite build`. SEM BROWSER — apenas templating de string a partir dos dados
// que já existem em src/data/. É determinístico e não depende de nenhuma
// biblioteca de sistema.
//
// POR QUE NÃO USA PUPPETEER (não reintroduza):
// A primeira versão disto abria cada rota num Chromium headless. Funcionava
// na máquina local e falhava no build da Vercel com
// `libnspr4.so: cannot open shared object file` — o container de build não
// tem as bibliotecas de sistema do Chromium. Resultado: o build passava, mas
// ia ao ar SEM as páginas prerenderizadas. Prerender que depende de
// infraestrutura que não controlamos não é confiável para isto.
//
// O QUE ISTO RESOLVE:
// Todas as rotas serviam o mesmo index.html — mesmo <title>, mesma
// description, mesmo H1 genérico. Para o Google isso é a mesma página
// repetida ~20 vezes; ele desduplica e não indexa. Crawlers que não executam
// JavaScript (Bing e a maioria dos bots de IA) nunca viam o conteúdo real,
// porque o componente SEO.tsx só preenche as tags num useEffect, no browser.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { PUBLIC_ROUTES, DUPLICATE_ROUTES } from './public-routes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const BASE = 'https://miseon.app.br';

/** Carrega um módulo .ts de src/data transpilando em memória com esbuild. */
async function loadTsModule(relPath) {
  const result = await build({
    entryPoints: [path.join(ROOT, relPath)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
  });
  const code = result.outputFiles[0].text;
  const b64 = Buffer.from(code, 'utf-8').toString('base64');
  return import(`data:text/javascript;base64,${b64}`);
}

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Conteúdo estático rico para as landing pages de nicho. */
function landingContent(data) {
  const h1 = escapeHtml(`${data.h1Title} ${data.h1Highlight}`.trim());
  const parts = [
    `<h1>${h1}</h1>`,
    `<p>${escapeHtml(data.subheadline)}</p>`,
  ];

  if (data.painPoints?.length) {
    parts.push(`<h2>${escapeHtml(data.painPointsTitle)}</h2>`);
    parts.push(
      `<ul>${data.painPoints
        .map(
          (p) =>
            `<li><strong>Sem o MiseOn:</strong> ${escapeHtml(p.semMiseOn)} <strong>Com o MiseOn:</strong> ${escapeHtml(p.comMiseOn)}</li>`
        )
        .join('')}</ul>`
    );
  }

  if (data.features?.length) {
    parts.push(`<h2>${escapeHtml(data.featuresTitle)}</h2>`);
    parts.push(
      `<ul>${data.features
        .map((f) => `<li><strong>${escapeHtml(f.title)}:</strong> ${escapeHtml(f.description)}</li>`)
        .join('')}</ul>`
    );
  }

  if (data.businessRules?.items?.length) {
    parts.push(`<h2>${escapeHtml(data.businessRules.title)}</h2>`);
    parts.push(`<ul>${data.businessRules.items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`);
  }

  if (data.faqs?.length) {
    parts.push('<h2>Perguntas Frequentes</h2>');
    parts.push(
      data.faqs
        .map((f) => `<h3>${escapeHtml(f.pergunta)}</h3><p>${escapeHtml(f.resposta)}</p>`)
        .join('')
    );
  }

  return parts.join('\n      ');
}

/** JSON-LD de FAQPage — habilita rich snippet de perguntas no Google. */
function faqJsonLd(data) {
  if (!data.faqs?.length) return '';
  const json = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: data.faqs.map((f) => ({
      '@type': 'Question',
      name: f.pergunta,
      acceptedAnswer: { '@type': 'Answer', text: f.resposta },
    })),
  };
  return `<script type="application/ld+json">${JSON.stringify(json)}</script>`;
}

/** Aplica meta + conteúdo de uma rota sobre o shell gerado pelo Vite. */
function renderPage(template, { title, description, canonicalUrl, bodyHtml, jsonLd }) {
  let html = template;

  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`);
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${escapeHtml(description)}" />`
  );
  html = html.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${canonicalUrl}" />`
  );
  html = html.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/,
    `<meta property="og:title" content="${escapeHtml(title)}" />`
  );
  html = html.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/,
    `<meta property="og:description" content="${escapeHtml(description)}" />`
  );
  html = html.replace(
    /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/,
    `<meta property="og:url" content="${canonicalUrl}" />`
  );

  // Substitui o H1 genérico de fallback pelo conteúdo real da rota. O React
  // troca tudo dentro de #root ao montar, então isto some para o usuário e
  // permanece para o crawler sem JS.
  html = html.replace(
    /<div id="root">[\s\S]*?<\/div>/,
    `<div id="root">\n      ${bodyHtml}\n    </div>`
  );

  // O <noscript> tem H1 e parágrafo genéricos da home — aqui viraria um
  // segundo H1 genérico competindo com o H1 real da rota.
  html = html.replace(/<noscript>[\s\S]*?<\/noscript>\s*/, '');

  if (jsonLd) {
    html = html.replace('</head>', `  ${jsonLd}\n  </head>`);
  }

  return html;
}

async function main() {
  const template = await readFile(path.join(DIST, 'index.html'), 'utf-8');

  const { PAGE_META } = await loadTsModule('src/data/pageMeta.ts');
  const { LANDING_PAGES_DATA } = await loadTsModule('src/data/landingPagesData.ts');

  const routes = [
    ...PUBLIC_ROUTES.filter((r) => r.prerender !== false).map((r) => r.path),
    ...DUPLICATE_ROUTES,
  ];

  console.log(`Gerando HTML estático de ${routes.length} rotas públicas (sem browser)...`);
  const seenTitles = new Map();
  let gerados = 0;

  for (const routePath of routes) {
    const slug = routePath.replace(/^\//, '');
    const landing = LANDING_PAGES_DATA[slug];
    const meta = PAGE_META[routePath];

    let title, description, canonicalUrl, bodyHtml, jsonLd;

    if (landing) {
      title = landing.seo.title;
      description = landing.seo.description;
      canonicalUrl = landing.seo.canonicalUrl || `${BASE}${routePath}`;
      bodyHtml = landingContent(landing);
      jsonLd = faqJsonLd(landing);
    } else if (meta) {
      title = meta.title;
      description = meta.description;
      canonicalUrl = meta.canonicalUrl;
      bodyHtml = `<h1>${escapeHtml(meta.h1)}</h1>\n      <p>${escapeHtml(meta.description)}</p>`;
      jsonLd = '';
    } else {
      // Rota pública sem metadados: falha o build. Sem isto, a página iria ao
      // ar herdando silenciosamente o title da home — que é exatamente o bug
      // que este script existe para eliminar.
      throw new Error(
        `Rota "${routePath}" não tem metadados. Adicione em src/data/pageMeta.ts ` +
        `(ou em src/data/landingPagesData.ts, se for landing de nicho).`
      );
    }

    // Barreira anti-regressão: dois títulos iguais entre rotas distintas
    // significa que o bug original voltou. Falha o build em vez de publicar.
    if (!DUPLICATE_ROUTES.includes(routePath)) {
      if (seenTitles.has(title)) {
        throw new Error(
          `Title duplicado: "${title}" em ${routePath} e ${seenTitles.get(title)}. ` +
          `Se for intencional, declare a rota em DUPLICATE_ROUTES (scripts/public-routes.mjs).`
        );
      }
      seenTitles.set(title, routePath);
    }

    const html = renderPage(template, { title, description, canonicalUrl, bodyHtml, jsonLd });

    // Verificação do produto final, não da intenção: se o HTML gravado não
    // tiver exatamente um H1 e o título certo, algo no template mudou e os
    // regex acima pararam de casar — silenciosamente. Melhor falhar aqui.
    const h1Count = (html.match(/<h1[\s>]/g) || []).length;
    if (h1Count !== 1) {
      throw new Error(`${routePath}: esperava exatamente 1 <h1> no HTML gerado, encontrei ${h1Count}.`);
    }
    if (!html.includes(`<title>${escapeHtml(title)}</title>`)) {
      throw new Error(`${routePath}: o <title> não foi aplicado — o template do index.html mudou?`);
    }

    const outDir = path.join(DIST, slug);
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, 'index.html'), html, 'utf-8');
    gerados++;
    console.log(`  ✓ ${routePath.padEnd(38)} → "${title}"`);
  }

  console.log(`Prerender concluído: ${gerados} páginas estáticas geradas em dist/.`);
}

main().catch((err) => {
  console.error('\nPrerender falhou:', err.message);
  process.exit(1);
});
