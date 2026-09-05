import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Touchpad,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  Cpu,
  MessageCircle,
  ChevronDown,
  MapPin,
  Zap,
  ShieldCheck,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import MiseOnLogo from '../../components/MiseOnLogo';
import SEO from '../../components/SEO';
import FooterSEO from '../../components/FooterSEO';
import { KioskLeadModal } from '../../components/landing/KioskLeadModal';
import { RoiCalculator } from '../../components/kiosk/RoiCalculator';
import { KioskSimulator } from '../../components/kiosk/KioskSimulator';

export default function AutoatendimentoPage() {
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [faqAberto, setFaqAberto] = useState<number | null>(null);

  const toggleFaq = (idx: number) => {
    setFaqAberto(faqAberto === idx ? null : idx);
  };

  const FAQS = [
    {
      pergunta: 'O MiseOn Kiosk faz parte do plano padrão de R$ 149,90 ou R$ 169,90?',
      resposta:
        'Não. O MiseOn Kiosk é uma nova vertical comercial e produto independente (Hardware Bravus Core + Licença Operacional Kiosk). Ele exige configuração física, homologação de periféricos e projeto comercial sob medida para sua loja.',
    },
    {
      pergunta: 'É verdade que ter um totem no restaurante é mais acessível do que parece?',
      resposta:
        'Sim! Muitos restaurantes acreditam que totens são exclusivos para multinacionais como o McDonald’s. Na parceria MiseOn + Bravus Core, oferecemos modelos comerciais flexíveis e com rápido retorno de investimento — onde o próprio aumento de ticket médio em adicionais paga o equipamento.',
    },
    {
      pergunta: 'Quem fabrica o totem de autoatendimento?',
      resposta:
        'O hardware é fabricado pela Bravus Core (bravuscore.com.br), empresa brasileira referência com o lema "Tecnologia é o nosso core". O modelo homologado é o Totem Bravus Core 21", sinônimo de robustez e alta performance industrial.',
    },
    {
      pergunta: 'Qual a diferença do MiseOn Kiosk para os totens tradicionais do mercado?',
      resposta:
        'A maioria dos totens do mercado são apenas "telas isoladas" que não conversam com sua cozinha ou cobram comissões abusivas por pedido. O MiseOn Kiosk conecta o totem direto ao seu KDS Kanban, baixa o estoque por lote PEPS, calcula o CMV e alimenta a DRE gerencial do restaurante.',
    },
    {
      pergunta: 'Como funcionam os pagamentos no totem?',
      resposta:
        'O cliente paga na hora através de QR Code Pix com baixa automática instantânea ou cartão de débito/crédito via leitor POS lateral homologado.',
    },
    {
      pergunta: 'Como os pedidos chegam para a equipe da cozinha?',
      resposta:
        'Assim que o cliente finaliza o pedido na tela, a comanda surge imediatamente no KDS Kanban da cozinha organizada por estação de preparo (Chapa, Bar, Fritura, Montagem) sem necessidade de papel ou digitação manual.',
    },
    {
      pergunta: 'Posso ter mais de um totem na minha loja ou franquia?',
      resposta:
        'Com certeza. A arquitetura do MiseOn OS suporta múltiplas estações de autoatendimento operando simultaneamente com sincronização em milissegundos.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#070C18] text-white selection:bg-[#FC5B24] selection:text-white font-sans">
      {/* ══════════ GEO-SEO COMPLETO NO DOCUMENT HEAD ══════════ */}
      <SEO
        title="Totem de Autoatendimento para Restaurantes | MiseOn Kiosk (Hardware Bravus Core 21')"
        description="Autoatendimento profissional para restaurantes, hamburguerias e lanchonetes. Hardware Bravus Core 21' + Software MiseOn OS integrado ao KDS, estoque e DRE. É mais acessível do que parece — fale com a MiseOn!"
        keywords="totem de autoatendimento, totem para restaurante, totem bravus core 21, totem hamburgueria, totem lanchonete, autoatendimento food service, totem bravus miseon, totem sp, totem rj, totem bh, totem curitiba, totem poa, totem brasilia"
        canonicalUrl="https://miseon.app.br/autoatendimento"
        geoRegion="BR-SP"
        geoPlacename="São Paulo, Rio de Janeiro, Belo Horizonte, Curitiba, Porto Alegre, Brasília, Campinas, Salvador, Brasil"
        geoPosition="-23.55052;-46.633308"
        schemaJson={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          'name': 'MiseOn Kiosk - Autoatendimento Enterprise (Bravus Core 21")',
          'image': 'https://miseon.app.br/images/kiosk/hero_bravus_totem.png',
          'description':
            'Vertical comercial independente de autoatendimento para restaurantes, lanchonetes e hamburguerias. Hardware Bravus Core 21" + plataforma operacional MiseOn.',
          'brand': {
            '@type': 'Brand',
            'name': 'MiseOn Kiosk',
          },
          'offers': {
            '@type': 'AggregateOffer',
            'priceCurrency': 'BRL',
            'availability': 'https://schema.org/InStock',
            'url': 'https://miseon.app.br/autoatendimento',
          },
        }}
      />

      {/* Header / Navbar Compacta */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-gray-800 bg-[#070C18]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" aria-label="MiseOn — início">
            <MiseOnLogo size={128} />
          </Link>
          <div className="hidden md:flex items-center gap-6 text-xs font-semibold text-gray-300">
            <a href="#solucao" className="hover:text-white transition">Solução</a>
            <a href="#acessivel" className="hover:text-[#FC5B24] transition font-bold text-amber-400">É Acessível?</a>
            <a href="#bravus" className="hover:text-white transition">Hardware Bravus Core</a>
            <a href="#demo" className="hover:text-white transition">Demonstração</a>
            <a href="#roi" className="hover:text-white transition">Calculadora ROI</a>
            <a href="#faq" className="hover:text-white transition">FAQ</a>
          </div>
          <button
            onClick={() => setLeadModalOpen(true)}
            className="rounded-full bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] px-5 py-2 text-xs font-bold text-white shadow-lg shadow-[#FC5B24]/20 hover:brightness-110 transition flex items-center gap-1.5"
          >
            <span>Fale com a MiseOn</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </nav>

      {/* ══════════ 1. HERO SECTION ENTERPRISE ══════════ */}
      <header className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28 border-b border-gray-800">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-[#FC5B24]/15 blur-[140px] pointer-events-none" />

        <div className="mx-auto max-w-6xl px-4 sm:px-6 relative z-10 text-center">
          
          {/* Badge Oficial */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#FC5B24]/40 bg-[#FC5B24]/10 px-4 py-1.5 text-xs font-bold text-[#FC5B24] mb-4">
            <Sparkles size={14} /> MISEON KIOSK • HARDWARE BRAVUS CORE
          </div>

          <h1 className="font-['Sora'] text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.1] max-w-4xl mx-auto text-white">
            Seu cliente pede sozinho. <br />
            <span className="bg-gradient-to-r from-[#FF8A5C] via-[#FC5B24] to-[#3B82F6] bg-clip-text text-transparent">
              Sua cozinha recebe.
            </span>{' '}
            Sua operação controla tudo.
          </h1>

          <p className="mt-5 text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Autoatendimento profissional para restaurantes, hamburguerias e lanchonetes.{' '}
            <strong className="text-amber-300 font-bold block sm:inline mt-1 sm:mt-0">É mais acessível do que parece!</strong>
          </p>

          {/* Botões de Ação Hero */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => setLeadModalOpen(true)}
              className="w-full sm:w-auto rounded-full bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] px-8 py-4 font-['Sora'] text-base font-bold text-white shadow-xl shadow-[#FC5B24]/30 hover:scale-105 transition flex items-center justify-center gap-2"
            >
              <span>Não perca tempo — Fale com a MiseOn</span>
              <ArrowRight size={18} />
            </button>

            <a
              href="#demo"
              className="w-full sm:w-auto rounded-full border border-gray-700 bg-white/5 px-7 py-4 font-['Sora'] text-base font-bold text-white hover:bg-white/10 transition flex items-center justify-center gap-2"
            >
              <span>Testar demonstração ao vivo</span>
              <Touchpad size={18} className="text-[#FC5B24]" />
            </a>
          </div>

          <p className="mt-4 text-xs font-semibold text-slate-400">
            Hardware Bravus Core 21" ("Tecnologia é o nosso core") • Operação MiseOn OS
          </p>

          {/* Hero Visual Mockup */}
          <div className="mt-12 max-w-4xl mx-auto rounded-3xl border border-gray-800 bg-[#0B1120] p-4 shadow-2xl relative">
            <img
              src="/images/kiosk/hero_bravus_totem.png"
              alt="MiseOn Kiosk Totem Bravus Core 21 em Restaurante"
              className="w-full h-auto rounded-2xl object-cover"
            />
            
            {/* Benefícios Rápidos em Chips */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-left">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs">
                <span className="text-[#FC5B24] font-bold block mb-0.5">Pedidos & Pagamentos</span>
                <span className="text-gray-400 text-[11px]">Pix e Cartão na tela</span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs">
                <span className="text-emerald-400 font-bold block mb-0.5">Conectado ao KDS</span>
                <span className="text-gray-400 text-[11px]">Cozinha sem papel</span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs">
                <span className="text-blue-400 font-bold block mb-0.5">Estoque & Ficha Técnica</span>
                <span className="text-gray-400 text-[11px]">Baixa por lote PEPS</span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs">
                <span className="text-purple-400 font-bold block mb-0.5">DRE & Relatórios</span>
                <span className="text-gray-400 text-[11px]">Gestão em tempo real</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ══════════ 2. POR QUE É MAIS ACESSÍVEL DO QUE PARECE? ══════════ */}
      <section id="acessivel" className="py-20 border-b border-gray-800 bg-gradient-to-b from-[#090E1A] to-[#070C18]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Quebrando Mitos do Mercado</span>
            <h2 className="font-['Sora'] text-3xl sm:text-4xl font-bold text-white mt-2">
              "Achei que totem de autoatendimento custasse R$ 50 mil..."
            </h2>
            <p className="mt-3 text-sm sm:text-base text-gray-300">
              Esqueça os orçamentos abusivos e as burocracias de empresas tradicionais de hardware. O MiseOn Kiosk foi desenhado para o restaurante real.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl border border-gray-800 bg-[#0B1120] space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                <DollarSign size={22} />
              </div>
              <h3 className="font-['Sora'] text-lg font-bold text-white">Investimento Inteligente</h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                Na parceria com a Bravus Core, formatamos propostas comerciais com viabilidade real para hamburguerias, lanchonetes e restaurantes de médio e grande porte.
              </p>
            </div>

            <div className="p-6 rounded-3xl border border-gray-800 bg-[#0B1120] space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <TrendingUp size={22} />
              </div>
              <h3 className="font-['Sora'] text-lg font-bold text-white">O próprio Kiosk se paga</h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                O totem não esquece de oferecer adicionais (bacon, queijo duplo, bebida grande). Com um aumento médio de 15% no ticket por pedido, o faturamento extra cobre a operação.
              </p>
            </div>

            <div className="p-6 rounded-3xl border border-gray-800 bg-[#0B1120] space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                <Zap size={22} />
              </div>
              <h3 className="font-['Sora'] text-lg font-bold text-white">Sem taxas por pedido</h3>
              <p className="text-xs text-gray-300 leading-relaxed">
                Ao contrário de agregadores e intermediários que cobram porcentagens sobre cada venda, o MiseOn Kiosk é seu canal direto de atendimento sem comissões por pedido.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ 3. COMPARATIVO COM TOTENS TRADICIONAIS ══════════ */}
      <section className="py-20 border-b border-gray-800 bg-[#070C18]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-[#FC5B24]">Comparativo de Mercado</span>
            <h2 className="font-['Sora'] text-3xl sm:text-4xl font-bold text-white mt-2">
              Por que os totens tradicionais falham no restaurante?
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Outros Totens */}
            <div className="p-7 rounded-3xl border border-red-500/20 bg-red-500/5">
              <div className="flex items-center gap-2 text-red-400 font-bold text-sm uppercase mb-4">
                <AlertTriangle size={18} /> Totens Tradicionais do Mercado
              </div>

              <ul className="space-y-3 text-xs text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-red-400 font-bold">✕</span>
                  <span>São apenas "telas isoladas" que não conversam com a cozinha.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 font-bold">✕</span>
                  <span>Exigem redigitação manual do pedido no sistema do caixa.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 font-bold">✕</span>
                  <span>Não baixam o estoque por lote PEPS nem calculam o CMV.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 font-bold">✕</span>
                  <span>Contratos pesados e burocráticos direcionados só para grandes redes.</span>
                </li>
              </ul>
            </div>

            {/* MiseOn Kiosk */}
            <div className="p-7 rounded-3xl border border-emerald-500/30 bg-emerald-500/5 shadow-xl relative">
              <span className="absolute -top-3 right-6 rounded-full bg-emerald-500 px-3 py-0.5 text-[10px] font-black text-slate-950 uppercase">
                DIFERENCIAL MISEON
              </span>

              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm uppercase mb-4">
                <ShieldCheck size={18} /> MiseOn Kiosk (Hardware Bravus Core + Software OS)
              </div>

              <ul className="space-y-3 text-xs text-gray-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span><strong>Conectado ao KDS Kanban:</strong> O pedido cai direto na tela da cozinha por estação.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span><strong>Baixa Automática de Estoque:</strong> Cada venda abate a ficha técnica exata.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span><strong>Integração com DRE & Financeiro:</strong> Conciliação instantânea de Pix e Cartão.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span><strong>Mais acessível do que parece:</strong> Estrutura comercial sob medida.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ 4. HARDWARE BRAVUS CORE ("Tecnologia é o nosso core") ══════════ */}
      <section id="bravus" className="py-20 border-b border-gray-800 bg-[#090E1A]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid lg:grid-cols-12 gap-10 items-center">
            
            {/* Lado Esquerdo: Mensagem Parceria */}
            <div className="lg:col-span-6 space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/40 bg-blue-500/10 px-3.5 py-1 text-xs font-bold text-blue-400">
                <Cpu size={14} /> PARCERIA DE HARDWARE • BRAVUS CORE
              </div>

              <h2 className="font-['Sora'] text-3xl sm:text-4xl font-bold text-white">
                Hardware Bravus Core. <br />
                <span className="text-[#FC5B24]">Software MiseOn OS.</span>
              </h2>

              <p className="text-xs font-bold text-blue-300 uppercase tracking-widest">
                "Tecnologia é o nosso core" — bravuscore.com.br
              </p>

              <p className="text-sm text-gray-300 leading-relaxed">
                Em parceria com a <strong>Bravus Core</strong>, referência em engenharia de hardware e totens de autoatendimento no Brasil, conectamos equipamentos de durabilidade industrial a uma plataforma completa de gestão de food service.
              </p>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 font-mono text-xs text-gray-300">
                <span className="text-blue-400 font-bold">[ HARDWARE BRAVUS CORE 21" ]</span> +{' '}
                <span className="text-[#FC5B24] font-bold">[ SOFTWARE MISEON ]</span> ={' '}
                <span className="text-emerald-400 font-bold">[ MISEON KIOSK ]</span>
              </div>
            </div>

            {/* Lado Direito: Especificações do Hardware Bravus Core 21 */}
            <div className="lg:col-span-6">
              <div className="rounded-3xl border border-gray-700 bg-[#0B1120] p-6 shadow-2xl">
                <img
                  src="/images/kiosk/hardware_specs.png"
                  alt="Totem Bravus Core 21 Especificações de Hardware"
                  className="w-full h-auto rounded-xl object-cover mb-5"
                />

                <h3 className="font-['Sora'] text-sm font-bold text-white uppercase mb-3">
                  Ficha Técnica do Totem Bravus Core 21":
                </h3>

                <ul className="space-y-2 text-xs text-gray-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    <span><strong>Display 21.5" Touchscreen Capacitivo</strong> Full HD de alta sensibilidade</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    <span><strong>Impressora Térmica 80mm</strong> com cortador/guilhotina automática</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    <span><strong>Scanner 1D/2D QR Code</strong> para vouchers, cupons e leitura rápida</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    <span><strong>Gabinete em Aço Carbono</strong> com pintura eletrostática ultra-resistente</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    <span><strong>Suporte a Pinpad / POS Lateral</strong> homologado para pagamentos</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ 5. DEMO INTERATIVA ══════════ */}
      <section id="demo" className="py-20 border-b border-gray-800 bg-[#070C18]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <KioskSimulator isEmbedded={false} />
        </div>
      </section>

      {/* ══════════ 6. CALCULADORA DE ROI ══════════ */}
      <section id="roi" className="py-20 border-b border-gray-800 bg-[#090E1A]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <RoiCalculator />
        </div>
      </section>

      {/* ══════════ 7. GEO-SEO REGIONAL TAGLINE ══════════ */}
      <section className="py-16 border-b border-gray-800 bg-[#070C18]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-400 block mb-2">
            PRESENÇA NACIONAL & HOMOLOGAÇÃO
          </span>
          <h3 className="font-['Sora'] text-xl font-bold text-white mb-6">
            Atendimento comercial e suporte técnico para todo o Brasil
          </h3>

          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-gray-300 max-w-4xl mx-auto">
            <span className="flex items-center gap-1 font-bold text-white"><MapPin size={14} className="text-[#FC5B24]" /> São Paulo (SP)</span>
            <span>•</span>
            <span className="font-bold text-white">Rio de Janeiro (RJ)</span>
            <span>•</span>
            <span className="font-bold text-white">Belo Horizonte (MG)</span>
            <span>•</span>
            <span className="font-bold text-white">Curitiba (PR)</span>
            <span>•</span>
            <span className="font-bold text-white">Porto Alegre (RS)</span>
            <span>•</span>
            <span className="font-bold text-white">Brasília (DF)</span>
            <span>•</span>
            <span className="font-bold text-white">Campinas (SP)</span>
            <span>•</span>
            <span className="font-bold text-white">Salvador (BA)</span>
            <span>•</span>
            <span className="font-bold text-white">Goiânia (GO)</span>
          </div>
        </div>
      </section>

      {/* ══════════ AVISO DE POLÍTICA COMERCIAL TRANSPARENTE ══════════ */}
      <section className="py-12 border-b border-gray-800 bg-[#0B1120]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="p-6 rounded-3xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-4">
            <ShieldCheck size={28} className="text-amber-400 shrink-0 mt-1" />
            <div>
              <h4 className="font-['Sora'] text-base font-bold text-amber-300">
                Política Comercial Transparente — MiseOn Kiosk
              </h4>
              <p className="mt-1 text-xs text-amber-200/90 leading-relaxed">
                O <strong>MiseOn Kiosk</strong> é uma vertical comercial e produto B2B independente (Hardware Bravus Core 21" + Licença Operacional Kiosk). Trata-se de um produto a parte contratado sob proposta comercial sob medida para a estrutura da sua loja, não fazendo parte dos planos de assinatura de software de balcão e delivery padrão (R$ 149,90 / R$ 169,90).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ 8. FAQ ESPECÍFICO ══════════ */}
      <section id="faq" className="py-20 border-b border-gray-800 bg-[#090E1A]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400">Esclarecimentos Rápidos</span>
            <h2 className="font-['Sora'] text-3xl font-bold text-white mt-2">
              Perguntas Frequentes sobre o MiseOn Kiosk
            </h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, idx) => (
              <div key={idx} className="rounded-2xl border border-gray-800 bg-[#0B1120] overflow-hidden">
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-5 text-left flex justify-between items-center text-sm font-bold text-white hover:bg-white/5 transition"
                >
                  <span>{faq.pergunta}</span>
                  <ChevronDown
                    size={18}
                    className={`text-[#FC5B24] transition-transform duration-300 ${
                      faqAberto === idx ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {faqAberto === idx && (
                  <div className="px-5 pb-5 pt-1 text-xs text-gray-300 leading-relaxed border-t border-gray-800/60">
                    {faq.resposta}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ 9. CTA FINAL URGENTE (NÃO PERCA TEMPO) ══════════ */}
      <section className="py-24 bg-gradient-to-b from-[#0B1120] to-[#070C18]">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#FC5B24]/40 bg-[#FC5B24]/10 px-4 py-1.5 text-xs font-bold text-[#FC5B24] mb-4">
            <Sparkles size={14} /> NÃO PERCA TEMPO COM FILAS NO BALCÃO
          </div>

          <h2 className="font-['Sora'] text-3xl sm:text-5xl font-extrabold text-white">
            Pronto para levar o autoatendimento profissional para a sua loja?
          </h2>

          <p className="mt-4 text-base text-gray-300 max-w-2xl mx-auto">
            É mais acessível do que parece. Fale com um de nossos especialistas e receba um projeto sob medida.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => setLeadModalOpen(true)}
              className="w-full sm:w-auto rounded-full bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] px-9 py-4 font-['Sora'] text-base font-bold text-white shadow-xl shadow-[#FC5B24]/30 hover:scale-105 transition flex items-center justify-center gap-2"
            >
              <span>Não perca tempo — Fale com a MiseOn</span>
              <ArrowRight size={18} />
            </button>

            <a
              href="https://wa.me/5511919889233?text=Ol%C3%A1!%20Não%20quero%20perder%20tempo,%20preciso%20de%20um%20projeto%20do%20MiseOn%20Kiosk."
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto rounded-full border border-emerald-500/40 bg-emerald-500/10 px-8 py-4 font-['Sora'] text-base font-bold text-emerald-400 hover:bg-emerald-500/20 transition flex items-center justify-center gap-2"
            >
              <MessageCircle size={18} /> Falar no WhatsApp Comercial
            </a>
          </div>

          <p className="mt-6 text-xs text-gray-400">
            Hardware Bravus Core ("Tecnologia é o nosso core") • Operação MiseOn OS
          </p>
        </div>
      </section>

      {/* Footer SEO */}
      <FooterSEO />

      {/* Modal de Lead */}
      <KioskLeadModal
        isOpen={leadModalOpen}
        onClose={() => setLeadModalOpen(false)}
        origem="kiosk_landing_page"
      />
    </div>
  );
}
