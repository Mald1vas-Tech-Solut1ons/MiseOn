// Prerenderiza as rotas públicas de marketing para HTML estático depois do
// `vite build`, usando o Chromium do Puppeteer (já é devDependency do
// projeto, usado hoje pelo Cypress — nenhuma dependência nova).
//
// Problema que resolve: hoje TODAS as rotas servem o mesmo index.html vazio
// (só meta tags da Home) para qualquer crawler que não execute JavaScript —
// Bing, GPTBot, PerplexityBot, ClaudeBot, todos liberados no robots.txt mas
// recebendo conteúdo idêntico em toda URL. O componente SEO.tsx já escreve
// title/description/JSON-LD corretos por rota, só que via useEffect — tarde
// demais para quem não roda JS. Este script deixa o Chromium montar a página
// (incluindo o useEffect do SEO.tsx) e salva o HTML resultante como arquivo
// estático por rota, sem tocar no app autenticado nem trocar de framework.
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { PUBLIC_ROUTES, DUPLICATE_ROUTES } from './public-routes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '..', 'dist');
const PORT = 4173 + Math.floor(Math.random() * 500);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
};

// Servidor estático mínimo que reproduz o rewrite do vercel.json: serve o
// arquivo exato se existir, senão cai para dist/index.html (comportamento de
// SPA em produção) — é o mesmo contrato que o Chromium vai ver na Vercel.
function startServer() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      let filePath = path.join(DIST, urlPath);
      try {
        const s = await stat(filePath);
        if (s.isDirectory()) filePath = path.join(filePath, 'index.html');
        await stat(filePath);
      } catch {
        filePath = path.join(DIST, 'index.html');
      }
      res.setHeader('Content-Type', MIME[path.extname(filePath)] || 'application/octet-stream');
      createReadStream(filePath)
        .on('error', () => { res.statusCode = 404; res.end(); })
        .pipe(res);
    });
    server.listen(PORT, () => resolve(server));
  });
}

async function prerenderRoute(browser, routePath) {
  const page = await browser.newPage();

  // Não precisamos baixar vídeo/imagem/fonte pra capturar o HTML renderizado
  // — só o texto e os data-attributes importam aqui. Acelera e reduz flakiness.
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (['media', 'image', 'font'].includes(req.resourceType())) req.abort();
    else req.continue();
  });

  // Só exceções JS não tratadas derrubam o build. Console 'error' inclui os
  // "Failed to load resource" das requisições de mídia/fonte/imagem que a
  // gente aborta de propósito acima — não é sinal de bug.
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto(`http://localhost:${PORT}${routePath}`, {
    waitUntil: 'networkidle0',
    timeout: 30000,
  });

  // O SEO.tsx escreve title/meta/JSON-LD num useEffect após o mount — espera
  // um <h1> aparecer (sinal de que a página montou) e dá um respiro pro
  // useEffect rodar antes de capturar o HTML final.
  await page.waitForSelector('h1', { timeout: 10000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 300));

  let html = await page.content();
  const title = await page.title();
  await page.close();

  // O <noscript> do index.html (H1 + parágrafo genéricos da Home) é o
  // fallback para quando JS não roda. React nunca o remove — só substitui
  // #root — então ele sobrevive intacto na captura. Numa página já
  // prerenderizada isso é redundante (o conteúdo real já está no HTML sem
  // depender de JS) e pior: cria um segundo <h1> genérico que um parser sem
  // JS (a maioria dos crawlers não-Google) lê como elemento real, não texto
  // inerte. Tira o bloco só das páginas prerenderizadas.
  html = html.replace(/<noscript>[\s\S]*?<\/noscript>/, '');

  if (errors.length) {
    throw new Error(`Erro de console/JS em ${routePath}:\n${errors.join('\n')}`);
  }
  if (!title.trim()) {
    throw new Error(`${routePath} não gerou <title> — SEO.tsx não rodou ou a rota não existe.`);
  }

  return { html, title };
}

async function main() {
  const server = await startServer();
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const routes = [
    ...PUBLIC_ROUTES.filter((r) => r.prerender !== false).map((r) => r.path),
    ...DUPLICATE_ROUTES,
  ];

  console.log(`Prerenderizando ${routes.length} rotas públicas...`);
  const seenTitles = new Map();

  try {
    for (const routePath of routes) {
      const { html, title } = await prerenderRoute(browser, routePath);

      // Barreira anti-regressão: se duas rotas não-duplicadas saírem com o
      // MESMO <title>, o bug original (toda página idêntica pro crawler)
      // voltou silenciosamente — falha o build em vez de shippar isso.
      const isKnownDuplicate = DUPLICATE_ROUTES.includes(routePath);
      if (!isKnownDuplicate) {
        if (seenTitles.has(title)) {
          throw new Error(
            `Title duplicado: "${title}" em ${routePath} e ${seenTitles.get(title)}. ` +
            `Se isso é intencional, adicione a rota em DUPLICATE_ROUTES (scripts/public-routes.mjs).`
          );
        }
        seenTitles.set(title, routePath);
      }

      const outDir = path.join(DIST, routePath.replace(/^\//, ''));
      await mkdir(outDir, { recursive: true });
      await writeFile(path.join(outDir, 'index.html'), html, 'utf-8');
      console.log(`  ✓ ${routePath.padEnd(38)} → "${title}"`);
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  console.log(`Prerender concluído: ${routes.length} páginas estáticas geradas em dist/.`);
}

main().catch((err) => {
  console.error('Prerender falhou:', err.message);
  process.exit(1);
});
