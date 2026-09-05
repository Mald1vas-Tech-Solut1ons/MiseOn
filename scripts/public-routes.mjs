import { readFileSync } from 'node:fs';

// Fonte única de verdade das rotas públicas de marketing — usada tanto pelo
// prerender (scripts/prerender.mjs) quanto pela geração do sitemap
// (scripts/generate-sitemap.mjs). Antes, o sitemap.xml era mantido à mão e
// divergia das rotas reais do app (16 URLs no sitemap vs 20+ no roteador).
//
// Ao adicionar uma página de marketing nova em src/main.tsx, adicione aqui
// também — os dois scripts derivam tudo deste array.


/**
 * Slugs dos artigos, lidos direto de src/data/blogData.ts.
 *
 * Antes esta lista era escrita à mão, e envelhecia calada: o blog chegou a
 * onze artigos com apenas quatro no sitemap — sete textos invisíveis para o
 * Google, incluindo os publicados no mesmo dia. Como o arquivo de dados é
 * TypeScript e estes scripts são Node puro, a leitura é por texto: basta o
 * campo `slug` no formato que o arquivo já usa.
 */
function rotasDoBlog() {
  const arquivo = new URL('../src/data/blogData.ts', import.meta.url);
  let conteudo = '';
  try {
    conteudo = readFileSync(arquivo, 'utf-8');
  } catch {
    return [];
  }

  const slugs = [...conteudo.matchAll(/^\s{4}slug:\s*'([^']+)'/gm)].map((m) => m[1]);
  const unicos = [...new Set(slugs)];

  if (unicos.length === 0) {
    throw new Error('Nenhum artigo encontrado em blogData.ts — o formato do arquivo mudou?');
  }

  return unicos.map((slug) => ({
    path: `/blog/${slug}`,
    changefreq: 'monthly',
    priority: 0.8,
  }));
}

export const PUBLIC_ROUTES = [
  // A home É prerenderizada, em dist/index.html, com H1 real e visível.
  // O shell da SPA para as rotas dinâmicas (/admin, /superadmin, /entregador,
  // /:slug, /pedido/:id) foi movido para dist/app.html, para onde o rewrite
  // catch-all do vercel.json aponta — por isso dar conteúdo real ao
  // index.html não contamina mais as rotas dinâmicas.
  { path: '/', changefreq: 'weekly', priority: 1.0 },

  { path: '/acesso', changefreq: 'yearly', priority: 0.4 },
  { path: '/sobre', changefreq: 'monthly', priority: 0.8 },
  { path: '/contato', changefreq: 'monthly', priority: 0.8 },
  { path: '/termos', changefreq: 'yearly', priority: 0.3 },
  { path: '/privacidade', changefreq: 'yearly', priority: 0.3 },
  { path: '/lojas', changefreq: 'weekly', priority: 0.6 },
  { path: '/cadastre-se', changefreq: 'monthly', priority: 0.9 },

  {
    path: '/videos',
    changefreq: 'weekly',
    priority: 0.9,
    video: [
      {
        thumbnail: '/MISEON-logo.png',
        title: 'Identidade e Ecossistema MiseOn',
        description: 'Conheça o conceito, o rigor de engenharia e o design da plataforma MiseOn.',
        content: '/MiseOn%20brand%20identity/videoIntro1.mp4',
      },
      {
        thumbnail: '/MISEON-logo.png',
        title: 'Demonstracao do PDV e KDS em Tempo Real',
        description: 'Veja como o fluxo continuo conecta o salao, o caixa e a linha de producao.',
        content: '/videoIntro.mp4',
      },
      {
        thumbnail: '/MISEON-logo.png',
        title: 'Integracao Nativa com iFood',
        description: 'Sincronizacao instantanea de cardapio, pedidos do iFood no KDS e estoque.',
        content: '/videoMarketing.mp4',
      },
      {
        thumbnail: '/MISEON-logo.png',
        title: 'Atendimento Inteligente no WhatsApp com IA',
        description: 'Como a IA do MiseOn conversa no WhatsApp e gera pedidos automaticamente.',
        content: '/videomarketing2.mp4',
      },
      {
        // Hospedado no canal do YouTube — usa player_loc (embed de terceiro),
        // não content_loc (reservado a arquivo de mídia bruto), conforme a
        // spec do Google para vídeo em sitemap.
        thumbnail: 'https://img.youtube.com/vi/0ZP6ZQ7wvVA/hqdefault.jpg',
        title: 'Pare de Perder Pedidos no WhatsApp | MiseOn Case #1',
        description: 'Case #1 da série MiseOn: como o atendimento por WhatsApp com IA evita pedido perdido e organiza o fluxo da cozinha.',
        player: 'https://www.youtube-nocookie.com/embed/0ZP6ZQ7wvVA?rel=0',
      },
    ],
  },

  { path: '/sistema-para-hamburgueria', changefreq: 'weekly', priority: 0.9 },
  { path: '/sistema-para-lanchonete', changefreq: 'weekly', priority: 0.9 },
  { path: '/sistema-para-pizzaria', changefreq: 'weekly', priority: 0.9 },
  { path: '/sistema-para-restaurantes', changefreq: 'weekly', priority: 0.9 },
  { path: '/sistema-para-restaurante-por-quilo', changefreq: 'weekly', priority: 0.9 },
  { path: '/sistema-para-bar', changefreq: 'weekly', priority: 0.9 },
  { path: '/sistema-para-dark-kitchen', changefreq: 'weekly', priority: 0.9 },
  { path: '/integracao-ifood', changefreq: 'weekly', priority: 0.9 },
  { path: '/cardapio-qr-code', changefreq: 'weekly', priority: 0.9 },
  { path: '/api-whatsapp-restaurantes', changefreq: 'weekly', priority: 0.9 },
  { path: '/painel-de-senhas-tv', changefreq: 'weekly', priority: 0.9 },
  { path: '/gestao-fiscal-nfe', changefreq: 'weekly', priority: 0.9 },
  { path: '/gestao-de-estoque-3d', changefreq: 'weekly', priority: 0.8 },
  // Vertical MiseOn Kiosk (commit de lançamento editou o sitemap.xml à mão
  // sem cadastrar aqui — o próximo build as apagava. /totem é redirect para
  // /autoatendimento, então não entra).
  { path: '/autoatendimento', changefreq: 'weekly', priority: 1.0 },
  { path: '/demo-kiosk', changefreq: 'weekly', priority: 0.9 },
  { path: '/blog', changefreq: 'daily', priority: 0.9 },
  // Os posts entram automaticamente logo abaixo — ver ROTAS_DO_BLOG.
  ...rotasDoBlog(),
];

// Rotas que renderizam o MESMO componente/conteúdo de uma rota acima
// (ex.: /ajuda/estoque === /gestao-de-estoque-3d). São prerenderizadas para
// que um link direto ou compartilhamento social tenha HTML correto, mas
// ficam FORA do sitemap.xml — cada uma já declara <link rel="canonical">
// apontando para a rota principal, então submetê-las ao Google seria
// conteúdo duplicado.
export const DUPLICATE_ROUTES = [
  '/depoimentos', // mesmo componente de /videos, canonical -> /videos
  '/demonstracao', // mesmo componente de /videos, canonical -> /videos
  '/ajuda/estoque', // mesmo componente de /gestao-de-estoque-3d, canonical já embutido no componente
];
