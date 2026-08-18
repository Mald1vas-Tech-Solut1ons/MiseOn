/**
 * Redireciona URLs públicas do Supabase Storage para a CDN Cloudflare (cdn.miseon.app.br).
 * Zera o consumo de Egress de leitura do Supabase servindo imagens em cache de borda.
 *
 * @param url URL da imagem (pode ser pública do Supabase, externa ou vazia)
 * @returns URL reescrita apontando para a CDN Cloudflare, ou a URL intacta se for externa/nula
 */
export function getOptimizedImageUrl(url?: string | null): string {
  if (!url) return '';
  
  // Reescreve qualquer subdomínio do Supabase Storage público para a CDN Cloudflare
  if (url.includes('.supabase.co/storage/v1/object/public/')) {
    return url.replace(
      /https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\//,
      'https://cdn.miseon.app.br/storage/v1/object/public/'
    );
  }
  
  return url;
}
