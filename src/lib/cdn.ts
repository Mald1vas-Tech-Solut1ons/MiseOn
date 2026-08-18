/**
 * Redireciona URLs públicas do Supabase Storage para uma CDN de borda, para
 * zerar o consumo de Egress de leitura do Supabase.
 *
 * O host da CDN vem de VITE_CDN_HOST. Sem essa variável, a URL original do
 * Supabase é devolvida intacta — a imagem carrega, só sem o cache de borda.
 *
 * Isso é proposital: apontar para um host que não resolve no DNS derruba TODAS
 * as imagens do site de uma vez (foi o que aconteceu quando o código cravava
 * cdn.miseon.app.br, subdomínio que nunca existiu). Só ative a variável depois
 * que o DNS do subdomínio estiver de pé e servindo /storage/v1/object/public/.
 *
 * @param url URL da imagem (pode ser pública do Supabase, externa ou vazia)
 * @returns URL na CDN quando configurada, ou a URL intacta
 */
const CDN_HOST = (import.meta.env?.VITE_CDN_HOST as string | undefined)?.replace(/\/+$/, '');

export function getOptimizedImageUrl(url?: string | null): string {
  if (!url) return '';

  if (CDN_HOST && url.includes('.supabase.co/storage/v1/object/public/')) {
    return url.replace(
      /https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\//,
      `${CDN_HOST}/storage/v1/object/public/`
    );
  }

  return url;
}
