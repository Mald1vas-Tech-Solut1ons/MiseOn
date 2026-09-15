// Gera o carrossel do Instagram em PNG 1080x1350 (4:5, o formato que ocupa
// mais altura no feed). Mesmo motor dos ativos de video: HTML renderizado no
// Chrome, nada de template de terceiro.
import puppeteer from 'puppeteer';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = path.resolve('output/marketing/instagram/carrossel-delivery');
await mkdir(OUT, { recursive: true });

const nav = await puppeteer.launch({ headless: 'new', executablePath: CHROME,
  args: ['--no-sandbox', '--force-device-scale-factor=1', '--hide-scrollbars'] });
const page = await nav.newPage();
await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.resolve('scripts/ativos/carrossel.html')).href,
  { waitUntil: 'networkidle0' });

const total = await page.evaluate(() => window.CARROSSEL.total);
for (let i = 0; i < total; i++) {
  await page.evaluate((n) => window.CARROSSEL.montar(n), i);
  await new Promise((r) => setTimeout(r, 350));
  const arq = path.join(OUT, String(i + 1).padStart(2, '0') + '.png');
  await (await page.$('#slide')).screenshot({ path: arq });
  console.log('  ' + path.basename(arq));
}
await nav.close();
console.log(`\n${total} lâminas em ${OUT}`);
