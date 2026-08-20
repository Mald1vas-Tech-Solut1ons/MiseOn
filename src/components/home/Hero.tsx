import { ArrowRight, Zap } from 'lucide-react';

import { useI18n } from '../../contexts/I18nContext';
export function Hero() {
  const { tDynamic } = useI18n();
  return (
    <section className="relative overflow-hidden pb-24 pt-36 lg:pb-32 lg:pt-48">
      <div style={{ background: 'radial-gradient(circle, rgba(10,92,196,0.35) 0%, transparent 70%)', width: 700, height: 700, borderRadius: '50%', position: 'absolute', top: -200, left: '50%', transform: 'translateX(-60%)', pointerEvents: 'none' }} />
      <div style={{ background: 'radial-gradient(circle, rgba(252,91,36,0.2) 0%, transparent 70%)', width: 400, height: 400, borderRadius: '50%', position: 'absolute', top: 50, right: -100, pointerEvents: 'none' }} />

      <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">
        <div
          style={{ border: '1px solid rgba(252,91,36,0.4)', background: 'rgba(252,91,36,0.1)', color: '#FC5B24', fontFamily: "'Sora', sans-serif" }}
          className="mb-8 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold uppercase tracking-wider"
        >
          <Zap size={14} className="fill-current" /> {tDynamic('Sistema completo para bares e restaurantes')}
        </div>

        <h1
          style={{ fontFamily: "'Sora', sans-serif", lineHeight: 1.1 }}
          className="mx-auto max-w-4xl text-5xl font-extrabold tracking-tight sm:text-7xl"
        >
          O marketplace fica com 27% do seu lanche.{' '}
          <span style={{ backgroundImage: 'linear-gradient(135deg, #FC5B24, #0A5CC4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            {tDynamic('A gente fica com 0%.')}
          </span>
        </h1>

        <p style={{ color: 'rgba(234,241,251,0.65)' }} className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
          Cardápio próprio, PDV, mesas, cozinha, entregas, estoque, nota fiscal, financeiro
          e <b>inteligência artificial atendendo seu cliente</b> — tudo em um sistema só,
          por <b>mensalidade fixa</b>. Sem comissão por pedido. Sem pegadinha.
        </p>

        <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="/cadastre-se"
            style={{ background: '#0A5CC4', fontFamily: "'Sora', sans-serif", boxShadow: '0 8px 32px rgba(10,92,196,0.5)' }}
            className="flex w-full items-center justify-center gap-2 rounded-full px-8 py-4 text-lg font-bold text-white transition hover:scale-105 hover:brightness-125 sm:w-auto"
          >
            {tDynamic('Testar 14 dias grátis')} <ArrowRight size={20} />
          </a>
          <a
            href="/natureba"
            style={{ border: '2px solid rgba(252,91,36,0.5)', color: '#FC5B24', background: 'rgba(252,91,36,0.08)', fontFamily: "'Sora', sans-serif" }}
            className="flex w-full items-center justify-center gap-2 rounded-full px-8 py-4 text-lg font-bold transition hover:bg-orange-500/20 sm:w-auto"
          >
            {tDynamic('Ver loja de exemplo')}
          </a>
        </div>

        <p style={{ color: 'rgba(234,241,251,0.4)' }} className="mt-5 text-sm font-medium">
          {tDynamic('Sem cartão de crédito · Sem fidelidade · Cancele quando quiser')}
        </p>

        {/* Barra de métricas — prova executiva logo no primeiro scroll */}
        <div className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { valor: '0%', label: 'comissão por pedido' },
            { valor: '27%', label: 'que o marketplace leva' },
            { valor: '24h', label: 'IA atendendo seu cliente' },
            { valor: '14', label: 'dias grátis p/ testar' },
          ].map((m) => (
            <div key={m.label} style={{ border: '1px solid rgba(255,255,255,.09)', background: 'rgba(255,255,255,.02)' }} className="rounded-2xl px-4 py-4">
              <p style={{ fontFamily: "'Sora', sans-serif" }} className="text-2xl font-extrabold text-white">{m.valor}</p>
              <p className="mt-1 text-[11px] font-medium text-gray-500">{m.label}</p>
            </div>
          ))}
        </div>

        {/* Vídeo Showcase Hero */}
        <div className="relative mx-auto mt-16 w-full max-w-4xl">
          <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-[#070C18] via-transparent to-[#070C18] opacity-80" />
          <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-r from-[#070C18] via-transparent to-[#070C18] opacity-80" />
          <video
            src="/videoIntro.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="h-auto w-full object-contain opacity-90 mix-blend-screen"
            style={{ maskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)' }}
          />
        </div>
      </div>
    </section>
  );
}
