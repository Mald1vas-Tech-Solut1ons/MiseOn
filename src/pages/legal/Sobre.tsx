import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Building2, Code2, Cpu, MapPin, ShieldCheck, Sparkles, Trophy, Zap } from 'lucide-react';
import { SEO } from '../../components/SEO';
import FooterSEO from '../../components/FooterSEO';
import MiseOnLogo from '../../components/MiseOnLogo';
import LanguageToggle from '../../components/LanguageToggle';
import { useI18n } from '../../contexts/I18nContext';

export default function Sobre() {
  const { tDynamic } = useI18n();

  return (
    <div className="min-h-screen bg-[#070C18] font-sans text-slate-200 selection:bg-orange-500 selection:text-white">
      <SEO
        title="Sobre o MiseOn | Engenharia de Software por Maldivas Tech Solutions"
        description="Conheça a história e o propósito do MiseOn. Plataforma SaaS de gestão de restaurantes criada pela Maldivas Tech Solutions (Rafael Maldivas) com tecnologia de ponta."
        keywords="sobre miseon, maldivas tech solutions, rafael maldivas, sistema para restaurantes, empresa miseon cnpj"
        canonicalUrl="https://miseon.app.br/sobre"
        schemaJson={{
          '@context': 'https://schema.org',
          '@type': 'AboutPage',
          'name': 'Sobre o MiseOn',
          'description': 'Informações institucionais da plataforma MiseOn e engenharia Maldivas Tech Solutions.',
          'url': 'https://miseon.app.br/sobre',
          'mainEntity': {
            '@type': 'Organization',
            'name': 'MiseOn — Maldivas Tech Solutions',
            'taxID': '63.310.253/0001-81',
            'url': 'https://miseon.app.br',
            'sameAs': [
              'https://rafael-maldivas.vercel.app/',
              'https://github.com/MaldivaSky'
            ],
            'address': {
              '@type': 'PostalAddress',
              'addressLocality': 'Manaus',
              'addressRegion': 'AM',
              'addressCountry': 'BR'
            }
          }
        }}
      />

      {/* Header com Navegação */}
      <header className="border-b border-white/10 bg-[#0B1120]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" aria-label="Voltar para o início">
            <MiseOnLogo size={130} />
          </Link>

          <div className="flex items-center gap-4">
            <LanguageToggle variant="pill" />
            <Link
              to="/"
              className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={16} /> {tDynamic('Voltar ao Início')}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-500/10 via-transparent to-transparent pointer-events-none" />
        
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-orange-400">
            <Sparkles size={14} /> Institucional & Engenharia
          </span>

          <h1 className="mt-6 font-['Sora'] text-3xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
            {tDynamic('Engenharia de software criada para o ritmo real do')} <span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">Food Service</span>
          </h1>

          <p className="mt-6 text-base leading-relaxed text-slate-300 sm:text-lg">
            O MiseOn nasceu da visão prática da engenharia de software aliada ao conhecimento profundo da rotina operacional de hamburguerias, lanchonetes, pizzarias e restaurantes em todo o Brasil.
          </p>
        </div>
      </section>

      {/* Seção Maldivas Tech Solutions */}
      <section className="border-y border-white/10 bg-slate-900/40 py-16 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            
            <div className="space-y-6">
              <div className="inline-flex rounded-2xl bg-blue-500/10 p-3 text-blue-400 border border-blue-500/20">
                <Code2 size={28} />
              </div>
              <h2 className="font-['Sora'] text-2xl font-bold text-white sm:text-3xl">
                {tDynamic('Assinatura Técnica Maldivas Tech Solutions')}
              </h2>
              <p className="text-sm leading-relaxed text-slate-300">
                {tDynamic('A plataforma MiseOn é desenvolvida e mantida por')} <strong>Rafael Maldivas</strong> (fundador da <i>Maldivas Tech Solutions / MaldivaSky</i>), especialista em arquiteturas SaaS distribuídas, análise de dados e sistemas de alta disponibilidade.
              </p>
              <p className="text-sm leading-relaxed text-slate-300">
                Com base em uma sólida experiência em engenharia fullstack e inteligência de negócios B2B, a arquitetura do MiseOn foi desenhada para oferecer latência ultrabaixa no KDS de cozinha, sincronia em tempo real via WebSockets e máxima segurança em transações financeiras e fiscais.
              </p>
              <div className="pt-2">
                <a
                  href="https://rafael-maldivas.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600/20 border border-blue-500/40 px-4 py-2.5 text-xs font-bold text-blue-400 hover:bg-blue-600/30 transition-all"
                >
                  {tDynamic('Conheça o Portfólio de Engenharia (Maldivas Tech) →')}
                </a>
              </div>
            </div>

            {/* Grid de Pilares Tecnológicos */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <Zap size={22} className="text-orange-400" />
                <h3 className="mt-3 font-['Sora'] text-sm font-bold text-white">{tDynamic('Tempo Real Nativo')}</h3>
                <p className="mt-1 text-xs text-slate-400">{tDynamic('Atualização instantânea entre PDV, comanda de salão e tela da cozinha (KDS).')}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <Cpu size={22} className="text-emerald-400" />
                <h3 className="mt-3 font-['Sora'] text-sm font-bold text-white">{tDynamic('IA Oficial Meta')}</h3>
                <p className="mt-1 text-xs text-slate-400">{tDynamic('Conexão oficial via WhatsApp Cloud API com respostas em tempo real.')}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <ShieldCheck size={22} className="text-blue-400" />
                <h3 className="mt-3 font-['Sora'] text-sm font-bold text-white">{tDynamic('FocusNFe & Efí')}</h3>
                <p className="mt-1 text-xs text-slate-400">{tDynamic('Emissão fiscal NFC-e homologada e conciliação bancária via Pix direto.')}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <Trophy size={22} className="text-amber-400" />
                <h3 className="mt-3 font-['Sora'] text-sm font-bold text-white">{tDynamic('SLA Superior')}</h3>
                <p className="mt-1 text-xs text-slate-400">{tDynamic('Infraestrutura em nuvem escalável com taxa de disponibilidade de 99.9%.')}</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Seção Institucional & CNPJ */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="rounded-3xl border border-white/15 bg-gradient-to-b from-white/10 to-white/5 p-8 sm:p-12 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-3">
              <Building2 className="text-orange-400" size={32} />
              <div>
                <h2 className="font-['Sora'] text-xl font-extrabold text-white sm:text-2xl">
                  {tDynamic('Dados Institucionais da Empresa')}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">{tDynamic('Transparência jurídica e governança corporativa')}</p>
              </div>
            </div>

            <div className="mt-8 grid gap-6 sm:grid-cols-2 text-sm text-slate-300">
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{tDynamic('Razão Social & Nome Fantasia')}</span>
                <p className="font-bold text-white">{tDynamic('MiseOn Tecnologia e Soluções para Food Service')}</p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{tDynamic('Cadastro de Pessoa Jurídica (CNPJ)')}</span>
                <p className="font-mono font-bold text-emerald-400">63.310.253/0001-81</p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sede Operacional</span>
                <p className="flex items-center gap-1.5 font-medium text-white">
                  <MapPin size={16} className="text-orange-400 shrink-0" /> Manaus / Amazonas — Brasil
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Contato & Suporte</span>
                <p className="font-medium text-white">contato@miseon.app.br | suporte@miseon.app.br</p>
              </div>
            </div>

            <div className="mt-8 border-t border-white/10 pt-6 text-center text-xs text-slate-400">
              O MiseOn é um sistema de gestão de propriedade intelectual registrada, comprometido com a segurança dos dados dos nossos clientes em conformidade com a LGPD (Lei Geral de Proteção de Dados - Lei nº 13.709/2018).
            </div>
          </div>
        </div>
      </section>

      <FooterSEO />
    </div>
  );
}
