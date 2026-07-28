// Gera sitemap.xml a partir de scripts/public-routes.mjs — fonte única da
// verdade. Antes o arquivo era mantido à mão e tinha 16 URLs enquanto o app
// já tinha 20+; qualquer rota nova era esquecida no sitemap.
//
// Escreve em dois lugares:
//  - public/sitemap.xml → fonte versionada, serve o `vite preview`/dev local
//  - dist/sitemap.xml   → sobrescreve a cópia estática que o `vite build` já
//    havia copiado de public/ ANTES deste script rodar (senão a Vercel serve
//    a versão desatualizada de quando o build começou).
import { writeFile } from 'node:fs/promises';
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

function videoBlock(videos) {
  if (!videos?.length) return '';
  return videos
    .map(
      (v) => `
    <video:video>
      <video:thumbnail_loc>${BASE}${v.thumbnail}</video:thumbnail_loc>
      <video:title>${escapeXml(v.title)}</video:title>
      <video:description>${escapeXml(v.description)}</video:description>
      <video:content_loc>${BASE}${v.content}</video:content_loc>
    </video:video>`
    )
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
