import { useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Play, Pause, Volume2, VolumeX, Maximize2, Sparkles, Video, Star, Quote, CheckCircle2 } from 'lucide-react';
import { FooterSEO } from '../components/FooterSEO';
import MiseOnLogo from '../components/MiseOnLogo';
import LanguageToggle from '../components/LanguageToggle';
import SEO from '../components/SEO';
import { PAGE_META } from '../data/pageMeta';
import { useI18n } from '../contexts/I18nContext';

interface VideoItem {
  id: string;
  titulo: string;
  subtitulo: string;
  descricao: string;
  categoria: 'marca' | 'demonstracao' | 'depoimento' | 'case';
  // Vídeo autohospedado (arquivo em public/): usa `src`.
  // Vídeo hospedado no canal do YouTube (a partir de agora, o padrão para
  // conteúdo novo — soma view/inscrito no canal, entra na busca de vídeo do
  // Google e não pesa no carregamento do site): usa `youtubeId`.
  src?: string;
  youtubeId?: string;
  duracao: string;
  destaque?: boolean;
  autor?: string;
  cargo?: string;
  estabelecimento?: string;
  avatar?: string;
}

const youtubeThumbnail = (youtubeId: string) => `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
const youtubeEmbedUrl = (youtubeId: string) => `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0`;
const youtubeWatchUrl = (youtubeId: string) => `https://www.youtube.com/watch?v=${youtubeId}`;

const VIDEOS: VideoItem[] = [
  {
    id: 'brand-identity',
    titulo: 'Identidade & Ecossistema MiseOn',
    subtitulo: 'A revolução visual e operacional para Food Service',
    descricao: 'Conheça o conceito, o rigor de engenharia da Maldivas Tech e o design state-of-the-art por trás da plataforma MiseOn.',
    categoria: 'marca',
    src: '/MiseOn%20brand%20identity/videoIntro1.mp4',
    duracao: 'Vídeo Oficial',
    destaque: true,
    autor: 'Rafael Maldivas',
    cargo: 'Head de Engenharia & Produto',
    estabelecimento: 'MiseOn Tecnologia',
  },
  {
    id: 'demo-pdv-kds',
    titulo: 'Demonstração do PDV & KDS em Tempo Real',
    subtitulo: 'Do pedido na mesa até a expedição na cozinha',
    descricao: 'Veja como o fluxo contínuo sem travamento conecta o salão, o caixa e a linha de produção do restaurante.',
    categoria: 'demonstracao',
    src: '/videoIntro.mp4',
    duracao: 'Demonstração Prática',
  },
  {
    id: 'demo-ifood-integracao',
    titulo: 'Integração Nativa com iFood',
    subtitulo: 'Sincronização instantânea de cardápio e estoque',
    descricao: 'Acompanhe a chegada dos pedidos do iFood direto no KDS da cozinha, com impressão automática e baixa de estoque.',
    categoria: 'demonstracao',
    src: '/videoMarketing.mp4',
    duracao: 'Recurso em Ação',
  },
  {
    id: 'demo-whatsapp-ia',
    titulo: 'Atendimento Inteligente no WhatsApp com IA',
    subtitulo: 'Atenda clientes automaticamente 24 horas por dia',
    descricao: 'Como a IA do MiseOn conversa com o cliente no WhatsApp, tira dúvidas do cardápio e gera pedidos com pagamento automático.',
    categoria: 'demonstracao',
    src: '/videomarketing2.mp4',
    duracao: 'Visão Geral',
  },
  {
    id: 'case-1',
    titulo: 'Pare de Perder Pedidos no WhatsApp | MiseOn Case #1',
    subtitulo: 'O primeiro de uma série de cases reais de uso do MiseOn',
    descricao: 'Case #1 da série MiseOn: como o atendimento por WhatsApp com IA evita pedido perdido e organiza o fluxo da cozinha.',
    categoria: 'case',
    youtubeId: '0ZP6ZQ7wvVA',
    duracao: 'Case #1',
    destaque: true,
  },
];

const DEPOIMENTOS_FUTUROS = [
  {
    nome: 'Empresários e Chefs parceiros',
    restaurante: 'Depoimentos de Clientes SaaS em Breve',
    frase: 'Estamos colhendo histórias de sucesso de restaurantes, pizzarias e hamburguerias em todo o Brasil. Seu depoimento poderá estar aqui!',
    badge: 'Histórias Reais de Sucesso',
  },
];

export default function Videos() {
  const { t, tDynamic } = useI18n();
  // /videos, /depoimentos e /demonstracao renderizam este mesmo componente.
  // Título varia por rota para intenção de busca distinta, mas o canonical
  // sempre aponta para /videos — evita conteúdo duplicado nos três URLs.
  const location = useLocation();
  const meta = PAGE_META[location.pathname] ?? PAGE_META['/videos'];
  const [categoriaAtiva, setCategoriaAtiva] = useState<'todos' | 'marca' | 'demonstracao' | 'depoimento' | 'case'>('todos');
  const [videoAtivo, setVideoAtivo] = useState<VideoItem>(VIDEOS[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const fullScreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const selecionarVideo = (v: VideoItem) => {
    setVideoAtivo(v);
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.load();
      setTimeout(() => {
        videoRef.current?.play();
        setIsPlaying(true);
      }, 150);
    }
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  const filtrados = VIDEOS.filter((v) => categoriaAtiva === 'todos' || v.categoria === categoriaAtiva);

  return (
    <div className="min-h-screen bg-[#070C18] text-slate-100 font-sans selection:bg-orange-500 selection:text-white">
      <SEO {...meta} />
      {/* Schema.org Structured Data (JSON-LD) para SEO dos Vídeos */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'VideoObject',
            name: videoAtivo.titulo,
            description: videoAtivo.descricao,
            thumbnailUrl: videoAtivo.youtubeId
              ? youtubeThumbnail(videoAtivo.youtubeId)
              : 'https://miseon.app.br/MISEON-logo.png',
            uploadDate: '2026-07-24',
            contentUrl: videoAtivo.youtubeId
              ? youtubeWatchUrl(videoAtivo.youtubeId)
              : `https://miseon.app.br${videoAtivo.src}`,
            embedUrl: videoAtivo.youtubeId
              ? youtubeEmbedUrl(videoAtivo.youtubeId)
              : 'https://miseon.app.br/videos',
            publisher: {
              '@type': 'Organization',
              name: 'MiseOn Tecnologia',
              logo: {
                '@type': 'ImageObject',
                url: 'https://miseon.app.br/MISEON-logo.png',
              },
            },
          }),
        }}
      />

      {/* Header / Navegação Superior */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#070C18]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link to="/" className="transition hover:opacity-90">
              <MiseOnLogo size={130} />
            </Link>
            <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
              <Link to="/" className="transition hover:text-white">{t('nav.home')}</Link>
              <Link to="/sobre" className="transition hover:text-white">{tDynamic('Sobre Nós')}</Link>
              <Link to="/videos" className="text-orange-400 font-bold border-b-2 border-orange-500 pb-1">{t('nav.videos')}</Link>
              <Link to="/contato" className="transition hover:text-white">{tDynamic('Contato')}</Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <LanguageToggle variant="pill" />
            <Link
              to="/acesso"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800 transition"
            >
              {t('nav.entrar')}
            </Link>
            <Link
              to="/cadastre-se"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-orange-500/20 hover:scale-105 transition-all"
            >
              {t('nav.cadastrar')}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-8 text-center">
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-orange-500/15 blur-[120px]" />
        
        <div className="relative mx-auto max-w-4xl px-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 text-xs font-bold text-orange-400 backdrop-blur-md mb-6">
            <Sparkles size={14} /> {tDynamic('Galeria Oficial de Vídeos & Demonstrações')}
          </div>

          <h1 className="font-['Sora'] text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            {tDynamic('MiseOn em Ação: Assista e Comprove')}
          </h1>
          <p className="mt-4 text-base text-slate-300 sm:text-lg max-w-2xl mx-auto leading-relaxed">
            {tDynamic('Veja como a nossa arquitetura de software transforma a operação de restaurantes, lanchonetes e deliveries com velocidade, inteligência de margem e estabilidade.')}
          </p>
        </div>
      </section>

      {/* Reprodutor de Vídeo Principal (Player Destaque) */}
      <section className="mx-auto max-w-5xl px-4 py-6">
        <div className="relative overflow-hidden rounded-3xl border border-slate-700/80 bg-slate-900/90 shadow-2xl shadow-orange-950/20">
          
          {/* Player: vídeo autohospedado usa <video> com controles próprios;
              vídeo do YouTube usa o iframe oficial embed (controles nativos
              do YouTube — não dá pra pilotar play/pause/mute de um iframe
              cross-origin via videoRef, então essa reprodução não passa pela
              barra de controle flutuante abaixo). */}
          <div className="relative aspect-video w-full bg-black">
            {videoAtivo.youtubeId ? (
              <iframe
                key={videoAtivo.youtubeId}
                src={youtubeEmbedUrl(videoAtivo.youtubeId)}
                title={videoAtivo.titulo}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <video
                ref={videoRef}
                src={videoAtivo.src}
                className="h-full w-full object-contain"
                playsInline
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
              />
            )}

            {/* Overlay de Controle de Play Inicial (só no player autohospedado) */}
            {!videoAtivo.youtubeId && !isPlaying && (
              <div
                onClick={togglePlay}
                className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/40 backdrop-blur-[2px] transition hover:bg-black/30"
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-orange-500 text-white shadow-2xl shadow-orange-500/50 transition-transform duration-300 hover:scale-110">
                  <Play size={36} className="ml-1 fill-white" />
                </div>
              </div>
            )}

            {/* Floating Control Bar (só no player autohospedado) */}
            {!videoAtivo.youtubeId && (
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 flex items-center justify-between text-white opacity-90 hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  className="rounded-lg p-2 hover:bg-white/20 transition text-white"
                  title={isPlaying ? 'Pausar' : 'Reproduzir'}
                >
                  {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                </button>
                <button
                  onClick={toggleMute}
                  className="rounded-lg p-2 hover:bg-white/20 transition text-white"
                  title={isMuted ? 'Ativar som' : 'Mudar para mudo'}
                >
                  {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <span className="text-xs font-semibold text-slate-300">{videoAtivo.duracao}</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-orange-400 bg-orange-500/20 px-2.5 py-1 rounded-full border border-orange-500/30">
                  MiseOn HD 1080p
                </span>
                <button
                  onClick={fullScreen}
                  className="rounded-lg p-2 hover:bg-white/20 transition text-white"
                  title="Tela cheia"
                >
                  <Maximize2 size={20} />
                </button>
              </div>
            </div>
            )}
          </div>

          {/* Detalhes do Vídeo Ativo */}
          <div className="p-6 sm:p-8 bg-gradient-to-b from-slate-900 to-[#0B132B]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-orange-400">
                  <Video size={14} />{' '}
                  {videoAtivo.categoria === 'marca'
                    ? 'Vídeo Oficial de Apresentação'
                    : videoAtivo.categoria === 'case'
                    ? 'Case de Cliente'
                    : 'Demonstração de Produto'}
                </span>
                <h2 className="font-['Sora'] mt-1 text-xl font-bold text-white sm:text-2xl">
                  {videoAtivo.titulo}
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-300">
                  {videoAtivo.subtitulo}
                </p>
              </div>

              <Link
                to="/cadastre-se"
                className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 transition"
              >
                {tDynamic('Testar o MiseOn na Prática')}
              </Link>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-slate-400 border-t border-slate-800 pt-4">
              {videoAtivo.descricao}
            </p>
          </div>
        </div>
      </section>

      {/* Seletor de Categorias e Lista de Vídeos */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <div>
            <h3 className="font-['Sora'] text-2xl font-bold text-white">
              {tDynamic('Explore Todos os Vídeos')}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {tDynamic('Assista ao tour das telas, recursos do PDV, KDS e módulo fiscal.')}
            </p>
          </div>

          <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800">
            {[
              { id: 'todos', label: 'Todos os Vídeos' },
              { id: 'marca', label: 'Marca & Conceito' },
              { id: 'demonstracao', label: 'Demonstrações' },
              { id: 'case', label: 'Cases de Clientes' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoriaAtiva(cat.id as any)}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  categoriaAtiva === cat.id
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid de Vídeos */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((v) => (
            <div
              key={v.id}
              onClick={() => selecionarVideo(v)}
              className={`group cursor-pointer overflow-hidden rounded-2xl border transition-all duration-300 ${
                videoAtivo.id === v.id
                  ? 'border-orange-500 bg-slate-800/90 ring-2 ring-orange-500/20'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/60'
              }`}
            >
              {/* Miniatura: vídeo local usa preview em loop no hover; vídeo do
                  YouTube usa a thumbnail estática oficial (o iframe embed não
                  expõe o arquivo bruto pra tocar em preview) */}
              <div className="relative aspect-video w-full overflow-hidden bg-slate-950">
                {v.youtubeId ? (
                  <img
                    src={youtubeThumbnail(v.youtubeId)}
                    alt={v.titulo}
                    loading="lazy"
                    className="h-full w-full object-cover opacity-80 group-hover:scale-105 group-hover:opacity-100 transition-all duration-500"
                  />
                ) : (
                  <video
                    src={v.src}
                    muted
                    loop
                    playsInline
                    onMouseOver={(e) => (e.currentTarget as HTMLVideoElement).play()}
                    onMouseOut={(e) => {
                      const vid = e.currentTarget as HTMLVideoElement;
                      vid.pause();
                      vid.currentTime = 0;
                    }}
                    className="h-full w-full object-cover opacity-80 group-hover:scale-105 group-hover:opacity-100 transition-all duration-500"
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/90 text-white shadow-lg group-hover:scale-110 transition">
                    <Play size={22} className="ml-0.5 fill-white" />
                  </div>
                </div>
                <span className="absolute bottom-2 right-2 rounded bg-black/80 px-2 py-0.5 text-[10px] font-bold text-slate-300 backdrop-blur-sm">
                  {v.duracao}
                </span>
              </div>

              {/* Informações do Card */}
              <div className="p-5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400">
                  {v.categoria === 'marca'
                    ? 'Identidade Institucional'
                    : v.categoria === 'case'
                    ? 'Case de Cliente'
                    : 'Demonstração'}
                </span>
                <h4 className="font-['Sora'] mt-1 text-base font-bold text-white group-hover:text-orange-400 transition">
                  {v.titulo}
                </h4>
                <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                  {v.descricao}
                </p>
                <div className="mt-4 flex items-center justify-between text-xs font-semibold text-orange-400 group-hover:translate-x-1 transition-transform">
                  <span>Assistir agora →</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Seção Futura: Depoimentos de Usuários do SaaS */}
      <section className="border-t border-slate-800 bg-[#060A14] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1 text-xs font-bold text-emerald-400 mb-3">
              <Star size={14} className="fill-emerald-400" /> {tDynamic('Depoimentos &amp; Histórias de Clientes')}
            </div>
            <h2 className="font-['Sora'] text-3xl font-extrabold text-white">
              {tDynamic('O Que Dizem os Restaurantes Parceiros')}
            </h2>
            <p className="mt-3 text-sm text-slate-400">
              {tDynamic('Estamos gravando novos depoimentos em vídeo de proprietários e gestores que usam o MiseOn no seu dia a dia.')}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {DEPOIMENTOS_FUTUROS.concat([
              {
                nome: 'Hamburguerias e Lanchonetes',
                restaurante: 'Agilidade no Salão e no Delivery',
                frase: 'Zero fila de espera, pedidos integrados no WhatsApp e balcão funcionando sem quedas na hora do pico.',
                badge: 'Alta Performance',
              },
              {
                nome: 'Pizzarias e Restaurantes',
                restaurante: 'KDS & Produção sem papel',
                frase: 'Passagem de bastão precisa entre as etapas do forno e expedição, eliminando erros de cozinha.',
                badge: 'Eficiência Operacional',
              },
            ]).map((dep, idx) => (
              <div key={idx} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 relative">
                <Quote size={32} className="text-slate-800 absolute top-4 right-4" />
                <span className="inline-block rounded-full bg-slate-800 px-3 py-1 text-[10px] font-bold text-orange-400 mb-4">
                  {dep.badge}
                </span>
                <p className="text-xs text-slate-300 leading-relaxed italic mb-6">
                  "{dep.frase}"
                </p>
                <div className="flex items-center gap-3 border-t border-slate-800 pt-4">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center font-bold text-white text-sm">
                    M
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{dep.nome}</p>
                    <p className="text-[11px] text-slate-400">{dep.restaurante}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Banner Chamada para Clientes gravarem depoimento */}
          <div className="mt-12 rounded-3xl border border-orange-500/30 bg-gradient-to-r from-orange-950/40 via-slate-900 to-slate-900 p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="font-['Sora'] text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="text-orange-400" size={20} /> {tDynamic('É cliente MiseOn e quer aparecer aqui?')}
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                {tDynamic('Grave um vídeo sobre a experiência da sua loja com o MiseOn e ganhe destaque oficial no nosso portal.')}
              </p>
            </div>
            <Link
              to="/contato"
              className="shrink-0 rounded-xl bg-orange-500 px-6 py-3 text-xs font-bold text-white hover:bg-orange-600 transition"
            >
              {tDynamic('Falar com Nossa Equipe')}
            </Link>
          </div>
        </div>
      </section>

      {/* Credibilidade E-E-A-T & Footer */}
      <FooterSEO />
    </div>
  );
}
