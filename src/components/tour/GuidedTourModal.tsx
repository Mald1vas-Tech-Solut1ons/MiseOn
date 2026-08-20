import React, { useEffect, useState } from 'react';
import { Compass, X, ArrowRight, ArrowLeft, Sparkles, CheckCircle2 } from 'lucide-react';
import { TourStep } from '../../hooks/useGuidedTour';

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
  const { tDynamic } = useI18n();
  const [targetRect, setTargetRect] = useState<RectPos | null>(null);

  // Recalcular a posição do elemento em tempo real (mesmo com resize ou scroll)
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

  if (!ativo || !passoAtual) return null;

  const pctProgresso = Math.round(((passoIndex + 1) / totalPassos) * 100);

  // Posicionamento Inteligente: NUNCA cobre o elemento em destaque nem o seu conteúdo
  const cardEstilo: React.CSSProperties = {
    position: 'fixed',
    zIndex: 99999,
  };

  if (targetRect) {
    const cardWidth = Math.min(520, window.innerWidth * 0.94);
    const cardMaxHeight = Math.min(520, window.innerHeight - 32);

    const targetRight = targetRect.left + targetRect.width;
    const targetBottom = targetRect.top + targetRect.height;

    const espacoDireita = window.innerWidth - targetRight;
    const espacoEsquerda = targetRect.left;
    const espacoAbaixo = window.innerHeight - targetBottom;
    const espacoAcima = targetRect.top;

    let finalLeft = 20;
    let finalTop = 20;

    // Prioridade 1: Posicionar à DIREITA do elemento (deixa o elemento e o form livres)
    if (espacoDireita >= cardWidth + 24) {
      finalLeft = targetRight + 20;
      finalTop = Math.max(16, Math.min(window.innerHeight - cardMaxHeight - 16, targetRect.top - 10));
    }
    // Prioridade 2: Posicionar à ESQUERDA do elemento
    else if (espacoEsquerda >= cardWidth + 24) {
      finalLeft = Math.max(16, targetRect.left - cardWidth - 20);
      finalTop = Math.max(16, Math.min(window.innerHeight - cardMaxHeight - 16, targetRect.top - 10));
    }
    // Prioridade 3: Posicionar ABAIXO com deslocamento
    else if (espacoAbaixo >= cardMaxHeight + 24) {
      finalTop = targetBottom + 16;
      if (window.innerWidth - targetRect.left >= cardWidth + 16) {
        finalLeft = targetRect.left;
      } else {
        finalLeft = Math.max(16, window.innerWidth - cardWidth - 16);
      }
    }
    // Prioridade 4: Posicionar ACIMA com deslocamento
    else if (espacoAcima >= cardMaxHeight + 24) {
      finalTop = Math.max(16, targetRect.top - cardMaxHeight - 16);
      finalLeft = Math.max(16, Math.min(window.innerWidth - cardWidth - 16, targetRect.left));
    }
    // Fallback: Lado oposto da tela sem colidir com o centro do elemento
    else {
      finalTop = Math.max(16, Math.min(window.innerHeight - cardMaxHeight - 16, targetRect.top));
      if (targetRect.left > window.innerWidth / 2) {
        finalLeft = Math.max(16, targetRect.left - cardWidth - 20);
      } else {
        finalLeft = Math.min(window.innerWidth - cardWidth - 16, targetRight + 20);
      }
    }

    cardEstilo.top = `${finalTop}px`;
    cardEstilo.left = `${finalLeft}px`;
    cardEstilo.width = `${cardWidth}px`;
    cardEstilo.maxHeight = `${cardMaxHeight}px`;
  } else {
    // Posição Centralizada Fallback
    cardEstilo.top = '50%';
    cardEstilo.left = '50%';
    cardEstilo.transform = 'translate(-50%, -50%)';
    cardEstilo.width = `${Math.min(520, window.innerWidth * 0.94)}px`;
    cardEstilo.maxHeight = `${Math.min(520, window.innerHeight - 32)}px`;
  }

  return (
    <div className="fixed inset-0 z-[99990] pointer-events-auto">
      {/* ── SPOTLIGHT OVERLAY (Fundo Escuro com Recorte Iluminado) ── */}
      {targetRect ? (
        <svg className="fixed inset-0 h-full w-full pointer-events-none z-[99991]">
          <defs>
            <mask id="tour-spotlight-mask">
              {/* Fundo Branco (visível) */}
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {/* Recorte Preto no Elemento (transparente) com borda arredondada */}
              <rect
                x={targetRect.left - 8}
                y={targetRect.top - 8}
                width={targetRect.width + 16}
                height={targetRect.height + 16}
                rx="18"
                fill="black"
              />
            </mask>
          </defs>
          {/* Overlay Escuro com a Máscara Aplicada */}
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(3, 7, 18, 0.84)"
            mask="url(#tour-spotlight-mask)"
          />
        </svg>
      ) : (
        <div className="fixed inset-0 bg-[#030712]/85 backdrop-blur-md z-[99991]" />
      )}

      {/* Anel Neon Pulsante em Volta do Elemento Alvo */}
      {targetRect && (
        <div
          className="fixed pointer-events-none z-[99992] rounded-2xl border-2 border-orange-500 shadow-[0_0_35px_rgba(249,115,22,0.85)] animate-pulse"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
        />
      )}

      {/* ── CARD FLUTUANTE DE EXPLICAÇÃO (TIPOGRAFIA GRANDE, ALTO CONTRASTE E MÁXIMA ACESSIBILIDADE) ── */}
      <div
        style={cardEstilo}
        className="flex flex-col justify-between rounded-[32px] border-2 border-orange-500/60 bg-[#0B132B]/98 p-6 sm:p-7 text-white backdrop-blur-2xl shadow-[0_30px_70px_rgba(0,0,0,0.95)] z-[99999] animate-in fade-in zoom-in-95 duration-200 overflow-hidden"
      >
        {/* Cabeçalho do Card (Fixo no Topo) */}
        <div className="shrink-0">
          <div className="flex items-center justify-between gap-3 border-b border-white/15 pb-3.5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-500/25 text-orange-400 font-black border border-orange-500/50 shadow-inner">
                <Compass size={22} />
              </span>
              <div>
                <span className="font-['JetBrains_Mono'] text-xs sm:text-sm font-black uppercase tracking-wider text-orange-400 block">
                  {passoAtual.categoria}
                </span>
                <span className="text-sm sm:text-base font-extrabold text-slate-200">
                  Passo {passoIndex + 1} de {totalPassos}
                </span>
              </div>
            </div>

            <button
              onClick={onEncerrar}
              title="Encerrar Tour Guiado"
              className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white transition"
            >
              <X size={22} />
            </button>
          </div>

          {/* Barra de Progresso Superior */}
          <div className="mt-3.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400 transition-all duration-300 shadow-[0_0_15px_rgba(249,115,22,0.9)]"
              style={{ width: `${pctProgresso}%` }}
            />
          </div>

          {!targetRect && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-blue-500/40 bg-blue-500/15 px-3.5 py-2 text-xs sm:text-sm font-bold text-blue-300 animate-pulse">
              <Compass size={16} className="animate-spin text-blue-400" />
              <span>{tDynamic('Localizando elemento na página...')}</span>
            </div>
          )}
        </div>

        {/* Conteúdo Explicativo (Tipografia Grande & Ultra-Legível) */}
        <div className="flex-1 overflow-y-auto my-4 pr-1.5 custom-scrollbar space-y-3.5">
          <h3 className="font-['Sora'] text-lg sm:text-xl font-black text-white leading-snug flex items-center gap-2">
            {passoAtual.titulo}
          </h3>
          <p className="text-sm sm:text-base leading-relaxed text-slate-100 font-semibold">
            {passoAtual.descricao}
          </p>

          {/* Dica Extra */}
          {passoAtual.dicaExtra && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-500/50 bg-amber-500/20 p-4 text-amber-50 shadow-md">
              <Sparkles size={22} className="mt-0.5 shrink-0 text-amber-400" />
              <p className="text-sm sm:text-base leading-relaxed font-bold">
                <b className="text-amber-300">{tDynamic('Dica de Sucesso:')}</b> {passoAtual.dicaExtra}
              </p>
            </div>
          )}
        </div>

        {/* Rodapé com Navegação (Botões Maiores e 100% Visíveis) */}
        <div className="shrink-0 border-t border-white/15 pt-4 flex items-center justify-between">
          <button
            onClick={onEncerrar}
            className="text-xs sm:text-sm font-black text-slate-400 hover:text-white transition px-2 py-1"
          >
            Pular Tour
          </button>

          <div className="flex items-center gap-3">
            {passoIndex > 0 && (
              <button
                onClick={onAnterior}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/90 px-4 sm:px-5 py-2.5 text-sm sm:text-base font-bold text-slate-100 hover:bg-slate-700 hover:text-white transition shadow-sm"
              >
                <ArrowLeft size={18} /> Voltar
              </button>
            )}

            <button
              onClick={onProximo}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 px-5 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base font-black text-white shadow-[0_0_25px_rgba(249,115,22,0.5)] hover:scale-105 active:scale-95 transition-all"
            >
              <span>{passoIndex === totalPassos - 1 ? 'Concluir Tour 🎉' : 'Próximo'}</span>
              {passoIndex === totalPassos - 1 ? <CheckCircle2 size={18} /> : <ArrowRight size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
