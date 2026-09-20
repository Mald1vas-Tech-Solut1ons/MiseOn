import { Link } from 'react-router-dom';
import { ArrowRight, Calculator, Percent, Bike } from 'lucide-react';
import SEO from '../../components/SEO';
import FooterSEO from '../../components/FooterSEO';
import { CtaMiseOn, NavFerramentas } from '../../components/ferramentas/ui';
import { useTxt } from '../../components/ferramentas/useTxt';
import { FERRAMENTAS, HUB_FERRAMENTAS, ROTULOS, type SlugFerramenta } from '../../data/ferramentasData';

const ICONES: Record<SlugFerramenta, typeof Calculator> = {
  'calculadora-cmv': Calculator,
  'preco-ifood': Bike,
  'markup-preco-de-venda': Percent,
};

export default function FerramentasHub() {
  const tx = useTxt();
  const schemaJson = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: HUB_FERRAMENTAS.seo.title,
    itemListElement: FERRAMENTAS.map((f, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: f.nome.pt,
      url: `https://miseon.app.br${f.path}`,
    })),
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] font-['Manrope'] text-gray-900 dark:bg-[#070C18] dark:text-[#EAF1FB]">
      <SEO {...HUB_FERRAMENTAS.seo} schemaJson={schemaJson} />
      <NavFerramentas />

      <header className="relative overflow-hidden bg-gradient-to-br from-[#0B1120] via-[#0C1730] to-[#070C18] pb-14 pt-28 text-white sm:pt-36">
        <div className="pointer-events-none absolute -top-24 right-[-8%] h-96 w-96 rounded-full bg-[#0A5CC4]/25 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-10%] left-[-6%] h-80 w-80 rounded-full bg-[#FC5B24]/20 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 font-['JetBrains_Mono'] text-xs font-bold uppercase tracking-widest text-orange-300">
            <Calculator size={14} /> {tx(ROTULOS.gratis)}
          </span>
          <h1 className="mx-auto mt-5 font-['Sora'] text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">{tx(HUB_FERRAMENTAS.h1)}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-300 sm:text-lg">{tx(HUB_FERRAMENTAS.resumo)}</p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          {FERRAMENTAS.map((f) => {
            const Icone = ICONES[f.slug];
            return (
              <Link
                key={f.slug}
                to={f.path}
                className="group flex flex-col rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#FC5B24] hover:shadow-lg dark:border-white/10 dark:bg-white/5"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#FC5B24]/10 text-[#FC5B24]">
                  <Icone size={24} />
                </span>
                <h2 className="mt-4 font-['Sora'] text-xl font-extrabold">{tx(f.nome)}</h2>
                <p className="mt-2 flex-1 text-sm text-gray-600 dark:text-slate-300">{tx(f.resumo)}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[#FC5B24]">
                  {tx(ROTULOS.abrir)} <ArrowRight size={16} className="transition group-hover:translate-x-1" />
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mt-12">
          <CtaMiseOn mensagemWhatsapp="Olá! Vi as ferramentas grátis no site do MiseOn e quero conhecer o sistema." />
        </div>
      </main>

      <FooterSEO />
    </div>
  );
}
