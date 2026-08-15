import { useState } from 'react';
import { RotateCw, CheckCircle2, ArrowRight, type LucideIcon } from 'lucide-react';

export interface FlipCardProps {
  icone: LucideIcon;
  titulo: string;
  resumo: string;
  detalhes: string[];
  metrica: string;
  badge: string;
  corTexto: string;
  corFundo: string;
  corBorda: string;
  linkCta?: string;
}

export default function FlipCard({
  icone: Icon,
  titulo,
  resumo,
  detalhes,
  metrica,
  badge,
  corTexto,
  corFundo,
  corBorda,
  linkCta = '/cadastre-se',
}: FlipCardProps) {
  const [virado, setVirado] = useState(false);

  return (
    <div
      className="group relative h-80 w-full [perspective:1000px] cursor-pointer"
      onClick={() => setVirado(!virado)}
      onMouseEnter={() => setVirado(true)}
      onMouseLeave={() => setVirado(false)}
    >
      <div
        className={`relative h-full w-full rounded-3xl transition-all duration-700 [transform-style:preserve-3d] ${
          virado ? '[transform:rotateY(180deg)]' : ''
        }`}
      >
        {/* ══════════ FRENTE DO CARD (0deg) ══════════ */}
        <div
          className={`absolute inset-0 flex flex-col justify-between rounded-3xl border ${corBorda} ${corFundo} p-6 backdrop-blur-xl shadow-xl [backface-visibility:hidden]`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ${corTexto} shadow-inner`}>
                <Icon size={26} />
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white/90 border border-white/10">
                {badge}
              </span>
            </div>

            <h3 className="font-['Sora'] text-xl font-black tracking-tight text-white">
              {titulo}
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
              {resumo}
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-white/10 pt-3">
            <span className="text-[11px] font-bold text-orange-400 flex items-center gap-1">
              <RotateCw size={12} className="animate-spin" /> Virar card para detalhes
            </span>
            <span className="font-['Sora'] text-xs font-black text-white">{metrica}</span>
          </div>
        </div>

        {/* ══════════ VERSO DO CARD (180deg) ══════════ */}
        <div
          className="absolute inset-0 flex flex-col justify-between rounded-3xl border border-orange-500/40 bg-gradient-to-br from-[#0F172A] via-[#070C18] to-[#1E293B] p-6 text-white shadow-2xl [backface-visibility:hidden] [transform:rotateY(180deg)]"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-orange-400 flex items-center gap-1">
                <Icon size={14} /> REGRAS DE NEGÓCIO
              </span>
              <span className="text-[11px] font-mono font-bold text-emerald-400">{metrica}</span>
            </div>

            <h4 className="font-['Sora'] text-sm font-bold text-white">
              {titulo}
            </h4>

            <ul className="space-y-2">
              {detalhes.map((detalhe, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-300 leading-tight">
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-400" />
                  <span>{detalhe}</span>
                </li>
              ))}
            </ul>
          </div>

          <a
            href={linkCta}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#FC5B24] py-2.5 text-xs font-black text-white shadow-lg shadow-[#FC5B24]/30 hover:brightness-110 transition-all mt-2"
            onClick={(e) => e.stopPropagation()}
          >
            Ativar Módulo <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
