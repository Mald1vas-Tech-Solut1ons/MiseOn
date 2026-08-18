/**
 * Serve imagens do Supabase Storage pela borda, em vez de buscar na origem a
 * cada acesso — o que fazia todo visitante virar egress pago no Supabase.
 *
 * A URL publica do Storage vira /img/<caminho> no proprio dominio, atendido
 * pela função em api/img.ts com cache de um ano. O dominio ja esta atras do
 * Cloudflare, entao a partir do primeiro acesso a imagem sai da borda
 * (medido em producao: cf-cache-status HIT).
 *
 * Por que no proprio dominio e nao num subdominio: a primeira versao disto
 * apontava para cdn.miseon.app.br, que nunca existiu no DNS, e derrubou todas
 * as imagens do site de uma vez. Aqui nao ha host novo para dar errado.
 *
 * VITE_CDN_HOST continua disponivel para apontar para uma CDN externa no dia
 * em que existir uma; sem ela, usa o proprio dominio.
 *
 * @param url URL da imagem (publica do Supabase, externa ou vazia)
 * @returns URL servida pela borda, ou a URL intacta se for externa/nula
 */
const CDN_HOST = (import.meta.env?.VITE_CDN_HOST as string | undefined)?.replace(/\/+$/, '');

const PREFIXO_STORAGE = /^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\//;

export function getOptimizedImageUrl(url?: string | null): string {
  if (!url) return '';
  if (!PREFIXO_STORAGE.test(url)) return url;

  const caminho = url.replace(PREFIXO_STORAGE, '');

  if (CDN_HOST) return `${CDN_HOST}/storage/v1/object/public/${caminho}`;

  // Absoluta de proposito: este helper tambem alimenta og:image, e crawler de
  // rede social nao resolve caminho relativo.
  const base = typeof window !== 'undefined' ? window.location.origin : '';

  // /img e uma funcao da Vercel: nao existe no vite dev nem no vite preview.
  // Em maquina local a imagem vem direto do Supabase, senao quebraria o dev.
  if (!base || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(base)) return url;

  return `${base}/img/${caminho}`;
}
