import { Link } from 'react-router-dom';
import {
  QrCode, ClipboardList, ChefHat, Bike, Boxes, Wallet,
  MessageCircle, ShieldCheck, ArrowRight, Check, Sparkles,
  Menu as MenuIcon, X, UtensilsCrossed, Megaphone, ShoppingBag,
  Mail, ChevronDown, Headset, BarChart3, Star, Quote, BadgeCheck, Scale,
  Database, FlaskConical, Eye, AlertTriangle, BookOpen,
  Globe, PlayCircle, Compass,
} from 'lucide-react';
import { useState } from 'react';
import MiseOnLogo from '../components/MiseOnLogo';
import SEO from '../components/SEO';
import FooterSEO from '../components/FooterSEO';
import { useI18n } from '../contexts/I18nContext';

const WHATSAPP_CONTATO = '5511919889233';
const zap = (msg: string) => `https://wa.me/${WHATSAPP_CONTATO}?text=${encodeURIComponent(msg)}`;

/* ───────────────────────────── Dados ───────────────────────────── */

const RECURSOS = [
  {
    icone: QrCode,
    titulo: 'Cardápio digital com QR Code',
    texto: 'Sua loja no ar com link próprio e QR Code para mesas e balcão. Fotos, adicionais e preços sempre atualizados — sem imprimir nada.',
    cor: 'text-orange-500',
    fundo: 'bg-orange-500/10',
  },
  {
    icone: ClipboardList,
    titulo: 'Pedidos em tempo real',
    texto: 'Cada pedido cai no painel no mesmo segundo, com aviso sonoro. Aceite, produza e entregue sem perder nada no caminho.',
    cor: 'text-blue-500',
    fundo: 'bg-blue-500/10',
  },
  {
    icone: ChefHat,
    titulo: 'Cozinha (KDS)',
    texto: 'Tela de produção sem papel: a cozinha vê a fila, marca o preparo e o balcão acompanha tudo em tempo real.',
    cor: 'text-red-500',
    fundo: 'bg-red-500/10',
  },
  {
    icone: Bike,
    titulo: 'Gestão de entregas',
    texto: 'Rotas, entregadores e status de cada entrega em um só lugar. O cliente acompanha o pedido sem precisar ligar.',
    cor: 'text-emerald-500',
    fundo: 'bg-emerald-500/10',
  },
  {
    icone: UtensilsCrossed,
    titulo: 'PDV, mesas e comandas',
    texto: 'Balcão e salão no mesmo sistema: comanda por mesa, pedido direto na tela da cozinha e fechamento de conta sem confusão.',
    cor: 'text-amber-500',
    fundo: 'bg-amber-500/10',
  },
  {
    icone: Boxes,
    titulo: 'Estoque com ficha técnica e CMV',
    texto: 'Cada venda baixa os ingredientes automaticamente. Você sabe o custo real de cada prato e nunca vende o que acabou.',
    cor: 'text-purple-500',
    fundo: 'bg-purple-500/10',
  },
  {
    icone: Wallet,
    titulo: 'Financeiro com Pix (Efí)',
    texto: 'Pix cai direto na sua conta, com conciliação automática e taxas transparentes. O MiseOn não segura o seu dinheiro.',
    cor: 'text-teal-500',
    fundo: 'bg-teal-500/10',
  },
  {
    icone: Megaphone,
    titulo: 'Marketing e fidelização',
    texto: 'Cupons, promoções e e-mails automáticos de pedido, entrega e carrinho abandonado. O cliente volta sem você empurrar.',
    cor: 'text-pink-500',
    fundo: 'bg-pink-500/10',
  },
  {
    icone: ShoppingBag,
    titulo: 'Integração com iFood',
    texto: 'Os pedidos do iFood caem no mesmo painel dos pedidos do seu site. Uma fila só, uma cozinha só, um estoque só.',
    cor: 'text-rose-500',
    fundo: 'bg-rose-500/10',
  },
  {
    icone: Scale,
    titulo: 'Venda por Quilo (R$/kg)',
    texto: 'Peso Inteligente: vendas por R$/kg ou unidade com seletor de peso fracionado e baixa exata no estoque via Ficha Técnica.',
    cor: 'text-emerald-400',
    fundo: 'bg-emerald-500/10',
  },
];

const PLATAFORMA = [
  {
    grupo: 'Vender',
    itens: [
      'Cardápio digital com link próprio e QR Code',
      'PDV de balcão e comandas por mesa',
      'Pedidos em tempo real, com aviso sonoro',
      'Integração com iFood no mesmo painel',
      'Pagamento Pix e cartão via Efí',
    ],
  },
  {
    grupo: 'Operar',
    itens: [
      'Cozinha KDS sem papel, com fila de preparo',
      'Gestão de entregas e entregadores',
      'Status do pedido que o cliente acompanha',
      'Impressão de pedido para produção',
      'Equipe com papéis e permissões',
    ],
  },
  {
    grupo: 'Gerir',
    itens: [
      'Estoque com baixa automática por venda',
      'Ficha técnica, alergênicos e CMV por prato',
      'Compras e controle de fornecedores',
      'Financeiro com conciliação automática',
      'Relatórios e histórico de vendas',
    ],
  },
  {
    grupo: 'Fidelizar',
    itens: [
      'Cupons e promoções por campanha',
      'E-mails automáticos de pedido e entrega',
      'Recuperação de carrinho abandonado',
      'Chat com IA no site da sua loja',
      'WhatsApp atendido por IA (oficial Meta)',
    ],
  },
];

const PASSOS = [
  {
    n: 1,
    titulo: 'Cadastre sua loja',
    texto: 'Nome, endereço, horários e formas de pagamento. Em poucos minutos sua operação está dentro do MiseOn.',
  },
  {
    n: 2,
    titulo: 'Monte o cardápio',
    texto: 'Cadastre produtos com foto, adicionais e ficha técnica. O estoque e o custo de cada prato já nascem conectados.',
  },
  {
    n: 3,
    titulo: 'Compartilhe e receba pedidos',
    texto: 'Divulgue o link e o QR Code. Os pedidos caem no painel em tempo real — no balcão, na cozinha e na entrega.',
  },
];

const DEPOIMENTOS = [
  {
    nome: 'Carlos M.',
    negocio: 'Hamburgueria',
    texto: 'Antes eu pagava 3 sistemas diferentes que não se conversavam e custavam uma fortuna. Com o MiseOn, centralizei PDV, entregas e a IA do WhatsApp. Economizei R$ 400/mês e a operação voa.',
    perfil: 'Tinha sistema caro e complexo',
  },
  {
    nome: 'Juliana T.',
    negocio: 'Pizzaria Delivery',
    texto: 'Eu usava caderninho e WhatsApp manual. Perdia pedido toda sexta-feira. Agora a IA atende e envia o cardápio, os pedidos caem direto na tela. Nunca mais perdi venda.',
    perfil: 'Não tinha sistema',
  },
  {
    nome: 'Roberto S.',
    negocio: 'Restaurante e Bar',
    texto: 'O sistema antigo não tinha tela na cozinha (KDS) nem ficha técnica decente. O MiseOn resolveu isso. Cada venda na mesa já dá baixa no estoque. Controle total, sem gambiarra.',
    perfil: 'Tinha sistema incompleto',
  },
];

const SUPORTE_CANAIS = [
  {
    icone: MessageCircle,
    titulo: 'WhatsApp',
    descricao: 'Atendimento humano para dúvidas da operação, planos e implantação.',
    acao: 'Chamar no WhatsApp',
    href: zap('Olá! Preciso de ajuda com o MiseOn.'),
    externo: true,
    destaque: true,
  },
  {
    icone: Headset,
    titulo: 'Suporte técnico',
    descricao: 'Problemas com o sistema, integrações, pagamentos ou acessos.',
    acao: 'suporte@miseon.app.br',
    href: 'mailto:suporte@miseon.app.br?subject=Suporte%20MiseOn',
    externo: false,
    destaque: false,
  },
  {
    icone: Mail,
    titulo: 'Comercial e geral',
    descricao: 'Planos, parcerias, imprensa e qualquer outro assunto.',
    acao: 'contato@miseon.app.br',
    href: 'mailto:contato@miseon.app.br?subject=Contato%20MiseOn',
    externo: false,
    destaque: false,
  },
];

const FAQ = [
  {
    pergunta: 'Preciso comprar ou instalar algum equipamento?',
    resposta:
      'Não. O MiseOn roda no navegador, no computador e no celular que você já tem. A cozinha usa uma tela comum como KDS e o cardápio digital dispensa impressão.',
  },
  {
    pergunta: 'Como eu recebo o dinheiro das vendas?',
    resposta:
      'Os pagamentos são processados pela Efí (Gerencianet) e caem direto na conta da sua loja, com conciliação automática no painel. O MiseOn não retém o seu faturamento em nenhuma etapa.',
  },
  {
    pergunta: 'O atendimento por IA no WhatsApp é oficial?',
    resposta:
      'Sim. Usamos a WhatsApp Business Platform oficial da Meta — não é gambiarra com número pessoal nem risco de banimento. Nossa equipe conduz a configuração com você, sem mensalidade de integração.',
  },
  {
    pergunta: 'A IA fecha pedidos sozinha no WhatsApp?',
    resposta:
      'Não — e isso é de propósito. Ela tira dúvidas com os dados reais da sua loja (preços, cardápio, horários) e envia o link do cardápio digital. O pedido é montado pelo cliente na plataforma e cai no seu painel para você aceitar. A decisão final é sempre sua.',
  },
  {
    pergunta: 'O MiseOn integra com o iFood?',
    resposta:
      'Sim. Os pedidos do iFood entram na mesma fila dos pedidos do seu site, com baixa de estoque unificada. Você opera uma cozinha só, sem alternar entre telas.',
  },
  {
    pergunta: 'Posso cancelar quando quiser?',
    resposta:
      'Pode. Não há fidelidade nem multa: o cancelamento é feito direto no painel e seus dados continuam disponíveis para exportação conforme os Termos de Uso.',
  },
];

/* ─────────────────────── Componentes locais ─────────────────────── */

function FaqItem({ pergunta, resposta }: { pergunta: string; resposta: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-md">
      <button
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-gray-50 dark:hover:bg-white/5"
      >
        <span className="font-['Sora'] text-sm font-bold text-gray-900 sm:text-base dark:text-white">
          {pergunta}
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-[var(--cor-primaria)] transition-transform duration-300 ${aberto ? 'rotate-180' : ''}`}
        />
      </button>
      {aberto && (
        <p className="border-t border-gray-100 px-5 py-4 text-sm leading-relaxed text-gray-600 dark:border-white/10 dark:text-slate-300">
          {resposta}
        </p>
      )}
    </div>
  );
}

/* ───────────────────────────── Página ───────────────────────────── */

export default function Home() {
  const { idioma, setIdioma, t } = useI18n();
  const [menuAberto, setMenuAberto] = useState(false);
  const [planoAnual, setPlanoAnual] = useState(true);
  const [solucoesOpen, setSolucoesOpen] = useState(false);
  const [recursosOpen, setRecursosOpen] = useState(false);
  const [conteudoOpen, setConteudoOpen] = useState(false);

  return (
    <div className="min-h-screen scroll-smooth bg-[#F4F7FA] font-sans text-gray-900 selection:bg-[#FC5B24] selection:text-white dark:bg-[#070C18] dark:text-[#EAF1FB]">
      <SEO
        title="MiseOn | Sistema de Gestão e Automação para Restaurantes e Bares"
        description="MiseOn: sistema de gestão e automação para restaurantes, hamburguerias, pizzarias e bares. Cardápio digital QR Code, KDS, comanda eletrônica e iFood."
        keywords="sistema para restaurante, comanda eletrônica para bares, gerenciador de delivery integrado, sistema para hamburgueria, sistema para pizzaria, cardapio digital qr code, integracao ifood, whatsapp ia restaurante"
        canonicalUrl="https://miseon.app.br/"
        schemaJson={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'SoftwareApplication',
              '@id': 'https://miseon.app.br/#software',
              'name': 'MiseOn',
              'url': 'https://miseon.app.br',
              'image': 'https://miseon.app.br/icon-512.png',
              'applicationCategory': 'BusinessApplication',
              'operatingSystem': 'All',
              'inLanguage': 'pt-BR',
              'description': 'MiseOn é um sistema de gestão e automação inteligente focado exclusivamente no nicho de food service (restaurantes, bares, hamburguerias, pizzarias e lanchonetes). Oferece cardápio digital QR Code, controle de caixa e PDV, painel KDS para cozinha, gestão de delivery com integração iFood, comanda eletrônica para garçons e atendimento por Inteligência Artificial no WhatsApp.',
              'offers': {
                '@type': 'Offer',
                'price': '99.90',
                'priceCurrency': 'BRL',
                'priceValidUntil': '2027-12-31',
                'availability': 'https://schema.org/InStock',
                'url': 'https://miseon.app.br/cadastre-se',
              },
              'featureList': [
                'Cardápio Digital com QR Code para mesas e balcão sem taxas',
                'Painel KDS de Cozinha sem papel e gerenciamento de fila de produção',
                'Controle de Caixa, PDV Balcão e Fechamento de Turno',
                'Gestão de Delivery com rastreio e integração nativa com iFood',
                'Comanda Eletrônica no celular para garçons com divisão de conta',
                'Atendimento automatizado por Inteligência Artificial no WhatsApp (API Oficial Meta)',
                'Controle de Estoque com Ficha Técnica, CMV e Venda por Quilo (R$/kg)',
                'Emissão Fiscal NFC-e e NF-e integrada com FocusNFe',
                'Pagamento via Pix automático com conciliação instantânea (Efí Bank)',
              ],
              'author': {
                '@type': 'Organization',
                '@id': 'https://miseon.app.br/#organization',
              },
            },
            {
              '@type': 'Organization',
              '@id': 'https://miseon.app.br/#organization',
              'name': 'MiseOn',
              'legalName': 'MiseOn Tecnologia e Soluções para Food Service',
              'url': 'https://miseon.app.br',
              'logo': 'https://miseon.app.br/icon-512.png',
              'contactPoint': {
                '@type': 'ContactPoint',
                'contactType': 'customer support',
                'email': 'suporte@miseon.app.br',
                'telephone': '+55-11-91988-9233',
                'availableLanguage': 'Portuguese',
              },
            },
            {
              '@type': 'Blog',
              '@id': 'https://miseon.app.br/blog#blog',
              'name': 'Blog & Centro de Inteligência em Food Service | MiseOn',
              'url': 'https://miseon.app.br/blog',
              'description': 'Artigos e estudos profundos sobre Engenharia de Cardápio, CMV, KDS, Gestão Financeira DRE e Inteligência Artificial no WhatsApp para Restaurantes.',
              'publisher': {
                '@id': 'https://miseon.app.br/#organization',
              },
            },
          ],
        }}
      />

      {/* ══════════ 1. NAVBAR (UX REDESIGN COM DROPDOWNS) ══════════ */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-gray-200/70 bg-white/90 backdrop-blur-xl dark:border-white/10 dark:bg-[#070C18]/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" aria-label="MiseOn — início" className="drop-shadow-[0_0_10px_rgba(255,255,255,0.15)]">
            <MiseOnLogo size={128} />
          </Link>

          {/* Links âncora e Dropdowns — desktop (UX Clean: Máx 4 itens principais) */}
          <div className="hidden items-center gap-7 lg:flex">
            
            {/* 1. Soluções por Nicho (Dropdown) */}
            <div
              className="relative"
              onMouseEnter={() => setSolucoesOpen(true)}
              onMouseLeave={() => setSolucoesOpen(false)}
            >
              <button
                type="button"
                onClick={() => setSolucoesOpen(!solucoesOpen)}
                className="flex items-center gap-1 text-sm font-semibold text-gray-700 transition hover:text-[var(--cor-primaria)] dark:text-gray-200 dark:hover:text-white"
              >
                {t('nav.solucoes')}
                <ChevronDown size={14} className={`transition-transform duration-200 ${solucoesOpen ? 'rotate-180 text-[#FC5B24]' : ''}`} />
              </button>

              {solucoesOpen && (
                <div className="absolute top-full -left-4 mt-2 w-80 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-2xl backdrop-blur-xl dark:border-white/15 dark:bg-[#0B1120]/95 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="mb-2 px-3 pt-1 text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Soluções por Nicho
                  </div>
                  <div className="space-y-1">
                    <Link
                      to="/sistema-para-restaurante-por-quilo"
                      onClick={() => setSolucoesOpen(false)}
                      className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-emerald-500/10 dark:hover:bg-white/10 group"
                    >
                      <div className="rounded-lg bg-emerald-500/20 p-2 text-emerald-400 shrink-0">
                        <Scale size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-white group-hover:text-emerald-400">
                          Restaurantes por Quilo
                          <span className="rounded-full bg-emerald-500 px-1.5 py-0.2 text-[9px] font-black text-slate-950">NOVO</span>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400">Peso Inteligente R$/kg e Ficha Técnica</p>
                      </div>
                    </Link>
                    <Link
                      to="/sistema-para-hamburgueria"
                      onClick={() => setSolucoesOpen(false)}
                      className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-orange-500/10 dark:hover:bg-white/10 group"
                    >
                      <div className="rounded-lg bg-orange-500/20 p-2 text-orange-400 shrink-0">
                        <ChefHat size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-orange-400">Hamburguerias</p>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400">Chapa KDS, adicionais e blends</p>
                      </div>
                    </Link>
                    <Link
                      to="/sistema-para-pizzaria"
                      onClick={() => setSolucoesOpen(false)}
                      className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-emerald-500/10 dark:hover:bg-white/10 group"
                    >
                      <div className="rounded-lg bg-emerald-500/20 p-2 text-emerald-400 shrink-0">
                        <Boxes size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-emerald-400">Pizzarias</p>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400">KDS de forno, delivery e motoboys</p>
                      </div>
                    </Link>
                    <Link
                      to="/sistema-para-lanchonete"
                      onClick={() => setSolucoesOpen(false)}
                      className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-blue-500/10 dark:hover:bg-white/10 group"
                    >
                      <div className="rounded-lg bg-blue-500/20 p-2 text-blue-400 shrink-0">
                        <UtensilsCrossed size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-blue-400">Lanchonetes</p>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400">PDV balcão express e caixa por turno</p>
                      </div>
                    </Link>
                    <Link
                      to="/sistema-para-restaurantes"
                      onClick={() => setSolucoesOpen(false)}
                      className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-amber-500/10 dark:hover:bg-white/10 group"
                    >
                      <div className="rounded-lg bg-amber-500/20 p-2 text-amber-400 shrink-0">
                        <BarChart3 size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-amber-400">Restaurantes & Bares</p>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400">Garçom no celular e mapa de mesas</p>
                      </div>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Funcionalidades (Dropdown) */}
            <div
              className="relative"
              onMouseEnter={() => setRecursosOpen(true)}
              onMouseLeave={() => setRecursosOpen(false)}
            >
              <button
                type="button"
                onClick={() => setRecursosOpen(!recursosOpen)}
                className="flex items-center gap-1 text-sm font-semibold text-gray-700 transition hover:text-[var(--cor-primaria)] dark:text-gray-200 dark:hover:text-white"
              >
                {t('nav.funcionalidades')}
                <ChevronDown size={14} className={`transition-transform duration-200 ${recursosOpen ? 'rotate-180 text-[#FC5B24]' : ''}`} />
              </button>

              {recursosOpen && (
                <div className="absolute top-full -left-4 mt-2 w-80 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-2xl backdrop-blur-xl dark:border-white/15 dark:bg-[#0B1120]/95 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="mb-2 px-3 pt-1 text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Recursos em Destaque
                  </div>
                  <div className="space-y-1">
                    <Link
                      to="/api-whatsapp-restaurantes"
                      onClick={() => setRecursosOpen(false)}
                      className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-emerald-500/10 dark:hover:bg-white/10 group"
                    >
                      <div className="rounded-lg bg-emerald-500/20 p-2 text-emerald-400 shrink-0">
                        <MessageCircle size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-emerald-400">WhatsApp IA Oficial Meta</p>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400">Atendimento inteligente automatizado</p>
                      </div>
                    </Link>
                    <Link
                      to="/integracao-ifood"
                      onClick={() => setRecursosOpen(false)}
                      className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-rose-500/10 dark:hover:bg-white/10 group"
                    >
                      <div className="rounded-lg bg-rose-500/20 p-2 text-rose-400 shrink-0">
                        <ShoppingBag size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-rose-400">Integração iFood</p>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400">Fila única na cozinha e estoque</p>
                      </div>
                    </Link>
                    <Link
                      to="/cardapio-qr-code"
                      onClick={() => setRecursosOpen(false)}
                      className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-orange-500/10 dark:hover:bg-white/10 group"
                    >
                      <div className="rounded-lg bg-orange-500/20 p-2 text-orange-400 shrink-0">
                        <QrCode size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-orange-400">Cardápio QR Code</p>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400">Autoatendimento direto na mesa sem taxas</p>
                      </div>
                    </Link>
                    <Link
                      to="/gestao-fiscal-nfe"
                      onClick={() => setRecursosOpen(false)}
                      className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-blue-500/10 dark:hover:bg-white/10 group"
                    >
                      <div className="rounded-lg bg-blue-500/20 p-2 text-blue-400 shrink-0">
                        <ShieldCheck size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-blue-400">Emissão Fiscal NFC-e</p>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400">FocusNFe nativo e integrado</p>
                      </div>
                    </Link>
                    <Link
                      to="/gestao-de-estoque-3d"
                      onClick={() => setRecursosOpen(false)}
                      className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-purple-500/10 dark:hover:bg-white/10 group"
                    >
                      <div className="rounded-lg bg-purple-500/20 p-2 text-purple-400 shrink-0">
                        <Boxes size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-purple-400">Estoque 3D & Preparos</p>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400">Fichas técnicas, lotes e gráfico 3D</p>
                      </div>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Planos */}
            <a
              href="#planos"
              className="text-sm font-semibold text-gray-700 transition hover:text-[var(--cor-primaria)] dark:text-gray-200 dark:hover:text-white"
            >
              {t('nav.planos')}
            </a>

            {/* 4. Conteúdo (Dropdown) — agrupa Como funciona, Blog e Vídeos, que
                antes ocupavam três slots soltos e coloridos na barra */}
            <div
              className="relative"
              onMouseEnter={() => setConteudoOpen(true)}
              onMouseLeave={() => setConteudoOpen(false)}
            >
              <button
                type="button"
                onClick={() => setConteudoOpen(!conteudoOpen)}
                className="flex items-center gap-1 text-sm font-semibold text-gray-700 transition hover:text-[var(--cor-primaria)] dark:text-gray-200 dark:hover:text-white"
              >
                {t('nav.conteudo')}
                <ChevronDown size={14} className={`transition-transform duration-200 ${conteudoOpen ? 'rotate-180 text-[#FC5B24]' : ''}`} />
              </button>

              {conteudoOpen && (
                <div className="absolute top-full -left-4 mt-2 w-72 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-2xl backdrop-blur-xl dark:border-white/15 dark:bg-[#0B1120]/95 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="mb-2 px-3 pt-1 text-[11px] font-black uppercase tracking-wider text-slate-400">
                    {t('nav.conteudoTitulo')}
                  </div>
                  <div className="space-y-1">
                    {[
                      { to: '/#como-funciona', ancora: true, icone: <Compass size={18} />, titulo: t('nav.comoFunciona'), desc: t('nav.comoFuncionaDesc') },
                      { to: '/blog', icone: <BookOpen size={18} />, titulo: t('nav.blog'), desc: t('nav.blogDesc') },
                      { to: '/videos', icone: <PlayCircle size={18} />, titulo: t('nav.videos'), desc: t('nav.videosDesc') },
                      { to: '/depoimentos', icone: <Quote size={18} />, titulo: t('nav.depoimentos'), desc: t('nav.depoimentosDesc') },
                    ].map((item) =>
                      item.ancora ? (
                        <a
                          key={item.titulo}
                          href="#como-funciona"
                          onClick={() => setConteudoOpen(false)}
                          className="group flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-gray-100 dark:hover:bg-white/10"
                        >
                          <div className="shrink-0 rounded-lg bg-gray-100 p-2 text-gray-500 transition group-hover:bg-[#FC5B24]/15 group-hover:text-[#FC5B24] dark:bg-white/10 dark:text-slate-300">
                            {item.icone}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-900 dark:text-white">{item.titulo}</p>
                            <p className="text-[11px] text-gray-500 dark:text-slate-400">{item.desc}</p>
                          </div>
                        </a>
                      ) : (
                        <Link
                          key={item.titulo}
                          to={item.to}
                          onClick={() => setConteudoOpen(false)}
                          className="group flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-gray-100 dark:hover:bg-white/10"
                        >
                          <div className="shrink-0 rounded-lg bg-gray-100 p-2 text-gray-500 transition group-hover:bg-[#FC5B24]/15 group-hover:text-[#FC5B24] dark:bg-white/10 dark:text-slate-300">
                            {item.icone}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-900 dark:text-white">{item.titulo}</p>
                            <p className="text-[11px] text-gray-500 dark:text-slate-400">{item.desc}</p>
                          </div>
                        </Link>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            {/* Seletor de idioma — ícone de globo + sigla, sem bandeira emoji */}
            <button
              onClick={() => setIdioma(idioma === 'pt-BR' ? 'en-US' : 'pt-BR')}
              title={idioma === 'pt-BR' ? 'Switch to English' : 'Mudar para Português'}
              aria-label="Alternar idioma"
              className="flex items-center gap-1.5 rounded-full px-2.5 py-2 text-xs font-bold text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <Globe size={15} />
              {idioma === 'pt-BR' ? 'PT' : 'EN'}
            </button>

            <Link
              to="/acesso"
              className="rounded-full px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10"
            >
              {t('nav.entrar')}
            </Link>
            <Link
              to="/cadastre-se"
              className="rounded-full bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] px-5 py-2.5 font-['Sora'] text-sm font-bold text-white shadow-lg shadow-[#FC5B24]/25 transition hover:scale-105 hover:brightness-110"
            >
              {t('nav.cadastrar')}
            </Link>
          </div>

          {/* Toggle mobile */}
          <button
            onClick={() => setMenuAberto((a) => !a)}
            aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
            className="rounded-lg p-2 text-gray-600 transition hover:bg-gray-100 lg:hidden dark:text-gray-300 dark:hover:bg-white/10"
          >
            {menuAberto ? <X size={22} /> : <MenuIcon size={22} />}
          </button>
        </div>

        {/* Menu mobile */}
        {menuAberto && (
          <div className="border-t border-gray-200/70 bg-white/95 px-4 pb-5 pt-3 backdrop-blur-xl lg:hidden dark:border-white/10 dark:bg-[#070C18]/95">
            <div className="flex flex-col gap-1">
              <div className="px-3 py-1 text-[11px] font-black uppercase text-slate-400">{t('nav.solucoes')}</div>
              {[
                { to: '/sistema-para-restaurante-por-quilo', icone: <Scale size={16} />, rotulo: 'Restaurantes por Quilo', novo: true },
                { to: '/sistema-para-hamburgueria', icone: <ChefHat size={16} />, rotulo: 'Hamburguerias' },
                { to: '/sistema-para-pizzaria', icone: <Boxes size={16} />, rotulo: 'Pizzarias' },
                { to: '/sistema-para-lanchonete', icone: <UtensilsCrossed size={16} />, rotulo: 'Lanchonetes' },
                { to: '/sistema-para-restaurantes', icone: <BarChart3 size={16} />, rotulo: 'Restaurantes & Bares' },
              ].map((i) => (
                <Link
                  key={i.to}
                  to={i.to}
                  onClick={() => setMenuAberto(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10"
                >
                  <span className="text-gray-400 dark:text-slate-400">{i.icone}</span>
                  {i.rotulo}
                  {i.novo && (
                    <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9px] font-black text-slate-950">NOVO</span>
                  )}
                </Link>
              ))}

              <div className="mt-2 px-3 py-1 text-[11px] font-black uppercase text-slate-400">{t('nav.navegacao')}</div>
              <a href="#como-funciona" onClick={() => setMenuAberto(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10">
                <span className="text-gray-400 dark:text-slate-400"><Compass size={16} /></span> {t('nav.comoFunciona')}
              </a>
              <a href="#planos" onClick={() => setMenuAberto(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10">
                <span className="text-gray-400 dark:text-slate-400"><Wallet size={16} /></span> {t('nav.planos')}
              </a>
              <Link to="/blog" onClick={() => setMenuAberto(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10">
                <span className="text-gray-400 dark:text-slate-400"><BookOpen size={16} /></span> {t('nav.blog')}
              </Link>
              <Link to="/videos" onClick={() => setMenuAberto(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10">
                <span className="text-gray-400 dark:text-slate-400"><PlayCircle size={16} /></span> {t('nav.videos')}
              </Link>
              <Link to="/depoimentos" onClick={() => setMenuAberto(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10">
                <span className="text-gray-400 dark:text-slate-400"><Quote size={16} /></span> {t('nav.depoimentos')}
              </Link>

              <div className="mt-3 flex flex-col gap-2">
                <Link
                  to="/acesso"
                  className="rounded-xl border border-gray-300 px-4 py-2.5 text-center text-sm font-bold text-gray-700 dark:border-white/15 dark:text-gray-100"
                >
                  {t('nav.entrar')}
                </Link>
                <Link
                  to="/cadastre-se"
                  className="rounded-xl bg-[var(--cor-primaria)] px-4 py-2.5 text-center font-['Sora'] text-sm font-bold text-white shadow-lg"
                >
                  {t('nav.cadastrar')}
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ══════════ 2. HERO ESCURO GLASSMORPHISM ══════════ */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[#0B1120] via-[#0C1730] to-[#070C18] pb-20 pt-32 sm:pb-28 sm:pt-40">
        {/* brilhos decorativos */}
        <div className="pointer-events-none absolute -top-24 right-[-8%] h-96 w-96 rounded-full bg-[#0A5CC4]/25 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-10%] left-[-6%] h-80 w-80 rounded-full bg-[#FC5B24]/20 blur-3xl" />
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-4 text-center sm:px-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-blue-200 backdrop-blur-md">
            <Sparkles size={13} className="text-orange-400" />
            {t('hero.badge')}
          </span>

          <h1 className="mx-auto mt-6 max-w-4xl font-['Sora'] text-4xl font-extrabold leading-[1.12] tracking-tight text-white sm:text-5xl lg:text-6xl">
            {t('hero.title')}{' '}
            <span className="bg-gradient-to-r from-[#FF8A5C] via-[#FC5B24] to-[#6B9EFF] bg-clip-text text-transparent">
              {t('hero.titleHighlight')}
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
            {t('hero.subtitle')}
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/cadastre-se"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] px-8 py-4 font-['Sora'] text-base font-bold text-white shadow-xl shadow-[#FC5B24]/30 transition hover:scale-105 hover:brightness-110 sm:w-auto"
            >
              {t('hero.ctaPrincipal')} <ArrowRight size={18} />
            </Link>
            <a
              href="#como-funciona"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-8 py-4 font-['Sora'] text-base font-bold text-white backdrop-blur-md transition hover:bg-white/15 sm:w-auto"
            >
              {t('hero.ctaSecundario')}
            </a>
          </div>

          {/* Mini-cards de prova */}
          <div className="mt-14 grid gap-4 text-left sm:grid-cols-3">
            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-md transition-colors hover:bg-white/15">
              <ClipboardList size={22} className="mt-0.5 shrink-0 text-blue-300" />
              <div>
                <p className="text-sm font-bold text-white">{t('prova.pedidos')}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-300/90">
                  {t('prova.pedidosDesc')}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-md transition-colors hover:bg-white/15">
              <ChefHat size={22} className="mt-0.5 shrink-0 text-orange-400" />
              <div>
                <p className="text-sm font-bold text-white">{t('prova.kds')}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-300/90">
                  {t('prova.kdsDesc')}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-md transition-colors hover:bg-white/15">
              <MessageCircle size={22} className="mt-0.5 shrink-0 text-emerald-400" />
              <div>
                <p className="text-sm font-bold text-white">{t('prova.ia')}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-300/90">
                  {t('prova.iaDesc')}
                </p>
              </div>
            </div>
          </div>

          {/* ══════════ SELOS DE HOMOLOGAÇÃO & CERTIFICAÇÕES OFICIAIS ══════════ */}
          <div className="mt-10 pt-8 border-t border-white/10 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-slate-300 font-semibold">
            <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-emerald-300 backdrop-blur-md">
              <ShieldCheck size={16} className="text-emerald-400" />
              <span>API Cloud Oficial Meta Verified</span>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-blue-300 backdrop-blur-md">
              <Wallet size={16} className="text-blue-400" />
              <span>Parceiro Homologado Efí Bank (Pix)</span>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-amber-300 backdrop-blur-md">
              <Boxes size={16} className="text-amber-400" />
              <span>Emissão Fiscal FocusNFe Homologada</span>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-purple-300 backdrop-blur-md">
              <BadgeCheck size={16} className="text-purple-400" />
              <span>Conexão SSL 256-bit Certificada</span>
            </div>
          </div>
        </div>
      </header>

      {/* ══════════ 3. FAIXA DE CREDIBILIDADE ══════════ */}
      <section className="border-y border-white/10 bg-[#0B1120] py-8 relative overflow-hidden">
        <div className="pointer-events-none absolute left-1/2 top-0 h-full w-[800px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-[#0B1120]/0 to-transparent" />
        <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 sm:px-6">
          <p className="text-center font-['Sora'] text-xs font-bold uppercase tracking-widest text-slate-500">
            Tudo o que a sua operação precisa, em um só painel
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm font-semibold text-slate-300">
            <span className="flex items-center gap-2 transition hover:text-white"><Check size={16} className="text-emerald-400" /> Cardápio & QR Code</span>
            <span className="flex items-center gap-2 transition hover:text-white"><Check size={16} className="text-emerald-400" /> WhatsApp com IA</span>
            <span className="flex items-center gap-2 transition hover:text-white"><Check size={16} className="text-emerald-400" /> Integração iFood</span>
            <span className="flex items-center gap-2 transition hover:text-white"><Check size={16} className="text-emerald-400" /> PDV & Comandas</span>
            <span className="flex items-center gap-2 transition hover:text-white"><Check size={16} className="text-emerald-400" /> Cozinha KDS</span>
            <span className="flex items-center gap-2 transition hover:text-white"><Check size={16} className="text-emerald-400" /> Rotas & Entregas</span>
            <span className="flex items-center gap-2 transition hover:text-white"><Check size={16} className="text-emerald-400" /> Estoque & Ficha Técnica</span>
            <span className="flex items-center gap-2 transition hover:text-white"><Check size={16} className="text-emerald-400" /> Pix Automático</span>
          </div>
        </div>
      </section>

      {/* ══════════ 3.5 SEÇÃO VISUAL DE NICHOS E FUNCIONALIDADES ══════════ */}
      <section id="nichos" className="scroll-mt-24 bg-slate-900/40 py-20 backdrop-blur-sm border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1 text-xs font-bold uppercase tracking-widest text-orange-400">
              <Sparkles size={13} /> Soluções Sob Medida
            </span>
            <h2 className="mt-4 font-['Sora'] text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Feito sob medida para o ritmo real da sua cozinha
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-300">
              Cada segmento tem suas próprias dores. Clique no seu tipo de negócio e descubra como o MiseOn resolve sua operação:
            </p>
          </div>

          {/* Cards de Nicho */}
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            
            {/* 1. Hamburguerias */}
            <Link
              to="/sistema-para-hamburgueria"
              className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 hover:border-orange-500/50 hover:bg-white/10 hover:shadow-2xl hover:shadow-orange-500/10"
            >
              <div>
                <div className="inline-flex rounded-2xl bg-orange-500/20 p-3 text-orange-400">
                  <ChefHat size={28} />
                </div>
                <h3 className="mt-4 font-['Sora'] text-xl font-bold text-white group-hover:text-orange-400 transition-colors">
                  Hamburguerias
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  Ponto da carne, adicionais/combos, KDS na chapa, baixa de insumos (blends/pães) e iFood unificado.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-orange-400 group-hover:translate-x-1 transition-transform">
                Ver solução para Hamburgueria <ArrowRight size={14} />
              </div>
            </Link>

            {/* 2. Lanchonetes */}
            <Link
              to="/sistema-para-lanchonete"
              className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 hover:border-blue-500/50 hover:bg-white/10 hover:shadow-2xl hover:shadow-blue-500/10"
            >
              <div>
                <div className="inline-flex rounded-2xl bg-blue-500/20 p-3 text-blue-400">
                  <UtensilsCrossed size={28} />
                </div>
                <h3 className="mt-4 font-['Sora'] text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                  Lanchonetes
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  PDV express de balcão, comandas de salgado/bebida, controle de caixa por turno e impressões ultrarrápidas.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-blue-400 group-hover:translate-x-1 transition-transform">
                Ver solução para Lanchonete <ArrowRight size={14} />
              </div>
            </Link>

            {/* 3. Pizzarias */}
            <Link
              to="/sistema-para-pizzaria"
              className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 hover:border-emerald-500/50 hover:bg-white/10 hover:shadow-2xl hover:shadow-emerald-500/10"
            >
              <div>
                <div className="inline-flex rounded-2xl bg-emerald-500/20 p-3 text-emerald-400">
                  <Boxes size={28} />
                </div>
                <h3 className="mt-4 font-['Sora'] text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">
                  Pizzarias
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  Acompanhamento no KDS de forno, gestão de entregadores/motoboys, ficha técnica de insumos e iFood unificado.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition-transform">
                Ver solução para Pizzaria <ArrowRight size={14} />
              </div>
            </Link>

            {/* 4. Restaurantes */}
            <Link
              to="/sistema-para-restaurantes"
              className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 hover:border-amber-500/50 hover:bg-white/10 hover:shadow-2xl hover:shadow-amber-500/10"
            >
              <div>
                <div className="inline-flex rounded-2xl bg-amber-500/20 p-3 text-amber-400">
                  <BarChart3 size={28} />
                </div>
                <h3 className="mt-4 font-['Sora'] text-xl font-bold text-white group-hover:text-amber-400 transition-colors">
                  Restaurantes & Bares
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  Comanda no celular do garçom, mapa de mesas com divisão de conta, DRE financeiro e NFC-e.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-amber-400 group-hover:translate-x-1 transition-transform">
                Ver solução para Restaurante <ArrowRight size={14} />
              </div>
            </Link>

            {/* 5. Restaurantes por Quilo & Self-Service */}
            <Link
              to="/sistema-para-restaurante-por-quilo"
              className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-emerald-500/30 bg-emerald-950/20 p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 hover:border-emerald-500 hover:bg-emerald-900/30 hover:shadow-2xl hover:shadow-emerald-500/20 sm:col-span-2 lg:col-span-4"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="inline-flex rounded-2xl bg-emerald-500/20 p-3.5 text-emerald-400 shrink-0">
                    <Scale size={32} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-['Sora'] text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">
                        Restaurantes a Quilo & Buffet Self-Service
                      </h3>
                      <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-black uppercase text-slate-950">
                        NOVO MÓDULO
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-slate-300 max-w-3xl">
                      Módulo de Peso Inteligente (R$/kg) + Integração Nativa com Balanças (Toledo/Filizola/Urano), Divisão Inteligente de Bebidas/Itens na Mesa (Garçom no Lançamento & Caixa por Produto) e PWA Garçom com Vibração Hálptica.
                    </p>
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-1.5 text-sm font-bold text-emerald-400 group-hover:translate-x-1 transition-transform">
                  Conhecer Peso Inteligente <ArrowRight size={16} />
                </div>
              </div>
            </Link>

          </div>

          {/* Faixa de Funcionalidades Chave */}
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Principais Integrações:
              </span>
              <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
                <Link to="/integracao-ifood" className="rounded-xl border border-white/10 bg-white/10 px-3.5 py-2 text-slate-200 transition hover:border-rose-500 hover:text-rose-400">
                  🛵 Integração iFood
                </Link>
                <Link to="/cardapio-qr-code" className="rounded-xl border border-white/10 bg-white/10 px-3.5 py-2 text-slate-200 transition hover:border-orange-500 hover:text-orange-400">
                  📱 Cardápio QR Code
                </Link>
                <Link to="/api-whatsapp-restaurantes" className="rounded-xl border border-white/10 bg-white/10 px-3.5 py-2 text-slate-200 transition hover:border-emerald-500 hover:text-emerald-400">
                  🤖 WhatsApp IA Oficial
                </Link>
                <Link to="/gestao-fiscal-nfe" className="rounded-xl border border-white/10 bg-white/10 px-3.5 py-2 text-slate-200 transition hover:border-blue-500 hover:text-blue-400">
                  🧾 Emissão Fiscal NFC-e
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ 4. RECURSOS ══════════ */}
      <section id="recursos" className="scroll-mt-24 bg-white py-20 sm:py-24 dark:bg-transparent">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-black uppercase tracking-widest text-[var(--cor-primaria)]">Recursos</span>
            <h2 className="mt-3 font-['Sora'] text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
              Um sistema inteiro, não um cardápio bonito
            </h2>
            <p className="mt-4 text-base leading-relaxed text-gray-600 dark:text-slate-300">
              O MiseOn nasceu para a rotina real do food service: cada módulo conversa com o
              outro, do pedido à baixa de estoque, sem retrabalho e sem planilha paralela.
            </p>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {RECURSOS.map((r) => (
              <div
                key={r.titulo}
                className="group rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-md"
              >
                <div className={`inline-flex rounded-2xl p-3 ${r.fundo} ${r.cor}`}>
                  <r.icone size={24} />
                </div>
                <h3 className="mt-4 font-['Sora'] text-lg font-bold text-gray-900 dark:text-white">{r.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-slate-300">{r.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ 5. PLATAFORMA COMPLETA (ESCURO, GLASS) ══════════ */}
      <section id="plataforma" className="relative scroll-mt-24 overflow-hidden bg-gradient-to-br from-[#0B1120] via-[#0D1830] to-[#070C18] py-20 sm:py-24">
        <div className="pointer-events-none absolute -left-20 top-0 h-80 w-80 rounded-full bg-[#0A5CC4]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-[-6%] h-80 w-80 rounded-full bg-[#FC5B24]/15 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-blue-200 backdrop-blur-md">
              <BarChart3 size={13} className="text-orange-400" /> Plataforma completa
            </span>
            <h2 className="mt-5 font-['Sora'] text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Tudo incluso. Sem módulo escondido, sem surpresa na fatura
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-300">
              Do primeiro clique do cliente ao relatório de fechamento do mês —
              é isto que entra na sua conta quando você assina o MiseOn.
            </p>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PLATAFORMA.map((g) => (
              <div
                key={g.grupo}
                className="rounded-3xl border border-white/10 bg-white/10 p-6 backdrop-blur-md transition-colors hover:bg-white/15"
              >
                <h3 className="font-['Sora'] text-base font-extrabold uppercase tracking-widest text-orange-300">
                  {g.grupo}
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {g.itens.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm leading-snug text-slate-200">
                      <Check size={15} className="mt-0.5 shrink-0 text-emerald-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ 6. WHATSAPP IA (ESCURO, GLASS) ══════════ */}
      <section id="whatsapp-ia" className="relative scroll-mt-24 overflow-hidden bg-gradient-to-br from-[#022c22] via-[#064e3b] to-[#052e16] py-20 sm:py-24">
        <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-teal-300/10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-emerald-200 backdrop-blur-md">
                <MessageCircle size={13} /> WhatsApp Business Platform · Meta
              </span>
              <h2 className="mt-5 font-['Sora'] text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Seu WhatsApp atendendo sozinho — de verdade
              </h2>
              <p className="mt-5 text-base leading-relaxed text-emerald-100/85">
                A IA do MiseOn responde seus clientes usando os dados <b className="text-white">reais</b> da
                sua loja — cardápio, preços, estoque e horário. Quando o cliente quer pedir, ela envia o link
                do seu cardápio digital e o pedido cai direto no seu painel, com selo de origem.
              </p>
              <p className="mt-4 text-base leading-relaxed text-emerald-100/85">
                A integração não tem mensalidade oculta. E o controle continua totalmente seu: assumiu a conversa, a IA silencia na hora.
              </p>

              <div className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-[#1877F2]/20 bg-[#1877F2]/10 px-3 py-1.5 shadow-[0_0_15px_rgba(24,119,242,0.15)] backdrop-blur-sm">
                <BadgeCheck size={18} fill="#1877F2" stroke="white" strokeWidth={1.5} />
                <span className="font-['Sora'] text-[13px] font-extrabold text-white">Meta Verified</span>
                <span className="text-[11px] font-medium text-emerald-100/60 ml-1">— Parceiro Oficial</span>
              </div>
              <div className="mt-8">
                <Link
                  to="/cadastre-se"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 font-['Sora'] text-sm font-bold text-emerald-950 shadow-xl transition hover:scale-105 hover:bg-emerald-50"
                >
                  Quero isso na minha loja <ArrowRight size={16} />
                </Link>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-md transition-colors hover:bg-white/15">
                <MessageCircle size={20} className="mt-0.5 shrink-0 text-emerald-300" />
                <div>
                  <p className="text-sm font-bold text-white">Responde com dados reais</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-emerald-100/70">
                    Preço, ingredientes, taxa de entrega e horário vêm do seu cadastro. Nunca inventa valor nem desconto.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-md transition-colors hover:bg-white/15">
                <QrCode size={20} className="mt-0.5 shrink-0 text-emerald-300" />
                <div>
                  <p className="text-sm font-bold text-white">Manda o link do cardápio</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-emerald-100/70">
                    Na hora de pedir, o cliente monta o carrinho no seu site com preço real — a IA não fecha pedido sozinha.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-md transition-colors hover:bg-white/15">
                <ClipboardList size={20} className="mt-0.5 shrink-0 text-emerald-300" />
                <div>
                  <p className="text-sm font-bold text-white">Pedido cai no painel</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-emerald-100/70">
                    Chega como "Novo", com selo WhatsApp. Você aceita como qualquer pedido — decisão sempre sua.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-md transition-colors hover:bg-white/15">
                <ShieldCheck size={20} className="mt-0.5 shrink-0 text-emerald-300" />
                <div>
                  <p className="text-sm font-bold text-white">Seguro por desenho</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-emerald-100/70">
                    Assunto de saúde, como alergias, chama você na hora. E você pode desligar a IA quando quiser.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ 6.4 SEÇÃO DE VANTAGEM COMPETITIVA & POR QUE O MISEON É SUPERIOR ══════════ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#070C18] via-[#0B1120] to-[#070C18] py-20 sm:py-28 border-t border-b border-white/10">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FC5B24]/10 blur-[120px]" />
        
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-amber-400 backdrop-blur-md">
              <Sparkles size={14} className="text-amber-400" />
              Por Que o MiseOn é Infinitamente Superior
            </span>
            <h2 className="mt-5 font-['Sora'] text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
              "Todo sistema te diz quanto você vendeu.{' '}
              <span className="bg-gradient-to-r from-[#FF8A5C] via-[#FC5B24] to-[#6B9EFF] bg-clip-text text-transparent">
                O MiseOn é o único que te mostra quanto sobrou no bolso
              </span>
               — e por quê."
            </h2>
            <p className="mt-5 text-base leading-relaxed text-slate-300 sm:text-lg">
              Enquanto concorrentes te vendem robôs travados por botões que apenas disparam links secos e seguram o seu dinheiro por semanas, o MiseOn entrega um ecossistema completo de vendas, inteligência de IA e gestão financeira real.
            </p>
          </div>

          {/* Tabela Comparativa de Alta Conversão */}
          <div className="mt-14 overflow-hidden rounded-3xl border border-white/15 bg-white/5 shadow-2xl backdrop-blur-xl">
            <div className="grid grid-cols-12 bg-[#0F172A]/90 p-4 sm:p-6 text-xs font-black uppercase tracking-wider text-slate-400 border-b border-white/10">
              <div className="col-span-5 sm:col-span-4">Recurso & Inteligência</div>
              <div className="col-span-3 sm:col-span-4 text-center text-rose-400">Sistemas Tradicionais</div>
              <div className="col-span-4 text-center text-emerald-400 font-extrabold">MiseOn (Onda 2026)</div>
            </div>

            <div className="divide-y divide-white/10 text-xs sm:text-sm">
              {[
                {
                  recurso: 'Atendimento WhatsApp',
                  concorrente: 'Robô frio travado em botões com link seco',
                  miseon: 'IA Consultiva LLaMA 3.3 70B (Tira dúvidas nutricionais, faz vendas e sugere pratos)',
                  destaque: true,
                },
                {
                  recurso: 'Atribuição de Vendas',
                  concorrente: 'Não sabe de qual conversa ou anúncio veio o pedido',
                  miseon: 'Token atômico ?wa= exclusivo por conversa com vínculo direto ao pedido',
                  destaque: true,
                },
                {
                  recurso: 'Rastreio Meta Pixel & GA4',
                  concorrente: 'Sem integração nativa com seus anúncios do Instagram',
                  miseon: 'Eventos AddToCart e Purchase nativos sem custos extras de API',
                  destaque: false,
                },
                {
                  recurso: 'Apuração do Custo Real (CMV)',
                  concorrente: 'Apenas estimativas genéricas ou sem controle de lote',
                  miseon: 'Ficha Técnica Recursiva + PEPS Auditável com baixa exata por grama',
                  destaque: true,
                },
                {
                  recurso: 'DRE & Lucro Líquido Real',
                  concorrente: 'Relatório simples de faturamento bruto',
                  miseon: 'Contabilidade de Dupla Entrada (Ledger) com DRE mensal automatizado',
                  destaque: true,
                },
                {
                  recurso: 'Recebimento de Vendas (Pix)',
                  concorrente: 'Taxas intermediárias e retenção por 14 a 30 dias',
                  miseon: 'Split Bancário Direto na Conta Efí do lojista com liquidação rápida',
                  destaque: false,
                },
              ].map((row, idx) => (
                <div key={idx} className={`grid grid-cols-12 items-center p-4 sm:p-6 transition hover:bg-white/5 ${row.destaque ? 'bg-white/[0.02]' : ''}`}>
                  <div className="col-span-5 sm:col-span-4 font-bold text-white flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FC5B24]" />
                    {row.recurso}
                  </div>
                  <div className="col-span-3 sm:col-span-4 text-center text-slate-400 text-xs sm:text-sm px-2">
                    {row.concorrente}
                  </div>
                  <div className="col-span-4 text-center font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-2.5 sm:p-3 text-xs sm:text-sm shadow-inner">
                    ✨ {row.miseon}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/cadastre-se"
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] px-8 py-4 font-['Sora'] text-base font-extrabold text-white shadow-xl shadow-[#FC5B24]/30 transition hover:scale-105 hover:brightness-110"
            >
              Quero o Sistema Mais Completo do Mercado <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════ 6.5 SEÇÃO PROMO DE REFEIÇÃO POR QUILO ══════════ */}
      <section className="relative overflow-hidden bg-slate-900 py-20 border-t border-white/10">
        <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/60 via-slate-900 to-emerald-950/40 p-8 md:p-12 shadow-2xl backdrop-blur-xl">
            <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1.5 text-xs font-extrabold uppercase tracking-widest text-emerald-300">
                  <Scale size={14} /> Fim do Desperdício no Buffet
                </span>
                <h2 className="mt-4 font-['Sora'] text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                  Seu restaurante a quilo vendendo com{' '}
                  <span className="bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
                    Peso Inteligente
                  </span>
                </h2>
                <p className="mt-4 text-base leading-relaxed text-slate-300">
                  Chega de perder dinheiro no buffet por falta de controle de estoque. Com a tecnologia de peso do MiseOn, cada grama servida no prato baixa exatamente a proporção de insumos cadastrada na Ficha Técnica.
                </p>
                <div className="mt-6 space-y-3">
                  <div className="flex items-start gap-3 text-sm text-slate-200">
                    <Check size={18} className="mt-0.5 shrink-0 text-emerald-400 font-bold" />
                    <span><b>Baixa Exata de Estoque:</b> 0.350kg no prato = baixa proporcional exata no estoque de insumos.</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-slate-200">
                    <Check size={18} className="mt-0.5 shrink-0 text-emerald-400 font-bold" />
                    <span><b>Preço R$/kg Flexível:</b> Atualize o valor por quilo sempre que a carne ou insumos oscilarem.</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-slate-200">
                    <Check size={18} className="mt-0.5 shrink-0 text-emerald-400 font-bold" />
                    <span><b>Operação Híbrida:</b> Prato por quilo + marmitas a peso + bebidas unitárias no mesmo caixa.</span>
                  </div>
                </div>
                <div className="mt-8">
                  <Link
                    to="/sistema-para-restaurante-por-quilo"
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-8 py-4 font-['Sora'] text-sm font-extrabold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:scale-105 hover:bg-emerald-400"
                  >
                    Conhecer Módulo por Quilo <ArrowRight size={18} />
                  </Link>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-md">
                <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-xs font-bold uppercase text-emerald-400">Simulação de Venda por Peso</span>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">PDV Express</span>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between rounded-xl bg-white/5 p-3">
                    <span className="font-semibold text-slate-200">Feijoada por Quilo (R$ 69,90/kg)</span>
                    <span className="font-mono font-bold text-emerald-400">0,420 kg</span>
                  </div>
                  <div className="flex justify-between rounded-xl bg-white/5 p-3">
                    <span className="font-semibold text-slate-200">Baixa automática em estoque</span>
                    <span className="font-mono text-slate-300">-126g Feijão / -84g Carne</span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-3 text-sm font-bold text-white">
                    <span>Subtotal Prato</span>
                    <span className="text-emerald-400">R$ 29,35</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ 6.6 SEÇÃO ENGENHARIA DE ESTOQUE 3D & PREPAROS ══════════ */}
      <section id="estoque-3d" className="relative scroll-mt-24 overflow-hidden bg-[#070C18] py-20 sm:py-28 border-t border-white/10">
        <div className="pointer-events-none absolute left-1/4 top-0 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="pointer-events-none absolute right-10 bottom-0 h-96 w-96 rounded-full bg-purple-500/10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-blue-400">
              <Boxes size={14} /> Módulo de Engenharia de Estoque & Preparos
            </span>
            <h2 className="mt-5 font-['Sora'] text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Controle de Insumos, Fichas Técnicas e{' '}
              <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                Observabilidade 3D em Tempo Real
              </span>
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-300 sm:text-lg">
              Transforme a gestão de suprimentos da sua cozinha com conversão automática de fracionamento, receitas base com controle de validade e mapeamento tridimensional de lotes físicos.
            </p>
          </div>

          <div className="mt-16 grid gap-8 lg:grid-cols-3">
            
            {/* Pilar 1: Cadastro & Fracionamento */}
            <div className="flex flex-col justify-between rounded-3xl border border-white/10 bg-white/5 p-7 backdrop-blur-xl transition-all duration-300 hover:border-blue-500/40 hover:bg-white/10 hover:shadow-2xl">
              <div>
                <div className="inline-flex rounded-2xl bg-blue-500/20 p-3.5 text-blue-400">
                  <Database size={28} />
                </div>
                <div className="mt-5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-blue-400">Pilar 01</span>
                  <h3 className="mt-1 font-['Sora'] text-xl font-bold text-white">
                    Cadastro & Fracionamento Inteligente
                  </h3>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-300">
                  Cadastre insumos por categoria (<i>Ingrediente, Revenda Direta, Embalagem, Limpeza</i>) e atribua o setor físico (<i>Geladeira, Freezer, Dispensa, Armário</i>).
                </p>
                <div className="mt-4 space-y-2 rounded-2xl bg-black/40 p-4 text-xs">
                  <div className="flex items-center justify-between text-slate-200">
                    <span>Unidade de Compra:</span>
                    <span className="font-bold text-blue-300">Pacote / Fardo / Caixa</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-200 border-t border-white/10 pt-2">
                    <span>Conversão de Uso:</span>
                    <span className="font-bold text-emerald-400">Gramas (g) / ML / Fatias</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-300 border-t border-white/10 pt-2">
                    <AlertTriangle size={13} className="shrink-0" />
                    <span>Alerta automático de estoque crítico/risco.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pilar 2: Receitas & Ordens de Produção */}
            <div className="flex flex-col justify-between rounded-3xl border border-white/10 bg-white/5 p-7 backdrop-blur-xl transition-all duration-300 hover:border-orange-500/40 hover:bg-white/10 hover:shadow-2xl">
              <div>
                <div className="inline-flex rounded-2xl bg-orange-500/20 p-3.5 text-orange-400">
                  <FlaskConical size={28} />
                </div>
                <div className="mt-5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-orange-400">Pilar 02</span>
                  <h3 className="mt-1 font-['Sora'] text-xl font-bold text-white">
                    Receitas Base & Validade de Lotes
                  </h3>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-300">
                  Crie preparos intermediários (ex: <i>Blend Moldado 180g, Cebola Caramelizada, Molhos</i>) especificando rendimento por lote e ficha técnica dos insumos brutos.
                </p>
                <div className="mt-4 space-y-2 rounded-2xl bg-black/40 p-4 text-xs">
                  <div className="flex items-center justify-between text-slate-200">
                    <span>Produção por Lote:</span>
                    <span className="font-bold text-orange-300">Ordens de Serviço (OS)</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-200 border-t border-white/10 pt-2">
                    <span>Controle de Validade:</span>
                    <span className="font-bold text-white">Horas / Dias com Timer</span>
                  </div>
                  <div className="flex items-center justify-between text-[#FF4D4D] border-t border-white/10 pt-2 font-bold">
                    <span>Sinalização de Risco:</span>
                    <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px]">LOTE VENCIDO</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pilar 3: Observabilidade 3D & Rastreio */}
            <div className="flex flex-col justify-between rounded-3xl border border-white/10 bg-white/5 p-7 backdrop-blur-xl transition-all duration-300 hover:border-purple-500/40 hover:bg-white/10 hover:shadow-2xl">
              <div>
                <div className="inline-flex rounded-2xl bg-purple-500/20 p-3.5 text-purple-400">
                  <Eye size={28} />
                </div>
                <div className="mt-5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-purple-400">Pilar 03</span>
                  <h3 className="mt-1 font-['Sora'] text-xl font-bold text-white">
                    Observabilidade 3D de Estoque Físico
                  </h3>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-300">
                  Visualização tridimensional interativa que mapeia lotes físicos no espaço da cozinha e aplica o método PEPS (Primeiro que entra, Primeiro que sai).
                </p>
                <div className="mt-4 space-y-2 rounded-2xl bg-black/40 p-4 text-xs">
                  <div className="flex items-center justify-between text-slate-200">
                    <span>Capital Investido:</span>
                    <span className="font-mono font-bold text-emerald-400">R$ Total Mapeado</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-200 border-t border-white/10 pt-2">
                    <span>Maior Alocação:</span>
                    <span className="font-bold text-purple-300">Custo unitário por Lote</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-200 border-t border-white/10 pt-2">
                    <span>Rastreabilidade:</span>
                    <span className="font-bold text-blue-300">Esteiras 3D por Setor</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <div className="mt-12 rounded-3xl border border-white/10 bg-gradient-to-r from-blue-950/40 via-purple-950/40 to-slate-900 p-8 text-center backdrop-blur-xl">
            <h3 className="font-['Sora'] text-2xl font-bold text-white">
              Quer ver o controle de estoque 3D da sua cozinha em ação?
            </h3>
            <p className="mt-2 text-sm text-slate-300 max-w-2xl mx-auto">
              Elimine perdas por insumos vencidos e saiba exatamente quanto dinheiro está parado nas suas prateleiras e geladeiras.
            </p>
            <div className="mt-6 flex justify-center">
              <Link
                to="/cadastre-se"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] px-8 py-4 font-['Sora'] text-sm font-extrabold text-white shadow-xl shadow-[#FC5B24]/30 transition hover:scale-105"
              >
                Testar Estoque 3D Grátis <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ 7. COMO FUNCIONA ══════════ */}
      <section id="como-funciona" className="scroll-mt-24 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-black uppercase tracking-widest text-[var(--cor-primaria)]">Como funciona</span>
            <h2 className="mt-3 font-['Sora'] text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
              Do cadastro ao primeiro pedido em 3 passos
            </h2>
            <p className="mt-4 text-base leading-relaxed text-gray-600 dark:text-slate-300">
              Sem instalação, sem equipamento especial. Funciona no navegador, no computador e no celular.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {PASSOS.map((p) => (
              <div
                key={p.n}
                className="relative rounded-3xl border border-gray-200 bg-white p-7 pt-9 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-md"
              >
                <div className="absolute -top-5 left-7 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FC5B24] to-[#E34A1B] font-['Sora'] text-lg font-black text-white shadow-lg shadow-[#FC5B24]/30">
                  {p.n}
                </div>
                <h3 className="font-['Sora'] text-lg font-bold text-gray-900 dark:text-white">{p.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-slate-300">{p.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ 8. DEPOIMENTOS ══════════ */}
      <section className="bg-white py-20 sm:py-24 dark:bg-transparent">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-black uppercase tracking-widest text-[var(--cor-primaria)]">Histórias reais</span>
            <h2 className="mt-3 font-['Sora'] text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
              De quem já tentou de tudo, ou estava apenas começando
            </h2>
            <p className="mt-4 text-base leading-relaxed text-gray-600 dark:text-slate-300">
              Não importa se você usa um sistema caro, um sistema incompleto ou se ainda está no papel.
              O MiseOn se adapta à sua realidade e transforma sua gestão.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {DEPOIMENTOS.map((d, i) => (
              <div key={i} className="relative flex flex-col justify-between rounded-3xl border border-gray-200 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-md">
                <Quote className="absolute right-6 top-6 text-gray-100 dark:text-white/5" size={60} />
                <div className="relative">
                  <div className="flex items-center gap-1 text-amber-400">
                    <Star size={16} fill="currentColor" />
                    <Star size={16} fill="currentColor" />
                    <Star size={16} fill="currentColor" />
                    <Star size={16} fill="currentColor" />
                    <Star size={16} fill="currentColor" />
                  </div>
                  <p className="mt-5 text-sm leading-relaxed text-gray-700 dark:text-slate-300 italic">
                    "{d.texto}"
                  </p>
                </div>
                <div className="relative mt-8 flex items-center justify-between border-t border-gray-100 pt-5 dark:border-white/10">
                  <div>
                    <p className="font-['Sora'] text-sm font-bold text-gray-900 dark:text-white">{d.nome}</p>
                    <p className="text-xs font-medium text-[var(--cor-primaria)]">{d.negocio}</p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:bg-white/10 dark:text-gray-400 max-w-[120px] text-right">
                    {d.perfil}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ 9. PLANOS / CTA FINAL ══════════ */}
      <section id="planos" className="scroll-mt-24 pb-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center mb-14">
            <span className="text-xs font-black uppercase tracking-widest text-[var(--cor-primaria)]">Planos & Assinatura</span>
            <h2 className="mt-3 font-['Sora'] text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
              Sua loja no ar com 30 dias grátis — Sem pegadinha de cartão
            </h2>
            <p className="mt-4 text-base leading-relaxed text-gray-600 dark:text-slate-300">
              Cadastre sua loja em menos de 3 minutos, use 30 dias sem custos e escolha a melhor opção para a sua operação. 
              Pagamentos via Pix têm 5% de desconto à vista e o plano anual pode ser parcelado no cartão em até 12x pelo Efí Bank.
            </p>
          </div>

          <div className="mx-auto mt-8 flex max-w-sm items-center justify-center rounded-full border border-gray-200 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-white/5">
            <button
              onClick={() => setPlanoAnual(false)}
              className={`flex-1 rounded-full py-2.5 text-sm font-bold transition-all ${
                !planoAnual
                  ? 'bg-gray-100 text-gray-900 shadow-sm dark:bg-white/15 dark:text-white'
                  : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setPlanoAnual(true)}
              className={`flex-1 rounded-full py-2.5 text-sm font-bold transition-all ${
                planoAnual
                  ? 'bg-[var(--cor-primaria)] text-white shadow-lg shadow-[var(--cor-primaria)]/30'
                  : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Anual (Desconto Especial)
            </button>
          </div>

          <div className="mx-auto mt-10 max-w-5xl">
            <div className="flex flex-col lg:flex-row rounded-3xl border border-orange-500/30 bg-[#0B1120] shadow-2xl overflow-hidden transition-all duration-500 hover:shadow-orange-500/10">
              
              {/* Esquerda: Preço e CTA */}
              <div className="relative flex flex-col justify-between p-8 lg:w-[45%] lg:p-10 bg-gradient-to-br from-[#0B1120] via-[#0C1730] to-[#111a33] border-b border-white/10 lg:border-b-0 lg:border-r">
                {planoAnual && (
                  <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-[#FC5B24]/20 blur-3xl pointer-events-none transition-opacity duration-500" />
                )}
                
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="inline-flex rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-300">
                      ✨ 30 Dias Grátis Sem Cartão
                    </span>
                    {planoAnual && (
                      <span className="inline-flex rounded-full bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-lg">
                        Mais Recomendado
                      </span>
                    )}
                  </div>
                  <h3 className="font-['Sora'] text-3xl font-extrabold text-white">Plano Profissional</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    {planoAnual ? 'A escolha inteligente: R$ 149,90/mês no plano anual. Parcele em até 12x no cartão ou ganhe 5% OFF à vista no Pix.' : 'Flexibilidade mensal: R$ 169,90/mês com acesso completo a todos os módulos, sem fidelidade forçada.'}
                  </p>
                </div>

                <div className="mt-8 flex flex-col">
                  {planoAnual ? (
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-sm font-medium text-slate-500 line-through">R$ 169,90/mês</span>
                      <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-400 uppercase">Economize R$ 240,00/ano</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-emerald-400">Pix com 5% OFF: R$ 161,40/mês</span>
                    </div>
                  )}
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-extrabold tracking-tight text-white transition-all">
                      R$ {planoAnual ? '149,90' : '169,90'}
                    </span>
                    <span className="text-base font-medium text-slate-400">/mês</span>
                  </div>
                  <span className="mt-2 text-xs text-orange-300/90 font-medium transition-all">
                    {planoAnual ? 'Parcele em 3x, 6x, 8x ou 12x de R$ 149,90 no cartão (ou R$ 1.708,86 à vista no Pix com 5% OFF)' : 'R$ 169,90 no cartão ou R$ 161,40 à vista no Pix (5% OFF)'}
                  </span>
                </div>

                <div className="mt-8">
                  <Link
                    to="/cadastre-se"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] px-6 py-4 font-['Sora'] text-base font-bold text-white shadow-lg shadow-[#FC5B24]/30 transition hover:scale-105 hover:brightness-110"
                  >
                    Testar 30 Dias Grátis <ArrowRight size={18} />
                  </Link>
                  <p className="mt-4 text-center text-[11px] font-medium text-slate-400">
                    <strong className="text-slate-200">Sem cartão no cadastro.</strong> Tolerância de 7 dias pós-vencimento.
                  </p>
                </div>
              </div>

              {/* Direita: Features Detalhadas */}
              <div className="p-8 lg:w-[58%] lg:p-10 bg-[#060a14]">
                <h4 className="font-['Sora'] text-base font-bold text-white mb-8 flex items-center gap-2">
                  <Sparkles size={18} className="text-orange-400" />
                  O sistema completo, sem surpresas:
                </h4>
                
                <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
                  {/* Categoria 1 */}
                  <div>
                    <h5 className="flex items-center gap-2 text-sm font-bold text-slate-200 mb-3 border-b border-white/5 pb-2">
                      <ChefHat size={16} className="text-emerald-400" /> Operação e Vendas
                    </h5>
                    <ul className="space-y-2.5 text-xs text-slate-400">
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-emerald-500/70 mt-0.5" /> <span><strong className="text-slate-300">PDV Frente de Caixa</strong> inteligente</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-emerald-500/70 mt-0.5" /> <span><strong className="text-slate-300">Cardápio QR Code</strong> p/ mesas</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-emerald-500/70 mt-0.5" /> <span><strong className="text-slate-300">Integração iFood</strong> nativa</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-emerald-500/70 mt-0.5" /> <span><strong className="text-slate-300">Gestão de Comandas</strong> na palma</span></li>
                    </ul>
                  </div>

                  {/* Categoria 2 */}
                  <div>
                    <h5 className="flex items-center gap-2 text-sm font-bold text-slate-200 mb-3 border-b border-white/5 pb-2">
                      <MessageCircle size={16} className="text-blue-400" /> IA e Delivery
                    </h5>
                    <ul className="space-y-2.5 text-xs text-slate-400">
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-blue-500/70 mt-0.5" /> <span><strong className="text-slate-300">Robô WhatsApp</strong> (API Oficial Meta)</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-blue-500/70 mt-0.5" /> <span><strong className="text-slate-300">Cardápio Online</strong> livre de taxas</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-blue-500/70 mt-0.5" /> <span><strong className="text-slate-300">Impressão Automática</strong> de pedidos</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-blue-500/70 mt-0.5" /> <span><strong className="text-slate-300">Cozinha KDS</strong> em telas</span></li>
                    </ul>
                  </div>

                  {/* Categoria 3 */}
                  <div>
                    <h5 className="flex items-center gap-2 text-sm font-bold text-slate-200 mb-3 border-b border-white/5 pb-2">
                      <Boxes size={16} className="text-orange-400" /> Estoque e Precisão
                    </h5>
                    <ul className="space-y-2.5 text-xs text-slate-400">
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-orange-500/70 mt-0.5" /> <span><strong className="text-slate-300">Ficha Técnica</strong> avançada (CMV)</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-orange-500/70 mt-0.5" /> <span><strong className="text-slate-300">Baixa automática</strong> por venda</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-orange-500/70 mt-0.5" /> <span><strong className="text-slate-300">Controle de Lotes</strong> e PEPs</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-orange-500/70 mt-0.5" /> <span><strong className="text-slate-300">Visualização 3D</strong> do espaço</span></li>
                    </ul>
                  </div>

                  {/* Categoria 4 */}
                  <div>
                    <h5 className="flex items-center gap-2 text-sm font-bold text-slate-200 mb-3 border-b border-white/5 pb-2">
                      <Wallet size={16} className="text-indigo-400" /> Controle e Equipe
                    </h5>
                    <ul className="space-y-2.5 text-xs text-slate-400">
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-indigo-500/70 mt-0.5" /> <span><strong className="text-slate-300">Pix Automático (Efí)</strong> direto na conta</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-indigo-500/70 mt-0.5" /> <span><strong className="text-slate-300">Caixa e Relatórios</strong> analíticos</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-indigo-500/70 mt-0.5" /> <span><strong className="text-slate-300">Usuários Ilimitados</strong> com permissões</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-indigo-500/70 mt-0.5" /> <span><strong className="text-slate-300">Atendimento Humano</strong> prioritário</span></li>
                    </ul>
                  </div>
                </div>
                
              </div>
            </div>
          </div>
          
          <div className="mt-12 flex justify-center">
            <a
              href={zap('Olá! Quero conhecer os planos do MiseOn para o meu restaurante.')}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 transition hover:text-[var(--cor-primaria)] dark:text-slate-400 dark:hover:text-orange-400"
            >
              <MessageCircle size={18} /> Ainda com dúvidas? Fale com nosso time
            </a>
          </div>
        </div>
      </section>

      {/* ══════════ 8.5 BLOG & COMUNIDADE DE ESPECIALISTAS ══════════ */}
      <section id="blog-destaque" className="scroll-mt-24 py-20 bg-gradient-to-br from-[#0B1120] via-[#0C1730] to-[#070C18] text-white border-t border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FC5B24]/20 border border-[#FC5B24]/40 px-4 py-1 text-xs font-black uppercase tracking-widest text-orange-300">
              <BookOpen size={14} className="text-[#FC5B24]" />
              Blog & Centro de Inteligência em Food Service
            </span>
            <h2 className="mt-4 font-['Sora'] text-3xl font-extrabold tracking-tight sm:text-4xl">
              Conteúdo profundo sobre CMV, KDS, Engenharia de Cardápio e IA
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-300">
              Aprenda com estudos de caso reais, análises financeiras e regras de operação validadas na prática em cozinhas profissionais.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
              <div>
                <span className="text-[10px] font-black uppercase text-[#FC5B24]">Gestão Financeira</span>
                <h3 className="mt-2 font-['Sora'] text-base font-bold text-white leading-snug">
                  A Evolução do CMV: Do Caderno ao Custeio PEPS 3D
                </h3>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  Como calcular a perda de cocção e valorizar preparos em lote sem margens maquiadas.
                </p>
              </div>
              <Link to="/blog/evolucao-do-cmv-do-caderno-ao-custeio-peps-3d" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#FC5B24] hover:underline">
                Ler estudo <ArrowRight size={13} />
              </Link>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
              <div>
                <span className="text-[10px] font-black uppercase text-blue-400">Operação & KDS</span>
                <h3 className="mt-2 font-['Sora'] text-base font-bold text-white leading-snug">
                  O Fim do Papel na Cozinha com KDS Kanban
                </h3>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  Reduza até 35% do tempo de preparo eliminando rasuras e papel engordurado.
                </p>
              </div>
              <Link to="/blog/o-fim-do-papel-na-cozinha-kds-kanban-operacional" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#FC5B24] hover:underline">
                Ler estudo <ArrowRight size={13} />
              </Link>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-400">Tecnologia & IA</span>
                <h3 className="mt-2 font-['Sora'] text-base font-bold text-white leading-snug">
                  IA no WhatsApp: Conexão Oficial Meta vs Bots Amadores
                </h3>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  Evite banimento do seu número de delivery e atenda clientes com precisão.
                </p>
              </div>
              <Link to="/blog/ia-no-whatsapp-do-restaurante-atendimento-oficial-meta-vs-bots-amadores" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#FC5B24] hover:underline">
                Ler estudo <ArrowRight size={13} />
              </Link>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
              <div>
                <span className="text-[10px] font-black uppercase text-amber-400">Restaurante por Quilo</span>
                <h3 className="mt-2 font-['Sora'] text-base font-bold text-white leading-snug">
                  Perda de Cocção & Peso Inteligente no Buffet
                </h3>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  Entenda o encolhimento de carnes e a baixa de estoque por grama servida.
                </p>
              </div>
              <Link to="/blog/verdade-sobre-venda-por-quilo-perda-coccao-peso-inteligente" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#FC5B24] hover:underline">
                Ler estudo <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* BOX DE CONVITE PARA AUTORES E ESPECIALISTAS */}
          <div className="mt-12 rounded-3xl border border-orange-500/30 bg-gradient-to-r from-orange-500/10 via-purple-500/10 to-blue-500/10 p-8 backdrop-blur-xl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-orange-300">
                  🖋️ Escreva para o Blog MiseOn
                </span>
                <h3 className="mt-2 font-['Sora'] text-2xl font-bold text-white">
                  É Consultor de CMV, Chef, Nutricionista ou Especialista em Gastronomia?
                </h3>
                <p className="mt-2 text-xs text-slate-300 max-w-2xl leading-relaxed">
                  Publique seus artigos técnicos em nosso Blog e seja lido por milhares de donos de restaurantes e gestores de food service de todo o Brasil.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <Link
                  to="/blog"
                  className="rounded-full bg-white px-5 py-3 font-['Sora'] text-xs font-bold text-gray-900 shadow-md transition hover:bg-gray-100"
                >
                  Acessar Hub do Blog
                </Link>
                <a
                  href="mailto:contato@miseon.app.br?subject=Proposta%20de%20Artigo%20para%20o%20Blog%20MiseOn"
                  className="rounded-full bg-[#FC5B24] px-5 py-3 font-['Sora'] text-xs font-bold text-white shadow-lg shadow-[#FC5B24]/30 transition hover:scale-105"
                >
                  Enviar Proposta de Artigo
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ 9. SUPORTE + FAQ ══════════ */}
      <section id="suporte" className="scroll-mt-24 border-t border-gray-200/70 bg-white py-20 sm:py-24 dark:border-white/10 dark:bg-transparent">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-black uppercase tracking-widest text-[var(--cor-primaria)]">Suporte</span>
            <h2 className="mt-3 font-['Sora'] text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
              Gente de verdade do outro lado
            </h2>
            <p className="mt-4 text-base leading-relaxed text-gray-600 dark:text-slate-300">
              Nada de ticket perdido em fila infinita. Você fala com o time que constrói
              o MiseOn — no WhatsApp ou por e-mail, no canal que preferir.
            </p>
          </div>

          {/* Canais de atendimento */}
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {SUPORTE_CANAIS.map((c) => (
              <div
                key={c.titulo}
                className={`flex flex-col rounded-3xl border p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl ${
                  c.destaque
                    ? 'border-emerald-500/40 bg-gradient-to-br from-emerald-600 to-emerald-800 text-white'
                    : 'border-gray-200 bg-white dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-md'
                }`}
              >
                <div
                  className={`inline-flex w-fit rounded-2xl p-3 ${
                    c.destaque ? 'bg-white/15 text-white' : 'bg-[var(--cor-primaria)]/10 text-[var(--cor-primaria)]'
                  }`}
                >
                  <c.icone size={24} />
                </div>
                <h3 className={`mt-4 font-['Sora'] text-lg font-bold ${c.destaque ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                  {c.titulo}
                </h3>
                <p className={`mt-2 flex-1 text-sm leading-relaxed ${c.destaque ? 'text-emerald-100/90' : 'text-gray-600 dark:text-slate-300'}`}>
                  {c.descricao}
                </p>
                <a
                  href={c.href}
                  {...(c.externo ? { target: '_blank', rel: 'noreferrer' } : {})}
                  className={`mt-5 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition hover:scale-[1.02] ${
                    c.destaque
                      ? 'bg-white text-emerald-900 shadow-lg hover:bg-emerald-50'
                      : 'border border-gray-300 text-gray-800 hover:bg-gray-50 dark:border-white/20 dark:text-white dark:hover:bg-white/10'
                  }`}
                >
                  {c.acao} <ArrowRight size={15} />
                </a>
              </div>
            ))}
          </div>

          {/* FAQ */}
          <div className="mx-auto mt-16 max-w-3xl">
            <h3 className="text-center font-['Sora'] text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              Perguntas frequentes
            </h3>
            <div className="mt-8 grid gap-3">
              {FAQ.map((f) => (
                <FaqItem key={f.pergunta} pergunta={f.pergunta} resposta={f.resposta} />
              ))}
            </div>
            <p className="mt-8 text-center text-sm text-gray-500 dark:text-slate-400">
              Não achou a sua dúvida?{' '}
              <a
                href={zap('Olá! Tenho uma dúvida sobre o MiseOn.')}
                target="_blank"
                rel="noreferrer"
                className="font-bold text-[var(--cor-primaria)] underline-offset-2 transition hover:underline"
              >
                Chama no WhatsApp
              </a>{' '}
              ou escreva para{' '}
              <a
                href="mailto:suporte@miseon.app.br?subject=D%C3%BAvida%20MiseOn"
                className="font-bold text-[var(--cor-primaria)] underline-offset-2 transition hover:underline"
              >
                suporte@miseon.app.br
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      {/* ══════════ 9.5 SEÇÃO SEMÂNTICA "SOBRE O SISTEMA MISEON" (GEO & SEO) ══════════ */}
      <section id="sobre-o-sistema" className="border-t border-gray-200/70 bg-[#070C18] py-16 text-slate-300 dark:border-white/10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md">
            <h2 className="font-['Sora'] text-2xl font-extrabold text-white">
              Sobre o Sistema MiseOn | Sistema de Gestão e Automação para Restaurantes e Bares
            </h2>
            <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-300">
              <p>
                O sistema <strong>MiseOn</strong> é uma plataforma de gestão corporativa e automação inteligente desenvolvida exclusivamente para atender a rotina de restaurantes, hamburguerias, pizzarias, lanchonetes e bares em todo o Brasil.
              </p>
              <p>
                Com arquitetura em nuvem de alta performance, o <strong>MiseOn</strong> integra em um único painel o cardápio digital QR Code para mesas e balcão, comandas eletrônicas via celular para garçons, telas de produção de cozinha (KDS sem papel), gerenciador de delivery integrado ao iFood, controle de caixa PDV, ficha técnica com baixa automática de estoque e atendimento via IA no WhatsApp oficial da Meta.
              </p>
              <p>
                Desenvolvido para garantir agilidade e controle financeiro total, o sistema conta ainda com recebimento Pix automático sem retenção de valores e emissão fiscal NFC-e / NF-e integrada.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ 10. FOOTER SEO — LINKAGEM INTERNA ══════════ */}
      <FooterSEO />
    </div>
  );
}
