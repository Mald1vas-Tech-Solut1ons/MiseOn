import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, MapPin, Mail, ShieldCheck, MessageCircle, CreditCard, Lock, Youtube, Cookie } from 'lucide-react';
import MiseOnLogo from './MiseOnLogo';
import LanguageToggle from './LanguageToggle';
import { abrirGerenciadorCookies } from '../lib/cookieConsent';
import { useI18n } from '../contexts/I18nContext';

export function FooterSEO() {
  const { t, tDynamic } = useI18n();

  const nichos = [
    { title: tDynamic('Restaurantes por Quilo (R$/kg)'), href: '/sistema-para-restaurante-por-quilo' },
    { title: tDynamic('Sistema para Hamburgueria'), href: '/sistema-para-hamburgueria' },
    { title: tDynamic('Sistema para Lanchonete'), href: '/sistema-para-lanchonete' },
    { title: tDynamic('Sistema para Pizzaria'), href: '/sistema-para-pizzaria' },
    { title: tDynamic('Sistema para Restaurantes'), href: '/sistema-para-restaurantes' },
  ];

  const funcionalidades = [
    { title: tDynamic('Integração iFood Nativa'), href: '/integracao-ifood' },
    { title: tDynamic('Cardápio Digital QR Code'), href: '/cardapio-qr-code' },
    { title: tDynamic('Atendimento WhatsApp com IA'), href: '/api-whatsapp-restaurantes' },
    { title: tDynamic('Gestão Fiscal NFC-e / NF-e'), href: '/gestao-fiscal-nfe' },
  ];

  const legal = [
    { title: t('nav.blog'), href: '/blog' },
    { title: tDynamic('Sobre Nós'), href: '/sobre' },
    { title: t('nav.videos'), href: '/videos' },
    { title: tDynamic('Contato & Suporte'), href: '/contato' },
    { title: tDynamic('Termos de Uso'), href: '/termos' },
    { title: tDynamic('Política de Privacidade'), href: '/privacidade' },
    { title: t('nav.cadastrar'), href: '/cadastre-se' },
    { title: t('nav.entrar'), href: '/acesso' },
  ];

  return (
    <footer className="border-t border-gray-200/80 bg-[#070C18] text-slate-300 dark:border-white/10">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        
        {/* Grids principais */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          
          {/* Coluna 1: Logo & Missão */}
          <div className="space-y-4">
            <Link to="/" aria-label="MiseOn - Solução para Restaurantes">
              <MiseOnLogo size={140} />
            </Link>
            <p className="text-xs leading-relaxed text-slate-400">
              {tDynamic('O MiseOn é a plataforma completa para simplificar e organizar a gestão de restaurantes, hamburguerias, pizzarias, lanchonetes e deliveries em um único painel.')}
            </p>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <ShieldCheck size={16} /> {tDynamic('Plataforma Segura & Certificada')}
            </div>
            <div className="pt-1">
              <LanguageToggle variant="dropdown" />
            </div>
            <a
              href="https://www.youtube.com/@MiseOnSISTEMA--CozinhasProfiss"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Canal oficial do MiseOn no YouTube (abre em nova aba)"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-white"
            >
              <Youtube size={16} className="text-red-500" />
              Inscreva-se no YouTube
            </a>
          </div>

          {/* Coluna 2: Soluções por Nicho */}
          <div>
            <h3 className="font-['Sora'] text-xs font-bold uppercase tracking-wider text-orange-400">
              {t('nav.solucoes')}
            </h3>
            <ul className="mt-4 space-y-2.5 text-xs font-medium">
              {nichos.map((item) => (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    className="transition-colors hover:text-white hover:underline"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Coluna 3: Funcionalidades Principais */}
          <div>
            <h3 className="font-['Sora'] text-xs font-bold uppercase tracking-wider text-blue-400">
              {t('nav.funcionalidades')}
            </h3>
            <ul className="mt-4 space-y-2.5 text-xs font-medium">
              {funcionalidades.map((item) => (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    className="transition-colors hover:text-white hover:underline"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Coluna 4: Institucional & Atendimento */}
          <div>
            <h3 className="font-['Sora'] text-xs font-bold uppercase tracking-wider text-emerald-400">
              Institucional & Suporte
            </h3>
            <ul className="mt-4 space-y-2.5 text-xs font-medium">
              {legal.map((item) => (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    className="transition-colors hover:text-white hover:underline"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-5 space-y-1.5 border-t border-white/10 pt-3 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <Mail size={13} className="text-slate-400" />
                <span>contato@miseon.app.br</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageCircle size={13} className="text-emerald-400" />
                <span>Suporte: suporte@miseon.app.br</span>
              </div>
            </div>
          </div>

        </div>

        {/* ══════════ BLOCO INSTITUCIONAL CNPJ & DADOS CORPORATIVOS ══════════ */}
        <div className="mt-12 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            
            {/* Informações da Empresa & CNPJ */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-orange-400" />
                <span className="font-['Sora'] text-sm font-bold text-white">
                  MiseOn Tecnologia e Soluções para Food Service
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 font-mono">
                <span><strong>CNPJ:</strong> 63.310.253/0001-81</span>
                <span className="text-slate-600">|</span>
                <span className="flex items-center gap-1">
                  <MapPin size={13} className="text-slate-400" /> Manaus / AM — Brasil
                </span>
              </div>
            </div>

            {/* Selos de Confiança e Parceiros Oficiais */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
                <CreditCard size={14} className="text-blue-400" />
                <span>Pagamentos Efí Bank</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span>API Oficial Meta</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
                <Lock size={14} className="text-amber-400" />
                <span>Conexão SSL 256-bit</span>
              </div>
            </div>

          </div>
        </div>

        {/* Direitos Autorais e Resumo SEO */}
        <div className="mt-8 border-t border-white/10 pt-6 text-center text-[11px] leading-relaxed text-slate-500">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <p>© {new Date().getFullYear()} MiseOn · Todos os direitos reservados. CNPJ 63.310.253/0001-81</p>
            <span className="text-slate-700">|</span>
            <button
              type="button"
              onClick={abrirGerenciadorCookies}
              title="Gerenciar preferências de privacidade e cookies (LGPD)"
              aria-label="Gerenciar preferências de privacidade e cookies (LGPD)"
              className="inline-flex items-center gap-1 font-semibold text-slate-400 transition-colors hover:text-orange-400 hover:underline"
            >
              <Cookie size={12} className="text-orange-400" /> Gerenciar Cookies (LGPD)
            </button>
          </div>
          <p className="mt-1">
            MiseOn — Sistema para Hamburguerias, Lanchonetes, Pizzarias, Restaurantes e Deliveries. Cardápio Digital com QR Code, Integração iFood, Atendimento WhatsApp IA, KDS de Cozinha, PDV Frente de Caixa, Ficha Técnica e Emissão Fiscal NFC-e/NF-e.
          </p>
        </div>

      </div>
    </footer>
  );
}

export default FooterSEO;
