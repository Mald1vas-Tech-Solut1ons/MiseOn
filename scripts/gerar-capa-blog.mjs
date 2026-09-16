// Gera a capa 1280x720 de um artigo do blog a partir de scripts/ativos/capa-blog.html.
// Mesmo motor do carrossel e das cartelas: HTML no Chrome, via puppeteer.
//
//   node scripts/gerar-capa-blog.mjs loja-lotada
//   node scripts/gerar-capa-blog.mjs                 (todas)
//
// ESTA É A CAPA PROVISÓRIA. O padrão do blog é fotografia de cena real
// (scripts/gerar-capas-ia.mjs, Gemini). Esta serve para o artigo nunca ir ao
// ar sem capa própria, e o arquivo gerado tem exatamente o mesmo nome da foto
// que vai substituí-la — então a troca é rodar o gerador de IA com
// --refazer, sem tocar em blogData.ts.
//
// Cada entrada escolhe um `motivo` gráfico diferente (ver capa-blog.html):
// capa repetida entre artigos faz o hub parecer conteúdo reciclado.
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
    motivo: 'margem',
    apoio:
      'Movimento mede <strong>quantas vezes</strong> a operação rodou. Margem mede <strong>quanto sobrou</strong> de cada vez.',
    assinatura: 'Engenharia de custo para food service',
  },

  // Este artigo estava publicado apontando para uma capa que nunca existiu: o
  // card caía no fallback e o link compartilhado não tinha imagem nenhuma. A
  // guarda do prerender agora falha o build nesse caso.
  'calculadora-vazamento': {
    arquivo: 'calculadora-vazamento-cover',
    rotulo: 'GESTÃO FINANCEIRA',
    titulo: 'O caixa vaza',
    destaque: 'em silêncio',
    motivo: 'vazamento',
    apoio:
      'Reajuste não repassado, falta no rush, desvio de CMV. <strong>Nenhum aparece numa linha só.</strong>',
    assinatura: 'Diagnóstico operacional em 4 passos',
  },

  'delivery': {
    arquivo: 'delivery-margem-por-canal-cover',
    rotulo: 'GESTÃO FINANCEIRA',
    titulo: 'Delivery dá',
    destaque: 'dinheiro?',
    motivo: 'canais',
    apoio:
      'Comissão, embalagem e taxa saem <strong>do mesmo prato</strong>. Cada canal come uma fatia diferente.',
    assinatura: 'A margem por canal, na prática',
  },

  'presenca-digital': {
    arquivo: 'presenca-digital-restaurante-cover',
    rotulo: 'TECNOLOGIA & IA',
    titulo: 'Parecer amador',
    destaque: 'custa a venda',
    motivo: 'funil',
    apoio:
      'O cliente não avalia a sua comida pela internet. Ele avalia <strong>o risco de pedir</strong>.',
    assinatura: 'O que arrumar, e em que ordem',
  },

  'padaria': {
    arquivo: 'padaria-onde-esta-o-lucro-cover',
    rotulo: 'ENGENHARIA DE CARDÁPIO',
    titulo: 'Padaria dá dinheiro:',
    destaque: 'onde está o lucro',
    motivo: 'mix',
    apoio:
      'O pão traz a cidade para dentro da loja. <strong>A margem está no que entra na sacola junto.</strong>',
    assinatura: 'Quatro negócios na mesma loja',
  },

  'buffet': {
    arquivo: 'buffet-engenharia-do-balcao-cover',
    rotulo: 'ENGENHARIA DE CARDÁPIO',
    titulo: 'No self-service,',
    destaque: 'o cardápio é o balcão',
    motivo: 'balcao',
    apoio:
      'A ordem das cubas, a reposição e o fim do serviço decidem <strong>a margem do quilo</strong>.',
    assinatura: 'A engenharia do balcão',
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
  console.log(`  ✓ ${dados.arquivo}.jpg  (motivo: ${dados.motivo})`);
}

await nav.close();
console.log(`\n${chaves.length} capa(s) em ${OUT}`);
