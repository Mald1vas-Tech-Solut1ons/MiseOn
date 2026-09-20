import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'output', 'marketing', 'qa-posicionamento');
const REPORT = path.join(ROOT, 'docs', 'auditoria-visual-site.md');
const BASE = process.env.MISEON_QA_URL || 'http://127.0.0.1:4173';

const cases = [
  { route: '/', name: 'home', desktop: true },
  { route: '/sistema-para-restaurantes', name: 'restaurante-salao' },
  { route: '/sistema-para-hamburgueria', name: 'hamburgueria' },
  { route: '/sistema-para-lanchonete', name: 'lanchonete' },
  { route: '/sistema-para-pizzaria', name: 'pizzaria' },
  { route: '/sistema-para-dark-kitchen', name: 'dark-kitchen' },
  { route: '/api-whatsapp-restaurantes', name: 'whatsapp-ia' },
  { route: '/cadastre-se', name: 'cadastro' },
  { route: '/contato', name: 'contato' },
];

await mkdir(OUT, { recursive: true });

const browserCandidates = [
  process.env.MISEON_BROWSER_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);
const executablePath = browserCandidates.find((candidate) => existsSync(candidate));
const browser = await puppeteer.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const results = [];

try {
  for (const current of cases) {
    const viewports = current.desktop
      ? [
          { label: 'desktop', width: 1440, height: 1000 },
          { label: 'mobile', width: 390, height: 844 },
        ]
      : [{ label: 'mobile', width: 390, height: 844 }];

    for (const viewport of viewports) {
      const page = await browser.newPage();
      const consoleErrors = [];
      const pageErrors = [];

      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });
      await page.evaluateOnNewDocument(() => {
        localStorage.setItem('miseon_cookie_consent_v1', JSON.stringify({
          tipo: 'apenas_essenciais',
          preferencias: { essenciais: true, analiticos: false, marketing: false },
          atualizadoEm: new Date().toISOString(),
        }));
      });

      const response = await page.goto(`${BASE}${current.route}`, { waitUntil: 'networkidle2', timeout: 30_000 });
      await page.waitForSelector('h1', { timeout: 10_000 });
      await page.evaluate(async () => {
        for (let top = 0; top < document.documentElement.scrollHeight; top += window.innerHeight) {
          window.scrollTo(0, top);
          await new Promise((resolve) => setTimeout(resolve, 40));
        }
        await Promise.all([...document.images].map((image) => {
          if (image.complete) return Promise.resolve();
          return new Promise((resolve) => {
            image.addEventListener('load', resolve, { once: true });
            image.addEventListener('error', resolve, { once: true });
            setTimeout(resolve, 3_000);
          });
        }));
        window.scrollTo(0, 0);
      });

      const state = await page.evaluate(() => {
        const links = [...document.querySelectorAll('a[href]')].map((link) => link.getAttribute('href'));
        const brokenImages = [...document.images]
          .filter((image) => !image.complete || image.naturalWidth === 0)
          .map((image) => image.getAttribute('src'));
        return {
          title: document.title,
          h1: document.querySelector('h1')?.textContent?.trim() ?? '',
          bodyLength: document.body.innerText.trim().length,
          horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          ctaTest: links.includes('/cadastre-se'),
          ctaDemo: links.includes('/contato'),
          ctaWhatsapp: links.includes('/api-whatsapp-restaurantes'),
          brokenImages,
          bannedCopy: /depoimentos? de clientes reais|case(?:s)? reais? de clientes?/i.test(document.body.innerText),
        };
      });

      const screenshot = path.join(OUT, `${current.name}-${viewport.label}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });

      const errors = [];
      if (!response || response.status() >= 400) errors.push(`HTTP ${response?.status() ?? 'sem resposta'}`);
      if (!state.h1) errors.push('H1 ausente');
      if (state.bodyLength < 200) errors.push('conteúdo insuficiente');
      if (state.horizontalOverflow) errors.push('overflow horizontal');
      if (state.brokenImages.length) errors.push(`imagens quebradas: ${state.brokenImages.join(', ')}`);
      if (state.bannedCopy) errors.push('prova social não comprovada');
      if (consoleErrors.length) errors.push(`console: ${consoleErrors.join(' | ')}`);
      if (pageErrors.length) errors.push(`runtime: ${pageErrors.join(' | ')}`);
      if (current.route === '/' && !(state.ctaTest && state.ctaDemo && state.ctaWhatsapp)) {
        errors.push('home sem os três CTAs');
      }

      results.push({ ...current, viewport: viewport.label, screenshot, state, errors });
      await page.close();
    }
  }
} finally {
  await browser.close();
}

const failures = results.filter((result) => result.errors.length);
const lines = [
  '# Auditoria visual e comportamental do site',
  '',
  `**Base verificada:** ${BASE}`,
  `**Cenários:** ${results.length} combinações de rota e viewport.`,
  '',
  `## Resultado: ${failures.length ? 'REPROVADO' : 'APROVADO'}`,
  '',
  '| Rota | Viewport | H1 | Imagens | Overflow | Resultado |',
  '|---|---|---|---:|---|---|',
  ...results.map((result) =>
    `| ${result.route} | ${result.viewport} | ${result.state.h1.replaceAll('|', '\\|')} | ${result.state.brokenImages.length} quebradas | ${result.state.horizontalOverflow ? 'sim' : 'não'} | ${result.errors.length ? result.errors.join('; ') : 'OK'} |`
  ),
  '',
  '## Evidências',
  '',
  ...results.map((result) => `- \`${path.relative(ROOT, result.screenshot).replaceAll('\\', '/')}\``),
  '',
  '## Escopo',
  '',
  '- carregamento sem tela vazia ou erro de runtime;',
  '- H1 e conteúdo significativo;',
  '- ausência de overflow horizontal nas larguras verificadas;',
  '- imagens carregadas;',
  '- três CTAs na home;',
  '- ausência de prova social proibida.',
  '',
];

await writeFile(REPORT, lines.join('\n'), 'utf8');

if (failures.length) {
  for (const failure of failures) console.error(`${failure.route} (${failure.viewport}): ${failure.errors.join('; ')}`);
  process.exitCode = 1;
} else {
  console.log(`Auditoria visual aprovada: ${results.length} cenários; evidências em ${OUT}.`);
}
