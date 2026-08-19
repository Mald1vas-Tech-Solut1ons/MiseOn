/**
 * Passa por tDynamic tudo o que a Home e as landing pages mandam traduzir e
 * mostra o que REALMENTE muda em en-US.
 *
 * Envolver a string em tDynamic() não traduz nada por si só: se o texto não
 * estiver no dicionário, o fallback de substituição por palavra devolve quase
 * a mesma frase. Este script separa os três casos:
 *   traduzido   — saiu diferente e sem palavra em português sobrando
 *   parcial     — mudou, mas ainda tem português no meio (o pior caso: mistura)
 *   intacto     — não mudou nada
 *
 * Uso: node scripts/qa/conferir-traducao.mjs
 */
import fs from 'fs';
import path from 'path';

const { tDynamic } = await import('../../src/data/i18nData.ts').catch(async () => {
  // i18nData é TS: compila na hora com esbuild (já é dependência do vite)
  const { build } = await import('esbuild');
  const saida = path.join(process.cwd(), 'node_modules', '.cache-i18n.mjs');
  fs.mkdirSync(path.dirname(saida), { recursive: true });
  await build({
    entryPoints: ['src/data/i18nData.ts'],
    bundle: true, format: 'esm', platform: 'node', outfile: saida, logLevel: 'silent',
  });
  return import(`file://${saida}`);
});

const alvos = ['src/pages/Home.tsx', 'src/pages/landing', 'src/components/ui/FlipCard.tsx'];
const arquivos = [];
for (const a of alvos) {
  if (!fs.existsSync(a)) continue;
  if (fs.statSync(a).isDirectory()) {
    for (const e of fs.readdirSync(a)) if (/\.tsx?$/.test(e)) arquivos.push(path.join(a, e));
  } else arquivos.push(a);
}

const strings = new Set();
for (const arq of arquivos) {
  const txt = fs.readFileSync(arq, 'utf8');
  for (const m of txt.matchAll(/tDynamic\(\s*(['"])((?:\\.|(?!\1)[^\\])*)\1\s*\)/g)) {
    strings.add(m[2].replace(/\\'/g, "'").replace(/\\"/g, '"'));
  }
}

const PT_SOBRANDO = /\b(de|da|do|para|com|sem|seu|sua|você|não|mais|todo|toda|cada|pelo|pela|que|até|já|só|uma|nossa|nosso|sua|dos|das)\b/i;

const traduzido = [], parcial = [], intacto = [];
for (const s of strings) {
  const en = tDynamic(s, 'en-US');
  if (en === s) intacto.push(s);
  else if (PT_SOBRANDO.test(en)) parcial.push([s, en]);
  else traduzido.push([s, en]);
}

const total = strings.size;
const pct = (n) => ((n / total) * 100).toFixed(1) + '%';
console.log(`\nstrings marcadas para traduzir: ${total}\n`);
console.log(`  traduzido  ${String(traduzido.length).padStart(4)}  ${pct(traduzido.length)}`);
console.log(`  parcial    ${String(parcial.length).padStart(4)}  ${pct(parcial.length)}   <- mistura PT/EN na tela`);
console.log(`  intacto    ${String(intacto.length).padStart(4)}  ${pct(intacto.length)}   <- fica em portugues\n`);

if (parcial.length) {
  console.log('━━ PARCIAL (os piores: metade em cada idioma)');
  for (const [pt, en] of parcial.slice(0, 15)) console.log(`   pt: ${pt.slice(0, 76)}\n   en: ${en.slice(0, 76)}\n`);
  if (parcial.length > 15) console.log(`   … mais ${parcial.length - 15}\n`);
}
if (intacto.length) {
  console.log('━━ INTACTO (sem entrada no dicionario)');
  for (const s of intacto.slice(0, 20)) console.log(`   ${s.slice(0, 88)}`);
  if (intacto.length > 20) console.log(`   … mais ${intacto.length - 20}`);
}
