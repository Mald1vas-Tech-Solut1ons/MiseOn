// Gera sitemap.xml a partir de scripts/public-routes.mjs — fonte única da
// verdade. Antes o arquivo era mantido à mão e tinha 16 URLs enquanto o app
// já tinha 20+; qualquer rota nova era esquecida no sitemap.
//
// Escreve em dois lugares:
//  - public/sitemap.xml → fonte versionada, serve o `vite preview`/dev local
//  - dist/sitemap.xml   → sobrescreve a cópia estática que o `vite build` já
//    havia copiado de public/ ANTES deste script rodar (senão a Vercel serve
//    a versão desatualizada de quando o build começou).
import { writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_ROUTES } from './public-routes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_OUT = path.resolve(__dirname, '..', 'public', 'sitemap.xml');
const DIST_OUT = path.resolve(__dirname, '..', 'dist', 'sitemap.xml');
const BASE = 'https://miseon.app.br';

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Path relativo (arquivo em public/) vira absoluto com BASE; URL já absoluta
// (ex.: thumbnail do YouTube) é usada como está.
const resolveUrl = (u) => (u.startsWith('http') ? u : `${BASE}${u}`);

function videoBlock(videos) {
  if (!videos?.length) return '';
  return videos
    .map((v) => {
      // content_loc exige um arquivo de mídia bruto (nosso .mp4 local).
      // player_loc é pra player de terceiro embutido (embed do YouTube) —
      // são mutuamente exclusivos na spec do Google.
      const locTag = v.player
        ? `<video:player_loc allow_embed="yes">${resolveUrl(v.player)}</video:player_loc>`
        : `<video:content_loc>${resolveUrl(v.content)}</video:content_loc>`;
      return `
    <video:video>
      <video:thumbnail_loc>${resolveUrl(v.thumbnail)}</video:thumbnail_loc>
      <video:title>${escapeXml(v.title)}</video:title>
      <video:description>${escapeXml(v.description)}</video:description>
      ${locTag}
    </video:video>`;
    })
    .join('');
}

const urls = PUBLIC_ROUTES.map(
  (r) => `  <url>
    <loc>${BASE}${r.path}</loc>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority.toFixed(1)}</priority>${videoBlock(r.video)}
  </url>`
).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${urls}
</urlset>
`;

await writeFile(PUBLIC_OUT, xml, 'utf-8');
await writeFile(DIST_OUT, xml, 'utf-8');
console.log(`sitemap.xml gerado com ${PUBLIC_ROUTES.length} URLs (public/ e dist/).`);

// Arquivos de verificação de buscador não são referenciados por nenhum
// código, então nada quebra visivelmente quando somem — foi assim que as
// duas chaves do IndexNow foram deletadas no commit 583a2bf e ficaram 404 em
// produção sem ninguém notar. Falha o build em vez de publicar sem elas.
const ARQUIVOS_VERIFICACAO = [
  '85ab415ae21f43bb8c74ac936ea56de5.txt', // chave IndexNow (Bing/Yandex/Seznam/Naver)
  'bafd591fb187443394a2f30550742e97.txt', // chave IndexNow secundária
  'robots.txt',
];

const faltando = [];
for (const nome of ARQUIVOS_VERIFICACAO) {
  try {
    await stat(path.join(__dirname, '..', 'dist', nome));
  } catch {
    faltando.push(nome);
  }
}
if (faltando.length) {
  console.error(
    `\n❌ Arquivo(s) de verificação de buscador ausente(s) em dist/: ${faltando.join(', ')}\n` +
    `   Devem existir em public/. Sem eles o IndexNow é rejeitado e o site perde\n` +
    `   a indexação instantânea no Bing.\n`
  );
  process.exit(1);
}
console.log(`Arquivos de verificação de buscador conferidos: ${ARQUIVOS_VERIFICACAO.length}/${ARQUIVOS_VERIFICACAO.length}.`);
