// Fonte única de verdade das meta tags das páginas públicas que NÃO são
// landing pages de nicho (essas ficam em landingPagesData.ts).
//
// Lido em dois lugares, e é por isso que existe:
//  1. Pelos componentes React, via <SEO {...PAGE_META['/rota']} /> — define
//     title/description no navegador.
//  2. Por scripts/prerender.mjs no build — gera o HTML estático de cada rota
//     com title, description, canonical e H1 corretos, para os crawlers que
//     NÃO executam JavaScript (Bing e a maioria dos bots de IA).
//
// Se estas duas fontes divergirem, o crawler vê uma coisa e o usuário outra.
// Por isso: um lugar só. Ao criar página pública nova, adicione aqui.

export interface PageMeta {
  title: string;
  description: string;
  keywords?: string;
  canonicalUrl: string;
  /**
   * Texto puro do H1 da página — sem JSX, sem <span> de gradiente.
   * Usado pelo prerender para escrever o H1 no HTML estático. Deve ser
   * equivalente ao H1 que o componente renderiza na tela.
   */
  h1: string;
}

const BASE = 'https://miseon.app.br';

export const PAGE_META: Record<string, PageMeta> = {
  // A home é prerenderizada em dist/index.html com este H1 REAL e VISÍVEL.
  // Antes havia aqui um H1 escondido por CSS (clip:rect(0,0,0,0), 1px) que o
  // Bing Webmaster Tools continuava reportando como "Marca H1 ausente" —
  // analisador de SEO desconta conteúdo oculto, porque texto escondido é
  // técnica conhecida de spam. Conteúdo dentro de <noscript> ele também não
  // conta. A única coisa que resolve é H1 de verdade no HTML servido.
  '/': {
    title: 'MiseOn | Operação e custos conectados para restaurantes',
    description:
      'Conecte salão, delivery, WhatsApp, cozinha, estoque e custos em um único fluxo com o MiseOn. Teste por 30 dias ou agende uma demonstração.',
    keywords:
      'sistema para restaurante, comanda eletrônica para bares, gerenciador de delivery integrado, sistema para hamburgueria, sistema para pizzaria, cardápio digital qr code, integração ifood, whatsapp ia restaurante',
    canonicalUrl: `${BASE}/`,
    h1: 'Do pedido ao custo real, o MiseOn conecta sua operação.',
  },

  '/acesso': {
    title: 'Área de Acesso MiseOn | Cliente, Lojista e Entregador',
    description:
      'Escolha como quer entrar no MiseOn: pedir como cliente, acessar o painel como lojista e equipe, ou abrir o app do entregador.',
    canonicalUrl: `${BASE}/acesso`,
    h1: 'Escolha o seu acesso',
  },

  '/lojas': {
    title: 'Lojas no MiseOn | Encontre Restaurantes Perto de Você',
    description:
      'Veja restaurantes, hamburguerias e pizzarias cadastrados no MiseOn perto de você e monte seu pedido direto, sem precisar instalar app.',
    canonicalUrl: `${BASE}/lojas`,
    h1: 'Lojas no MiseOn',
  },

  '/cadastre-se': {
    title: 'Cadastre sua loja no MiseOn | Teste o sistema',
    description:
      'Crie sua loja no MiseOn para conhecer o sistema. Integrações como WhatsApp, iFood e emissão fiscal dependem de configuração e credenciais próprias.',
    canonicalUrl: `${BASE}/cadastre-se`,
    h1: 'Cadastre sua loja no MiseOn',
  },

  '/sobre': {
    title: 'Sobre o MiseOn | Engenharia de Software por Maldivas Tech',
    description:
      'Conheça a história e o propósito do MiseOn. Plataforma SaaS de gestão de restaurantes criada pela Maldivas Tech (Rafael Maldivas) com tecnologia de ponta.',
    keywords: 'sobre miseon, maldivas tech solutions, rafael maldivas, sistema para restaurantes, empresa miseon cnpj',
    canonicalUrl: `${BASE}/sobre`,
    h1: 'Engenharia de software criada para o ritmo real do Food Service',
  },

  '/contato': {
    title: 'Contato & Suporte | MiseOn — Sistema para Restaurantes',
    description:
      'Fale com a equipe do MiseOn. Canais oficiais de atendimento comercial e suporte técnico via WhatsApp, e-mail e formulário. CNPJ 68.923.239/0001-77.',
    keywords: 'contato miseon, suporte miseon, whatsapp miseon, endereco miseon, cnpj miseon',
    canonicalUrl: `${BASE}/contato`,
    h1: 'Fale com a nossa equipe',
  },

  '/termos': {
    title: 'Termos de Uso e Serviço | MiseOn',
    description:
      'Termos de uso e serviço da plataforma MiseOn: condições de assinatura, responsabilidades do lojista e do cliente final.',
    canonicalUrl: `${BASE}/termos`,
    h1: 'Termos de Uso e Serviço',
  },

  '/privacidade': {
    title: 'Política de Privacidade (LGPD) | MiseOn',
    description:
      'Política de privacidade do MiseOn em conformidade com a LGPD: quais dados coletamos, como usamos e os direitos do titular sobre pedidos, cadastro e localização.',
    canonicalUrl: `${BASE}/privacidade`,
    h1: 'Política de Privacidade',
  },

  // /videos e /demonstracao renderizam o mesmo componente. O canonical da
  // demonstração aponta para /videos para evitar conteúdo duplicado.
  '/videos': {
    title: 'Vídeos MiseOn | Identidade e demonstração do produto',
    description:
      'Conheça a identidade do MiseOn e veja uma demonstração do fluxo entre o PDV e a produção, sem resultados ou depoimentos não comprovados.',
    canonicalUrl: `${BASE}/videos`,
    h1: 'MiseOn em ação: vídeos e demonstrações',
  },
  '/demonstracao': {
    title: 'Demonstração do sistema MiseOn | PDV e produção',
    description:
      'Veja uma demonstração do fluxo entre o PDV e a produção no MiseOn e conheça a identidade visual do produto.',
    canonicalUrl: `${BASE}/videos`,
    h1: 'MiseOn em ação: vídeos e demonstrações',
  },

  // /ajuda/estoque renderiza o mesmo componente de /gestao-de-estoque-3d;
  // canonical aponta para a rota principal.
  '/gestao-de-estoque-3d': {
    title: 'Estoque, Compras e Desmonte de Insumos com Custo Real — MiseOn',
    description:
      'Controle de compras com fornecedor, marca e recebimento parcial; desmonte de insumos com rateio de custo PEPS; inventário em qualquer unidade e mapa 3D do capital parado na cozinha.',
    keywords: 'controle de compras restaurante, gestão de fornecedores food service, desmonte de insumos, rendimento de desossa, inventario de estoque restaurante, estoque 3d restaurante, ficha técnica restaurante, custeio peps comida',
    canonicalUrl: `${BASE}/gestao-de-estoque-3d`,
    h1: 'Gestão de Estoque Físico, Fichas Técnicas e Observabilidade 3D em Tempo Real',
  },
  '/blog': {
    title: 'Blog MiseOn | Engenharia, CMV & Tecnologia para Food Service',
    description:
      'Artigos especializados para donos de restaurantes, hamburguerias e pizzarias. Estudos profundos sobre CMV real, Ficha Técnica, KDS sem papel e IA no WhatsApp.',
    keywords: 'blog restaurante, cmv food service, kds produção, ficha técnica hamburgueria, whatsapp ia delivery',
    canonicalUrl: `${BASE}/blog`,
    h1: 'Blog MiseOn: Engenharia, CMV & Tecnologia para Food Service',
  },
  '/ajuda/estoque': {
    title: 'Estoque, Compras e Desmonte de Insumos com Custo Real — MiseOn',
    description:
      'Controle de compras com fornecedor, marca e recebimento parcial; desmonte de insumos com rateio de custo PEPS; inventário em qualquer unidade e mapa 3D do capital parado na cozinha.',
    canonicalUrl: `${BASE}/gestao-de-estoque-3d`,
    h1: 'Gestão de Estoque Físico, Fichas Técnicas e Observabilidade 3D em Tempo Real',
  },

  // Vertical MiseOn Kiosk — registradas em scripts/public-routes.mjs no
  // Sprint 0; sem isto o prerender do build quebrava (rota pública sem metadados).
  '/autoatendimento': {
    title: 'Totem de Autoatendimento para Restaurantes | MiseOn Kiosk',
    description:
      'Totem de autoatendimento com pedido por QR Code, cardápio digital e pagamento no balcão: menos fila, mais giro e comanda certa para lanchonetes, hamburguerias e food service.',
    canonicalUrl: `${BASE}/autoatendimento`,
    h1: 'Autoatendimento que Acelera o Balcão e a Mesa',
  },
  '/demo-kiosk': {
    title: 'Demonstração interativa de autoatendimento | MiseOn',
    description:
      'Experimente no navegador uma jornada demonstrativa de autoatendimento, da escolha dos itens ao encaminhamento do pedido para a produção.',
    canonicalUrl: `${BASE}/demo-kiosk`,
    h1: 'Demonstração interativa de autoatendimento',
  },
};
