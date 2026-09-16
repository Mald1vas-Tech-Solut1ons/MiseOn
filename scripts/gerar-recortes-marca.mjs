// Refaz os recortes da marca usados pelo motor de ativos.
//
//   node scripts/gerar-recortes-marca.mjs
//
// POR QUE ISTO EXISTE:
// `scripts/ativos/marca.png` e `lockup.png` são os arquivos oficiais de
// `public/` sem a margem transparente — sem o recorte, 52% e 69% do arquivo
// era vazio e a marca saía minúscula no quadro. Só que eles eram feitos à
// mão: quando o logo oficial foi trocado em 15/09/2026, os recortes ficaram
// com o desenho ANTIGO e continuaram sendo carimbados em carrossel, cartela,
// vinheta e capa de blog. A marca velha reapareceu em material novo, e
// ninguém tinha como notar olhando o código.
//
// Agora o recorte é derivado, não desenhado: trocou o logo em public/, roda
// isto e todo o motor de ativos passa a usar o logo novo. Os PNGs gerados
// são versionados junto — quem só gera uma cartela não precisa deste passo.
//
// O recorte roda no Chrome porque é ele quem já está aqui: carrega o PNG num
// canvas, acha o retângulo dos pixels visíveis e reexporta.
import puppeteer from 'puppeteer';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

/** origem em public/ → destino em scripts/ativos/ */
const RECORTES = [
  { de: 'public/icon.png', para: 'scripts/ativos/marca.png' },
  { de: 'public/MiseOn-repagina-removebg-preview.png', para: 'scripts/ativos/lockup.png' },
];

const nav = await puppeteer.launch({
  headless: 'new',
  executablePath: CHROME,
  args: ['--no-sandbox'],
});
const page = await nav.newPage();
await page.goto('about:blank');

for (const { de, para } of RECORTES) {
  // O PNG entra como data: URL. Carregar por file:// numa página em branco
  // não funciona (origem opaca) e ainda sujaria o canvas para o getImageData.
  const url = `data:image/png;base64,${(await readFile(path.resolve(de))).toString('base64')}`;

  const resultado = await page.evaluate(async (src) => {
    const img = await new Promise((ok, erro) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => erro(new Error('não carregou'));
      i.src = src;
    });

    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth;
    cv.height = img.naturalHeight;
    const cx = cv.getContext('2d');
    cx.drawImage(img, 0, 0);

    const { data } = cx.getImageData(0, 0, cv.width, cv.height);
    let x0 = cv.width, y0 = cv.height, x1 = -1, y1 = -1;
    for (let y = 0; y < cv.height; y++) {
      for (let x = 0; x < cv.width; x++) {
        // 8 de alfa: abaixo disso é sujeira de antialiasing, não desenho
        if (data[(y * cv.width + x) * 4 + 3] > 8) {
          if (x < x0) x0 = x;
          if (y < y0) y0 = y;
          if (x > x1) x1 = x;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) throw new Error('imagem inteiramente transparente');

    const larguraCortada = x1 - x0 + 1;
    const alturaCortada = y1 - y0 + 1;
    const corte = document.createElement('canvas');
    corte.width = larguraCortada;
    corte.height = alturaCortada;
    corte.getContext('2d').drawImage(cv, x0, y0, larguraCortada, alturaCortada, 0, 0, larguraCortada, alturaCortada);

    return {
      dataUrl: corte.toDataURL('image/png'),
      antes: `${cv.width}x${cv.height}`,
      depois: `${larguraCortada}x${alturaCortada}`,
      vazioPct: Math.round((1 - (larguraCortada * alturaCortada) / (cv.width * cv.height)) * 100),
    };
  }, url);

  const png = Buffer.from(resultado.dataUrl.split(',')[1], 'base64');
  await writeFile(path.resolve(para), png);
  console.log(`  ✓ ${para}  ${resultado.antes} → ${resultado.depois}  (${resultado.vazioPct}% era margem vazia)`);
}

await nav.close();
console.log('\nRecortes atualizados a partir de public/. Regere as peças que os usam.');
