// Gera as cartelas 1080x1920 dos roteiros locutados. Sao elas que substituem
// a camera: o Rafael grava so a voz, e a imagem sai daqui e das gravacoes de
// tela. Mesmo motor do carrossel e dos ativos de video: HTML no Chrome.
//
//   node scripts/gerar-cartelas.mjs            todas
//   node scripts/gerar-cartelas.mjs L04        so as do roteiro L04
import puppeteer from 'puppeteer';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = path.resolve('output/marketing/cartelas');
const filtro = process.argv[2];
await mkdir(OUT, { recursive: true });

const nav = await puppeteer.launch({ headless: 'new', executablePath: CHROME,
  args: ['--no-sandbox', '--force-device-scale-factor=1', '--hide-scrollbars'] });
const page = await nav.newPage();
await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.resolve('scripts/ativos/cartelas.html')).href,
  { waitUntil: 'networkidle0' });

let nomes = await page.evaluate(() => window.CARTELAS.nomes);
if (filtro) nomes = nomes.filter((n) => n.startsWith(filtro));
if (!nomes.length) {
  console.error(`nenhuma cartela casa com "${filtro}"`);
  await nav.close();
  process.exit(1);
}

for (const nome of nomes) {
  await page.evaluate((n) => window.CARTELAS.montar(n), nome);
  await new Promise((r) => setTimeout(r, 300));
  // a tira de credito vai por cima da gravacao: precisa de fundo transparente
  const vazado = await page.evaluate((n) => window.CARTELAS.transparente(n), nome);
  await (await page.$('#slide')).screenshot({
    path: path.join(OUT, nome + '.png'),
    omitBackground: vazado,
  });
  console.log('  ' + nome + '.png' + (vazado ? '  (transparente)' : ''));
}
await nav.close();
console.log(`\n${nomes.length} cartelas em ${OUT}`);
