import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface HorizontalScrollContainerProps {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  arrowSize?: number;
  stepRatio?: number; // Ex: 0.75 rola 75% da largura visível por clique
  showGradients?: boolean;
}

export const HorizontalScrollContainer: React.FC<HorizontalScrollContainerProps> = ({
  children,
  className = '',
  contentClassName = '',
  arrowSize = 18,
  stepRatio = 0.75,
  showGradients = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [podeRolarEsquerda, setPodeRolarEsquerda] = useState(false);
  const [podeRolarDireita, setPodeRolarDireita] = useState(false);

  // Estados para mouse-drag (arrastar com o cursor do mouse no desktop)
  const isMouseDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const isDraggingRef = useRef(false);

  const checarScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    // Tolerância de 2px para evitar imprecisão de arredondamento de subpixel
    const temOverflow = el.scrollWidth > el.clientWidth + 2;
    const noInicio = el.scrollLeft <= 2;
    const noFim = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;

    setPodeRolarEsquerda(temOverflow && !noInicio);
    setPodeRolarDireita(temOverflow && !noFim);
  }, []);

  useEffect(() => {
    checarScroll();

    const el = containerRef.current;
    if (!el) return;

    // ResizeObserver para recalcular se a tela redimensionar ou se novos elementos forem renderizados
    const resizeObserver = new ResizeObserver(() => checarScroll());
    resizeObserver.observe(el);

    // MutationObserver para recalcular se o DOM interno mudar (ex: abas carregadas dinamicamente)
    const mutationObserver = new MutationObserver(() => checarScroll());
    mutationObserver.observe(el, { childList: true, subtree: true });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [checarScroll, children]);

  const rolar = (direcao: 'esquerda' | 'direita') => {
    const el = containerRef.current;
    if (!el) return;

    const quantidade = el.clientWidth * stepRatio;
    const delta = direcao === 'esquerda' ? -quantidade : quantidade;

    el.scrollBy({
      left: delta,
      behavior: 'smooth',
    });
  };

  // ── Suporte a arrasto com o mouse (Drag-to-scroll) ──
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;

    // Apenas botão esquerdo do mouse
    if (e.button !== 0) return;

    isMouseDownRef.current = true;
    startXRef.current = e.pageX - el.offsetLeft;
    scrollLeftRef.current = el.scrollLeft;
    isDraggingRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMouseDownRef.current) return;
    const el = containerRef.current;
    if (!el) return;

    const x = e.pageX - el.offsetLeft;
    const walk = (x - startXRef.current) * 1.5; // Multiplicador de sensibilidade do arrasto

    if (Math.abs(walk) > 5) {
      isDraggingRef.current = true;
    }

    if (isDraggingRef.current) {
      el.scrollLeft = scrollLeftRef.current - walk;
    }
  };

  const handleMouseUp = () => {
    isMouseDownRef.current = false;
    // Pequeno atraso para impedir que o clique em um botão/aba seja acionado se foi um arrasto
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);
  };

  // Previne clique indesejado nos filhos quando o usuário estava apenas arrastando a lista
  const handleClickCapture = (e: React.MouseEvent) => {
    if (isDraggingRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // ── Suporte a Scroll pela Roda do Mouse (Wheel) ──
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;

    // Se houver overflow horizontal e a rolagem for vertical, converte em rolagem horizontal
    if (el.scrollWidth > el.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
      checarScroll();
    }
  };

  return (
    <div className={`relative group/hscroll select-none ${className}`}>
      {/* Gradiente de Atenuação na Esquerda */}
      {showGradients && podeRolarEsquerda && (
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-r from-white via-white/80 to-transparent dark:from-gray-900 dark:via-gray-900/80 rounded-l-2xl transition-opacity duration-300" />
      )}

      {/* Seta Flutuante Esquerda */}
      {podeRolarEsquerda && (
        <button
          type="button"
          onClick={() => rolar('esquerda')}
          aria-label="Rolar para esquerda"
          className="absolute left-1 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200/80 bg-white/95 text-gray-700 shadow-md shadow-black/10 backdrop-blur-md transition-all hover:scale-110 hover:bg-white hover:text-black dark:border-gray-700/80 dark:bg-gray-900/95 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-white"
        >
          <ChevronLeft size={arrowSize} />
        </button>
      )}

      {/* Container de Conteúdo Roolável */}
      <div
        ref={containerRef}
        onScroll={checarScroll}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClickCapture={handleClickCapture}
        onWheel={handleWheel}
        className={`flex items-center gap-2 overflow-x-auto scrollbar-none scroll-smooth cursor-grab active:cursor-grabbing ${contentClassName}`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {children}
      </div>

      {/* Gradiente de Atenuação na Direita */}
      {showGradients && podeRolarDireita && (
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-l from-white via-white/80 to-transparent dark:from-gray-900 dark:via-gray-900/80 rounded-r-2xl transition-opacity duration-300" />
      )}

      {/* Seta Flutuante Direita */}
      {podeRolarDireita && (
        <button
          type="button"
          onClick={() => rolar('direita')}
          aria-label="Rolar para direita"
          className="absolute right-1 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200/80 bg-white/95 text-gray-700 shadow-md shadow-black/10 backdrop-blur-md transition-all hover:scale-110 hover:bg-white hover:text-black dark:border-gray-700/80 dark:bg-gray-900/95 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-white"
        >
          <ChevronRight size={arrowSize} />
        </button>
      )}
    </div>
  );
};
