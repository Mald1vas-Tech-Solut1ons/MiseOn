/**
 * CDN de imagens: /img/<caminho> serve o arquivo do Supabase Storage publico
 * com cache de borda da Vercel.
 *
 * Por que existe: as imagens saiam direto do Supabase, e todo acesso de todo
 * visitante contava como egress la. A primeira tentativa de resolver isso
 * apontou as URLs para cdn.miseon.app.br — subdominio que nunca existiu no
 * DNS — e derrubou todas as imagens do site de uma vez.
 *
 * Por que uma funcao e nao um rewrite: um rewrite do vercel.json para host
 * externo e pass-through, nao entra no cache da CDN (medido: x-vercel-cache
 * MISS em toda chamada). Respondendo daqui com s-maxage, a borda guarda o
 * arquivo e o Supabase so paga o primeiro acesso de cada regiao.
 *
 * O Cloudflare na frente do dominio esta com cache em BYPASS por configuracao
 * do painel, entao hoje quem cacheia e a borda da Vercel. Se um dia a regra do
 * Cloudflare for ajustada, o Cache-Control abaixo ja esta pronto para ele.
 *
 * Somente leitura do bucket publico: nenhuma chave, nenhum header de auth.
 */

const PROJETO_SUPABASE = process.env.SUPABASE_PROJECT_REF ?? 'zzuxklwhaoisuuvndtfw';
const BASE_STORAGE = `https://${PROJETO_SUPABASE}.supabase.co/storage/v1/object/public`;

/** Um ano na borda; os arquivos sao gravados com nome UUID, nunca sobrescritos. */
const CACHE = 'public, max-age=31536000, s-maxage=31536000, immutable';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const { pathname } = new URL(req.url);
  const caminho = pathname.replace(/^\/img\//, '');

  // Impede que o caminho escape do bucket publico ou vire outro host.
  if (!caminho || caminho.includes('..') || caminho.startsWith('/')) {
    return new Response('Caminho invalido', { status: 400 });
  }

  const origem = `${BASE_STORAGE}/${caminho}`;

  let resposta: Response;
  try {
    resposta = await fetch(origem, { method: req.method, headers: { Accept: 'image/*,*/*' } });
  } catch {
    return new Response('Falha ao buscar a imagem na origem', { status: 502 });
  }

  if (!resposta.ok) {
    // Erro da origem nao pode ficar preso na borda por um ano.
    return new Response(resposta.status === 404 ? 'Imagem nao encontrada' : 'Erro na origem', {
      status: resposta.status === 404 ? 404 : 502,
      headers: { 'Cache-Control': 'public, max-age=60' },
    });
  }

  const headers = new Headers();
  headers.set('Content-Type', resposta.headers.get('Content-Type') ?? 'application/octet-stream');
  const tamanho = resposta.headers.get('Content-Length');
  if (tamanho) headers.set('Content-Length', tamanho);
  headers.set('Cache-Control', CACHE);
  headers.set('X-Content-Type-Options', 'nosniff');

  return new Response(resposta.body, { status: 200, headers });
}
