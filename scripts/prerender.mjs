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

/**
 * Largura e altura de um PNG ou JPEG, lidas do cabeçalho do arquivo.
 *
 * O WhatsApp precisa das dimensões declaradas na meta para decidir se baixa a
 * imagem — sem elas ele desiste e manda o link sem miniatura (é o que está
 * escrito no index.html, e já custou caro uma vez). Declarar um número chutado
 * seria o mesmo problema com outra roupa, então aqui se mede.
 */
function dimensoesImagem(buffer) {
  // PNG: assinatura de 8 bytes, depois o IHDR com largura e altura.
  if (buffer.length > 24 && buffer.readUInt32BE(0) === 0x89504e47) {
    return { largura: buffer.readUInt32BE(16), altura: buffer.readUInt32BE(20) };
  }

  // JPEG: percorre os marcadores até um SOF, que carrega as dimensões.
  if (buffer.length > 4 && buffer.readUInt16BE(0) === 0xffd8) {
    let i = 2;
    while (i < buffer.length - 9) {
      if (buffer[i] !== 0xff) { i++; continue; }
      const marcador = buffer[i + 1];
      // SOF0..SOF15, menos DHT (c4), JPG (c8) e DAC (cc), que não são frames.
      if (marcador >= 0xc0 && marcador <= 0xcf && marcador !== 0xc4 && marcador !== 0xc8 && marcador !== 0xcc) {
        return { altura: buffer.readUInt16BE(i + 5), largura: buffer.readUInt16BE(i + 7) };
      }
      i += 2 + buffer.readUInt16BE(i + 2);
    }
  }

  return null;
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
function renderPage(template, { title, description, canonicalUrl, bodyHtml, jsonLd, headExtra, imagem }) {
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

  // A prévia do link: sem isto todo artigo do blog era compartilhado com o
  // ícone de 512x512 do app — a mesma figura para trinta textos diferentes.
  // Com a capa, o card de cada matéria mostra o título dela.
  if (imagem) {
    html = html.replace(
      /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/,
      `<meta property="og:image" content="${imagem.url}" />`
    );
    html = html.replace(
      /<meta\s+property="og:image:width"\s+content="[^"]*"\s*\/?>/,
      `<meta property="og:image:width" content="${imagem.largura}" />`
    );
    html = html.replace(
      /<meta\s+property="og:image:height"\s+content="[^"]*"\s*\/?>/,
      `<meta property="og:image:height" content="${imagem.altura}" />`
    );
    html = html.replace(
      /<meta\s+property="og:image:type"\s+content="[^"]*"\s*\/?>/,
      `<meta property="og:image:type" content="${imagem.tipo}" />`
    );
    html = html.replace(
      /<meta\s+property="og:image:alt"\s+content="[^"]*"\s*\/?>/,
      `<meta property="og:image:alt" content="${escapeHtml(title)}" />`
    );
    html = html.replace(
      /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/,
      `<meta name="twitter:image" content="${imagem.url}" />`
    );
    // Capa larga pede card grande; com "summary" o X corta a imagem num
    // quadradinho ao lado do texto.
    html = html.replace(
      /<meta\s+name="twitter:card"\s+content="[^"]*"\s*\/?>/,
      '<meta name="twitter:card" content="summary_large_image" />'
    );
  }

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

  // Scripts que valem para UMA rota (hoje: o loader do AdSense, só no
  // blog). Ver src/lib/adsense.ts para o porquê de não morar no template.
  if (headExtra) {
    html = html.replace('</head>', `  ${headExtra}\n  </head>`);
  }

  return html;
}

async function main() {
  const template = await readFile(path.join(DIST, 'index.html'), 'utf-8');

  const { PAGE_META } = await loadTsModule('src/data/pageMeta.ts');
  const { LANDING_PAGES_DATA } = await loadTsModule('src/data/landingPagesData.ts');
  const { BLOG_POSTS } = await loadTsModule('src/data/blogData.ts');
  const { FERRAMENTAS, HUB_FERRAMENTAS } = await loadTsModule('src/data/ferramentasData.ts');
  const { snippetAdSense } = await loadTsModule('src/lib/adsense.ts');

  // dist/app.html — shell da SPA para as rotas que NÃO dá para gerar
  // estaticamente: /admin, /superadmin, /entregador, /pedido/:id e o cardápio
  // de cada loja (/:slug), que vêm do banco. O vercel.json aponta o rewrite
  // catch-all para cá.
  let appShell = template.replace(
    /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/,
    '<meta name="robots" content="noindex, follow" />'
  );
  if (!appShell.includes('content="noindex, follow"')) {
    throw new Error('Não consegui aplicar noindex no app.html — a meta robots do index.html mudou?');
  }

  // ── O SHELL NÃO CARREGA O TEXTO DA HOME ────────────────────────────────
  //
  // `index.html` traz um H1 e um parágrafo reais dentro de #root, e isso está
  // certo PARA A HOME: é o conteúdo indexado, e esconder texto por CSS já foi
  // tentado aqui e é descontado por analisador de SEO (ver comentário no
  // index.html).
  //
  // Só que o app.html era uma cópia dele. Resultado: /lanchepaulista,
  // /admin e /entregador abriam piscando o título da home como texto cru,
  // sem estilo, até o React montar — e, quando o JS demorava ou falhava,
  // ficavam ASSIM. Era o que parecia "site quebrado" no celular do cliente.
  //
  // O shell é `noindex`, então esse texto não servia nem para busca. Fica
  // vazio: a folha de estilo é render-blocking, então o primeiro paint já sai
  // com o fundo certo do tema em vez de letra preta no branco. Cada tela
  // mostra o próprio loader assim que monta.
  const shellVazio = '<div id="root"></div>';
  const antes = appShell;
  appShell = appShell.replace(/<div id="root">[\s\S]*?<\/div>/, shellVazio);
  if (appShell === antes || !appShell.includes(shellVazio)) {
    throw new Error('Não consegui esvaziar o #root do app.html — a estrutura do index.html mudou?');
  }
  appShell = appShell.replace(
    /<noscript>[\s\S]*?<\/noscript>/,
    '<noscript><p>Este aplicativo precisa de JavaScript para funcionar. Ative o JavaScript no seu navegador.</p></noscript>',
  );

  await writeFile(path.join(DIST, 'app.html'), appShell, 'utf-8');
  console.log('  ✓ app.html (shell da SPA para rotas dinâmicas, noindex, #root vazio)');

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
    const blogPost = routePath.startsWith('/blog/') ? BLOG_POSTS.find((p) => `/blog/${p.slug}` === routePath) : null;
    const ferramenta = FERRAMENTAS.find((f) => f.path === routePath);

    let title, description, canonicalUrl, bodyHtml, jsonLd;

    if (blogPost) {
      title = blogPost.seo.title;
      description = blogPost.seo.description;
      canonicalUrl = blogPost.seo.canonicalUrl;
      bodyHtml = `<h1>${escapeHtml(blogPost.title)}</h1>\n      <p>${escapeHtml(blogPost.description)}</p>\n      <article>${escapeHtml(blogPost.summary)}</article>`;
      jsonLd = `<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: blogPost.title,
        description: blogPost.description,
        author: { '@type': 'Person', name: blogPost.author.name, jobTitle: blogPost.author.role },
        publisher: { '@type': 'Organization', name: 'MiseOn', logo: 'https://miseon.app.br/icon-512.png' },
        datePublished: blogPost.publishedAt,
        mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl }
      })}</script>`;
    } else if (routePath === HUB_FERRAMENTAS.path) {
      title = HUB_FERRAMENTAS.seo.title;
      description = HUB_FERRAMENTAS.seo.description;
      canonicalUrl = HUB_FERRAMENTAS.seo.canonicalUrl;
      bodyHtml = [
        `<h1>${escapeHtml(HUB_FERRAMENTAS.h1.pt)}</h1>`,
        `<p>${escapeHtml(HUB_FERRAMENTAS.resumo.pt)}</p>`,
        `<ul>${FERRAMENTAS.map((f) => `<li><a href="${f.path}">${escapeHtml(f.nome.pt)}</a>: ${escapeHtml(f.resumo.pt)}</li>`).join('')}</ul>`,
      ].join('\n      ');
      jsonLd = '';
    } else if (ferramenta) {
      title = ferramenta.seo.title;
      description = ferramenta.seo.description;
      canonicalUrl = `${BASE}${ferramenta.path}`;
      bodyHtml = [
        `<h1>${escapeHtml(ferramenta.h1.pt)}</h1>`,
        `<p>${escapeHtml(ferramenta.resumo.pt)}</p>`,
        ...ferramenta.explicacao.map(
          (b) => `<h2>${escapeHtml(b.titulo.pt)}</h2>${b.paragrafos.map((p) => `<p>${escapeHtml(p.pt)}</p>`).join('')}`
        ),
        '<h2>Perguntas frequentes</h2>',
        ferramenta.faqs.map((q) => `<h3>${escapeHtml(q.pergunta.pt)}</h3><p>${escapeHtml(q.resposta.pt)}</p>`).join(''),
      ].join('\n      ');
      jsonLd = faqJsonLd({ faqs: ferramenta.faqs.map((q) => ({ pergunta: q.pergunta.pt, resposta: q.resposta.pt })) });
    } else if (landing) {
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
      throw new Error(
        `Rota "${routePath}" não tem metadados. Adicione em src/data/pageMeta.ts ` +
        `(ou em src/data/landingPagesData.ts ou src/data/blogData.ts).`
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

    // O AdSense entra apenas no blog — nem na home, nem nas landings, nem
    // (sobretudo) no app.html, que é o shell das telas do lojista.
    const ehBlog = routePath === '/blog' || routePath.startsWith('/blog/');
    const headExtra = ehBlog ? snippetAdSense() : '';

    // Cada matéria compartilha a própria capa. As dimensões saem do arquivo,
    // não de um palpite — ver dimensoesImagem().
    let imagem = null;
    if (blogPost?.coverImage) {
      const arquivo = path.join(ROOT, 'public', blogPost.coverImage.replace(/^\//, ''));
      try {
        const medidas = dimensoesImagem(await readFile(arquivo));
        if (medidas) {
          imagem = {
            url: `${BASE}${blogPost.coverImage}`,
            largura: medidas.largura,
            altura: medidas.altura,
            tipo: blogPost.coverImage.endsWith('.png') ? 'image/png' : 'image/jpeg',
          };
        } else {
          console.warn(`  ! capa de ${routePath} em formato não reconhecido — prévia fica com o ícone`);
        }
      } catch {
        throw new Error(
          `${routePath}: a capa ${blogPost.coverImage} não existe em public/. ` +
          `Gere com "node scripts/gerar-capa-blog.mjs" ou corrija o coverImage em blogData.ts.`
        );
      }
    }

    const html = renderPage(template, { title, description, canonicalUrl, bodyHtml, jsonLd, headExtra, imagem });

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

    // O loader do AdSense é do blog e de mais nada. Se ele aparecer numa
    // rota comercial é porque alguém o colou no index.html — falha o build
    // em vez de publicar anúncio na página de venda.
    if (html.includes('adsbygoogle.js') !== ehBlog) {
      throw new Error(
        ehBlog
          ? `${routePath}: o snippet do AdSense não foi aplicado ao HTML do blog.`
          : `${routePath}: o snippet do AdSense vazou para fora do blog (veja src/lib/adsense.ts).`
      );
    }

    // A home vai para dist/index.html (é o que a Vercel serve em "/");
    // as demais para dist/<rota>/index.html.
    const outFile = routePath === '/'
      ? path.join(DIST, 'index.html')
      : path.join(DIST, slug, 'index.html');
    await mkdir(path.dirname(outFile), { recursive: true });
    await writeFile(outFile, html, 'utf-8');
    gerados++;
    console.log(`  ✓ ${routePath.padEnd(38)} → "${title}"`);
  }

  console.log(`Prerender concluído: ${gerados} páginas estáticas geradas em dist/.`);
}

main().catch((err) => {
  console.error('\nPrerender falhou:', err.message);
  process.exit(1);
});
