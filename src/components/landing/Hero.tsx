import { ArrowRight, MessageCircle, Flame, QrCode } from 'lucide-react';
import { Badge } from '../ui';
import { zap } from './zap';

import { useI18n } from '../../contexts/I18nContext';
/** Mockup em JSX: tela do KDS com cronômetros (baseado no painel real). */
function MockupKDS() {
  const { tDynamic } = useI18n();
  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border border-gray-800 bg-[#070C18] p-4">
      <div className="flex items-center justify-between border-b border-gray-800 pb-3">
        <div className="text-sm font-bold text-white">Cozinha · KDS</div>
        <div className="rounded bg-green-900/30 px-2 py-1 text-xs text-green-500">2 pedidos novos</div>
      </div>
      <div className="flex gap-3">
        <div className="flex-1 rounded-lg border border-orange-500/30 bg-gray-900/50 p-3">
          <div className="mb-2 text-xs font-bold text-orange-500">#1042 · PREPARANDO (04:12)</div>
          <div className="text-sm text-gray-300">1x Combo Smash Duplo</div>
          <div className="mt-1 text-xs text-gray-500">{tDynamic('Sem cebola, molho extra')}</div>
        </div>
        <div className="flex-1 rounded-lg border border-gray-800 bg-gray-900/50 p-3">
          <div className="mb-2 text-xs font-bold text-blue-500">#1043 · NOVO (00:45)</div>
          <div className="text-sm text-gray-300">2x Suco natural 500ml</div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  const { tDynamic } = useI18n();
  return (
    <section className="relative overflow-hidden pt-32 pb-20 lg:pt-44 lg:pb-28">
      {/* Glow orbs */}
      <div
        style={{ background: 'radial-gradient(circle, rgba(10,92,196,0.35) 0%, transparent 70%)', width: 700, height: 700, borderRadius: '50%', position: 'absolute', top: -200, left: '50%', transform: 'translateX(-60%)', pointerEvents: 'none' }}
      />
      <div
        style={{ background: 'radial-gradient(circle, rgba(252,91,36,0.18) 0%, transparent 70%)', width: 420, height: 420, borderRadius: '50%', position: 'absolute', top: 80, right: -120, pointerEvents: 'none' }}
      />

      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-14 px-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="text-center lg:text-left">
          <Badge tom="primario" className="mb-6 px-4 py-1.5 text-xs">
            <Flame size={12} /> {tDynamic('Cardápio digital + operação completa')}
          </Badge>

          <h1 style={{ fontFamily: "'Sora', sans-serif", lineHeight: 1.08 }} className="text-4xl font-extrabold tracking-tight sm:text-6xl">
            Do balcão à cozinha industrial,{' '}
            <span style={{ backgroundImage: 'linear-gradient(135deg, #FC5B24, #0A5CC4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              um sistema só.
            </span>
          </h1>

          <p style={{ color: 'rgba(234,241,251,0.65)' }} className="mx-auto mt-6 max-w-xl text-lg leading-relaxed lg:mx-0">
            Cardápio digital com a sua marca, pedidos em tempo real, KDS com cronômetro, PDV, mesas, entrega com rota ao vivo e estoque com ficha técnica. Pix e cartão caem direto na sua conta — sem comissão por pedido.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row lg:justify-start sm:justify-center">
            <a
              href="/cadastre-se"
              style={{ background: '#0A5CC4', fontFamily: "'Sora', sans-serif", boxShadow: '0 8px 32px rgba(10,92,196,0.5)' }}
              className="flex w-full items-center justify-center gap-2 rounded-full px-8 py-4 text-lg font-bold text-white transition hover:brightness-125 hover:scale-105 sm:w-auto"
            >
              {tDynamic('Testar grátis por 14 dias')} <ArrowRight size={20} />
            </a>
            <a
              href={zap('Olá! Quero ver o MiseOn funcionando no meu negócio.')}
              target="_blank"
              rel="noreferrer"
              style={{ border: '2px solid #22c55e', color: '#22c55e', background: 'rgba(34,197,94,0.08)', fontFamily: "'Sora', sans-serif" }}
              className="flex w-full items-center justify-center gap-2 rounded-full px-8 py-4 text-lg font-bold transition hover:bg-green-500/15 sm:w-auto"
            >
              <MessageCircle size={20} /> {tDynamic('Falar no WhatsApp')}
            </a>
          </div>

          <p style={{ color: 'rgba(234,241,251,0.4)' }} className="mt-4 text-sm font-medium">
            {tDynamic('Sem cartão de crédito · Cancele quando quiser')}
          </p>
        </div>

        {/* Visual: janela do admin + cartões flutuantes */}
        <div className="relative mx-auto w-full max-w-lg fade">
          <div className="flex h-[320px] flex-col overflow-hidden rounded-3xl border border-[rgba(10,92,196,0.3)] bg-[#070C18]/80 p-2 shadow-[0_0_50px_rgba(10,92,196,0.15)] backdrop-blur-xl sm:h-[360px]">
            <div className="flex items-center gap-2 rounded-t-2xl border-b border-gray-800 bg-black/40 px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-red-500/80" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
              <div className="h-3 w-3 rounded-full bg-green-500/80" />
              <div className="ml-4 font-mono text-xs text-gray-500">miseon.com/admin/kds</div>
            </div>
            <div className="flex-1 bg-black/20 p-4">
              <MockupKDS />
            </div>
          </div>

          {/* Pix recebido */}
          <div className="landing-float absolute -bottom-6 -left-4 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-[#0B1120]/95 px-4 py-3 shadow-xl backdrop-blur sm:-left-8">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <QrCode size={18} />
            </div>
            <div>
              <div className="text-xs text-gray-400">{tDynamic('Pix recebido na sua conta')}</div>
              <div className="text-sm font-extrabold text-emerald-400">+ R$ 38,90</div>
            </div>
          </div>

          {/* Entrega a caminho */}
          <div className="landing-float-delay absolute -top-5 -right-3 flex items-center gap-3 rounded-2xl border border-[rgba(252,91,36,0.35)] bg-[#0B1120]/95 px-4 py-3 shadow-xl backdrop-blur sm:-right-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(252,91,36,0.15)] text-[#FC5B24]">
              <Flame size={18} />
            </div>
            <div>
              <div className="text-xs text-gray-400">Entrega #1042</div>
              <div className="text-sm font-extrabold text-white">A caminho · 2 min</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
