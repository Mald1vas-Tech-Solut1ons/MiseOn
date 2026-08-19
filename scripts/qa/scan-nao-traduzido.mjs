/**
 * Encontra texto visível em português que NÃO passa por tradução.
 *
 * Procura duas coisas nos arquivos alvo:
 *   1. texto solto entre tags JSX  -> <p>Alguma frase</p>
 *   2. props de texto com literal   -> titulo="Alguma frase", placeholder='...'
 * e ignora o que já está dentro de tDynamic(...) ou t(...).
 *
 * Uso: node scripts/qa/scan-nao-traduzido.mjs [arquivo|pasta ...]
 *      sem argumento, varre a Home e as landing pages.
 */
import fs from 'fs';
import path from 'path';

const alvosPadrao = [
  'src/pages/Home.tsx',
  'src/pages/landing',
  'src/data/landingPagesData.ts',
];

const args = process.argv.slice(2);
const alvos = args.length ? args : alvosPadrao;

const arquivos = [];
for (const a of alvos) {
  if (!fs.existsSync(a)) continue;
  if (fs.statSync(a).isDirectory()) {
    for (const e of fs.readdirSync(a)) {
      if (/\.(tsx?|ts)$/.test(e)) arquivos.push(path.join(a, e));
    }
  } else arquivos.push(a);
}

// Sinais de português: acento, ou palavra funcional comum. Evita pegar
// classe CSS, chave de objeto e identificador em inglês.
const PT = /[áàâãéêíóôõúüç]|\b(de|da|do|para|com|sem|seu|sua|você|não|mais|todo|toda|cada|pelo|pela|nos|nas|em|por|que|até|já|só|ao|à)\b/i;

const ignorar = (txt) =>
  !txt ||
  txt.length < 4 ||
  !/[a-zA-ZÀ-ÿ]/.test(txt) ||          // só símbolo/número
  !PT.test(txt) ||                      // não parece português
  /^[A-Z_]+$/.test(txt) ||              // CONSTANTE
  /^(https?:|\/|#|\d)/.test(txt) ||     // url, rota, número
  /^[a-z-]+$/.test(txt);                // provável classe/slug

const achados = [];

for (const arq of arquivos) {
  const linhas = fs.readFileSync(arq, 'utf8').split(/\r?\n/);
  linhas.forEach((linha, i) => {
    const n = i + 1;
    if (/^\s*(\/\/|\*|\/\*)/.test(linha)) return;      // comentário
    if (/tDynamic\(|(?<![\w.])t\(/.test(linha)) return; // já traduz nesta linha

    // 1. texto entre tags:  >Texto aqui<
    for (const m of linha.matchAll(/>([^<>{}\n]{4,120})</g)) {
      const txt = m[1].trim();
      if (!ignorar(txt)) achados.push({ arq, n, tipo: 'texto JSX', txt });
    }

    // 2. prop com string literal
    for (const m of linha.matchAll(/\b(placeholder|title|alt|label|titulo|texto|subtitulo|descricao|resumo|badge|metrica|cta)\s*=\s*["']([^"']{4,120})["']/g)) {
      const txt = m[2].trim();
      if (!ignorar(txt)) achados.push({ arq, n, tipo: `prop ${m[1]}`, txt });
    }
  });
}

const porArquivo = {};
for (const a of achados) (porArquivo[a.arq] ??= []).push(a);

console.log(`\narquivos varridos: ${arquivos.length}`);
console.log(`strings visíveis sem tradução: ${achados.length}\n`);
for (const [arq, itens] of Object.entries(porArquivo).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`━━ ${arq}  (${itens.length})`);
  for (const it of itens.slice(0, 12)) console.log(`   ${String(it.n).padStart(4)}  ${it.txt.slice(0, 88)}`);
  if (itens.length > 12) console.log(`   … mais ${itens.length - 12}`);
  console.log();
}
if (!achados.length) console.log('nenhuma string visível ficou fora da tradução.');
