// Verificacao visual do <MiseOnLogo /> recortado por CSS.
//
// O componente troca o lettering sintetico por um recorte da arte oficial
// (public/MiseOn-repagina-removebg-preview.png, 823x303). O recorte e feito com
// overflow-hidden + deslocamento negativo. Este script renderiza o componente
// nos tamanhos que o app realmente usa e falha se a imagem aparecer esticada
// (proporcao errada) ou vazia (recorte que nao mostra a marca).
//
// Uso:  node scripts/qa/verificar-logo-miseon.mjs
// Sai com codigo != 0 se qualquer tamanho reprovar.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import puppeteer from 'puppeteer';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ARTE = { w: 823, h: 303 };

// Mesma matematica do componente (manter em sincronia com MiseOnLogo.tsx).
const K = 459;
function caixa(size) {
  const scale = size / K;
  return {
    width: size,
    height: 170 * scale,
    imgW: ARTE.w * scale,
    imgH: ARTE.h * scale,
    left: -185 * scale,
    top: -51 * scale,
  };
}

const TAMANHOS = [110, 128, 130, 132, 140, 150, 160];

const mime = {
  '.html': 'text/html',
  '.png': 'image/png',
};

const servidor = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const conteudo = await readFile(join(raiz, 'public', rel.replace(/^\//, '')));
    res.writeHead(200, { 'Content-Type': mime[extname(rel)] ?? 'application/octet-stream' });
    res.end(conteudo);
  } catch {
    res.writeHead(404);
    res.end('nope');
  }
});

await new Promise((ok) => servidor.listen(0, ok));
const porta = servidor.address().port;

const html = `<!doctype html><html><body style="margin:0;background:#070C18">
${TAMANHOS.map((s) => {
  const c = caixa(s);
  return `<div data-size="${s}" style="position:relative;display:inline-block;overflow:hidden;width:${c.width}px;height:${c.height}px;margin:8px;outline:1px solid #FC5B24">
    <img src="/MiseOn-repagina-removebg-preview.png" style="pointer-events:none;position:absolute;max-width:none;width:${c.imgW}px;height:${c.imgH}px;left:${c.left}px;top:${c.top}px" />
  </div>`;
}).join('\n')}
</body></html>`;

const navegador = await puppeteer.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  args: ['--no-sandbox'],
});
const pagina = await navegador.newPage();
await pagina.setContent(html.replaceAll('src="/', `src="http://localhost:${porta}/`), { waitUntil: 'networkidle0' });

const resultados = await pagina.evaluate((arte) => {
  const alvos = [...document.querySelectorAll('div[data-size]')];
  return alvos.map((div) => {
    const size = Number(div.dataset.size);
    const img = div.querySelector('img');
    return {
      size,
      naturalW: img.naturalWidth,
      naturalH: img.naturalHeight,
      boxW: Math.round(div.getBoundingClientRect().width),
      boxH: Math.round(div.getBoundingClientRect().height),
    };
  });
}, ARTE);

await navegador.close();
servidor.close();

let falhas = 0;
for (const r of resultados) {
  const imgCarregou = r.naturalW === ARTE.w && r.naturalH === ARTE.h;
  const caixaOk = r.boxW > 0 && r.boxH > 0;
  const proporcaoImg = r.naturalH ? r.naturalW / r.naturalH : 0;
  const proporcaoEsperada = ARTE.w / ARTE.h;
  const semDistorcao = Math.abs(proporcaoImg - proporcaoEsperada) < 0.01;
  const ok = imgCarregou && caixaOk && semDistorcao;
  if (!ok) falhas += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  size=${r.size}  caixa=${r.boxW}x${r.boxH}  imagem=${r.naturalW}x${r.naturalH}`);
}

if (falhas > 0) {
  console.error(`\n${falhas} tamanho(s) reprovado(s).`);
  process.exit(1);
}
console.log(`\nOK - ${resultados.length} tamanho(s) renderizam a arte oficial sem distorcao.`);
