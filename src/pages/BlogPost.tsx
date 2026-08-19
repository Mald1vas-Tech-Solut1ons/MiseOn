import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Clock, ArrowRight, Check, Bookmark } from 'lucide-react';
import { BLOG_POSTS } from '../data/blogData';
import SEO from '../components/SEO';
import FooterSEO from '../components/FooterSEO';
import MiseOnLogo from '../components/MiseOnLogo';
import LanguageToggle from '../components/LanguageToggle';
import { useI18n } from '../contexts/I18nContext';

interface BlogPostProps {
  forcedSlug?: string;
}

export default function BlogPost({ forcedSlug }: BlogPostProps) {
  const { t } = useI18n();
  const params = useParams<{ slug?: string }>();
  const slug = forcedSlug || params.slug || '';
  const post = BLOG_POSTS.find((p) => p.slug === slug);

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  const postsRelacionados = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);

  const schemaJson = [
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      'headline': post.title,
      'description': post.description,
      'image': 'https://miseon.app.br/icon-512.png',
      'author': {
        '@type': 'Person',
        'name': post.author.name,
        'jobTitle': post.author.role,
      },
      'publisher': {
        '@type': 'Organization',
        'name': 'MiseOn',
        'logo': 'https://miseon.app.br/icon-512.png',
      },
      'datePublished': post.publishedAt,
      'mainEntityOfPage': {
        '@type': 'WebPage',
        '@id': post.seo.canonicalUrl,
      },
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
          'name': 'Blog',
          'item': 'https://miseon.app.br/blog',
        },
        {
          '@type': 'ListItem',
          'position': 3,
          'name': post.title,
          'item': post.seo.canonicalUrl,
        },
      ],
    },
  ];

  const renderContent = (content: string) => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let listBuffer: string[] = [];

    const flushList = () => {
      if (listBuffer.length > 0) {
        elements.push(
          <ul key={`list-${elements.length}`} className="my-4 space-y-2.5 pl-2">
            {listBuffer.map((item, idx) => {
              const formatted = item.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
              return (
                <li key={idx} className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-slate-300">
                  <Check size={16} className="mt-0.5 shrink-0 text-[#FC5B24]" />
                  <span dangerouslySetInnerHTML={{ __html: formatted }} />
                </li>
              );
            })}
          </ul>
        );
        listBuffer = [];
      }
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      if (trimmed.startsWith('- ') || trimmed.startsWith('1. ') || trimmed.startsWith('2. ') || trimmed.startsWith('3. ') || trimmed.startsWith('4. ')) {
        const itemText = trimmed.replace(/^[-0-9.]+\s*/, '');
        listBuffer.push(itemText);
        return;
      }

      flushList();

      if (trimmed.startsWith('# ')) {
        elements.push(
          <h1 key={index} className="mt-8 mb-4 font-['Sora'] text-2xl font-extrabold text-gray-900 sm:text-3xl dark:text-white">
            {trimmed.replace('# ', '')}
          </h1>
        );
      } else if (trimmed.startsWith('## ')) {
        elements.push(
          <h2 key={index} className="mt-8 mb-4 font-['Sora'] text-xl font-bold text-gray-900 sm:text-2xl dark:text-white border-b border-gray-200/60 pb-2 dark:border-white/10">
            {trimmed.replace('## ', '')}
          </h2>
        );
      } else if (trimmed.startsWith('---')) {
        elements.push(<hr key={index} className="my-8 border-gray-200 dark:border-white/10" />);
      } else if (trimmed.length > 0) {
        const formatted = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        elements.push(
          <p key={index} className="my-4 text-base leading-relaxed text-gray-700 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: formatted }} />
        );
      }
    });

    flushList();
    return elements;
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] font-sans text-gray-900 selection:bg-[#FC5B24] selection:text-white dark:bg-[#070C18] dark:text-[#EAF1FB]">
      <SEO
        title={post.seo.title}
        description={post.seo.description}
        keywords={post.seo.keywords}
        canonicalUrl={post.seo.canonicalUrl}
        schemaJson={schemaJson}
      />

      {/* ══════════ 1. NAVBAR ══════════ */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-gray-200/70 bg-white/90 backdrop-blur-xl dark:border-white/10 dark:bg-[#070C18]/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" aria-label="MiseOn - Voltar ao início">
            <MiseOnLogo size={132} />
          </Link>
          <div className="flex items-center gap-4 text-sm font-semibold">
            <Link to="/blog" className="flex items-center gap-1 text-gray-600 hover:text-gray-900 dark:text-slate-300 dark:hover:text-white">
              <ArrowLeft size={16} /> {t('blog.voltarBlog')}
            </Link>
            <LanguageToggle variant="pill" />
            <Link to="/cadastre-se" className="rounded-full bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] px-5 py-2 text-xs font-bold text-white shadow-md">
              {t('nav.testar30d')}
            </Link>
          </div>
        </div>
      </nav>

      {/* ══════════ 2. HEADER DO ARTIGO ══════════ */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[#0B1120] via-[#0C1730] to-[#070C18] pb-16 pt-32 sm:pb-20 sm:pt-36 text-white">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-[#FC5B24]/20 border border-[#FC5B24]/40 px-3 py-1 text-xs font-bold text-orange-300">
              {post.category}
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-300">
              <Clock size={13} /> {post.readTime}
            </span>
          </div>

          <h1 className="mt-4 font-['Sora'] text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            {post.title}
          </h1>

          <p className="mt-4 text-base text-slate-300 leading-relaxed sm:text-lg">
            {post.description}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-between border-t border-white/10 pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FC5B24] text-white font-black text-sm">
                RM
              </div>
              <div>
                <p className="text-sm font-bold text-white">{post.author.name}</p>
                <p className="text-xs text-slate-400">{post.author.role}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Banner com Imagem de Capa em Alta Resolução */}
        <div className="mx-auto mt-8 max-w-4xl px-4 sm:px-6">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl">
            <img
              src={post.coverImage}
              alt={post.title}
              className="h-64 sm:h-96 w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/blog-covers/smart-tv-cover.jpg';
              }}
            />
          </div>
        </div>
      </header>

      {/* ══════════ 3. CORPO DO ARTIGO ══════════ */}
      <main className="py-12">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <article className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-10 dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-md">
            
            {/* Box de Resumo executivo */}
            <div className="mb-8 rounded-2xl border border-orange-500/20 bg-orange-500/5 p-5 text-gray-900 dark:text-slate-200">
              <p className="text-xs font-black uppercase tracking-wider text-[#FC5B24] flex items-center gap-1.5">
                <Bookmark size={14} /> {t('blog.resumoExecutivo')}
              </p>
              <p className="mt-2 text-sm leading-relaxed font-medium">
                {post.summary}
              </p>
            </div>

            {/* Conteúdo Renderizado */}
            <div className="prose max-w-none dark:prose-invert">
              {renderContent(post.content)}
            </div>

            {/* Tags */}
            <div className="mt-10 pt-6 border-t border-gray-200 dark:border-white/10 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-400 mr-2">Tags:</span>
              {post.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-white/10 dark:text-slate-300">
                  #{tag}
                </span>
              ))}
            </div>
          </article>

          {/* CTA DENTRO DO ARTIGO */}
          <div className="mt-10 rounded-3xl border border-orange-500/30 bg-gradient-to-br from-[#0B1120] via-[#0C1730] to-[#111a33] p-8 text-white shadow-2xl">
            <span className="inline-flex rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3.5 py-1 text-xs font-bold text-emerald-300">
              💡 Aplique esta engenharia no seu restaurante
            </span>
            <h3 className="mt-3 font-['Sora'] text-2xl font-bold">
              {t('blog.ctaTitulo')}
            </h3>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed max-w-2xl">
              {t('blog.ctaSub')}
            </p>
            <Link
              to="/cadastre-se"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#FC5B24] to-[#E34A1B] px-6 py-3 font-['Sora'] text-xs font-bold text-white shadow-lg transition hover:scale-105"
            >
              {t('blog.ctaBotao')} <ArrowRight size={15} />
            </Link>
          </div>

          {/* ARTIGOS RELACIONADOS */}
          <div className="mt-16">
            <h3 className="font-['Sora'] text-xl font-bold text-gray-900 dark:text-white mb-6">
              {t('blog.continueLendo')}
            </h3>
            <div className="grid gap-6 sm:grid-cols-3">
              {postsRelacionados.map((rel) => (
                <Link
                  key={rel.slug}
                  to={`/blog/${rel.slug}`}
                  className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md dark:border-white/10 dark:bg-white/5"
                >
                  <span className="text-[10px] font-bold text-[#FC5B24]">{rel.category}</span>
                  <h4 className="mt-2 font-['Sora'] text-sm font-bold text-gray-900 group-hover:text-[#FC5B24] dark:text-white line-clamp-2 transition-colors">
                    {rel.title}
                  </h4>
                  <span className="mt-4 flex items-center gap-1 text-xs font-bold text-[#FC5B24]">
                    {t('blog.lerArtigo')} <ArrowRight size={12} />
                  </span>
                </Link>
              ))}
            </div>
          </div>

        </div>
      </main>

      <FooterSEO />
    </div>
  );
}
