import { Link } from 'react-router-dom';
import {
  QrCode, ClipboardList, ChefHat, Bike, Boxes, Wallet, ScanLine, HeartPulse,
  MessageCircle, ShieldCheck, ArrowRight, Check, Sparkles,
  Menu as MenuIcon, X, UtensilsCrossed, Megaphone, ShoppingBag,
  Mail, ChevronDown, Headset, BarChart3, Star, Quote, BadgeCheck, Scale,
  Database, FlaskConical, Eye, AlertTriangle, BookOpen,
  Globe, PlayCircle, Compass, Tv, Mic, ShoppingCart, Store,
} from 'lucide-react';
import { useState } from 'react';
import MiseOnLogo from '../components/MiseOnLogo';
import SEO from '../components/SEO';
import FooterSEO from '../components/FooterSEO';
import FlipCard from '../components/ui/FlipCard';
import { useI18n } from '../contexts/I18nContext';

const WHATSAPP_CONTATO = '5511919889233';
const zap = (msg: string) => `https://wa.me/${WHATSAPP_CONTATO}?text=${encodeURIComponent(msg)}`;

/* ───────────────────────────── Dados ───────────────────────────── */

const RECURSOS = [
  {
    icone: Tv,
    titulo: 'Menu Board 4K & Chamada por Voz na TV',
    detalhes: [
      'Chamada da senha falada em voz alta pela própria TV',
      'Painel de senhas do dia, sem login e sem app na TV',
      'Basta abrir o link da loja numa Smart TV comum',
    ],
    metrica: 'SENHA CHAMADA EM VOZ',
    badge: 'SALÃO E BALCÃO',
    texto: 'Transforme qualquer Smart TV do salão em um painel noturno 4K rotativo com chamada de senhas por voz sintetizada em viva-voz.',
    cor: 'text-purple-400',
    fundo: 'bg-purple-500/10',
  },
  {
    icone: Mic,
    titulo: 'Comanda por Voz no Celular',
    detalhes: [
      'O atendente fala e o próprio aparelho transcreve',
      'O sistema casa o que foi dito com os itens do seu cardápio',
      'Você confere na tela antes de mandar para a comanda',
    ],
    metrica: 'PEDIDO SEM DIGITAR',
    badge: 'MAOS LIVRES',
    texto: 'O cliente fala seu pedido no celular de forma natural ("Dois X-Burgers e 1 Coca Zero") e a IA localiza e insere os itens no carrinho.',
    cor: 'text-[#FC5B24]',
    fundo: 'bg-[#FC5B24]/10',
  },
  {
    icone: ShoppingCart,
    titulo: 'Inteligência Preditiva de Compras',
    detalhes: [
      'Sugestão pelo giro real dos últimos 30 dias, não pelo mínimo esquecido',
      'Projeta a cobertura do estoque até a próxima entrega',
      'Ordem de compra pronta para enviar ao fornecedor',
    ],
    metrica: 'COMPRA NA MEDIDA',
    badge: 'PREVISAO DE GIRO',
    texto: 'Algoritmo que analisa o giro real dos últimos 30 dias, projeta o consumo para 7 dias e gera a Ordem de Compra em 1-Clique via WhatsApp do fornecedor.',
    cor: 'text-emerald-500',
    fundo: 'bg-emerald-500/10',
  },
  {
    icone: QrCode,
    titulo: 'Cardápio Digital com QR Code',
    detalhes: [
      'Link e QR próprios, com a sua marca — sem comissão por pedido',
      'O cardápio consulta a ficha técnica e sabe o que ainda tem insumo',
      'Cliente pede pelo navegador, sem instalar aplicativo',
    ],
    metrica: 'ZERO COMISSÃO',
    badge: 'VENDA DIRETA',
    texto: 'Sua loja no ar com link próprio e QR Code para mesas e balcão. Fotos, adicionais e preços sempre atualizados — sem imprimir nada.',
    cor: 'text-orange-500',
    fundo: 'bg-orange-500/10',
  },
  {
    icone: ChefHat,
    titulo: 'Cozinha (KDS Kanban)',
    detalhes: [
      'Pedidos em colunas por etapa, com o tempo correndo em cada ficha',
      'Estações de preparo separadas por tipo de produção',
      'Tempo médio por etapa para achar o gargalo da cozinha',
    ],
    metrica: 'COZINHA SEM PAPEL',
    badge: 'PRODUÇÃO',
    texto: 'Tela de produção sem papel: a cozinha vê a fila por estações (Cozinha, Bar, Confeitaria), marca o preparo e o balcão acompanha tudo em tempo real.',
    cor: 'text-red-500',
    fundo: 'bg-red-500/10',
  },
  {
    icone: Store,
    titulo: 'Dark Kitchen (Delivery Apenas)',
    detalhes: [
      'Perfil de operação sem salão: o painel se ajusta ao delivery',
      'Sem mesa e sem balcão atravancando a tela de quem só entrega',
      'Mesmo estoque, mesmo KDS e mesmo financeiro',
    ],
    metrica: 'OPERAÇÃO SEM SALÃO',
    badge: 'PERFIL DE NEGOCIO',
    texto: 'Opere múltiplas marcas virtuais no mesmo restaurante compartilhando a mesma cozinha física e a mesma baixa de estoque PEPS.',
    cor: 'text-indigo-400',
    fundo: 'bg-indigo-500/10',
  },
  {
    icone: Bike,
    titulo: 'Gestão de Entregas por Km',
    detalhes: [
      'Taxa por faixa de distância, calculada pelo km real da entrega',
      'Rota do entregador acompanhada ao vivo',
      'Distância média e volume por faixa no painel',
    ],
    metrica: 'TAXA POR DISTÂNCIA',
    badge: 'DELIVERY',
    texto: 'Cálculo de frete por distância (Taxa Base + R$/km + Raio máximo), Live GPS Tracking do entregador e visualização no mapa.',
    cor: 'text-emerald-500',
    fundo: 'bg-emerald-500/10',
  },
  {
    icone: UtensilsCrossed,
    titulo: 'PDV, Mesas 3D e Comandas',
    detalhes: [
      'Salão desenhado em 3D: mesa livre, ocupada ou fechando conta',
      'Caixa com abertura e fechamento de turno',
      'Mesmo caixa do delivery, do balcão e do salão',
    ],
    metrica: 'SALÃO E BALCÃO NO MESMO CAIXA',
    badge: 'ATENDIMENTO',
    texto: 'Balcão e salão no mesmo sistema: comanda por mesa/assento, pedido direto na tela da cozinha e fechamento de conta sem confusão.',
    cor: 'text-amber-500',
    fundo: 'bg-amber-500/10',
  },
  {
    icone: HeartPulse,
    titulo: 'Tabela Nutricional por Ficha Técnica',
    detalhes: [
      'Lê o rótulo pela foto, pelo código de barras ou estima com IA',
      'Bases de referência USDA, TBCA e IBGE/POF por trás do cálculo',
      'Cada valor mostra de onde veio — rótulo, base científica ou estimativa',
    ],
    metrica: 'NUTRICAO SEM NUTRICIONISTA',
    badge: 'DIFERENCIAL RARO',
    texto: 'O valor nutricional do prato sai da própria ficha técnica: o sistema soma os insumos e calcula. Você alimenta o insumo fotografando o rótulo, lendo o código de barras ou deixando a IA estimar — e cada número carrega a origem do dado.',
    cor: 'text-rose-400',
    fundo: 'bg-rose-500/10',
  },
  {
    icone: ScanLine,
    titulo: 'Estoque pelo Cupom do Mercado (NFC-e)',
    detalhes: [
      'A nota inteira em um scan, lida na SEFAZ — sem digitar item por item',
      'Você escolhe o que entra e como converte (1 bandeja = 20 unidades)',
      'Aprende o código de cada mercado e recusa nota já lançada',
    ],
    metrica: 'COMPRA INTEIRA EM 1 SCAN',
    badge: 'EXCLUSIVO MISEON',
    texto: 'A compra inteira entra no estoque com um scan do cupom fiscal. O MiseOn lê a nota na SEFAZ, traz produto, quantidade e custo real, e aprende o vínculo de cada item — a segunda compra no mesmo mercado já cai reconhecida.',
    cor: 'text-orange-500',
    fundo: 'bg-orange-500/10',
  },
  {
    icone: Boxes,
    titulo: 'Estoque com Ficha Técnica & CMV',
    detalhes: [
      'Cada venda baixa os ingredientes pela ficha do prato',
      'Custo pelo lote PEPS: o CMV segue o preço que você pagou',
      'Desmonte de peça inteira com rateio de custo por corte',
    ],
    metrica: 'CMV REAL POR PRATO',
    badge: 'CUSTEIO PEPS',
    texto: 'Cada venda baixa os ingredientes automaticamente pelo custo PEPS. Você sabe o custo real de cada prato e nunca vende o que acabou.',
    cor: 'text-purple-500',
    fundo: 'bg-purple-500/10',
  },
  {
    icone: Wallet,
    titulo: 'Financeiro com Pix (Efí) & DRE',
    detalhes: [
      'Pix cai na conta da sua loja, com conciliação automática',
      'DRE com margem de contribuição e lucro líquido reais',
      'Custo fixo e variável separados, por período',
    ],
    metrica: 'LUCRO SEM PLANILHA',
    badge: 'FINANCEIRO',
    texto: 'Pix cai direto na sua conta, com conciliação automática e DRE Gerencial de Dupla Entrada revelando seu lucro líquido real.',
    cor: 'text-teal-500',
    fundo: 'bg-teal-500/10',
  },
  {
    icone: Megaphone,
    titulo: 'Marketing, Meta Pixel & Cashback',
    detalhes: [
      'CRM com análise RFM: quem sumiu, quem volta e quem gasta mais',
      'Cashback, cupons e banners de vitrine na sua mão',
      'Meta Pixel e GA4 medindo cada pedido, com recuperação de venda',
    ],
    metrica: 'CLIENTE QUE VOLTA',
    badge: 'CRM E FIDELIZAÇÃO',
    texto: 'Cupons, cashback acumulado na carteira virtual, atribuição WhatsApp (?wa=) e rastreamento Meta Pixel/GA4 para vendas sem comissão.',
    cor: 'text-pink-500',
    fundo: 'bg-pink-500/10',
  },
  {
    icone: Scale,
    titulo: 'Venda por Quilo (R$/kg) & Balança',
    detalhes: [
      'Balança ligada por WebSerial: o peso entra sozinho na conta',
      'Toledo Prix 3/4, Filizola, Urano e serial genérica',
      'O peso vai para a comanda e para a baixa de estoque',
    ],
    metrica: 'PESO DIRETO NA CONTA',
    badge: 'SELF-SERVICE',
    texto: 'Integração WebSerial HID com balanças Toledo/Prix 3: pesagem automática, seletor de peso fracionado e baixa exata no estoque.',
    cor: 'text-emerald-400',
    fundo: 'bg-emerald-500/10',
  },
];

const PLATAFORMA = [
  {
    grupo: 'Vender',
    itens: [
      'Cardápio digital com link próprio e QR Code',
      'Painel TV 4K para Smart TV com chamada de pedidos por voz',
      'Comanda por Voz com IA no celular do cliente',
      'PDV de balcão e comandas por mesa',
      'Pedidos em tempo real, com aviso sonoro',
      'Pagamento Pix e cartão via Efí com split automático',
    ],
  },
  {
    grupo: 'Operar',
    itens: [
      'Cozinha KDS sem papel com estações de preparo',
      'Suporte a Dark Kitchen Multi-Brand (Múltiplas Marcas)',
      'Gestão de entregas por Km com GPS Tracking ao vivo',
      'Status do pedido que o cliente acompanha',
      'Impressão de pedido para produção (WebSerial HID)',
      'Equipe com papéis e permissões de acesso',
    ],
  },
  {
    grupo: 'Gerir',
    itens: [
      'Entrada de estoque escaneando o cupom fiscal do mercado (NFC-e)',
      'Estoque com baixa automática por lote PEPS',
      'Inteligência Preditiva de Compras (Ordem no WhatsApp)',
      'Ficha técnica, alergênicos e CMV real por prato',
      'Tabela nutricional calculada pela ficha (rótulo, código de barras ou IA)',
      'DRE Gerencial de Dupla Entrada com Margem Líquida',
      'Marketing, Meta Pixel, GA4 e Cashback Fidelidade',
      'Conformidade LGPD com E-mails Transacionais',
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
    pergunta: 'Preciso cadastrar item por item quando volto do mercado?',
    resposta:
      'Não. Escaneie o QR Code do cupom fiscal (NFC-e) com a câmera do celular — ou envie uma foto dele — e o MiseOn consulta a nota na SEFAZ e traz a lista completa: descrição, quantidade, unidade e custo de cada item. Na conferência você desmarca o que não é da cozinha, ajusta a conversão (uma bandeja de ovos vira 20 unidades) e dá entrada de todos de uma vez. Na compra seguinte no mesmo mercado, o reconhecimento já é automático — e a mesma nota nunca entra duas vezes.',
  },
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
      'Sim, via API do iFood. Os pedidos entram na mesma fila dos do seu site com a comanda inteira — endereço, observação de entrega, troco e bandeira do cartão — e a comissão do iFood descontada pedido a pedido, para você ver o líquido. A baixa de estoque é unificada depois que os produtos são vinculados aos códigos do iFood, o que fazemos no onboarding.',
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
  const { idioma, setIdioma, t, tDynamic } = useI18n();
  const [menuAberto, setMenuAberto] = useState(false);
  const [planoAnual, setPlanoAnual] = useState(true);
  const [solucoesOpen, setSolucoesOpen] = useState(false);
  const [recursosOpen, setRecursosOpen] = useState(false);
  const [conteudoOpen, setConteudoOpen] = useState(false);

  return (
    <div className="min-h-screen scroll-smooth bg-[#F4F7FA] font-sans text-gray-900 selection:bg-[#FC5B24] selection:text-white dark:bg-[#070C18] dark:text-[#EAF1FB]">
      <SEO
        title="MiseOn | Sistema de Gestão para Food Service e Restaurantes"
        description="MiseOn: sistema de gestão para todo o food service — hamburgueria, pizzaria, lanchonete, restaurante à la carte, buffet por quilo, bar e dark kitchen. Cardápio digital, KDS, estoque pelo cupom fiscal e iFood."
        keywords="sistema para restaurante, comanda eletrônica para bares, gerenciador de delivery integrado, sistema para hamburgueria, sistema para pizzaria, cardápio digital qr code, integração ifood, whatsapp ia restaurante"
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
                    {tDynamic('Soluções por Nicho')}
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
                          {tDynamic('Restaurantes por Quilo')}
                          <span className="rounded-full bg-emerald-500 px-1.5 py-0.2 text-[9px] font-black text-slate-950">{tDynamic('NOVO')}</span>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400">{tDynamic('Peso Inteligente R$/kg e Ficha Técnica')}</p>
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
                        <p className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-orange-400">{tDynamic('Hamburguerias')}</p>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400">{tDynamic('Chapa KDS, adicionais e blends')}</p>
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
                        <p className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-emerald-400">{tDynamic('Pizzarias')}</p>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400">{tDynamic('KDS de forno, delivery e motoboys')}</p>
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
                        <p className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-blue-400">{tDynamic('Lanchonetes')}</p>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400">{tDynamic('PDV balcão express e caixa por turno')}</p>
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
                        <p className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-amber-400">{tDynamic('Restaurantes & Bares')}</p>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400">{tDynamic('Garçom no celular e mapa de mesas')}</p>
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
                    {tDynamic('Recursos em Destaque')}
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
                        <p className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-rose-400">{tDynamic("Integração iFood")}</p>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400">{tDynamic("Margem protegida e comanda completa")}</p>
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
                        <p className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-orange-400">{tDynamic("Cardápio QR Code")}</p>
                        <p className="text-[11px] text-gray-500 dark:text-slate-400">{tDynamic("Autoatendimento direto na mesa sem taxas")}</p>
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
                        <p className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-blue-400">{tDynamic("Emissão Fiscal NFC-e")}</p>
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
                        <p className="text-[11px] text-gray-500 dark:text-slate-400">{tDynamic("Fichas técnicas, lotes e gráfico 3D")}</p>
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

          {/*
            "Entrar" fora do menu, abaixo de 1024px.

            O bloco da direita só aparece em `lg`, então em notebook de tela
            menor, tablet e celular o acesso ficava escondido atrás do
            hambúrguer. Quem já é assinante não vem para a landing ler a
            proposta: vem para entrar no sistema, e esconder essa porta em
            metade dos aparelhos é atrito no cliente que já pagou.

            O "Cadastrar minha loja" continua só em `lg` de propósito — é texto
            longo e brigaria com o hambúrguer nas telas estreitas.
          */}
          <Link
            to="/acesso"
            className="rounded-full border border-gray-300 px-3.5 py-1.5 text-sm font-bold text-gray-700 transition hover:bg-gray-100 lg:hidden dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10"
          >
            {t('nav.entrar')}
          </Link>

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
              <span>{tDynamic('API Cloud Oficial Meta Verified')}</span>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-blue-300 backdrop-blur-md">
              <Wallet size={16} className="text-blue-400" />
              <span>{tDynamic('Parceiro Homologado Efí Bank (Pix)')}</span>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-amber-300 backdrop-blur-md">
              <Boxes size={16} className="text-amber-400" />
              <span>{tDynamic('Emissão Fiscal FocusNFe Homologada')}</span>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-purple-300 backdrop-blur-md">
              <BadgeCheck size={16} className="text-purple-400" />
              <span>{tDynamic('Conexão SSL 256-bit Certificada')}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ══════════ 3. FAIXA DE CREDIBILIDADE ══════════ */}
      <section className="border-y border-white/10 bg-[#0B1120] py-8 relative overflow-hidden">
        <div className="pointer-events-none absolute left-1/2 top-0 h-full w-[800px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-[#0B1120]/0 to-transparent" />
        <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 sm:px-6">
          <p className="text-center font-['Sora'] text-xs font-bold uppercase tracking-widest text-slate-500">
            {tDynamic('Tudo o que a sua operação precisa, em um só painel')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm font-semibold text-slate-300">
            <span className="flex items-center gap-2 transition hover:text-white"><Check size={16} className="text-emerald-400" /> {tDynamic('Cardápio & QR Code')}</span>
            <span className="flex items-center gap-2 transition hover:text-white"><Check size={16} className="text-emerald-400" /> {tDynamic('WhatsApp com IA')}</span>
            <span className="flex items-center gap-2 transition hover:text-white"><Check size={16} className="text-emerald-400" /> {tDynamic('Integração iFood')}</span>
            <span className="flex items-center gap-2 transition hover:text-white"><Check size={16} className="text-emerald-400" /> {tDynamic('PDV & Comandas')}</span>
            <span className="flex items-center gap-2 transition hover:text-white"><Check size={16} className="text-emerald-400" /> {tDynamic('Cozinha KDS')}</span>
            <span className="flex items-center gap-2 transition hover:text-white"><Check size={16} className="text-emerald-400" /> {tDynamic('Rotas & Entregas')}</span>
            <span className="flex items-center gap-2 transition hover:text-white"><Check size={16} className="text-emerald-400" /> {tDynamic('Estoque & Ficha Técnica')}</span>
            <span className="flex items-center gap-2 transition hover:text-white"><Check size={16} className="text-emerald-400" /> {tDynamic('Pix Automático')}</span>
          </div>
        </div>
      </section>

      {/* ══════════ 3.5 SEÇÃO VISUAL DE NICHOS E FUNCIONALIDADES ══════════ */}
      <section id="nichos" className="scroll-mt-24 bg-slate-900/40 py-20 backdrop-blur-sm border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1 text-xs font-bold uppercase tracking-widest text-orange-400">
              <Sparkles size={13} /> {t('nicho.badge')}
            </span>
            <h2 className="mt-4 font-['Sora'] text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              {t('nicho.titulo')}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-300">
              {t('nicho.subtitulo')}
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
                  {t('nicho.hamburgueria')}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  {t('nicho.hamburgueriaDesc')}
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-orange-400 group-hover:translate-x-1 transition-transform">
                {t('nicho.verSolucao')} {t('nicho.hamburgueria')} <ArrowRight size={14} />
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
                  {t('nicho.lanchonete')}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  {t('nicho.lanchoneteDesc')}
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-blue-400 group-hover:translate-x-1 transition-transform">
                {t('nicho.verSolucao')} {t('nicho.lanchonete')} <ArrowRight size={14} />
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
                  {t('nicho.pizzaria')}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  {t('nicho.pizzariaDesc')}
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition-transform">
                {t('nicho.verSolucao')} {t('nicho.pizzaria')} <ArrowRight size={14} />
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
                  {t('nicho.restauranteBar')}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  {t('nicho.restauranteBarDesc')}
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-amber-400 group-hover:translate-x-1 transition-transform">
                {t('nicho.verSolucao')} {t('nicho.restauranteBar')} <ArrowRight size={14} />
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
                        {tDynamic('Restaurantes a Quilo & Buffet Self-Service')}
                      </h3>
                      <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-black uppercase text-slate-950">
                        {tDynamic('NOVO MÓDULO')}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-slate-300 max-w-3xl">
                      {tDynamic('Módulo de Peso Inteligente (R$/kg) + Integração Nativa com Balanças (Toledo/Filizola/Urano), Divisão Inteligente de Bebidas/Itens na Mesa (Garçom no Lançamento & Caixa por Produto) e PWA Garçom com Vibração Hálptica.')}
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
                {tDynamic('Principais Integrações:')}
              </span>
              <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
                <Link to="/integracao-ifood" className="rounded-xl border border-white/10 bg-white/10 px-3.5 py-2 text-slate-200 transition hover:border-rose-500 hover:text-rose-400">
                  🛵 {tDynamic('Integração iFood')}
                </Link>
                <Link to="/cardapio-qr-code" className="rounded-xl border border-white/10 bg-white/10 px-3.5 py-2 text-slate-200 transition hover:border-orange-500 hover:text-orange-400">
                  📱 {tDynamic('Cardápio QR Code')}
                </Link>
                <Link to="/api-whatsapp-restaurantes" className="rounded-xl border border-white/10 bg-white/10 px-3.5 py-2 text-slate-200 transition hover:border-emerald-500 hover:text-emerald-400">
                  🤖 {tDynamic('WhatsApp IA Oficial')}
                </Link>
                <Link to="/gestao-fiscal-nfe" className="rounded-xl border border-white/10 bg-white/10 px-3.5 py-2 text-slate-200 transition hover:border-blue-500 hover:text-blue-400">
                  🧾 {tDynamic('Emissão Fiscal NFC-e')}
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
            <span className="text-xs font-black uppercase tracking-widest text-[var(--cor-primaria)]">{tDynamic('Recursos')}</span>
            <h2 className="mt-3 font-['Sora'] text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
              {tDynamic('Um sistema inteiro, não um cardápio bonito')}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-gray-600 dark:text-slate-300">
              {tDynamic('O MiseOn nasceu para a rotina real do food service: cada módulo conversa com o outro, do pedido à baixa de estoque, sem retrabalho e sem planilha paralela.')}
            </p>
          </div>

          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {RECURSOS.map((r, i) => (
              <FlipCard
                key={i}
                icone={r.icone}
                titulo={tDynamic(r.titulo)}
                resumo={tDynamic(r.texto)}
                detalhes={r.detalhes}
                metrica={r.metrica}
                badge={r.badge}
                corTexto={r.cor}
                corFundo="bg-[#0B1120]/90"
                corBorda="border-white/10"
              />
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
              <BarChart3 size={13} className="text-orange-400" /> {tDynamic('Plataforma completa')}
            </span>
            <h2 className="mt-5 font-['Sora'] text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              {tDynamic('Tudo incluso. Sem módulo escondido, sem surpresa na fatura')}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-300">
              {tDynamic('Do primeiro clique do cliente ao relatório de fechamento do mês — é isto que entra na sua conta quando você assina o MiseOn.')}
            </p>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PLATAFORMA.map((g) => (
              <div
                key={g.grupo}
                className="rounded-3xl border border-white/10 bg-white/10 p-6 backdrop-blur-md transition-colors hover:bg-white/15"
              >
                <h3 className="font-['Sora'] text-base font-extrabold uppercase tracking-widest text-orange-300">
                  {tDynamic(g.grupo)}
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {g.itens.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm leading-snug text-slate-200">
                      <Check size={15} className="mt-0.5 shrink-0 text-emerald-400" />
                      {tDynamic(item)}
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
                {tDynamic('Seu WhatsApp atendendo sozinho — de verdade')}
              </h2>
              <p className="mt-5 text-base leading-relaxed text-emerald-100/85">
                {tDynamic('A IA do MiseOn responde seus clientes usando os dados reais da sua loja — cardápio, preços, estoque e horário. Quando o cliente quer pedir, ela envia o link do seu cardápio digital e o pedido cai direto no seu painel, com selo de origem.')}
              </p>
              <p className="mt-4 text-base leading-relaxed text-emerald-100/85">
                {tDynamic('A integração não tem mensalidade oculta. E o controle continua totalmente seu: assumiu a conversa, a IA silencia na hora.')}
              </p>

              <div className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-[#1877F2]/20 bg-[#1877F2]/10 px-3 py-1.5 shadow-[0_0_15px_rgba(24,119,242,0.15)] backdrop-blur-sm">
                <BadgeCheck size={18} fill="#1877F2" stroke="white" strokeWidth={1.5} />
                <span className="font-['Sora'] text-[13px] font-extrabold text-white">Meta Verified</span>
                <span className="text-[11px] font-medium text-emerald-100/60 ml-1">— {tDynamic('Parceiro Oficial')}</span>
              </div>
              <div className="mt-8">
                <Link
                  to="/cadastre-se"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 font-['Sora'] text-sm font-bold text-emerald-950 shadow-xl transition hover:scale-105 hover:bg-emerald-50"
                >
                  {tDynamic('Quero isso na minha loja')} <ArrowRight size={16} />
                </Link>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-md transition-colors hover:bg-white/15">
                <MessageCircle size={20} className="mt-0.5 shrink-0 text-emerald-300" />
                <div>
                  <p className="text-sm font-bold text-white">{tDynamic('Responde com dados reais')}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-emerald-100/70">
                    {tDynamic('Preço, ingredientes, taxa de entrega e horário vêm do seu cadastro. Nunca inventa valor nem desconto.')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-md transition-colors hover:bg-white/15">
                <QrCode size={20} className="mt-0.5 shrink-0 text-emerald-300" />
                <div>
                  <p className="text-sm font-bold text-white">{tDynamic('Manda o link do cardápio')}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-emerald-100/70">
                    {tDynamic('Na hora de pedir, o cliente monta o carrinho no seu site com preço real — a IA não fecha pedido sozinha.')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-md transition-colors hover:bg-white/15">
                <ClipboardList size={20} className="mt-0.5 shrink-0 text-emerald-300" />
                <div>
                  <p className="text-sm font-bold text-white">{tDynamic('Pedido cai no painel')}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-emerald-100/70">
                    {tDynamic('Chega como "Novo", com selo WhatsApp. Você aceita como qualquer pedido — decisão sempre sua.')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-md transition-colors hover:bg-white/15">
                <ShieldCheck size={20} className="mt-0.5 shrink-0 text-emerald-300" />
                <div>
                  <p className="text-sm font-bold text-white">{tDynamic('Seguro por desenho')}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-emerald-100/70">
                    {tDynamic('Assunto de saúde, como alergias, chama você na hora. E você pode desligar a IA quando quiser.')}
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
              {tDynamic('Por Que o MiseOn é Infinitamente Superior')}
            </span>
            <h2 className="mt-5 font-['Sora'] text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
              "{tDynamic('Todo sistema te diz quanto você vendeu.')}{' '}
              <span className="bg-gradient-to-r from-[#FF8A5C] via-[#FC5B24] to-[#6B9EFF] bg-clip-text text-transparent">
                {tDynamic('O MiseOn é o único que te mostra quanto sobrou no bolso')}
              </span>
              {' '}{tDynamic('— e por quê.')}"
            </h2>
            <p className="mt-5 text-base leading-relaxed text-slate-300 sm:text-lg">
              {tDynamic('Enquanto concorrentes te vendem robôs travados por botões que apenas disparam links secos e seguram o seu dinheiro por semanas, o MiseOn entrega um ecossistema completo de vendas, inteligência de IA e gestão financeira real.')}
            </p>
          </div>

          {/* Tabela Comparativa de Alta Conversão */}
          <div className="mt-14 overflow-hidden rounded-3xl border border-white/15 bg-white/5 shadow-2xl backdrop-blur-xl">
            <div className="grid grid-cols-12 bg-[#0F172A]/90 p-4 sm:p-6 text-xs font-black uppercase tracking-wider text-slate-400 border-b border-white/10">
              <div className="col-span-5 sm:col-span-4">{tDynamic('Recurso & Inteligência')}</div>
              <div className="col-span-3 sm:col-span-4 text-center text-rose-400">{tDynamic('Sistemas Tradicionais')}</div>
              <div className="col-span-4 text-center text-emerald-400 font-extrabold">{tDynamic('MiseOn (Onda 2026)')}</div>
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
                    {tDynamic(row.recurso)}
                  </div>
                  <div className="col-span-3 sm:col-span-4 text-center text-slate-400 text-xs sm:text-sm px-2">
                    {tDynamic(row.concorrente)}
                  </div>
                  <div className="col-span-4 text-center font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-2.5 sm:p-3 text-xs sm:text-sm shadow-inner">
                    ✨ {tDynamic(row.miseon)}
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
              {tDynamic('Quero o Sistema Mais Completo do Mercado')} <ArrowRight size={18} />
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
                  <Scale size={14} /> {tDynamic('Fim do Desperdício no Buffet')}
                </span>
                <h2 className="mt-4 font-['Sora'] text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                  {tDynamic('Seu restaurante a quilo vendendo com')}{' '}
                  <span className="bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
                    {tDynamic('Peso Inteligente')}
                  </span>
                </h2>
                <p className="mt-4 text-base leading-relaxed text-slate-300">
                  {tDynamic('Chega de perder dinheiro no buffet por falta de controle de estoque. Com a tecnologia de peso do MiseOn, cada grama servida no prato baixa exatamente a proporção de insumos cadastrada na Ficha Técnica.')}
                </p>
                <div className="mt-6 space-y-3">
                  <div className="flex items-start gap-3 text-sm text-slate-200">
                    <Check size={18} className="mt-0.5 shrink-0 text-emerald-400 font-bold" />
                    <span><b>{tDynamic('Baixa Exata de Estoque:')}</b> {tDynamic('0.350kg no prato = baixa proporcional exata no estoque de insumos.')}</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-slate-200">
                    <Check size={18} className="mt-0.5 shrink-0 text-emerald-400 font-bold" />
                    <span><b>{tDynamic('Preço R$/kg Flexível:')}</b> {tDynamic('Atualize o valor por quilo sempre que a carne ou insumos oscilarem.')}</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-slate-200">
                    <Check size={18} className="mt-0.5 shrink-0 text-emerald-400 font-bold" />
                    <span><b>{tDynamic('Operação Híbrida:')}</b> {tDynamic('Prato por quilo + marmitas a peso + bebidas unitárias no mesmo caixa.')}</span>
                  </div>
                </div>
                <div className="mt-8">
                  <Link
                    to="/sistema-para-restaurante-por-quilo"
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-8 py-4 font-['Sora'] text-sm font-extrabold text-slate-950 shadow-lg shadow-emerald-500/25 transition hover:scale-105 hover:bg-emerald-400"
                  >
                    {tDynamic('Conhecer Módulo por Quilo')} <ArrowRight size={18} />
                  </Link>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-md">
                <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-xs font-bold uppercase text-emerald-400">{tDynamic('Simulação de Venda por Peso')}</span>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">PDV Express</span>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between rounded-xl bg-white/5 p-3">
                    <span className="font-semibold text-slate-200">{tDynamic('Feijoada por Quilo (R$ 69,90/kg)')}</span>
                    <span className="font-mono font-bold text-emerald-400">0,420 kg</span>
                  </div>
                  <div className="flex justify-between rounded-xl bg-white/5 p-3">
                    <span className="font-semibold text-slate-200">{tDynamic('Baixa automática em estoque')}</span>
                    <span className="font-mono text-slate-300">-126g {tDynamic('Feijão')} / -84g {tDynamic('Carne')}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-3 text-sm font-bold text-white">
                    <span>{tDynamic('Subtotal Prato')}</span>
                    <span className="text-emerald-400">R$ 29,35</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ 6.55 SEÇÃO ENTRADA DE ESTOQUE PELO CUPOM FISCAL ══════════
           Vem ANTES do módulo de estoque 3D de propósito: primeiro o visitante
           entende como o estoque ENTRA (a objeção que faz gente desistir de
           sistema de gestão), depois vê o que o MiseOn faz com ele. */}
      <section id="estoque-nfce" className="relative scroll-mt-24 overflow-hidden bg-gradient-to-br from-[#1a0f02] via-[#2b1503] to-[#0B1120] py-20 sm:py-24 border-t border-white/10">
        <div className="pointer-events-none absolute -left-16 -top-16 h-72 w-72 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-orange-200 backdrop-blur-md">
                <ScanLine size={13} /> {tDynamic('Leitura de NFC-e direto na SEFAZ')}
              </span>
              <h2 className="mt-5 font-['Sora'] text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                {tDynamic('Você comprou.')}{' '}
                <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
                  {tDynamic('O estoque já sabe.')}
                </span>
              </h2>
              <p className="mt-5 text-base leading-relaxed text-orange-100/85">
                {tDynamic('Todo sistema de gestão morre no mesmo ponto: alguém precisa sentar e cadastrar item por item. É por isso que a maioria dos restaurantes desiste do controle de estoque na segunda semana.')}
              </p>
              <p className="mt-4 text-base leading-relaxed text-orange-100/85">
                {tDynamic('No MiseOn, você volta do mercado e')} <b className="text-white">{tDynamic('escaneia o QR Code do cupom fiscal')}</b>.
                {tDynamic('O sistema busca a nota na SEFAZ e traz a compra inteira — produto, quantidade, unidade e o custo real de cada item. Você confere, ajusta o que quiser e dá entrada de tudo de uma vez.')}
              </p>

              <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
                {[
                  { n: '1', t: tDynamic('Escaneie'), d: tDynamic('QR Code do cupom, pela câmera ou por foto') },
                  { n: '2', t: tDynamic('Confira'), d: tDynamic('Desmarque o que não é da cozinha') },
                  { n: '3', t: tDynamic('Pronto'), d: tDynamic('Estoque, custo e lote atualizados') },
                ].map((p) => (
                  <div key={p.n} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                    <div className="font-['Sora'] text-2xl font-black text-orange-400">{p.n}</div>
                    <div className="mt-1 text-sm font-bold text-white">{p.t}</div>
                    <div className="mt-0.5 text-[11px] leading-snug text-orange-100/60">{p.d}</div>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <Link
                  to="/cadastre-se"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 font-['Sora'] text-sm font-bold text-orange-950 shadow-xl transition hover:scale-105 hover:bg-orange-50"
                >
                  {tDynamic('Quero parar de digitar estoque')} <ArrowRight size={16} />
                </Link>
              </div>
            </div>

            <div className="grid gap-3">
              {[
                {
                  t: tDynamic('A compra inteira, de uma vez'),
                  d: tDynamic('Cupom de mercado com dezenas de itens entra em um scan. Cada linha vem com descrição, quantidade, unidade e o valor que você realmente pagou — lido da nota oficial, não digitado.'),
                },
                {
                  t: tDynamic('Você manda no que entra'),
                  d: tDynamic('Comprou algo pessoal junto? Desmarque. Comprou ovo em bandeja e usa em unidade? Diga que 1 bandeja rende 20 — e o estoque entra em unidade, do jeito que a sua cozinha trabalha.'),
                },
                {
                  t: tDynamic('Na segunda compra, ele já sabe'),
                  d: tDynamic('O MiseOn guarda o vínculo entre o código daquele mercado e o seu insumo. A próxima nota do mesmo fornecedor cai reconhecida — o trabalho de conferência só diminui.'),
                },
                {
                  t: tDynamic('A mesma nota nunca entra duas vezes'),
                  d: tDynamic('Escaneou de novo sem lembrar? Ele avisa a data em que aquela nota já foi lançada, em vez de dobrar seu estoque em silêncio e estragar o seu CMV.'),
                },
                {
                  t: tDynamic('Custo real, CMV honesto'),
                  d: tDynamic('Cada entrada abre um lote PEPS com o preço daquela compra. Quando o preço da carne sobe, o custo do seu prato sobe junto — sem você refazer conta nenhuma.'),
                },
              ].map((c) => (
                <div key={c.t} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-md transition-colors hover:bg-white/15">
                  <ScanLine size={20} className="mt-0.5 shrink-0 text-orange-300" />
                  <div>
                    <h3 className="font-['Sora'] text-sm font-bold text-white">{c.t}</h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-orange-100/70">{c.d}</p>
                  </div>
                </div>
              ))}
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
              <Boxes size={14} /> {tDynamic('Módulo de Engenharia de Estoque & Preparos')}
            </span>
            <h2 className="mt-5 font-['Sora'] text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Controle de Insumos, Fichas Técnicas e{' '}
              <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                {tDynamic('Observabilidade 3D em Tempo Real')}
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
                  {tDynamic('Cadastre insumos por categoria (')}<i>Ingrediente, Revenda Direta, Embalagem, Limpeza</i>{tDynamic(") e atribua o setor físico (")}<i>{tDynamic("Geladeira, Freezer, Dispensa, Armário")}</i>).
                </p>
                <div className="mt-4 space-y-2 rounded-2xl bg-black/40 p-4 text-xs">
                  <div className="flex items-center justify-between text-slate-200">
                    <span>{tDynamic("Unidade de Compra:")}</span>
                    <span className="font-bold text-blue-300">Pacote / Fardo / Caixa</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-200 border-t border-white/10 pt-2">
                    <span>{tDynamic("Conversão de Uso:")}</span>
                    <span className="font-bold text-emerald-400">Gramas (g) / ML / Fatias</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-300 border-t border-white/10 pt-2">
                    <AlertTriangle size={13} className="shrink-0" />
                    <span>{tDynamic("Alerta automático de estoque crítico/risco.")}</span>
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
                    {tDynamic('Receitas Base & Validade de Lotes')}
                  </h3>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-300">
                  {tDynamic('Crie preparos intermediários (ex:')} <i>Blend Moldado 180g, Cebola Caramelizada, Molhos</i>) especificando rendimento por lote e ficha técnica dos insumos brutos.
                </p>
                <div className="mt-4 space-y-2 rounded-2xl bg-black/40 p-4 text-xs">
                  <div className="flex items-center justify-between text-slate-200">
                    <span>{tDynamic("Produção por Lote:")}</span>
                    <span className="font-bold text-orange-300">{tDynamic("Ordens de Serviço (OS)")}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-200 border-t border-white/10 pt-2">
                    <span>{tDynamic("Controle de Validade:")}</span>
                    <span className="font-bold text-white">{tDynamic("Horas / Dias com Timer")}</span>
                  </div>
                  <div className="flex items-center justify-between text-[#FF4D4D] border-t border-white/10 pt-2 font-bold">
                    <span>{tDynamic("Sinalização de Risco:")}</span>
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
                    {tDynamic('Observabilidade 3D de Estoque Físico')}
                  </h3>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-300">
                  {tDynamic('Visualização tridimensional interativa que mapeia lotes físicos no espaço da cozinha e aplica o método PEPS (Primeiro que entra, Primeiro que sai).')}
                </p>
                <div className="mt-4 space-y-2 rounded-2xl bg-black/40 p-4 text-xs">
                  <div className="flex items-center justify-between text-slate-200">
                    <span>Capital Investido:</span>
                    <span className="font-mono font-bold text-emerald-400">R$ Total Mapeado</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-200 border-t border-white/10 pt-2">
                    <span>{tDynamic("Maior Alocação:")}</span>
                    <span className="font-bold text-purple-300">{tDynamic("Custo unitário por Lote")}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-200 border-t border-white/10 pt-2">
                    <span>Rastreabilidade:</span>
                    <span className="font-bold text-blue-300">{tDynamic("Esteiras 3D por Setor")}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <div className="mt-12 rounded-3xl border border-white/10 bg-gradient-to-r from-blue-950/40 via-purple-950/40 to-slate-900 p-8 text-center backdrop-blur-xl">
            <h3 className="font-['Sora'] text-2xl font-bold text-white">
              {tDynamic('Quer ver o controle de estoque 3D da sua cozinha em ação?')}
            </h3>
            <p className="mt-2 text-sm text-slate-300 max-w-2xl mx-auto">
              {tDynamic('Elimine perdas por insumos vencidos e saiba exatamente quanto dinheiro está parado nas suas prateleiras e geladeiras.')}
            </p>
            <div className="mt-6 flex justify-center">
              <Link
                to="/cadastre-se"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] px-8 py-4 font-['Sora'] text-sm font-extrabold text-white shadow-xl shadow-[#FC5B24]/30 transition hover:scale-105"
              >
                {tDynamic('Testar Estoque 3D Grátis')} <ArrowRight size={18} />
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
              {tDynamic('Do cadastro ao primeiro pedido em 3 passos')}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-gray-600 dark:text-slate-300">
              {tDynamic('Sem instalação, sem equipamento especial. Funciona no navegador, no computador e no celular.')}
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
                <h3 className="font-['Sora'] text-lg font-bold text-gray-900 dark:text-white">{tDynamic(p.titulo)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-slate-300">{tDynamic(p.texto)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ 8. DEPOIMENTOS ══════════ */}
      <section className="bg-white py-20 sm:py-24 dark:bg-transparent">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-black uppercase tracking-widest text-[var(--cor-primaria)]">{tDynamic("Histórias reais")}</span>
            <h2 className="mt-3 font-['Sora'] text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
              {tDynamic('De quem já tentou de tudo, ou estava apenas começando')}
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
                    "{tDynamic(d.texto)}"
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
              {tDynamic('Sua loja no ar com 30 dias grátis — Sem pegadinha de cartão')}
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
                        {tDynamic('Mais Recomendado')}
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
                      <span className="text-sm font-medium text-slate-500 line-through">{tDynamic("R$ 169,90/mês")}</span>
                      <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-400 uppercase">Economize R$ 240,00/ano</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-emerald-400">{tDynamic("Pix com 5% OFF: R$ 161,40/mês")}</span>
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
                    {tDynamic('Testar 30 Dias Grátis')} <ArrowRight size={18} />
                  </Link>
                  <p className="mt-4 text-center text-[11px] font-medium text-slate-400">
                    <strong className="text-slate-200">{tDynamic("Sem cartão no cadastro.")}</strong> {tDynamic('Tolerância de 7 dias pós-vencimento.')}
                  </p>
                </div>
              </div>

              {/* Direita: Features Detalhadas */}
              <div className="p-8 lg:w-[58%] lg:p-10 bg-[#060a14]">
                <h4 className="font-['Sora'] text-base font-bold text-white mb-8 flex items-center gap-2">
                  <Sparkles size={18} className="text-orange-400" />
                  {tDynamic('O sistema completo, sem surpresas:')}
                </h4>
                
                <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
                  {/* Categoria 1 */}
                  <div>
                    <h5 className="flex items-center gap-2 text-sm font-bold text-slate-200 mb-3 border-b border-white/5 pb-2">
                      <ChefHat size={16} className="text-emerald-400" /> {tDynamic('Operação e Vendas')}
                    </h5>
                    <ul className="space-y-2.5 text-xs text-slate-400">
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-emerald-500/70 mt-0.5" /> <span><strong className="text-slate-300">{tDynamic("PDV Frente de Caixa")}</strong> inteligente</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-emerald-500/70 mt-0.5" /> <span><strong className="text-slate-300">{tDynamic("Cardápio QR Code")}</strong> p/ mesas</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-emerald-500/70 mt-0.5" /> <span><strong className="text-slate-300">{tDynamic("Integração iFood")}</strong> nativa</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-emerald-500/70 mt-0.5" /> <span><strong className="text-slate-300">{tDynamic("Gestão de Comandas")}</strong> na palma</span></li>
                    </ul>
                  </div>

                  {/* Categoria 2 */}
                  <div>
                    <h5 className="flex items-center gap-2 text-sm font-bold text-slate-200 mb-3 border-b border-white/5 pb-2">
                      <MessageCircle size={16} className="text-blue-400" /> IA e Delivery
                    </h5>
                    <ul className="space-y-2.5 text-xs text-slate-400">
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-blue-500/70 mt-0.5" /> <span><strong className="text-slate-300">{tDynamic("Robô WhatsApp")}</strong> (API Oficial Meta)</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-blue-500/70 mt-0.5" /> <span><strong className="text-slate-300">{tDynamic("Cardápio Online")}</strong> {tDynamic("livre de taxas")}</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-blue-500/70 mt-0.5" /> <span><strong className="text-slate-300">{tDynamic("Impressão Automática")}</strong> {tDynamic("de pedidos")}</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-blue-500/70 mt-0.5" /> <span><strong className="text-slate-300">Cozinha KDS</strong> {tDynamic("em telas")}</span></li>
                    </ul>
                  </div>

                  {/* Categoria 3 */}
                  <div>
                    <h5 className="flex items-center gap-2 text-sm font-bold text-slate-200 mb-3 border-b border-white/5 pb-2">
                      <Boxes size={16} className="text-orange-400" /> {tDynamic('Estoque e Precisão')}
                    </h5>
                    <ul className="space-y-2.5 text-xs text-slate-400">
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-orange-500/70 mt-0.5" /> <span><strong className="text-slate-300">{tDynamic("Ficha Técnica")}</strong> {tDynamic("avançada (CMV)")}</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-orange-500/70 mt-0.5" /> <span><strong className="text-slate-300">{tDynamic("Baixa automática")}</strong> {tDynamic("por venda")}</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-orange-500/70 mt-0.5" /> <span><strong className="text-slate-300">{tDynamic("Controle de Lotes")}</strong> e PEPs</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-orange-500/70 mt-0.5" /> <span><strong className="text-slate-300">{tDynamic("Visualização 3D")}</strong> {tDynamic("do espaço")}</span></li>
                    </ul>
                  </div>

                  {/* Categoria 4 */}
                  <div>
                    <h5 className="flex items-center gap-2 text-sm font-bold text-slate-200 mb-3 border-b border-white/5 pb-2">
                      <Wallet size={16} className="text-indigo-400" /> Controle e Equipe
                    </h5>
                    <ul className="space-y-2.5 text-xs text-slate-400">
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-indigo-500/70 mt-0.5" /> <span><strong className="text-slate-300">{tDynamic("Pix Automático (Efí)")}</strong> direto na conta</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-indigo-500/70 mt-0.5" /> <span><strong className="text-slate-300">{tDynamic("Caixa e Relatórios")}</strong> {tDynamic("analíticos")}</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-indigo-500/70 mt-0.5" /> <span><strong className="text-slate-300">{tDynamic("Usuários Ilimitados")}</strong> {tDynamic("com permissões")}</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="shrink-0 text-indigo-500/70 mt-0.5" /> <span><strong className="text-slate-300">Atendimento Humano</strong> {tDynamic("prioritário")}</span></li>
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
              <MessageCircle size={18} /> {tDynamic('Ainda com dúvidas? Fale com nosso time')}
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
              {tDynamic('Blog & Centro de Inteligência em Food Service')}
            </span>
            <h2 className="mt-4 font-['Sora'] text-3xl font-extrabold tracking-tight sm:text-4xl">
              {tDynamic('Conteúdo profundo sobre CMV, KDS, Engenharia de Cardápio e IA')}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-300">
              {tDynamic('Aprenda com estudos de caso reais, análises financeiras e regras de operação validadas na prática em cozinhas profissionais.')}
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
              <div>
                <span className="text-[10px] font-black uppercase text-[#FC5B24]">{tDynamic("Gestão Financeira")}</span>
                <h3 className="mt-2 font-['Sora'] text-base font-bold text-white leading-snug">
                  {tDynamic('A Evolução do CMV: Do Caderno ao Custeio PEPS 3D')}
                </h3>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  {tDynamic('Como calcular a perda de cocção e valorizar preparos em lote sem margens maquiadas.')}
                </p>
              </div>
              <Link to="/blog/evolucao-do-cmv-do-caderno-ao-custeio-peps-3d" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#FC5B24] hover:underline">
                Ler estudo <ArrowRight size={13} />
              </Link>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
              <div>
                <span className="text-[10px] font-black uppercase text-blue-400">{tDynamic("Operação & KDS")}</span>
                <h3 className="mt-2 font-['Sora'] text-base font-bold text-white leading-snug">
                  {tDynamic('O Fim do Papel na Cozinha com KDS Kanban')}
                </h3>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  {tDynamic('Reduza até 35% do tempo de preparo eliminando rasuras e papel engordurado.')}
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
                  {tDynamic('IA no WhatsApp: Conexão Oficial Meta vs Bots Amadores')}
                </h3>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  {tDynamic('Evite banimento do seu número de delivery e atenda clientes com precisão.')}
                </p>
              </div>
              <Link to="/blog/ia-no-whatsapp-do-restaurante-atendimento-oficial-meta-vs-bots-amadores" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#FC5B24] hover:underline">
                Ler estudo <ArrowRight size={13} />
              </Link>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
              <div>
                <span className="text-[10px] font-black uppercase text-amber-400">{tDynamic("Restaurante por Quilo")}</span>
                <h3 className="mt-2 font-['Sora'] text-base font-bold text-white leading-snug">
                  {tDynamic('Perda de Cocção & Peso Inteligente no Buffet')}
                </h3>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  {tDynamic('Entenda o encolhimento de carnes e a baixa de estoque por grama servida.')}
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
                  {tDynamic('É Consultor de CMV, Chef, Nutricionista ou Especialista em Gastronomia?')}
                </h3>
                <p className="mt-2 text-xs text-slate-300 max-w-2xl leading-relaxed">
                  {tDynamic('Publique seus artigos técnicos em nosso Blog e seja lido por milhares de donos de restaurantes e gestores de food service de todo o Brasil.')}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <Link
                  to="/blog"
                  className="rounded-full bg-white px-5 py-3 font-['Sora'] text-xs font-bold text-gray-900 shadow-md transition hover:bg-gray-100"
                >
                  {tDynamic('Acessar Hub do Blog')}
                </Link>
                <a
                  href="mailto:contato@miseon.app.br?subject=Proposta%20de%20Artigo%20para%20o%20Blog%20MiseOn"
                  className="rounded-full bg-[#FC5B24] px-5 py-3 font-['Sora'] text-xs font-bold text-white shadow-lg shadow-[#FC5B24]/30 transition hover:scale-105"
                >
                  {tDynamic('Enviar Proposta de Artigo')}
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
              {tDynamic('Gente de verdade do outro lado')}
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
                key={tDynamic(c.titulo)}
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
                  {tDynamic(c.titulo)}
                </h3>
                <p className={`mt-2 flex-1 text-sm leading-relaxed ${c.destaque ? 'text-emerald-100/90' : 'text-gray-600 dark:text-slate-300'}`}>
                  {tDynamic(c.descricao)}
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
                <FaqItem key={tDynamic(f.pergunta)} pergunta={tDynamic(f.pergunta)} resposta={tDynamic(f.resposta)} />
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
                {tDynamic('Chama no WhatsApp')}
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
              {tDynamic('Sobre o Sistema MiseOn | Sistema de Gestão para Food Service e Restaurantes')}
            </h2>
            <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-300">
              <p>
                O sistema <strong>MiseOn</strong> é uma plataforma de gestão corporativa e automação inteligente desenvolvida exclusivamente para atender a rotina de restaurantes, hamburguerias, pizzarias, lanchonetes e bares em todo o Brasil.
              </p>
              <p>
                {tDynamic('Com arquitetura em nuvem de alta performance, o')} <strong>MiseOn</strong> integra em um único painel o cardápio digital QR Code para mesas e balcão, comandas eletrônicas via celular para garçons, telas de produção de cozinha (KDS sem papel), gerenciador de delivery integrado ao iFood, controle de caixa PDV, ficha técnica com baixa automática de estoque e atendimento via IA no WhatsApp oficial da Meta.
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
