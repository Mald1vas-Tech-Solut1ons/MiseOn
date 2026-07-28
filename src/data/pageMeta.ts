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
  '/acesso': {
    title: 'Área de Acesso MiseOn | Cliente, Lojista e Entregador',
    description:
      'Escolha como quer entrar no MiseOn: pedir como cliente, acessar o painel como lojista e equipe, ou abrir o app do entregador.',
    canonicalUrl: `${BASE}/acesso`,
    h1: 'Escolha o seu acesso',
  },

  '/lojas': {
    title: 'Lojas na MiseOn | Encontre Restaurantes Perto de Você',
    description:
      'Veja restaurantes, hamburguerias e pizzarias cadastrados no MiseOn perto de você e monte seu pedido direto, sem precisar instalar app.',
    canonicalUrl: `${BASE}/lojas`,
    h1: 'Lojas na MiseOn',
  },

  '/cadastre-se': {
    title: 'Cadastre sua Loja no MiseOn | 30 Dias Grátis, Sem Cartão',
    description:
      'Crie sua loja no MiseOn e libere 30 dias de uso completo sem compromisso: cardápio digital, WhatsApp com IA, PDV, entregas e controle de estoque.',
    canonicalUrl: `${BASE}/cadastre-se`,
    h1: 'Cadastre sua loja na MiseOn',
  },

  '/sobre': {
    title: 'Sobre o MiseOn | Engenharia de Software por Maldivas Tech Solutions',
    description:
      'Conheça a história e o propósito do MiseOn. Plataforma SaaS de gestão de restaurantes criada pela Maldivas Tech Solutions (Rafael Maldivas) com tecnologia de ponta.',
    keywords: 'sobre miseon, maldivas tech solutions, rafael maldivas, sistema para restaurantes, empresa miseon cnpj',
    canonicalUrl: `${BASE}/sobre`,
    h1: 'Engenharia de software criada para o ritmo real do Food Service',
  },

  '/contato': {
    title: 'Contato & Suporte | MiseOn — Sistema para Restaurantes',
    description:
      'Fale com a equipe do MiseOn. Canais oficiais de atendimento comercial e suporte técnico via WhatsApp, e-mail e formulário. CNPJ 63.310.253/0001-81.',
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

  // /videos, /depoimentos e /demonstracao renderizam o MESMO componente.
  // Título varia por intenção de busca, canonical sempre aponta para /videos
  // — evita o Google tratar as três URLs como conteúdo duplicado.
  '/videos': {
    title: 'Vídeos MiseOn | Identidade, Demonstração e Depoimentos',
    description:
      'Vídeos institucionais do MiseOn: identidade da marca, demonstração do PDV e KDS em tempo real e depoimentos de clientes reais.',
    canonicalUrl: `${BASE}/videos`,
    h1: 'MiseOn em Ação: Assista e Comprove',
  },
  '/depoimentos': {
    title: 'Depoimentos de Clientes MiseOn | Cases Reais de Restaurantes',
    description:
      'Veja depoimentos em vídeo de donos de restaurante, hamburgueria e pizzaria que usam o MiseOn no dia a dia — resultado real, sem atores.',
    canonicalUrl: `${BASE}/videos`,
    h1: 'MiseOn em Ação: Assista e Comprove',
  },
  '/demonstracao': {
    title: 'Demonstração do Sistema MiseOn | PDV, KDS e iFood em Ação',
    description:
      'Demonstração em vídeo do PDV, KDS de cozinha e integração com iFood do MiseOn funcionando em tempo real.',
    canonicalUrl: `${BASE}/videos`,
    h1: 'MiseOn em Ação: Assista e Comprove',
  },

  // /ajuda/estoque renderiza o mesmo componente de /gestao-de-estoque-3d;
  // canonical aponta para a rota principal.
  '/gestao-de-estoque-3d': {
    title: 'Engenharia de Estoque 3D, Ficha Técnica & Preparos — MiseOn',
    description:
      'Mapeamento tridimensional de estoque físico, fracionamento de insumos, custeio PEPS e ordens de produção com controle de validade para cozinhas profissionais.',
    keywords: 'estoque 3d restaurante, ficha tecnica restaurante, fracionamento insumos, custeio peps comida, controle de preparos e lotes',
    canonicalUrl: `${BASE}/gestao-de-estoque-3d`,
    h1: 'Gestão de Estoque Físico, Fichas Técnicas e Observabilidade 3D em Tempo Real',
  },
  '/ajuda/estoque': {
    title: 'Engenharia de Estoque 3D, Ficha Técnica & Preparos — MiseOn',
    description:
      'Mapeamento tridimensional de estoque físico, fracionamento de insumos, custeio PEPS e ordens de produção com controle de validade para cozinhas profissionais.',
    canonicalUrl: `${BASE}/gestao-de-estoque-3d`,
    h1: 'Gestão de Estoque Físico, Fichas Técnicas e Observabilidade 3D em Tempo Real',
  },
};
