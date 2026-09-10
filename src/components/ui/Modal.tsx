import { X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export function Modal({
  aberto,
  onFechar,
  children,
  titulo,
  largura = 'max-w-md',
}: {
  aberto: boolean;
  onFechar?: () => void;
  children: React.ReactNode;
  titulo?: string;
  largura?: string;
}) {
  useEffect(() => {
    if (!aberto) return;
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onFechar?.();
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  // Portal no body: position:fixed dentro de ancestral com transform
  // (ex.: .mo-screen em transição) seria posicionado errado sem isso.
  return createPortal(
    <div
      className="fade fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={onFechar}
    >
      <div
        className={`sheet w-full ${largura} max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-[var(--cor-borda)] bg-[var(--cor-card)] shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {(titulo || onFechar) && (
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--cor-borda)] bg-[var(--cor-card)]/95 backdrop-blur px-5 py-4">
            <h2 className="font-bold text-base text-[var(--cor-texto)] dark:text-[var(--cor-texto-claro)]">{titulo}</h2>
            {onFechar && (
              <button type="button"
                onClick={onFechar}
                aria-label="Fechar"
                className="rounded-full p-1.5 text-[var(--cor-texto-fraco)] hover:bg-[var(--cor-destaque)] hover:text-[var(--cor-texto)] transition-colors"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
