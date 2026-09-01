import React, { useState, useEffect } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import {
  ChefHat, UtensilsCrossed, Boxes, ShoppingBag, QrCode,
  MessageCircle, ShieldCheck, BarChart3, Bike, Wallet, Sparkles,
  ArrowRight, Check, X, ChevronDown, Menu as MenuIcon, ScanLine, HeartPulse,
  Percent,
  Ban,
  KeyRound,
  Maximize2,
  Tv,
  Volume2,
} from 'lucide-react';
import { LANDING_PAGES_DATA, type LandingPageData } from '../../data/landingPagesData';
import SEO from '../../components/SEO';
import FooterSEO from '../../components/FooterSEO';
import MiseOnLogo from '../../components/MiseOnLogo';
import LanguageToggle from '../../components/LanguageToggle';

const ICON_MAP: Record<string, any> = {
  ChefHat,
  UtensilsCrossed,
  Boxes,
  ShoppingBag,
  QrCode,
  MessageCircle,
  ShieldCheck,
  BarChart3,
  Bike,
  Wallet,
  Sparkles,
  // Sem o nome no mapa, o card cai no icone generico e a feature perde
  // identidade visual — o componente nao quebra, so fica sem sinal.
  ScanLine,
  HeartPulse,
  Percent,
  Ban,
  KeyRound,
  Tv,
  Volume2,
};

import { useI18n } from '../../contexts/I18nContext';

interface NicheLandingPageProps {
  forcedSlug?: string;
}

export default function NicheLandingPage({ forcedSlug }: NicheLandingPageProps) {
  const { t, tDynamic } = useI18n();
  const params = useParams<{ slug?: string }>();
  const slug = forcedSlug || params.slug || '';
  const data = LANDING_PAGES_DATA[slug];

  const [menuAberto, setMenuAberto] = useState(false);
  const [faqAberto, setFaqAberto] = useState<number | null>(null);

  /**
   * Captura aberta em tela cheia. `null` = nenhuma.
   *
   * Fica AQUI, acima do `if (!data)` logo abaixo, e nao junto da secao que a
   * usa: hook depois de return antecipado muda a ordem de chamada entre um
   * render e outro. Nesta tela quebraria de verdade — basta navegar de
   * /integracao-ifood para um slug que nao existe.
   */
  const [ampliada, setAmpliada] = useState<
    NonNullable<LandingPageData['screenshots']>[number] | null
  >(null);

  // Esc fecha, e a pagina para de rolar por tras do overlay — sem isso o
  // visitante rola a landing inteira achando que esta rolando a imagem.
  useEffect(() => {
    if (!ampliada) return;
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') setAmpliada(null); };
    // `overflow: hidden` so no <body> nao segura: dependendo do CSS quem rola e
    // o <html>. Trava os dois.
    const anterior = {
      body: document.body.style.overflow,
      html: document.documentElement.style.overflow,
    };
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    window.addEventListener('keydown', aoTeclar);
    return () => {
      window.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = anterior.body;
      document.documentElement.style.overflow = anterior.html;
    };
  }, [ampliada]);

  if (!data) {
    return <Navigate to="/" replace />;
  }

  // Montar Schema.org JSON-LD para SoftwareApplication + FAQPage + Breadcrumb
  const schemaJson = [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      'name': `MiseOn — ${data.h1Title}`,
      'operatingSystem': 'Web, Android, iOS, Windows, macOS',
      'applicationCategory': 'BusinessApplication',
      'offers': {
        '@type': 'Offer',
        'price': '149.90',
        'priceCurrency': 'BRL',
      },
      'description': data.seo.description,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': data.faqs.map((faq) => ({
        '@type': 'Question',
        'name': faq.pergunta,
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': faq.resposta,
        },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        {
          '@type': 'ListItem',
          'position': 1,
          'name': 'Home',
          'item': 'https://miseon.app.br',
        },
        {
          '@type': 'ListItem',
          'position': 2,
          'name': data.h1Title,
          'item': data.seo.canonicalUrl,
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#F4F7FA] font-sans text-gray-900 selection:bg-[#FC5B24] selection:text-white dark:bg-[#070C18] dark:text-[#EAF1FB]">
      
      {/* Dynamic SEO Meta & Head Inserter */}
      <SEO
        title={data.seo.title}
        description={data.seo.description}
        keywords={data.seo.keywords}
        canonicalUrl={data.seo.canonicalUrl}
        schemaJson={schemaJson}
      />

      {/* ══════════ 1. NAVBAR ══════════ */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-gray-200/70 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-[#070C18]/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link to="/" aria-label="MiseOn - Voltar ao início">
            <MiseOnLogo size={132} />
          </Link>

          <div className="hidden items-center gap-6 lg:flex text-sm font-semibold">
            <a href="#recursos" className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">{t('nav.funcionalidades')}</a>
            <a href="#comparativo" className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">{t('nav.solucoes')}</a>
            <a href="#regras" className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">{t('nav.comoFunciona')}</a>
            <a href="#faq" className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">FAQ</a>
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            <LanguageToggle variant="pill" />
            <Link
              to="/acesso"
              className="rounded-full px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10"
            >
              {t('nav.entrar')}
            </Link>
            <Link
              to="/cadastre-se"
              className="rounded-full bg-[var(--cor-primaria)] px-5 py-2.5 font-['Sora'] text-sm font-bold text-white shadow-lg shadow-[#FC5B24]/25 transition hover:scale-105"
            >
              {t('nav.testar30d')}
            </Link>
          </div>

          <button
            onClick={() => setMenuAberto((a) => !a)}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 lg:hidden dark:text-gray-300 dark:hover:bg-white/10"
          >
            {menuAberto ? <X size={22} /> : <MenuIcon size={22} />}
          </button>
        </div>

        {menuAberto && (
          <div className="border-t border-gray-200/70 bg-white/95 px-4 pb-5 pt-3 lg:hidden dark:border-white/10 dark:bg-[#070C18]/95">
            <div className="flex flex-col gap-2 font-semibold">
              <a href="#recursos" onClick={() => setMenuAberto(false)} className="py-2">Recursos</a>
              <a href="#comparativo" onClick={() => setMenuAberto(false)} className="py-2">{tDynamic("Dores & Soluções")}</a>
              <a href="#regras" onClick={() => setMenuAberto(false)} className="py-2">{tDynamic("Regras de Negócio")}</a>
              <a href="#faq" onClick={() => setMenuAberto(false)} className="py-2">{tDynamic("Dúvidas")}</a>
              <Link to="/cadastre-se" className="mt-2 rounded-xl bg-[var(--cor-primaria)] p-3 text-center text-white font-bold">
                Cadastrar Minha Loja
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ══════════ 2. HERO GLASSMORPHISM ══════════ */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[#0B1120] via-[#0C1730] to-[#070C18] pb-20 pt-32 sm:pb-28 sm:pt-40">
        <div className="pointer-events-none absolute -top-24 right-[-8%] h-96 w-96 rounded-full bg-[#0A5CC4]/25 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-10%] left-[-6%] h-80 w-80 rounded-full bg-[#FC5B24]/20 blur-3xl" />

        <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-orange-300 backdrop-blur-md">
            <Sparkles size={14} className="text-orange-400" />
            {tDynamic(data.badge)}
          </span>

          <h1 className="mx-auto mt-6 font-['Sora'] text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            {tDynamic(data.h1Title)}{' '}
            <span className="bg-gradient-to-r from-[#FF8A5C] via-[#FC5B24] to-[#6B9EFF] bg-clip-text text-transparent">
              {tDynamic(data.h1Highlight)}
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg">
            {tDynamic(data.subheadline)}
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/cadastre-se"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] px-8 py-4 font-['Sora'] text-base font-bold text-white shadow-xl shadow-[#FC5B24]/30 transition hover:scale-105 sm:w-auto"
            >
              {tDynamic('Criar Minha Conta Grátis')} <ArrowRight size={18} />
            </Link>
            <a
              href="#comparativo"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-8 py-4 font-['Sora'] text-base font-bold text-white backdrop-blur-md transition hover:bg-white/15 sm:w-auto"
            >
              {tDynamic('Ver Diferenciais')}
            </a>
          </div>

          {/* Metrics Bar */}
          <div className="mt-14 grid gap-4 sm:grid-cols-3">
            {data.heroMetrics.map((metric, idx) => (
              <div key={idx} className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur-md text-left">
                <p className="font-['Sora'] text-2xl font-extrabold text-white">{tDynamic(metric.value)}</p>
                <p className="mt-1 text-xs text-slate-300 font-medium">{tDynamic(metric.label)}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ══════════ 3. DORES VS SOLUÇÃO ══════════ */}
      <section id="comparativo" className="scroll-mt-24 py-20 bg-white dark:bg-transparent">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-black uppercase tracking-widest text-[var(--cor-primaria)]">{tDynamic('Dores & Solução')}</span>
            <h2 className="mt-3 font-['Sora'] text-3xl font-extrabold text-gray-900 sm:text-4xl dark:text-white">
              {tDynamic(data.painPointsTitle)}
            </h2>
            <p className="mt-3 text-base text-gray-600 dark:text-slate-300">
              {tDynamic(data.painPointsSubtitle)}
            </p>
          </div>

          <div className="mt-14 space-y-6">
            {data.painPoints.map((item, index) => (
              <div key={index} className="grid gap-4 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:grid-cols-2 dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-md">
                
                {/* Sem MiseOn */}
                <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-red-950 dark:text-red-200">
                  <div className="flex items-center gap-2 font-bold text-red-600 dark:text-red-400">
                    <X size={20} />
                    <span>{tDynamic("Sem o MiseOn")}</span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed">{tDynamic(item.semMiseOn)}</p>
                </div>

                {/* Com MiseOn */}
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-emerald-950 dark:text-emerald-200">
                  <div className="flex items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400">
                    <Check size={20} />
                    <span>{tDynamic("Com o MiseOn")}</span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed">{tDynamic(item.comMiseOn)}</p>
                </div>

              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ 4. FUNCIONALIDADES ══════════ */}
      <section id="recursos" className="scroll-mt-24 py-20 bg-gray-50 dark:bg-[#090F1E]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-black uppercase tracking-widest text-[var(--cor-primaria)]">{tDynamic("Módulos Especialistas")}</span>
            <h2 className="mt-3 font-['Sora'] text-3xl font-extrabold text-gray-900 sm:text-4xl dark:text-white">
              {tDynamic(data.featuresTitle)}
            </h2>
            <p className="mt-3 text-base text-gray-600 dark:text-slate-300">
              {tDynamic(data.featuresSubtitle)}
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {data.features.map((feat, idx) => {
              const IconComp = ICON_MAP[feat.iconName] || Sparkles;
              return (
                <div key={idx} className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-md">
                  <div className="inline-flex rounded-2xl bg-orange-500/10 p-3 text-[var(--cor-primaria)]">
                    <IconComp size={24} />
                  </div>
                  <span className="mt-4 block text-[10px] font-black uppercase tracking-wider text-slate-400">
                    {tDynamic(feat.tag)}
                  </span>
                  <h3 className="mt-1 font-['Sora'] text-lg font-bold text-gray-900 dark:text-white">
                    {tDynamic(feat.title)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-slate-300">
                    {tDynamic(feat.description)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════ 4B. AS TELAS DE VERDADE ══════════
          Vem depois dos recursos de propósito: o visitante acabou de ler seis
          afirmações e aqui confere três delas. Só renderiza quando a página tem
          captura — nenhuma landing quebra por não ter. */}
      {data.screenshots && data.screenshots.length > 0 && (
        <section id="telas" className="scroll-mt-24 bg-white py-20 dark:bg-transparent">
          <div className="mx-auto max-w-6xl px-4">
            <div className="text-center">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-[var(--cor-primaria)]">
                {tDynamic('Telas do produto')}
              </span>
              <h2 className="mt-3 font-['Sora'] text-3xl font-extrabold text-gray-900 sm:text-4xl dark:text-white">
                {tDynamic('Isto é a tela, não é ilustração')}
              </h2>
              <p className="mt-3 text-base text-gray-600 dark:text-slate-300">
                {tDynamic('Capturas do sistema em operação, com dados reais de uma loja usando a integração.')}
              </p>
            </div>

            <div className="mt-14 space-y-10">
              {data.screenshots.map((shot, idx) => (
                <div key={idx} className="grid items-center gap-8 lg:grid-cols-5">
                  {/* Ímpar inverte o lado: leitura em zigue-zague segura melhor
                      a atenção do que três blocos idênticos empilhados. */}
                  <div className={`lg:col-span-2 ${idx % 2 === 1 ? 'lg:order-2' : ''}`}>
                    <h3 className="font-['Sora'] text-xl font-bold text-gray-900 dark:text-white">
                      {tDynamic(shot.titulo)}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-slate-300">
                      {tDynamic(shot.legenda)}
                    </p>
                  </div>
                  <div className={`lg:col-span-3 ${idx % 2 === 1 ? 'lg:order-1' : ''}`}>
                    {/* Ampliar sem sair da pagina.
                        A primeira versao era um <a target="_blank"> para o PNG:
                        joga o visitante para fora da landing, no meio da leitura,
                        e no celular entrega uma imagem crua para ele pinçar com
                        os dedos. Aqui a captura abre sobre a pagina, ocupando a
                        tela inteira, e fecha no Esc ou no clique fora. */}
                    <button
                      type="button"
                      onClick={() => setAmpliada(shot)}
                      aria-label={`${tDynamic('Ampliar')}: ${shot.alt}`}
                      className="group block w-full overflow-hidden rounded-3xl border border-gray-200 bg-black/60 text-left shadow-2xl transition hover:border-[var(--cor-primaria)] dark:border-white/15"
                    >
                      <img
                        src={shot.src}
                        alt={shot.alt}
                        loading="lazy"
                        width={shot.largura}
                        height={shot.altura}
                        className="h-auto w-full object-cover"
                      />
                      <span className="flex items-center justify-center gap-1.5 border-t border-white/10 bg-slate-900/80 p-3 text-[11px] font-bold text-slate-300 transition group-hover:text-white">
                        <Maximize2 size={12} /> {tDynamic('Ampliar a tela')}
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {ampliada && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={ampliada.alt}
          onClick={() => setAmpliada(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={() => setAmpliada(null)}
            aria-label={tDynamic('Fechar')}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20"
          >
            <X size={20} />
          </button>
          {/* A caixa rola; a imagem NAO encolhe para caber.
              Numa tela estreita, limitar a imagem a largura do viewport faz o
              "ampliar" nao ampliar nada — foi exatamente o defeito da primeira
              versao. Aqui a captura entra no tamanho natural e o visitante
              arrasta para ler a interface; a partir de `md` ela ja cabe e passa
              a se ajustar sozinha. */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] max-w-full overflow-auto overscroll-contain rounded-xl md:overflow-visible"
          >
            <img
              src={ampliada.src}
              alt={ampliada.alt}
              width={ampliada.largura}
              height={ampliada.altura}
              className="h-auto w-auto max-w-none cursor-default rounded-xl shadow-2xl md:max-h-[92vh] md:max-w-full md:object-contain"
            />
          </div>
          <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-4 py-1.5 text-[11px] font-semibold text-white/80">
            <span className="md:hidden">{tDynamic('Arraste para ver a tela inteira · toque fora para fechar')}</span>
            <span className="hidden md:inline">{tDynamic('Toque fora ou aperte Esc para fechar')}</span>
          </p>
        </div>
      )}

      {/* ══════════ 5. REGRAS DE NEGÓCIO DO SISTEMA ══════════ */}
      <section id="regras" className="scroll-mt-24 py-20 bg-gradient-to-br from-[#0B1120] via-[#0C1730] to-[#070C18] text-white">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="rounded-3xl border border-white/10 bg-white/10 p-8 backdrop-blur-xl sm:p-12">
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-400/10 px-4 py-1 text-xs font-bold uppercase tracking-wider text-orange-300">
              <ShieldCheck size={14} /> {tDynamic('Regras de Negócio e Engenharia')}
            </span>
            <h2 className="mt-4 font-['Sora'] text-2xl font-extrabold sm:text-3xl">
              {tDynamic(data.businessRules.title)}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              {tDynamic(data.businessRules.description)}
            </p>

            <ul className="mt-8 space-y-4">
              {data.businessRules.items.map((rule, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-slate-200">
                  <Check size={18} className="mt-0.5 shrink-0 text-emerald-400" />
                  <span>{tDynamic(rule)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-xs text-slate-400">
                {tDynamic('Pronto para colocar sua operação no automático com o MiseOn?')}
              </span>
              <Link
                to="/cadastre-se"
                className="rounded-full bg-[var(--cor-primaria)] px-6 py-3 font-['Sora'] text-sm font-bold text-white shadow-lg transition hover:scale-105"
              >
                Cadastrar Loja Agora
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ 6. FAQ ACCORDION ══════════ */}
      <section id="faq" className="scroll-mt-24 py-20 bg-white dark:bg-transparent">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="text-center">
            <span className="text-xs font-black uppercase tracking-widest text-[var(--cor-primaria)]">FAQ</span>
            <h2 className="mt-3 font-['Sora'] text-3xl font-extrabold text-gray-900 dark:text-white">
              Perguntas Frequentes
            </h2>
          </div>

          <div className="mt-10 space-y-4">
            {data.faqs.map((faq, idx) => {
              const aberto = faqAberto === idx;
              return (
                <div key={idx} className="rounded-2xl border border-gray-200 bg-white overflow-hidden dark:border-white/10 dark:bg-white/5">
                  <button
                    onClick={() => setFaqAberto(aberto ? null : idx)}
                    className="flex w-full items-center justify-between p-5 text-left font-['Sora'] font-bold text-gray-900 dark:text-white"
                  >
                    <span>{tDynamic(faq.pergunta)}</span>
                    <ChevronDown size={18} className={`transition-transform duration-300 ${aberto ? 'rotate-180 text-[var(--cor-primaria)]' : ''}`} />
                  </button>
                  {aberto && (
                    <p className="border-t border-gray-100 p-5 text-sm leading-relaxed text-gray-600 dark:border-white/10 dark:text-slate-300">
                      {tDynamic(faq.resposta)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════ 6.5 CARD DE PRECIFICAÇÃO PROMOCIONAL DO NICHO ══════════ */}
      <section className="py-16 bg-[#070C18] border-t border-white/10">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <div className="rounded-3xl border border-orange-500/30 bg-gradient-to-br from-[#0B1120] via-[#0C1730] to-[#111a33] p-8 md:p-12 shadow-2xl backdrop-blur-xl">
            <span className="inline-flex rounded-full bg-emerald-500/20 border border-emerald-500/40 px-4 py-1 text-xs font-black uppercase tracking-widest text-emerald-300">
              ✨ 30 Dias Grátis · Sem Cartão de Crédito
            </span>
            <h2 className="mt-4 font-['Sora'] text-3xl font-extrabold text-white">
              {tDynamic('Comece agora sem custos e transforme a gestão da sua loja')}
            </h2>
            <p className="mt-3 text-sm text-slate-300 max-w-2xl mx-auto">
              {tDynamic('Teste todos os recursos liberados por 30 dias. Plano Mensal por')} <b>{tDynamic("R$ 169,90/mês")}</b> {tDynamic("ou Anual por")} <b>{tDynamic("R$ 149,90/mês")}</b> {tDynamic("(em até 12x no cartão via Efí Bank). Pagamentos no Pix têm")} <b>5% de desconto à vista</b>!
            </p>
            <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-4">
              <Link
                to="/cadastre-se"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] px-8 py-4 font-['Sora'] text-base font-bold text-white shadow-xl shadow-[#FC5B24]/30 transition hover:scale-105"
              >
                {tDynamic('Testar 30 Dias Grátis')} <ArrowRight size={18} />
              </Link>
            </div>
            <p className="mt-4 text-xs text-slate-400">
              {tDynamic('Zero pegadinhas. Tolerância de 7 dias pós-vencimento. Cancele quando quiser.')}
            </p>
          </div>
        </div>
      </section>

      {/* ══════════ 7. CTA FINAL ══════════ */}
      <section className="bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] py-16 text-white text-center">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="font-['Sora'] text-3xl font-extrabold sm:text-4xl">
            {tDynamic('Sua operação mais ágil, lucrativa e sem erros')}
          </h2>
          <p className="mt-4 text-base text-orange-100">
            {tDynamic('Cadastre sua loja em menos de 3 minutos e comece a vender no automático.')}
          </p>
          <Link
            to="/cadastre-se"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 font-['Sora'] text-base font-bold text-gray-900 shadow-2xl transition hover:scale-105"
          >
            Cadastrar Minha Loja Gratuitamente <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* ══════════ 8. FOOTER SEO ══════════ */}
      <FooterSEO />
    </div>
  );
}
