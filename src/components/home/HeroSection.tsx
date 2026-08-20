import { ArrowRight, LayoutDashboard, Play } from 'lucide-react';

import { useI18n } from '../../contexts/I18nContext';
export default function HeroSection() {
  const { tDynamic } = useI18n();
  return (
    <section className="relative overflow-hidden pb-32 pt-36 lg:pt-48">
      {/* Elementos de background orgânicos */}
      <div className="pointer-events-none absolute left-1/2 top-[-10%] h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(10,92,196,0.15)_0%,transparent_60%)] blur-3xl" />
      <div className="pointer-events-none absolute right-[-10%] top-[20%] h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(252,91,36,0.08)_0%,transparent_60%)] blur-3xl" />
      
      {/* Grid sutil de fundo para dar textura técnica */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="relative z-10 mx-auto max-w-6xl px-6 text-center">
        <div
          style={{ border: '1px solid rgba(10,92,196,0.3)', background: 'rgba(10,92,196,0.1)', color: '#4A90E2', fontFamily: "'Sora', sans-serif" }}
          className="mb-8 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold uppercase tracking-wider backdrop-blur-md"
        >
          <LayoutDashboard size={16} /> {tDynamic('O Sistema Operacional do seu Restaurante')}
        </div>

        <h1
          style={{ fontFamily: "'Sora', sans-serif", lineHeight: 1.15 }}
          className="mx-auto max-w-5xl text-5xl font-black tracking-tight sm:text-7xl text-white"
        >
          Orquestre todas as suas vendas{' '}
          <span style={{ backgroundImage: 'linear-gradient(135deg, #0A5CC4, #FC5B24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            em um único lugar.
          </span>
        </h1>

        <p style={{ color: 'rgba(234,241,251,0.7)' }} className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed sm:text-2xl font-medium">
          Loja Própria, iFood, Salão e Balcão. O MiseOn centraliza a sua operação inteira: do KDS na cozinha à gestão de ingredientes, até o dinheiro na sua conta. Pare de operar no caos e assuma o controle.
        </p>

        <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="/cadastre-se"
            style={{ background: '#0A5CC4', fontFamily: "'Sora', sans-serif", boxShadow: '0 8px 32px rgba(10,92,196,0.3)' }}
            className="group flex w-full items-center justify-center gap-2 rounded-full px-8 py-4 text-lg font-bold text-white transition-all hover:scale-105 hover:bg-blue-600 sm:w-auto"
          >
            Começar o Teste Gratuito <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
          </a>
          <a
            href="#demo"
            style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', fontFamily: "'Sora', sans-serif" }}
            className="group flex w-full items-center justify-center gap-2 rounded-full px-8 py-4 text-lg font-bold text-white transition-all hover:bg-white/10 sm:w-auto"
          >
            <Play size={20} className="text-gray-400 group-hover:text-white transition-colors" /> Ver na Prática
          </a>
        </div>

        {/* Showcase Vídeo Orgânico (Premium UX) */}
        <div id="demo" className="relative mx-auto mt-20 w-full max-w-5xl group perspective-1000">
          {/* Brilho atrás do frame */}
          <div className="absolute -inset-1 rounded-[2.5rem] bg-gradient-to-b from-[#0A5CC4]/40 to-[#FC5B24]/20 opacity-50 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
          
          <div style={{ transformStyle: 'preserve-3d' }} className="relative rounded-[2rem] border border-gray-800/80 bg-[#0A0F1C]/80 p-2 backdrop-blur-xl shadow-2xl transition-transform duration-700 hover:rotate-x-2">
            
            {/* Top Bar macOS Style */}
            <div className="flex h-12 items-center justify-between rounded-t-[1.5rem] border-b border-white/5 bg-white/5 px-4 backdrop-blur-md">
              <div className="flex gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500/80 shadow-sm" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/80 shadow-sm" />
                <div className="h-3 w-3 rounded-full bg-green-500/80 shadow-sm" />
              </div>
              <div className="flex flex-1 justify-center">
                <div className="flex h-6 items-center rounded-md bg-black/40 px-3 border border-white/10 shadow-inner">
                  <span className="text-[10px] font-medium text-gray-400 font-mono tracking-wide">app.miseon.com.br/dashboard</span>
                </div>
              </div>
              <div className="w-16" /> {/* Spacer */}
            </div>

            {/* Video Container */}
            <div className="relative overflow-hidden rounded-b-[1.5rem] bg-black">
              <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-[#070C18] via-transparent to-transparent opacity-60" />
              <video
                src="/videoIntro.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="h-auto w-full object-cover opacity-95 transition-transform duration-1000 ease-out group-hover:scale-[1.02]"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
