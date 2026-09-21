import { createClient } from '@supabase/supabase-js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(import.meta.dirname, '../..');
const BASE = process.env.MISEON_AUDIT_URL || 'http://127.0.0.1:4175';
const OUT = path.join(ROOT, 'output', 'manual', 'capturas-2026-09-20');
const ENV = Object.fromEntries(
  (await readFile(path.join(ROOT, '.env.local'), 'utf8'))
    .split(/\r?\n/)
    .filter((line) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line))
    .map((line) => {
      const [key, ...rest] = line.split('=');
      return [key, rest.join('=').trim().replace(/^"|"$/g, '')];
    }),
);

const supabaseUrl = ENV.VITE_SUPABASE_URL;
const serviceRole = ENV.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRole) throw new Error('Credenciais Supabase ausentes em .env.local');

const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: chrome,
  args: ['--no-sandbox', '--lang=pt-BR'],
});
await mkdir(OUT, { recursive: true });

const results = [];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function preparePage(viewport = { width: 1440, height: 1000 }) {
  const page = await browser.newPage();
  await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('miseon_cookie_consent_v1', JSON.stringify({
      tipo: 'apenas_essenciais',
      preferencias: { essenciais: true, analiticos: false, marketing: false },
      atualizadoEm: new Date().toISOString(),
    }));
  });
  return page;
}

async function capture(page, name, { fullPage = true } = {}) {
  await wait(900);
  const state = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    h1: document.querySelector('h1')?.textContent?.trim() || '',
    h2: document.querySelector('h2')?.textContent?.trim() || '',
    body: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 700),
  }));
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage });
  results.push({ name, file: path.relative(ROOT, file).replaceAll('\\', '/'), ...state });
  console.log(`CAPTURA ${name} <- ${state.url}`);
}

async function goto(page, route, options = {}) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle2', timeout: 60_000 });
  if (options.selector) await page.waitForSelector(options.selector, { timeout: 20_000 });
}

async function waitForText(page, text, timeout = 25_000) {
  await page.waitForFunction(
    (expected) => document.body.innerText.toLocaleLowerCase('pt-BR').includes(expected.toLocaleLowerCase('pt-BR')),
    { timeout },
    text,
  );
}

async function dismissSetupWizard(page) {
  const button = await page.$('button[title="Dispensar"]');
  if (!button) return false;
  await button.click();
  await wait(500);
  return true;
}

async function clickText(page, selector, pattern) {
  const clicked = await page.$$eval(selector, (nodes, source) => {
    const re = new RegExp(source, 'i');
    const node = nodes.find((element) => re.test(element.textContent || ''));
    if (!node) return false;
    node.click();
    return true;
  }, pattern.source);
  if (clicked) await wait(800);
  return clicked;
}

async function linkForTestAdmin() {
  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: loja, error: lojaError } = await admin
    .from('lojas')
    .select('id')
    .eq('slug', 'lanchepaulista')
    .single();
  if (lojaError) throw lojaError;

  const { data: vinculo, error: vinculoError } = await admin
    .from('usuarios_loja')
    .select('user_id')
    .eq('loja_id', loja.id)
    .eq('papel', 'admin')
    .limit(1)
    .single();
  if (vinculoError) throw vinculoError;

  const { data: usuario, error: usuarioError } = await admin.auth.admin.getUserById(vinculo.user_id);
  if (usuarioError) throw usuarioError;
  if (!usuario.user?.email) throw new Error('Administrador do tenant de provas não possui e-mail');

  const { data: generated, error: generateError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: usuario.user.email,
    options: { redirectTo: `${BASE}/admin` },
  });
  if (generateError) throw generateError;
  const actionLink = generated.properties?.action_link;
  if (!actionLink) throw new Error('Link de teste não foi criado');
  return actionLink;
}

async function installSession(page, actionLink) {
  await page.goto(actionLink, { waitUntil: 'networkidle2', timeout: 60_000 });
  await wait(1_500);
  if (!page.url().startsWith(BASE)) {
    throw new Error(`O link de teste não retornou ao ambiente local: ${new URL(page.url()).origin}`);
  }
}

try {
  // Percurso público: cada persona começa pela home e por sua página específica.
  const publicPage = await preparePage();
  await goto(publicPage, '/', { selector: 'h1' });
  await capture(publicPage, '00-home-primeiro-contato');

  const personas = [
    ['01-hamburgueria-posicionamento', '/sistema-para-hamburgueria'],
    ['02-lanchonete-posicionamento', '/sistema-para-lanchonete'],
    ['03-restaurante-salao-posicionamento', '/sistema-para-restaurantes'],
    ['04-pizzaria-posicionamento', '/sistema-para-pizzaria'],
    ['05-duas-unidades-primeiro-contato', '/'],
  ];
  for (const [name, route] of personas) {
    await goto(publicPage, route, { selector: 'h1' });
    await capture(publicPage, name);
  }

  await goto(publicPage, '/cadastre-se', { selector: 'h1' });
  await capture(publicPage, '06-cadastro-explicacao');
  const openedSignup = await clickText(publicPage, 'a,button', /criar|cadastrar|minha loja/i);
  if (openedSignup) await capture(publicPage, '07-cadastro-formulario');

  await goto(publicPage, '/', { selector: 'h1' });
  await publicPage.evaluate(() => document.querySelector('#planos')?.scrollIntoView());
  await capture(publicPage, '08-preco-planos', { fullPage: false });
  await publicPage.evaluate(() => document.querySelector('#suporte')?.scrollIntoView());
  await capture(publicPage, '09-suporte-publico', { fullPage: false });

  await goto(publicPage, '/lanchepaulista');
  await capture(publicPage, '10-cardapio-cliente-mobile', { fullPage: false });
  await publicPage.close();

  // Percurso autenticado, somente no tenant de provas. Nenhum formulário é salvo.
  const adminLink = await linkForTestAdmin();
  const adminPage = await preparePage();
  await installSession(adminPage, adminLink);

  const adminRoutes = [
    ['11-onboarding-inicio', '/admin/inicio'],
    ['12-configuracao-loja', '/admin/loja'],
    ['13-equipe-e-acessos', '/admin/equipe'],
    ['14-cardapio-administrativo', '/admin/cardapio'],
    ['16-pdv-primeiro-pedido', '/admin/pdv'],
    ['18-restaurante-mapa-mesas', '/admin/mesas'],
    ['19-restaurante-garcom-mobile', '/admin/garcom-mobile'],
    ['20-pizzaria-kds', '/admin/kds'],
    ['21-delivery-pedidos', '/admin/pedidos'],
    ['22-delivery-entregas', '/admin/entregas'],
    ['23-whatsapp-integracao', '/admin/whatsapp'],
    ['24-ifood-integracao', '/admin/ifood'],
    ['25-fiscal-nfce', '/admin/fiscal'],
    ['26-estoque-e-importacao', '/admin/estoque'],
    ['27-financeiro-extrato', '/admin/financeiro'],
    ['29-assinatura-preco', '/admin/assinatura'],
    ['30-ajuda-dentro-produto', '/admin/ajuda'],
  ];

  for (const [name, route] of adminRoutes) {
    await goto(adminPage, route);
    if (name === '23-whatsapp-integracao') {
      await waitForText(adminPage, 'Integração WhatsApp');
    } else {
      await wait(1_100);
    }
    await capture(adminPage, name, { fullPage: false });

    if (name === '11-onboarding-inicio') {
      await dismissSetupWizard(adminPage);
      await capture(adminPage, '11b-painel-sem-assistente-sobreposto', { fullPage: false });
    }

    if (name === '12-configuracao-loja') {
      if (await clickText(adminPage, 'button', /^Horários$/i)) {
        await capture(adminPage, '12b-configuracao-horarios', { fullPage: false });
      }
      if (await clickText(adminPage, 'button', /^Pagamentos$/i)) {
        await capture(adminPage, '12c-configuracao-pagamentos', { fullPage: false });
      }
    }

    if (name === '14-cardapio-administrativo') {
      const opened = await clickText(adminPage, 'button', /novo produto/i);
      if (opened) {
        await capture(adminPage, '15-formulario-novo-produto', { fullPage: false });
        await adminPage.evaluate(() => {
          const dialogs = [...document.querySelectorAll('[role="dialog"], .fixed.inset-0')];
          const dialog = dialogs.find((node) => node.textContent?.includes('Personalizações do item')) ?? dialogs.at(-1);
          if (dialog) dialog.scrollTop = dialog.scrollHeight;
        });
        await capture(adminPage, '15b-formulario-produto-ficha-personalizacoes', { fullPage: false });
      }
      await adminPage.keyboard.press('Escape');
    }

    if (name === '16-pdv-primeiro-pedido') {
      const added = await clickText(adminPage, 'button', /x-paulista|x-bacon|guaraná/i);
      if (added) {
        await clickText(adminPage, 'button', /^adicionar/i);
        await capture(adminPage, '17-pdv-carrinho-primeiro-pedido', { fullPage: false });
        await clickText(adminPage, 'button', /finalizar|pagamento|receber/i);
        await capture(adminPage, '17b-pdv-etapa-de-fechamento-sem-confirmar', { fullPage: false });
        await adminPage.keyboard.press('Escape');
      }
    }

    if (name === '27-financeiro-extrato') {
      const opened = await clickText(adminPage, 'button', /dre gerencial/i);
      if (opened) await capture(adminPage, '28-dre-demonstrativa-atual', { fullPage: false });
    }
  }
  await adminPage.close();

  const lines = [
    '# Manifesto de capturas novas do fluxo MiseOn',
    '',
    `**Gerado em:** ${new Date().toISOString()}`,
    `**Base:** ${BASE}`,
    '**Tenant autenticado:** `lanchepaulista`',
    '**Política:** navegação e abertura de formulários sem salvar produto, pedido, integração ou configuração.',
    '',
    '| Arquivo | Rota | Título/H1 observado |',
    '|---|---|---|',
    ...results.map((item) => `| \`${item.file}\` | ${item.url.replace(BASE, '')} | ${(item.h1 || item.h2 || item.title).replaceAll('|', '\\|')} |`),
    '',
  ];
  await writeFile(path.join(OUT, 'MANIFESTO.md'), lines.join('\n'), 'utf8');
  console.log(`\n${results.length} capturas novas gravadas em ${OUT}`);
} finally {
  await browser.close();
}
