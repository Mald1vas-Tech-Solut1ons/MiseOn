import React, { createContext, useContext, useState, useEffect } from 'react';

export type Idioma = 'pt-BR' | 'en-US';

export const DICIONARIO = {
  'pt-BR': {
    // Navbar & Header
    'nav.solucoes': 'Soluções',
    'nav.funcionalidades': 'Funcionalidades',
    'nav.comoFunciona': 'Como Funciona',
    'nav.planos': 'Planos',
    'nav.blog': 'Blog',
    'nav.videos': 'Vídeos',
    'nav.entrar': 'Entrar',
    'nav.cadastrar': 'Cadastrar minha loja',
    'nav.testar30d': 'Testar 30 Dias Grátis',
    'nav.conteudo': 'Conteúdo',
    'nav.conteudoTitulo': 'Conheça o MiseOn',
    'nav.comoFuncionaDesc': 'O sistema em 4 passos',
    'nav.blogDesc': 'CMV, engenharia e gestão',
    'nav.videosDesc': 'Demonstrações em ação',
    'nav.depoimentos': 'Depoimentos',
    'nav.depoimentosDesc': 'Cases reais de clientes',
    'nav.navegacao': 'Navegação',

    // Cards de prova do hero
    'prova.pedidos': 'Pedidos em tempo real',
    'prova.pedidosDesc': 'Do site, do balcão ou do WhatsApp: tudo cai no mesmo painel, com aviso na hora.',
    'prova.kds': 'Cozinha sob controle (KDS)',
    'prova.kdsDesc': 'Tela de produção inteligente por etapas Kanban. Sem papel engordurado nem confusão.',
    'prova.ia': 'IA no WhatsApp (API Meta)',
    'prova.iaDesc': 'A IA tira dúvidas, envia o cardápio e não deixa nenhum cliente sem resposta.',

    // Hero
    'hero.badge': 'PLATAFORMA COMPLETA PARA RESTAURANTES',
    'hero.title': 'MiseOn | Sistema de Gestão e Automação para Restaurantes e Bares —',
    'hero.titleHighlight': 'do cardápio ao WhatsApp',
    'hero.subtitle': 'O MiseOn é o sistema de gestão que coloca o seu cardápio digital, os pedidos, a cozinha, as entregas, o estoque e o financeiro no mesmo painel — com uma inteligência artificial que atende seus clientes no WhatsApp.',
    'hero.ctaPrincipal': 'Cadastrar minha loja grátis',
    'hero.ctaSecundario': 'Ver como funciona',

    // Trust Badges
    'badge.meta': 'API Cloud Oficial Meta Verified',
    'badge.efi': 'Parceiro Homologado Efí Bank (Pix)',
    'badge.focus': 'Emissão Fiscal FocusNFe Homologada',
    'badge.ssl': 'Conexão SSL 256-bit Certificada',

    // Admin & Features
    'admin.dashboard': 'Painel de Controle',
    'admin.pdv': 'PDV Balcão',
    'admin.kds': 'KDS Cozinha',
    'admin.mesas': 'Mapa de Mesas',
    'admin.comandas': 'Comandas Mobile',
    'admin.estoque': 'Estoque & CMV',
    'admin.financeiro': 'DRE Gerencial',
    'admin.crm': 'CRM & Cashback',
  },
  'en-US': {
    // Navbar & Header
    'nav.solucoes': 'Solutions',
    'nav.funcionalidades': 'Features',
    'nav.comoFunciona': 'How It Works',
    'nav.planos': 'Pricing',
    'nav.blog': 'Blog',
    'nav.videos': 'Videos',
    'nav.entrar': 'Sign In',
    'nav.cadastrar': 'Register Your Restaurant',
    'nav.testar30d': 'Start 30-Day Free Trial',
    'nav.conteudo': 'Resources',
    'nav.conteudoTitulo': 'Get to know MiseOn',
    'nav.comoFuncionaDesc': 'The system in 4 steps',
    'nav.blogDesc': 'COGS, engineering and management',
    'nav.videosDesc': 'Live product demos',
    'nav.depoimentos': 'Testimonials',
    'nav.depoimentosDesc': 'Real customer stories',
    'nav.navegacao': 'Navigation',

    // Cards de prova do hero
    'prova.pedidos': 'Real-time orders',
    'prova.pedidosDesc': 'From your website, the counter or WhatsApp: everything lands in one dashboard, with instant alerts.',
    'prova.kds': 'Kitchen under control (KDS)',
    'prova.kdsDesc': 'Smart Kanban production screen. No greasy paper tickets, no confusion.',
    'prova.ia': 'AI on WhatsApp (Meta API)',
    'prova.iaDesc': 'The AI answers questions, sends the menu and never leaves a customer waiting.',

    // Hero
    'hero.badge': 'ALL-IN-ONE FOOD SERVICE MANAGEMENT PLATFORM',
    'hero.title': 'MiseOn | Restaurant & Bar Operating System —',
    'hero.titleHighlight': 'from Digital Menu to AI WhatsApp Orders',
    'hero.subtitle': 'MiseOn is the ultimate restaurant OS that unifies your QR Code digital menu, POS, kitchen display system (KDS), delivery, inventory, and finances in one sleek dashboard — powered by an AI assistant.',
    'hero.ctaPrincipal': 'Start Free Trial Now',
    'hero.ctaSecundario': 'See How It Works',

    // Trust Badges
    'badge.meta': 'Meta Cloud API Official Verified Partner',
    'badge.efi': 'Instant Bank Transfer & Credit Card Integration',
    'badge.focus': 'Automated Tax Invoice & Receipt Emission',
    'badge.ssl': '256-Bit SSL Encrypted & GDPR Compliant',

    // Admin & Features
    'admin.dashboard': 'Dashboard Overview',
    'admin.pdv': 'Express POS',
    'admin.kds': 'Kitchen KDS',
    'admin.mesas': 'Table Management',
    'admin.comandas': 'Mobile Server Ordering',
    'admin.estoque': 'Inventory & COGS',
    'admin.financeiro': 'Financial P&L / DRE',
    'admin.crm': 'CRM & Loyalty Cashback',
  },
} as const;

export type ChaveDicionario = keyof typeof DICIONARIO['pt-BR'];

interface I18nContextType {
  idioma: Idioma;
  setIdioma: (idioma: Idioma) => void;
  t: (chave: ChaveDicionario) => string;
}

const I18nContext = createContext<I18nContextType>({
  idioma: 'pt-BR',
  setIdioma: () => {},
  t: (chave) => DICIONARIO['pt-BR'][chave] || chave,
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [idioma, setIdiomaState] = useState<Idioma>(() => {
    const salvo = localStorage.getItem('miseon_idioma') as Idioma;
    if (salvo === 'pt-BR' || salvo === 'en-US') return salvo;
    // Detecta o idioma do navegador
    if (navigator.language.startsWith('en')) return 'en-US';
    return 'pt-BR';
  });

  const setIdioma = (novoIdioma: Idioma) => {
    setIdiomaState(novoIdioma);
    localStorage.setItem('miseon_idioma', novoIdioma);
  };

  // Mantém o <html lang> em sincronia: buscadores e leitores de tela usam esse
  // atributo para saber o idioma da página. Sem isso a versão EN continua
  // anunciada como pt-BR.
  useEffect(() => {
    document.documentElement.lang = idioma;
  }, [idioma]);

  const t = (chave: ChaveDicionario): string => {
    return DICIONARIO[idioma]?.[chave] || DICIONARIO['pt-BR']?.[chave] || chave;
  };

  return (
    <I18nContext.Provider value={{ idioma, setIdioma, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);
