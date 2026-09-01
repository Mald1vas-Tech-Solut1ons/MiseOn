import { useState, useEffect } from 'react';
import { Cookie, ShieldCheck, Settings, Lock, Check, X, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  obterConsentimento,
  salvarConsentimento,
  aceitarTodos,
  aceitarApenasEssenciais,
  EVENT_OPEN_COOKIE_MANAGER,
  EVENT_COOKIE_UPDATED,
} from '../lib/cookieConsent';

import { useI18n } from '../contexts/I18nContext';

export function CookieBanner() {
  const { tDynamic } = useI18n();
  const [visivel, setVisivel] = useState(false);
  const [modo, setModo] = useState<'resumido' | 'personalizado'>('resumido');

  const [analiticos, setAnaliticos] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const estado = obterConsentimento();
    if (estado.tipo === 'indefinido') {
      setVisivel(true);
    } else {
      setAnaliticos(estado.preferencias.analiticos);
      setMarketing(estado.preferencias.marketing);
    }

    const handleAbrir = () => {
      const atual = obterConsentimento();
      setAnaliticos(atual.preferencias.analiticos);
      setMarketing(atual.preferencias.marketing);
      setModo('personalizado');
      setVisivel(true);
    };

    const handleAtualizado = () => {
      const atual = obterConsentimento();
      setAnaliticos(atual.preferencias.analiticos);
      setMarketing(atual.preferencias.marketing);
    };

    window.addEventListener(EVENT_OPEN_COOKIE_MANAGER, handleAbrir);
    window.addEventListener(EVENT_COOKIE_UPDATED, handleAtualizado);

    return () => {
      window.removeEventListener(EVENT_OPEN_COOKIE_MANAGER, handleAbrir);
      window.removeEventListener(EVENT_COOKIE_UPDATED, handleAtualizado);
    };
  }, []);

  if (!visivel) return null;

  const handleAceitarTodos = () => {
    aceitarTodos();
    setVisivel(false);
  };

  const handleAceitarEssenciais = () => {
    aceitarApenasEssenciais();
    setVisivel(false);
  };

  const handleSalvarPersonalizado = () => {
    salvarConsentimento('personalizado', { analiticos, marketing });
    setVisivel(false);
    setModo('resumido');
  };

  return (
    <div
      role="dialog"
      aria-label="Consentimento de Cookies e Privacidade LGPD"
      className="fixed bottom-4 left-4 right-4 z-[9999] mx-auto max-w-4xl animate-in fade-in slide-in-from-bottom-5 duration-300 sm:bottom-6 sm:left-6 sm:right-6"
    >
      <div className="overflow-hidden rounded-3xl border border-gray-200/80 bg-white/95 p-6 shadow-2xl backdrop-blur-xl dark:border-gray-800/80 dark:bg-[#0B132B]/95 dark:text-white sm:p-8">
        {modo === 'resumido' ? (
          /* ── VISÃO COMPACTA / RESUMIDA ── */
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--cor-primaria)]/10 text-[var(--cor-primaria)]">
                <Cookie size={26} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-['Sora'] text-base font-bold text-gray-900 dark:text-white">
                    {tDynamic('Sua Privacidade Importa (LGPD)')}
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck size={12} /> LGPD OK
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300 sm:text-sm">
                  {tDynamic('Utilizamos cookies essenciais para o funcionamento seguro do cardápio e autenticação. Com sua permissão, também podemos usar cookies analíticos e de marketing para otimizar sua experiência.')}{' '}
                  <Link
                    to="/privacidade"
                    /* Cor de sistema, nao da marca: este banner tem fundo proprio
                       (branco no claro, #0B132B no escuro) e aparece por cima do
                       tema de qualquer loja. Usando --cor-secundaria, uma loja com
                       secundaria preta (#000000) deixava este link com contraste
                       1.14:1 sobre o fundo escuro — um aviso legal de LGPD
                       ilegivel. Azul do sistema passa em ambos os temas. */
                    className="font-medium text-blue-700 underline decoration-2 underline-offset-2 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
                  >
                    {tDynamic('Política de Privacidade')}
                  </Link>
                  .
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0 sm:gap-3">
              <button
                type="button"
                onClick={() => setModo('personalizado')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <Settings size={14} /> {tDynamic('Personalizar')}
              </button>
              <button
                type="button"
                onClick={handleAceitarEssenciais}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-xs font-semibold text-gray-800 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                {tDynamic('Apenas Essenciais')}
              </button>
              <button
                type="button"
                data-testid="cookie-aceitar-todos"
                onClick={handleAceitarTodos}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--cor-primaria)] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-[var(--cor-primaria)]/20 transition hover:brightness-110 active:scale-95"
              >
                {tDynamic('Aceitar Todos')} <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ) : (
          /* ── VISÃO DETALHADA / PERSONALIZADA ── */
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--cor-secundaria)]/10 text-[var(--cor-secundaria)]">
                  <Settings size={22} />
                </div>
                <div>
                  <h3 className="font-['Sora'] text-base font-bold text-gray-900 dark:text-white">
                    {tDynamic('Gerenciador de Preferências de Cookies')}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {tDynamic('Escolha quais categorias de dados você permite processar nesta sessão.')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVisivel(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {/* Essenciais */}
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/40 p-4 dark:bg-emerald-950/10">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    <Lock size={14} /> {tDynamic('Essenciais')}
                  </span>
                  <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    {tDynamic('Obrigatório')}
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
                  {tDynamic('Necessários para navegação, login, sessão ativa e funcionamento do carrinho. Não podem ser desativados.')}
                </p>
              </div>

              {/* Analíticos */}
              <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800 dark:bg-gray-900/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900 dark:text-white">
                    {tDynamic('Analíticos (GA4)')}
                  </span>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={analiticos}
                      onChange={(e) => setAnaliticos(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-gray-200 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[var(--cor-primaria)] peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none dark:bg-gray-700" />
                  </label>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
                  {tDynamic('Ajudam a entender quais produtos são mais acessados para melhorar o desempenho do cardápio.')}
                </p>
              </div>

              {/* Marketing */}
              <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800 dark:bg-gray-900/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900 dark:text-white">
                    {tDynamic('Marketing (Meta Pixel)')}
                  </span>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={marketing}
                      onChange={(e) => setMarketing(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-gray-200 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[var(--cor-primaria)] peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none dark:bg-gray-700" />
                  </label>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
                  {tDynamic('Permitem mensurar o retorno de anúncios do Instagram/Facebook e exibir ofertas relevantes.')}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModo('resumido')}
                className="px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {tDynamic('Voltar')}
              </button>
              <button
                type="button"
                onClick={handleSalvarPersonalizado}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--cor-primaria)] px-6 py-2.5 text-xs font-bold text-white shadow-md transition hover:brightness-110 active:scale-95"
              >
                <Check size={14} /> {tDynamic('Salvar Minhas Preferências')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CookieBanner;
