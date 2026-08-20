import { Link } from 'react-router-dom';
import {
  Target, MessageCircle, Wallet, Tv, Mic, Sparkles,
  ArrowRight, Users
} from 'lucide-react';
import SEO from '../../components/SEO';
import FooterSEO from '../../components/FooterSEO';
import MiseOnLogo from '../../components/MiseOnLogo';
import FlipCard from '../../components/ui/FlipCard';

import { useI18n } from '../../contexts/I18nContext';
const PILARES_MARKETING = [
  {
    icone: Target,
    titulo: 'Meta Pixel & GA4 Nativo',
    resumo: 'Dispare eventos automáticos AddToCart, InitiateCheckout e Purchase com Conversions API. Saiba exatamente qual anúncio no Instagram gerou vendas reais.',
    detalhes: [
      'Disparo direto via Conversions API no servidor',
      'Medição exata do ROAS sem perda por bloqueadores',
      'Otimização contínua de público no Meta Ads',
    ],
    metrica: 'ROAS +350%',
    badge: 'ROI MEDÍVEL',
    corTexto: 'text-purple-400',
    corFundo: 'bg-purple-500/10',
    corBorda: 'border-purple-500/20',
  },
  {
    icone: MessageCircle,
    titulo: 'Token de Atribuição WhatsApp (?wa=)',
    resumo: 'A IA do WhatsApp acolhe o cliente, responde a dúvidas sobre ingredientes e entrega um link rastreável exclusivo. Vendas sem comissão direta.',
    detalhes: [
      'Atribuição atômica por conversa do WhatsApp',
      '0% de taxa por pedido realizado',
      'Badge de origem 🟢 WhatsApp no KDS',
    ],
    metrica: '0% COMISSÃO',
    badge: 'CANAL DIRETO',
    corTexto: 'text-emerald-400',
    corFundo: 'bg-emerald-500/10',
    corBorda: 'border-emerald-500/20',
  },
  {
    icone: Wallet,
    titulo: 'Carteira Virtual de Cashback Recorrente',
    resumo: 'Defina a % de devolução (ex: 5% a 10%). O saldo acumulado fica salvo no CPF do cliente e é aplicado no próximo checkout com 1-clique.',
    detalhes: [
      'Resgate fácil no checkout com 1-clique',
      'Histórico completo de saldo e extrato',
      'Aumento da frequência de compra do cliente',
    ],
    metrica: 'LTV +42%',
    badge: 'FIDELIZAÇÃO',
    corTexto: 'text-amber-400',
    corFundo: 'bg-amber-500/10',
    corBorda: 'border-amber-500/20',
  },
  {
    icone: Tv,
    titulo: 'Smart TV 4K de Balcão & Chamada por Voz',
    resumo: 'Transforme qualquer Smart TV do salão em um Menu Board 4K e viva-voz que avisa o cliente no momento exato em que o prato sai da cozinha.',
    detalhes: [
      'Cardápio noturno 4K com fotos em alta definição',
      'Voz sintetizada nativa anuncia o pedido pronto',
      'QR Code de autoatendimento na própria TV',
    ],
    metrica: '4K NATIVO',
    badge: 'SALÃO & BALCÃO',
    corTexto: 'text-blue-400',
    corFundo: 'bg-blue-500/10',
    corBorda: 'border-blue-500/20',
  },
  {
    icone: Mic,
    titulo: 'Comanda por Voz com IA no Celular',
    resumo: 'Permite que o cliente no salão ou na mesa aperte o microfone no celular e peça falando naturally ("Dois burgers sem picles e 1 chopp").',
    detalhes: [
      'Web Speech API com interpretação de linguagem natural',
      'Localiza produtos e adicionais no catálogo',
      'Adiciona automaticamente itens ao carrinho',
    ],
    metrica: 'PEDIDO EM 2s',
    badge: 'AUTOATENDIMENTO',
    corTexto: 'text-rose-400',
    corFundo: 'bg-rose-500/10',
    corBorda: 'border-rose-500/20',
  },
  {
    icone: Users,
    titulo: 'Matriz RFM & Disparos para Clientes Sumidos',
    resumo: 'Classifique sua base entre VIPs, Frequentes e Sumidos (+30 dias). Envie ofertas direcionadas no WhatsApp para movimentar terças e quartas.',
    detalhes: [
      'Segmentação automática por histórico de compras',
      'Disparo de ofertas para movimentar dias fracos',
      'Conformidade LGPD com token de descadastro',
    ],
    metrica: 'REENG. +65%',
    badge: 'CRM GASTRONÔMICO',
    corTexto: 'text-pink-400',
    corFundo: 'bg-pink-500/10',
    corBorda: 'border-pink-500/20',
  },
];

export default function MarketingStrategyPage() {
  const { tDynamic } = useI18n();
  return (
    <div className="min-h-screen bg-[#070C18] text-white font-['Inter'] selection:bg-orange-500 selection:text-white">
      <SEO
        title="Estratégia de Marketing e Growth para Restaurantes — MiseOn"
        description="Aprenda como dobrar a margem de lucro do seu restaurante com Meta Pixel, WhatsApp Atribuição, Cashback Recorrente e Smart TV 4K."
        canonicalUrl="https://miseon.app.br/estrategia-de-marketing-para-restaurantes"
      />

      {/* Header / Navbar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070C18]/80 backdrop-blur-md px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <MiseOnLogo className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/blog" className="text-xs font-bold text-slate-300 hover:text-white transition-colors">
              Blog & Artigos
            </Link>
            <Link
              to="/cadastre-se"
              className="rounded-full bg-[#FC5B24] px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-[#FC5B24]/30 hover:brightness-110 transition-all"
            >
              Testar 30 Dias Grátis
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 sm:py-24 px-4 sm:px-8">
        <div className="mx-auto max-w-5xl text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 text-xs font-extrabold text-orange-400">
            <Sparkles size={14} /> {tDynamic('PLAYBOOK DE GROWTH E MARKETING PARA FOOD SERVICE')}
          </div>

          <h1 className="font-['Sora'] text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            {tDynamic('Como Criar uma Máquina de Vendas Sem Pagar')} <span className="text-[#FC5B24]">27% de Comissão</span> por Pedido
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-3xl mx-auto leading-relaxed">
            Esqueça panfletos e links secos no WhatsApp. O MiseOn combina **Meta Pixel**, **IA Consultiva LLaMA 3.3**, **Cashback Fidelidade**, **Smart TV 4K** e **Pedido por Voz** para transformar o seu restaurante em um canal direto altamente rentável.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link
              to="/cadastre-se"
              className="inline-flex items-center gap-2 rounded-full bg-[#FC5B24] px-8 py-4 text-base font-black text-white shadow-xl shadow-[#FC5B24]/30 hover:scale-105 transition-all"
            >
              {tDynamic('Começar Agora sem Cartão')} <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Grid de Pilares de Marketing com Cards 3D Flip */}
      <section className="py-16 px-4 sm:px-8 bg-white/5 border-y border-white/10">
        <div className="mx-auto max-w-7xl space-y-12">
          <div className="text-center space-y-3">
            <h2 className="font-['Sora'] text-2xl sm:text-4xl font-black text-white">
              Os 6 Pilares de Marketing Interativos do MiseOn
            </h2>
            <p className="text-sm text-slate-400 max-w-2xl mx-auto">
              {tDynamic('Passe o cursor ou toque nos cards para girá-los em 3D e visualizar as regras de negócio e métricas operacionais.')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {PILARES_MARKETING.map((pilar, idx) => (
              <FlipCard
                key={idx}
                icone={pilar.icone}
                titulo={pilar.titulo}
                resumo={pilar.resumo}
                detalhes={pilar.detalhes}
                metrica={pilar.metrica}
                badge={pilar.badge}
                corTexto={pilar.corTexto}
                corFundo={pilar.corFundo}
                corBorda={pilar.corBorda}
              />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 px-4 sm:px-8 text-center space-y-6">
        <div className="mx-auto max-w-3xl rounded-3xl border border-orange-500/30 bg-gradient-to-r from-orange-500/20 via-orange-500/10 to-transparent p-8 sm:p-12 space-y-6 shadow-2xl">
          <h2 className="font-['Sora'] text-2xl sm:text-4xl font-black text-white">
            {tDynamic('Pronto para Dobrar o Lucro do Seu Restaurante?')}
          </h2>
          <p className="text-sm text-slate-300">
            {tDynamic('Teste gratuitamente por 30 dias com todos os módulos de Marketing, Smart TV 4K, Pedido por Voz e Estoque Preditivo ativados.')}
          </p>
          <Link
            to="/cadastre-se"
            className="inline-flex items-center gap-2 rounded-full bg-[#FC5B24] px-8 py-4 text-sm font-black text-white shadow-xl shadow-[#FC5B24]/40 hover:scale-105 transition-all"
          >
            Criar Minha Loja em 2 Minutos <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <FooterSEO />
    </div>
  );
}
