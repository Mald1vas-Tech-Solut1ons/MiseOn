// Captura prints reais das telas PÚBLICAS do MiseOn para o manual de conteúdo.
// Só rotas públicas: nada aqui precisa de login e nada altera dado.
import puppeteer from 'puppeteer';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'https://miseon.app.br';
const OUT = path.resolve('output/marketing/prints');

// Reels/TikTok/Stories = 9:16. Feed = 4:5. Desktop = 16:9.
const VIEWPORTS = {
  mobile:  { width: 430, height: 932, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 2 },
};

const TELAS = [
  // ── Vitrine: o que o CLIENTE FINAL vê (o confronto com o vídeo do site amador)
  { nome: '01-cardapio-quilo-topo',      url: '/demo-por-quilo',   vp: 'mobile' },
  { nome: '02-cardapio-quilo-scroll',    url: '/demo-por-quilo',   vp: 'mobile', scroll: 900 },
  { nome: '03-cardapio-quilo-full',      url: '/demo-por-quilo',   vp: 'mobile', full: true },
  { nome: '04-cardapio-burger-topo',     url: '/demo-hamburgueria',vp: 'mobile' },
  { nome: '05-cardapio-burger-scroll',   url: '/demo-hamburgueria',vp: 'mobile', scroll: 800 },
  { nome: '06-cardapio-natureba',        url: '/natureba',         vp: 'mobile' },
  { nome: '07-cardapio-paulista',        url: '/lanchepaulista',   vp: 'mobile' },
  { nome: '08-cardapio-paulista-full',   url: '/lanchepaulista',   vp: 'mobile', full: true },
  { nome: '09-cardapio-restaurante',     url: '/demo-restaurante', vp: 'mobile' },
  { nome: '10-cardapio-pizzaria',        url: '/demo-pizzaria',    vp: 'mobile' },
  { nome: '11-cardapio-quilo-desktop',   url: '/demo-por-quilo',   vp: 'desktop' },

  // ── Totem / autoatendimento
  { nome: '12-totem-demo',               url: '/demo-kiosk',       vp: 'desktop' },
  { nome: '13-autoatendimento',          url: '/autoatendimento',  vp: 'desktop' },

  // ── Site institucional (o que o LOJISTA vê ao chegar)
  { nome: '14-home-desktop',             url: '/',                 vp: 'desktop' },
  { nome: '15-home-mobile',              url: '/',                 vp: 'mobile' },
  { nome: '16-landing-por-quilo',        url: '/sistema-para-restaurante-por-quilo', vp: 'desktop' },
  { nome: '17-landing-por-quilo-mobile', url: '/sistema-para-restaurante-por-quilo', vp: 'mobile' },
  { nome: '18-landing-cardapio-qr',      url: '/cardapio-qr-code', vp: 'desktop' },
  { nome: '19-landing-ifood',            url: '/integracao-ifood', vp: 'desktop' },
  { nome: '20-estoque-3d',               url: '/gestao-de-estoque-3d', vp: 'desktop' },
];

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// O banner de cookies cobre a tela em todo print. Aceita só o essencial —
// é a opção mais preservadora de privacidade e some da foto.
async function dispensarCookies(page) {
  try {
    const botoes = await page.$$('button');
    for (const b of botoes) {
      const txt = (await page.evaluate((e) => e.innerText || '', b)).trim();
      if (/^Apenas Essenciais$/i.test(txt)) { await b.click(); await dormir(600); return; }
    }
  } catch { /* sem banner: segue */ }
}

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const navegador = await puppeteer.launch({ headless: 'new', executablePath: CHROME, args: ['--no-sandbox', '--lang=pt-BR'] });
await mkdir(OUT, { recursive: true });

let ok = 0, falhas = [];
for (const tela of TELAS) {
  const page = await navegador.newPage();
  try {
    await page.setViewport(VIEWPORTS[tela.vp]);
    await page.goto(BASE + tela.url, { waitUntil: 'networkidle2', timeout: 60000 });
    await dormir(2500);
    await dispensarCookies(page);
    if (tela.scroll) { await page.evaluate((y) => window.scrollTo(0, y), tela.scroll); await dormir(1200); }
    const arquivo = path.join(OUT, `${tela.nome}-${tela.vp}.png`);
    await page.screenshot({ path: arquivo, fullPage: !!tela.full });
    console.log('OK   ' + tela.nome + '  ->  ' + tela.url);
    ok++;
  } catch (e) {
    console.log('FALHA ' + tela.nome + ': ' + e.message.split('\n')[0]);
    falhas.push(tela.nome);
  } finally { await page.close(); }
}
await navegador.close();
console.log(`\n${ok}/${TELAS.length} prints em ${OUT}`);
if (falhas.length) console.log('falharam: ' + falhas.join(', '));
