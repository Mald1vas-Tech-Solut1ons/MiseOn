// Gera os carrosséis do Instagram em PNG 1080x1350 (4:5, o formato que ocupa
// mais altura no feed). Mesmo motor dos ativos de video: HTML renderizado no
// Chrome, nada de template de terceiro.
//
//   node scripts/gerar-carrossel.mjs               todos
//   node scripts/gerar-carrossel.mjs salada        so o carrossel "salada"
//
// Cada carrossel sai em output/marketing/instagram/carrossel-<nome>/.
import puppeteer from 'puppeteer';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = path.resolve('output/marketing/instagram');
const filtro = process.argv[2];

const nav = await puppeteer.launch({ headless: 'new', executablePath: CHROME,
  args: ['--no-sandbox', '--force-device-scale-factor=1', '--hide-scrollbars'] });
const page = await nav.newPage();
await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.resolve('scripts/ativos/carrossel.html')).href,
  { waitUntil: 'networkidle0' });

let nomes = await page.evaluate(() => window.CARROSSEL.lista);
if (filtro) nomes = nomes.filter((n) => n === filtro);
if (!nomes.length) {
  console.error(`carrossel "${filtro}" não existe`);
  await nav.close();
  process.exit(1);
}

let laminas = 0;
for (const nome of nomes) {
  const out = path.join(BASE, 'carrossel-' + nome);
  await mkdir(out, { recursive: true });
  const total = await page.evaluate((n) => window.CARROSSEL.total(n), nome);
  console.log(`carrossel-${nome}`);
  for (let i = 0; i < total; i++) {
    await page.evaluate((n, j) => window.CARROSSEL.montar(n, j), nome, i);
    await new Promise((r) => setTimeout(r, 350));
    const arq = path.join(out, String(i + 1).padStart(2, '0') + '.png');
    await (await page.$('#slide')).screenshot({ path: arq });
    console.log('  ' + path.basename(arq));
    laminas++;
  }
}
await nav.close();
console.log(`\n${nomes.length} carrosséis, ${laminas} lâminas em ${BASE}`);
