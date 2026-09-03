import React, { useEffect, useState, useRef } from 'react';
import { Compass, X, ArrowRight, ArrowLeft, Sparkles, CheckCircle2, MapPin } from 'lucide-react';
import { TourStep, TOUR_STEPS } from '../../hooks/useGuidedTour';
import { useI18n } from '../../contexts/I18nContext';

interface GuidedTourModalProps {
  ativo: boolean;
  passoAtual: TourStep | null;
  passoIndex: number;
  totalPassos: number;
  targetElement: HTMLElement | null;
  onProximo: () => void;
  onAnterior: () => void;
  onEncerrar: () => void;
}

interface RectPos {
  top: number;
  left: number;
  width: number;
  height: number;
}

// Agrupa os passos em módulos por rota para exibir a trilha de capítulos
const MODULOS = (() => {
  const visto = new Set<string>();
  return TOUR_STEPS.reduce<{ rota: string; label: string; labelEn: string; inicio: number; fim: number }[]>((acc, step, idx) => {
    if (!visto.has(step.rota)) {
      visto.add(step.rota);
      // Encontrar o label do módulo pela categoria do primeiro passo daquela rota
      const categoriaBase = step.categoria.replace(/\d+\.\s*/, '').split('(')[0].trim();
      const categoriaEnBase = step.categoriaEn.replace(/\d+\.\s*/, '').split('(')[0].trim();
      acc.push({ rota: step.rota, label: categoriaBase, labelEn: categoriaEnBase, inicio: idx, fim: idx });
    } else {
      acc[acc.length - 1].fim = idx;
    }
    return acc;
  }, []);
})();

export function GuidedTourModal({
  ativo,
  passoAtual,
  passoIndex,
  totalPassos,
  targetElement,
  onProximo,
  onAnterior,
  onEncerrar,
}: GuidedTourModalProps) {
  const { tDynamic, idioma } = useI18n();
  const [targetRect, setTargetRect] = useState<RectPos | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const isEn = idioma === 'en-US';

  // Atualizar posição do spotlight em tempo real
  useEffect(() => {
    if (!ativo || !targetElement) {
      setTargetRect(null);
      return;
    }

    const atualizarPosicao = () => {
      const rect = targetElement.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };

    atualizarPosicao();
    window.addEventListener('resize', atualizarPosicao);
    window.addEventListener('scroll', atualizarPosicao, true);

    return () => {
      window.removeEventListener('resize', atualizarPosicao);
      window.removeEventListener('scroll', atualizarPosicao, true);
    };
  }, [ativo, targetElement, passoAtual]);

  // Medir altura real do card para posicionamento perfeito sem cortar no viewport
  const [cardRealHeight, setCardRealHeight] = useState<number>(460);

  useEffect(() => {
    if (cardRef.current) {
      const h = cardRef.current.getBoundingClientRect().height;
      if (h > 0) setCardRealHeight(h);
    }
  }, [passoIndex, targetRect]);

  if (!ativo || !passoAtual) return null;

  const pctProgresso = Math.round(((passoIndex + 1) / totalPassos) * 100);

  // Módulo atual
  const moduloAtual = MODULOS.find((m) => passoIndex >= m.inicio && passoIndex <= m.fim);

  // Conteúdo no idioma correto
  const categoria = isEn ? passoAtual.categoriaEn : passoAtual.categoria;
  const titulo = isEn ? passoAtual.tituloEn : passoAtual.titulo;
  const descricao = isEn ? passoAtual.descricaoEn : passoAtual.descricao;
  const dicaExtra = isEn ? passoAtual.dicaExtraEn : passoAtual.dicaExtra;

  // Passos do módulo atual para os dots
  const passosDoModulo = TOUR_STEPS.filter((s) => s.rota === passoAtual.rota);
  const passoIndexNoModulo = passosDoModulo.findIndex((s) => s.id === passoAtual.id);

  // ── Posicionamento Inteligente do Card ──────────────────────────────────
  const cardWidth = Math.min(520, window.innerWidth * 0.94);
  const heightParaCalc = Math.min(cardRealHeight, window.innerHeight - 32);

  let finalTop = (window.innerHeight - heightParaCalc) / 2;
  let finalLeft = (window.innerWidth - cardWidth) / 2;

  if (targetRect) {
    const targetRight = targetRect.left + targetRect.width;
    const targetBottom = targetRect.top + targetRect.height;

    const espacoDireita = window.innerWidth - targetRight;
    const espacoEsquerda = targetRect.left;
    const espacoAbaixo = window.innerHeight - targetBottom;
    const espacoAcima = targetRect.top;

    if (espacoAbaixo >= heightParaCalc + 24) {
      finalTop = targetBottom + 16;
      finalLeft = Math.max(16, Math.min(window.innerWidth - cardWidth - 16, targetRect.left));
    } else if (espacoAcima >= heightParaCalc + 24) {
      finalTop = targetRect.top - heightParaCalc - 16;
      finalLeft = Math.max(16, Math.min(window.innerWidth - cardWidth - 16, targetRect.left));
    } else if (espacoDireita >= cardWidth + 24) {
      finalLeft = targetRight + 16;
      finalTop = Math.max(16, Math.min(window.innerHeight - heightParaCalc - 16, targetRect.top));
    } else if (espacoEsquerda >= cardWidth + 24) {
      finalLeft = targetRect.left - cardWidth - 16;
      finalTop = Math.max(16, Math.min(window.innerHeight - heightParaCalc - 16, targetRect.top));
    } else {
      // Se não couber ao redor, joga para o quadrante oposto do target para NUNCA cobri-lo
      finalTop = targetRect.top > window.innerHeight / 2 ? 16 : window.innerHeight - heightParaCalc - 16;
      finalLeft = targetRect.left > window.innerWidth / 2 ? 16 : window.innerWidth - cardWidth - 16;
    }
  }

  // TRAVA DE SEGURANÇA ABSOLUTA: Garante que o card NUNCA saia da tela (topo ou rodapé)
  finalTop = Math.max(16, Math.min(window.innerHeight - heightParaCalc - 16, finalTop));
  finalLeft = Math.max(16, Math.min(window.innerWidth - cardWidth - 16, finalLeft));

  const cardEstilo: React.CSSProperties = {
    position: 'fixed',
    zIndex: 99999,
    top: `${finalTop}px`,
    left: `${finalLeft}px`,
    width: `${cardWidth}px`,
    maxHeight: `${Math.max(280, window.innerHeight - finalTop - 16)}px`,
  };

  const isUltimoPasso = passoIndex === totalPassos - 1;

  return (
    <div className="fixed inset-0 z-[99990] pointer-events-auto">

      {/* ── STYLE TAG PARA ANIMAÇÕES DO TOUR ── */}
      <style>{`
        @keyframes tour-spotlight-pulse {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 0.92; }
        }
        @keyframes tour-ring-pulse {
          0% { box-shadow: 0 0 0 0 rgba(249,115,22,0.9), 0 0 35px rgba(249,115,22,0.7); }
          70% { box-shadow: 0 0 0 12px rgba(249,115,22,0), 0 0 35px rgba(249,115,22,0.5); }
          100% { box-shadow: 0 0 0 0 rgba(249,115,22,0), 0 0 35px rgba(249,115,22,0.7); }
        }
        @keyframes tour-card-in {
          0% { opacity: 0; transform: scale(0.93) translateY(8px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes tour-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .tour-card-animate {
          animation: tour-card-in 0.22s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .tour-shimmer-line {
          animation: tour-shimmer 2.5s ease-in-out infinite;
        }
      `}</style>

      {/* ── SPOTLIGHT OVERLAY ── */}
      {targetRect ? (
        <>
          {/* Vignette escura em SVG com máscara de recorte */}
          <svg
            className="fixed inset-0 w-screen h-screen pointer-events-none z-[99991]"
            style={{ animation: 'tour-spotlight-pulse 3s ease-in-out infinite' }}
          >
            <defs>
              <mask id="tour-spotlight-mask">
                <rect x="0" y="0" width="100vw" height="100vh" fill="white" />
                <rect
                  x={targetRect.left - 10}
                  y={targetRect.top - 10}
                  width={targetRect.width + 20}
                  height={targetRect.height + 20}
                  rx="20"
                  fill="black"
                />
              </mask>
              <radialGradient id="tour-vignette" cx="50%" cy="50%" r="70%">
                <stop offset="0%" stopColor="rgba(3,7,18,0.78)" />
                <stop offset="100%" stopColor="rgba(3,7,18,0.92)" />
              </radialGradient>
            </defs>
            <rect
              x="0" y="0" width="100vw" height="100vh"
              fill="url(#tour-vignette)"
              mask="url(#tour-spotlight-mask)"
            />
          </svg>

          {/* Anel pulsante em volta do elemento */}
          <div
            className="fixed pointer-events-none z-[99992] rounded-[20px]"
            style={{
              top: targetRect.top - 10,
              left: targetRect.left - 10,
              width: targetRect.width + 20,
              height: targetRect.height + 20,
              border: '2px solid rgba(249,115,22,0.9)',
              animation: 'tour-ring-pulse 1.8s cubic-bezier(0.24, 0, 0.38, 1) infinite',
            }}
          />

          {/* Seta indicadora apontando para o elemento */}
          <div
            className="fixed pointer-events-none z-[99993] flex items-center gap-1"
            style={{
              top: targetRect.top - 32,
              left: targetRect.left + targetRect.width / 2 - 16,
            }}
          >
            <MapPin size={18} className="text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.9)]" />
          </div>
        </>
      ) : (
        <div className="fixed inset-0 bg-[#030712]/88 backdrop-blur-[6px] z-[99991]" />
      )}

      {/* ── CARD FLUTUANTE PREMIUM ── */}
      <div
        ref={cardRef}
        key={passoIndex} // re-monta o card a cada passo para reativar a animação
        style={cardEstilo}
        className="tour-card-animate flex flex-col justify-between rounded-[28px] border border-orange-500/30 bg-[#080E1F]/97 p-5 sm:p-6 text-white shadow-[0_32px_80px_rgba(0,0,0,0.95),0_0_0_1px_rgba(249,115,22,0.15),inset_0_1px_0_rgba(255,255,255,0.07)] z-[99999] overflow-hidden"
      >

        {/* Brilho interior sutil no topo */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-orange-500/5 to-transparent pointer-events-none rounded-t-[28px]" />

        {/* Linha shimmer animada */}
        <div className="absolute top-0 left-0 h-full w-1/3 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent tour-shimmer-line pointer-events-none" />

        {/* ── CABEÇALHO ── */}
        <div className="shrink-0 relative z-10">

          {/* Trilha de Módulos (capítulos do tour) */}
          <div className="mb-3 flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5">
            {MODULOS.map((mod) => {
              const isAtivo = moduloAtual?.rota === mod.rota;
              const isConcluido = passoIndex > mod.fim;
              return (
                <div key={mod.rota} className="flex items-center gap-1 shrink-0">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-500 ${isAtivo
                        ? 'bg-orange-500 w-8 shadow-[0_0_8px_rgba(249,115,22,0.8)]'
                        : isConcluido
                          ? 'bg-emerald-500/70 w-4'
                          : 'bg-white/15 w-3'
                      }`}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-500/20 text-orange-400 border border-orange-500/40 shadow-[0_0_20px_rgba(249,115,22,0.2)]">
                <Compass size={20} />
              </span>
              <div className="min-w-0">
                <span className="font-['JetBrains_Mono'] text-[10px] sm:text-xs font-black uppercase tracking-[0.15em] text-orange-400/90 block truncate">
                  {categoria}
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-300">
                  {isEn ? `Step ${passoIndex + 1} of ${totalPassos}` : `Passo ${passoIndex + 1} de ${totalPassos}`}
                </span>
              </div>
            </div>

            <button
              onClick={onEncerrar}
              title={tDynamic('Encerrar Tour')}
              className="shrink-0 rounded-xl p-2 text-slate-500 hover:bg-white/8 hover:text-white transition-all duration-200 hover:rotate-90"
            >
              <X size={20} />
            </button>
          </div>

          {/* Barra de Progresso */}
          <div className="mt-3 space-y-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-600 via-amber-500 to-yellow-400 transition-all duration-500 ease-out"
                style={{
                  width: `${pctProgresso}%`,
                  boxShadow: '0 0 12px rgba(249,115,22,0.8), 0 0 4px rgba(245,158,11,0.5)',
                }}
              />
            </div>
          </div>

          {/* Buscando elemento */}
          {!targetRect && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3.5 py-2 text-xs sm:text-sm font-bold text-sky-300">
              <Compass size={14} className="animate-spin text-sky-400 shrink-0" />
              <span>{tDynamic('Localizando elemento na página...')}</span>
            </div>
          )}
        </div>

        {/* ── CONTEÚDO ── */}
        <div className="flex-1 overflow-y-auto my-4 pr-1 space-y-3 custom-scrollbar relative z-10">
          <h3 className="font-['Sora'] text-base sm:text-lg font-black text-white leading-snug">
            {titulo}
          </h3>
          <p className="text-sm sm:text-[15px] leading-relaxed text-slate-200/90 font-medium">
            {descricao}
          </p>

          {dicaExtra && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/12 p-3.5 text-amber-50">
              <Sparkles size={18} className="mt-0.5 shrink-0 text-amber-400" />
              <p className="text-xs sm:text-sm leading-relaxed font-semibold">
                <b className="text-amber-300">{tDynamic('Dica de Sucesso:')}</b>{' '}
                {dicaExtra}
              </p>
            </div>
          )}
        </div>

        {/* ── RODAPÉ ── */}
        <div className="shrink-0 border-t border-white/10 pt-3.5 relative z-10">
          {/* Dots de passo dentro do módulo atual */}
          {passosDoModulo.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 mb-3">
              {passosDoModulo.map((_, i) => (
                <div
                  key={i}
                  className={`rounded-full transition-all duration-300 ${i === passoIndexNoModulo
                      ? 'w-4 h-1.5 bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.8)]'
                      : i < passoIndexNoModulo
                        ? 'w-1.5 h-1.5 bg-emerald-500/70'
                        : 'w-1.5 h-1.5 bg-white/20'
                    }`}
                />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            {/* Pular Tour */}
            <button
              onClick={onEncerrar}
              className="text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors px-1 py-1"
            >
              {tDynamic('Pular Tour')}
            </button>

            {/* Hint de teclado */}
            <span className="hidden sm:flex items-center gap-1 text-[10px] text-white/20 font-mono select-none">
              <kbd className="px-1 py-0.5 rounded bg-white/8 border border-white/10">←</kbd>
              <kbd className="px-1 py-0.5 rounded bg-white/8 border border-white/10">→</kbd>
              <kbd className="px-1 py-0.5 rounded bg-white/8 border border-white/10">ESC</kbd>
            </span>

            <div className="flex items-center gap-2">
              {passoIndex > 0 && (
                <button
                  onClick={onAnterior}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-white/12 bg-white/6 px-4 py-2.5 text-sm font-bold text-slate-200 hover:bg-white/10 hover:text-white transition-all duration-200 active:scale-95"
                >
                  <ArrowLeft size={16} />
                  <span className="hidden sm:inline">{tDynamic('Voltar')}</span>
                </button>
              )}

              <button
                onClick={onProximo}
                className="inline-flex items-center gap-2 rounded-2xl px-5 sm:px-6 py-2.5 text-sm sm:text-base font-black text-white transition-all duration-200 hover:scale-[1.04] active:scale-95"
                style={{
                  background: isUltimoPasso
                    ? 'linear-gradient(135deg, #10b981, #059669)'
                    : 'linear-gradient(135deg, #f97316, #f59e0b)',
                  boxShadow: isUltimoPasso
                    ? '0 0 24px rgba(16,185,129,0.5), 0 4px 12px rgba(0,0,0,0.3)'
                    : '0 0 24px rgba(249,115,22,0.5), 0 4px 12px rgba(0,0,0,0.3)',
                }}
              >
                <span>{isUltimoPasso ? tDynamic('Concluir Tour 🎉') : tDynamic('Próximo')}</span>
                {isUltimoPasso ? <CheckCircle2 size={18} /> : <ArrowRight size={18} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
