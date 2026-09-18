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

/** Endpoint de transformacao (plano Pro). Ver o bloco de medicao no handler. */
const BASE_RENDER = `https://${PROJETO_SUPABASE}.supabase.co/storage/v1/render/image/public`;

/** Teto de largura: acima disso nenhuma tela do MiseOn ganha nitidez. */
const LARGURA_MAX = 1600;

/** Mesma qualidade que o upload ja aplica em `ImageUpload.tsx`. */
const QUALIDADE = 75;

/** Um ano na borda; os arquivos sao gravados com nome UUID, nunca sobrescritos. */
const CACHE = 'public, max-age=31536000, s-maxage=31536000, immutable';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // O caminho chega por query (?p=), e nao como rota: o vercel.json reescreve
  // /img/<caminho> para ca. Rota catch-all com colchetes no nome do arquivo nao
  // foi servida por este projeto — caia no fallback da SPA em vez da funcao.
  const caminho = new URL(req.url).searchParams.get('p') ?? '';

  // Impede que o caminho escape do bucket publico ou vire outro host.
  if (!caminho || caminho.includes('..') || caminho.startsWith('/') || caminho.includes('://')) {
    return new Response('Caminho invalido', { status: 400 });
  }

  // ── Transformacao na origem (plano Pro) ──────────────────────────────────
  //
  // Medido em 18/09/2026, no banner de banner do lanchepaulista:
  //
  //   objeto cru .................. 16.772.595 bytes (16 MB, PNG)
  //   render, width=1600, q=75 .....  4.999.288 bytes
  //   render + Accept: image/webp ....  307.898 bytes  (98% menos)
  //
  // Um banner de 16 MB servido a um visitante e ~0,3% da franquia mensal de
  // egress de uma vez so. Foi esse tipo de gasto que estourou a cota e derrubou
  // a producao por tres dias em 16/09.
  //
  // O `Accept` do navegador viaja para a origem, entao quem aceita WebP recebe
  // WebP e quem nao aceita (crawler velho de rede social lendo og:image) recebe
  // o formato original. Por isso o `Vary: Accept` la embaixo: sem ele a borda
  // entregaria o WebP cacheado para quem nao sabe ler.
  //
  // SVG nao passa pelo transformador — nao ha o que redimensionar num vetor, e
  // o endpoint recusa. Vai direto ao objeto.
  const ehSvg = /\.svg$/i.test(caminho.split('?')[0]);
  const aceita = req.headers.get('Accept') ?? 'image/*,*/*';
  const origem = ehSvg
    ? `${BASE_STORAGE}/${caminho}`
    : `${BASE_RENDER}/${caminho}?width=${LARGURA_MAX}&quality=${QUALIDADE}`;

  let resposta: Response;
  try {
    resposta = await fetch(origem, { method: req.method, headers: { Accept: aceita } });

    // Rede de seguranca: se a transformacao falhar (recurso desligado no
    // painel, formato nao suportado, franquia de imagens de origem estourada),
    // a imagem NAO pode sumir do cardapio. Cai para o objeto cru, que e o
    // comportamento que este proxy sempre teve.
    if (!ehSvg && !resposta.ok) {
      resposta = await fetch(`${BASE_STORAGE}/${caminho}`, {
        method: req.method,
        headers: { Accept: 'image/*,*/*' },
      });
    }
  } catch {
    return new Response('Falha ao buscar a imagem na origem', { status: 502 });
  }

  if (!resposta.ok) {
    // O Storage devolve 400 para objeto inexistente, nao 404 — os dois viram
    // 404 aqui. Erro da origem nao pode ficar preso na borda por um ano.
    const ausente = resposta.status === 404 || resposta.status === 400;
    return new Response(ausente ? 'Imagem nao encontrada' : 'Erro na origem', {
      status: ausente ? 404 : 502,
      headers: { 'Cache-Control': 'public, max-age=60' },
    });
  }

  const headers = new Headers();
  headers.set('Content-Type', resposta.headers.get('Content-Type') ?? 'application/octet-stream');
  const tamanho = resposta.headers.get('Content-Length');
  if (tamanho) headers.set('Content-Length', tamanho);
  headers.set('Cache-Control', CACHE);
  headers.set('X-Content-Type-Options', 'nosniff');
  // O corpo depende do `Accept` de quem pediu (WebP ou formato original).
  headers.set('Vary', 'Accept');

  return new Response(resposta.body, { status: 200, headers });
}
