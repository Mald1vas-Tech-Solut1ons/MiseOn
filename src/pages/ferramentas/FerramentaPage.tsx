import type { ComponentType } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, Calculator, ChevronRight } from 'lucide-react';
import SEO from '../../components/SEO';
import FooterSEO from '../../components/FooterSEO';
import { CtaMiseOn, NavFerramentas } from '../../components/ferramentas/ui';
import { useTxt } from '../../components/ferramentas/useTxt';
import CalculadoraCmv from '../../components/ferramentas/CalculadoraCmv';
import CalculadoraPrecoIfood from '../../components/ferramentas/CalculadoraPrecoIfood';
import CalculadoraMarkup from '../../components/ferramentas/CalculadoraMarkup';
import { FERRAMENTAS, ROTULOS, ferramentaPorSlug, type SlugFerramenta } from '../../data/ferramentasData';

const CALCULADORAS: Record<SlugFerramenta, ComponentType> = {
  'calculadora-cmv': CalculadoraCmv,
  'preco-ifood': CalculadoraPrecoIfood,
  'markup-preco-de-venda': CalculadoraMarkup,
};

export default function FerramentaPage({ slug }: { slug: SlugFerramenta }) {
  const tx = useTxt();
  const f = ferramentaPorSlug(slug);
  if (!f) return <Navigate to="/ferramentas" replace />;

  const Calculadora = CALCULADORAS[f.slug];
  const url = `https://miseon.app.br${f.path}`;
  const outras = FERRAMENTAS.filter((o) => o.slug !== f.slug);

  const schemaJson = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: f.nome.pt,
      url,
      description: f.seo.description,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' },
      publisher: { '@type': 'Organization', name: 'MiseOn', url: 'https://miseon.app.br' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: f.faqs.map((q) => ({
        '@type': 'Question',
        name: q.pergunta.pt,
        acceptedAnswer: { '@type': 'Answer', text: q.resposta.pt },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'MiseOn', item: 'https://miseon.app.br/' },
        { '@type': 'ListItem', position: 2, name: 'Ferramentas', item: 'https://miseon.app.br/ferramentas' },
        { '@type': 'ListItem', position: 3, name: f.nome.pt, item: url },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#F4F7FA] font-['Manrope'] text-gray-900 selection:bg-[#FC5B24] selection:text-white dark:bg-[#070C18] dark:text-[#EAF1FB]">
      <SEO title={f.seo.title} description={f.seo.description} keywords={f.seo.keywords} canonicalUrl={url} schemaJson={schemaJson} />
      <NavFerramentas />

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
        <ol className="mb-4 flex flex-wrap items-center gap-1 text-xs font-semibold text-gray-500 dark:text-slate-400">
          <li><Link to="/" className="hover:text-[#FC5B24]">{tx(ROTULOS.inicio)}</Link></li>
          <li><ChevronRight size={12} /></li>
          <li><Link to="/ferramentas" className="hover:text-[#FC5B24]">{tx(ROTULOS.ferramentas)}</Link></li>
          <li><ChevronRight size={12} /></li>
          <li className="text-gray-700 dark:text-slate-200">{tx(f.nome)}</li>
        </ol>

        <header className="mb-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 font-['JetBrains_Mono'] text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            <Calculator size={13} /> {tx(ROTULOS.gratis)}
          </span>
          <h1 className="mt-3 font-['Sora'] text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{tx(f.h1)}</h1>
          <p className="mt-2 max-w-3xl text-base text-gray-600 sm:text-lg dark:text-slate-300">{tx(f.resumo)}</p>
        </header>

        <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 dark:border-white/10 dark:bg-[#0B1120]/40">
          <Calculadora />
        </section>

        <div className="mt-12 grid gap-10">
          {f.explicacao.map((bloco) => (
            <section key={bloco.titulo.pt}>
              <h2 className="font-['Sora'] text-2xl font-extrabold">{tx(bloco.titulo)}</h2>
              {bloco.paragrafos.map((p) => (
                <p key={p.pt.slice(0, 40)} className="mt-3 max-w-3xl leading-relaxed text-gray-700 dark:text-slate-300">{tx(p)}</p>
              ))}
            </section>
          ))}

          <section>
            <h2 className="font-['Sora'] text-2xl font-extrabold">{tx(ROTULOS.perguntas)}</h2>
            <div className="mt-4 grid gap-3">
              {f.faqs.map((q) => (
                <details key={q.pergunta.pt} className="group rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                  <summary className="cursor-pointer list-none font-bold">{tx(q.pergunta)}</summary>
                  <p className="mt-2 leading-relaxed text-gray-700 dark:text-slate-300">{tx(q.resposta)}</p>
                </details>
              ))}
            </div>
          </section>

          <CtaMiseOn mensagemWhatsapp={f.whatsapp} />

          <section>
            <h2 className="font-['Sora'] text-xl font-extrabold">{tx(ROTULOS.outrasFerramentas)}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {outras.map((o) => (
                <Link
                  key={o.slug}
                  to={o.path}
                  className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-4 font-bold transition hover:border-[#FC5B24] dark:border-white/10 dark:bg-white/5"
                >
                  {tx(o.nome)} <ArrowRight size={16} className="text-[#FC5B24]" />
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>

      <FooterSEO />
    </div>
  );
}
