import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Search, ArrowRight, Clock, User } from 'lucide-react';
import { BLOG_POSTS } from '../data/blogData';
import SEO from '../components/SEO';
import FooterSEO from '../components/FooterSEO';
import MiseOnLogo from '../components/MiseOnLogo';

const CATEGORIAS = ['Todas', 'Gestão Financeira', 'Operação & KDS', 'Tecnologia & IA', 'Engenharia de Cardápio'] as const;

export default function Blog() {
  const [busca, setBusca] = useState('');
  const [categoriaSel, setCategoriaSel] = useState<string>('Todas');

  const postsOrdenados = [...BLOG_POSTS].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  const postsFiltrados = postsOrdenados.filter((post) => {
    const bateCategoria = categoriaSel === 'Todas' || post.category === categoriaSel;
    const termo = busca.toLowerCase().trim();
    const bateBusca =
      !termo ||
      post.title.toLowerCase().includes(termo) ||
      post.description.toLowerCase().includes(termo) ||
      post.tags.some((t) => t.toLowerCase().includes(termo));
    return bateCategoria && bateBusca;
  });

  const destaque = postsOrdenados[0];

  const schemaJson = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    'name': 'Blog MiseOn — Engenharia & Gestão para Food Service',
    'description': 'Artigos especializados sobre CMV, Ficha Técnica, KDS, IA no WhatsApp e Gestão de Restaurantes, Hamburguerias e Pizzarias.',
    'url': 'https://miseon.app.br/blog',
    'publisher': {
      '@type': 'Organization',
      'name': 'MiseOn',
      'logo': 'https://miseon.app.br/icon-512.png',
    },
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] font-sans text-gray-900 selection:bg-[#FC5B24] selection:text-white dark:bg-[#070C18] dark:text-[#EAF1FB]">
      <SEO
        title="Blog MiseOn | Engenharia, CMV & Tecnologia para Food Service"
        description="Conteúdo especializado para donos de restaurantes, hamburguerias e pizzarias. Artigos sobre CMV real, Ficha Técnica, KDS sem papel e IA no WhatsApp."
        keywords="blog restaurante, cmv food service, kds producao, ficha tecnica hamburgueria, whatsapp ia delivery, gestao de pizzaria"
        canonicalUrl="https://miseon.app.br/blog"
        schemaJson={schemaJson}
      />

      {/* ══════════ 1. NAVBAR ══════════ */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-gray-200/70 bg-white/90 backdrop-blur-xl dark:border-white/10 dark:bg-[#070C18]/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" aria-label="MiseOn - Voltar ao início">
            <MiseOnLogo size={132} />
          </Link>
          <div className="flex items-center gap-4 text-sm font-semibold">
            <Link to="/" className="text-gray-600 hover:text-gray-900 dark:text-slate-300 dark:hover:text-white">Home</Link>
            <Link to="/cadastre-se" className="rounded-full bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] px-5 py-2 text-xs font-bold text-white shadow-md">
              Testar 30 Dias Grátis
            </Link>
          </div>
        </div>
      </nav>

      {/* ══════════ 2. HERO HEADER ══════════ */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[#0B1120] via-[#0C1730] to-[#070C18] pb-16 pt-32 sm:pb-24 sm:pt-40 text-white">
        <div className="pointer-events-none absolute -top-24 right-[-8%] h-96 w-96 rounded-full bg-[#0A5CC4]/25 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-10%] left-[-6%] h-80 w-80 rounded-full bg-[#FC5B24]/20 blur-3xl" />

        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-orange-300 backdrop-blur-md">
            <BookOpen size={14} className="text-orange-400" />
            Conhecimento de Especialistas em Food Service
          </span>

          <h1 className="mx-auto mt-6 font-['Sora'] text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Blog MiseOn: <span className="bg-gradient-to-r from-[#FF8A5C] via-[#FC5B24] to-[#6B9EFF] bg-clip-text text-transparent">Engenharia, CMV & Tecnologia</span>
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-300 sm:text-lg">
            Artigos profundos e sem enrolação sobre gestão de custos, automação de cozinha, regras operacionais e o futuro da tecnologia no food service.
          </p>

          {/* Busca */}
          <div className="mx-auto mt-8 max-w-xl">
            <div className="relative flex items-center">
              <Search size={20} className="absolute left-4 text-slate-400" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Busque por tema (ex: CMV, KDS, WhatsApp, Perda de Cocção)..."
                className="w-full rounded-full border border-white/20 bg-white/10 py-3.5 pl-12 pr-4 text-sm text-white placeholder-slate-400 outline-none backdrop-blur-md focus:border-[#FC5B24]"
              />
            </div>
          </div>
        </div>
      </header>

      {/* ══════════ 3. FILTRO DE CATEGORIAS ══════════ */}
      <section className="border-b border-gray-200 bg-white py-4 dark:border-white/10 dark:bg-[#090F1E]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 px-4 sm:px-6">
          {CATEGORIAS.map((cat) => {
            const ativa = categoriaSel === cat;
            return (
              <button
                key={cat}
                onClick={() => setCategoriaSel(cat)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                  ativa
                    ? 'bg-[#FC5B24] text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </section>

      {/* ══════════ 4. ARTIGO EM DESTAQUE ══════════ */}
      {!busca && categoriaSel === 'Todas' && destaque && (
        <section className="py-12">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="mb-4 text-xs font-black uppercase tracking-widest text-[#FC5B24]">Artigo em Destaque</p>
            <div className="group overflow-hidden rounded-3xl border border-gray-200 bg-white p-8 shadow-sm transition hover:shadow-xl dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-md">
              <div className="grid gap-8 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <span className="inline-block rounded-full bg-orange-500/10 px-3 py-1 text-[11px] font-bold text-[#FC5B24]">
                    {destaque.category}
                  </span>
                  <h2 className="mt-3 font-['Sora'] text-2xl font-extrabold text-gray-900 group-hover:text-[#FC5B24] sm:text-3xl dark:text-white transition-colors">
                    <Link to={`/blog/${destaque.slug}`}>{destaque.title}</Link>
                  </h2>
                  <p className="mt-4 text-sm leading-relaxed text-gray-600 dark:text-slate-300">
                    {destaque.summary}
                  </p>
                  <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-slate-400">
                    <span className="flex items-center gap-1 font-semibold"><User size={14} /> {destaque.author.name}</span>
                    <span className="flex items-center gap-1"><Clock size={14} /> {destaque.readTime}</span>
                  </div>
                </div>

                <div className="flex flex-col justify-between rounded-2xl border border-orange-500/20 bg-gradient-to-br from-[#0B1120] to-[#111a33] p-6 text-white">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-orange-400">Visão Prática</span>
                    <p className="mt-2 text-xs leading-relaxed text-slate-300">
                      Entenda como aplicar a valoração de preparos PEPS e proteger a margem real do seu restaurante.
                    </p>
                  </div>
                  <Link
                    to={`/blog/${destaque.slug}`}
                    className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#FC5B24] px-5 py-3 font-['Sora'] text-xs font-bold text-white shadow-lg transition hover:scale-105"
                  >
                    Ler Artigo Completo <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ══════════ 5. GRID DE ARTIGOS ══════════ */}
      <section className="py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-['Sora'] text-xl font-bold text-gray-900 dark:text-white">
              {busca ? `Resultados para "${busca}"` : 'Artigos Recentes'}
            </h2>
            <span className="text-xs font-semibold text-slate-400">{postsFiltrados.length} artigo(s) encontrado(s)</span>
          </div>

          {postsFiltrados.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <p className="text-base font-semibold">Nenhum artigo encontrado para a busca selecionada.</p>
              <button onClick={() => { setBusca(''); setCategoriaSel('Todas'); }} className="mt-3 text-xs font-bold text-[#FC5B24] underline">
                Limpar filtros
              </button>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {postsFiltrados.map((post) => (
                <article
                  key={post.slug}
                  className="group flex flex-col justify-between overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-md"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
                    <img
                      src={post.coverImage}
                      alt={post.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/blog-covers/smart-tv-cover.jpg';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                    <span className="absolute bottom-3 left-3 rounded-full bg-[#FC5B24] px-3 py-0.5 text-[10px] font-bold text-white shadow-md">
                      {post.category}
                    </span>
                  </div>

                  <div className="p-6 flex flex-col flex-1 justify-between">
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                        <span className="flex items-center gap-1"><Clock size={12} /> {post.readTime}</span>
                        <span>{post.publishedAt}</span>
                      </div>

                      <h3 className="font-['Sora'] text-base font-bold leading-snug text-gray-900 group-hover:text-[#FC5B24] dark:text-white transition-colors">
                        <Link to={`/blog/${post.slug}`}>{post.title}</Link>
                      </h3>

                      <p className="mt-2 text-xs leading-relaxed text-gray-600 line-clamp-3 dark:text-slate-300">
                        {post.description}
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-gray-100 dark:border-white/10 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-400">{post.author.name}</span>
                      <Link to={`/blog/${post.slug}`} className="flex items-center gap-1 text-xs font-bold text-[#FC5B24] group-hover:translate-x-1 transition-transform">
                        Ler Artigo <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ══════════ 6. CTA DE CONVERSÃO DO MISEON ══════════ */}
      <section className="py-16 bg-[#070C18] border-t border-white/10 text-white">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <div className="rounded-3xl border border-orange-500/30 bg-gradient-to-br from-[#0B1120] via-[#0C1730] to-[#111a33] p-8 md:p-12 shadow-2xl">
            <span className="inline-flex rounded-full bg-emerald-500/20 border border-emerald-500/40 px-4 py-1 text-xs font-black uppercase tracking-widest text-emerald-300">
              🚀 Coloque a Engenharia MiseOn na sua loja
            </span>
            <h2 className="mt-4 font-['Sora'] text-3xl font-extrabold">
              Pronto para ter controle absoluto de CMV, Estoque e KDS?
            </h2>
            <p className="mt-3 text-sm text-slate-300 max-w-2xl mx-auto">
              Teste o MiseOn por 30 dias sem custos e sem cartão de crédito. Custeio PEPS, WhatsApp IA, iFood oficial e PDV balcão liberados.
            </p>
            <div className="mt-8 flex justify-center">
              <Link
                to="/cadastre-se"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] px-8 py-4 font-['Sora'] text-base font-bold text-white shadow-xl shadow-[#FC5B24]/30 transition hover:scale-105"
              >
                Cadastrar Loja Grátis <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <FooterSEO />
    </div>
  );
}
