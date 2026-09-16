// Gera a capa 1280x720 de um artigo do blog a partir de scripts/ativos/capa-blog.html.
// Mesmo motor do carrossel e das cartelas: HTML no Chrome, via puppeteer.
//
//   node scripts/gerar-capa-blog.mjs loja-lotada
//   node scripts/gerar-capa-blog.mjs                 (todas as capas definidas)
//
// A imagem sai em public/blog-covers/<arquivo>.jpg e é o `coverImage` do post
// em src/data/blogData.ts. Capa é conteúdo versionado, não build: rode quando
// criar o artigo e comite o .jpg junto.
import puppeteer from 'puppeteer';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = path.resolve('public/blog-covers');

/**
 * Uma entrada por capa. `titulo` e `destaque` são as duas linhas do título —
 * a segunda sai em laranja. Frases curtas: a capa é lida em miniatura, no
 * card do hub e na prévia do WhatsApp.
 */
const CAPAS = {
  'loja-lotada': {
    arquivo: 'loja-lotada-divida-enorme-cover',
    rotulo: 'GESTÃO FINANCEIRA',
    titulo: 'Loja lotada,',
    destaque: 'dívida enorme',
    apoio:
      'Movimento mede <strong>quantas vezes</strong> a operação rodou. Margem mede <strong>quanto sobrou</strong> de cada vez.',
    assinatura: 'Engenharia de custo para food service',
  },
};

const filtro = process.argv[2];
const chaves = filtro ? Object.keys(CAPAS).filter((k) => k.startsWith(filtro)) : Object.keys(CAPAS);

if (!chaves.length) {
  console.error(`nenhuma capa casa com "${filtro}". Disponíveis: ${Object.keys(CAPAS).join(', ')}`);
  process.exit(1);
}

await mkdir(OUT, { recursive: true });

const nav = await puppeteer.launch({
  headless: 'new',
  executablePath: CHROME,
  args: ['--no-sandbox', '--force-device-scale-factor=1', '--hide-scrollbars'],
});
const page = await nav.newPage();
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(path.resolve('scripts/ativos/capa-blog.html')).href, {
  waitUntil: 'networkidle0',
});

for (const chave of chaves) {
  const dados = CAPAS[chave];
  await page.evaluate((d) => window.CAPA.montar(d), dados);
  // As fontes do Google chegam pela rede; sem esta pausa a captura pode sair
  // com a fonte de sistema, e a capa perde a tipografia da marca.
  await new Promise((r) => setTimeout(r, 400));

  const destino = path.join(OUT, dados.arquivo + '.jpg');
  await (await page.$('#capa')).screenshot({ path: destino, type: 'jpeg', quality: 92 });
  console.log(`  ✓ ${dados.arquivo}.jpg`);
}

await nav.close();
console.log(`\n${chaves.length} capa(s) em ${OUT}`);
