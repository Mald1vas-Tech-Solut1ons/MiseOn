import { useEffect, useRef, useState } from 'react';

/**
 * Splash de identidade MiseOn — vídeo de 5s, exibido 1x por sessão.
 * Pulável com toque; some sozinho ao terminar.
 */
export default function Splash({ children }: { children: React.ReactNode }) {
  const [visivel, setVisivel] = useState(() => !sessionStorage.getItem('miseon_splash'));
  const videoRef = useRef<HTMLVideoElement>(null);

  const fechar = () => {
    sessionStorage.setItem('miseon_splash', '1');
    setVisivel(false);
  };

  useEffect(() => {
    if (!visivel) return;
    const t = setTimeout(fechar, 5500); // segurança: nunca passa de ~5s
    return () => clearTimeout(t);
  }, [visivel]);

  return (
    <>
      {children}
      {visivel && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white dark:bg-gray-900 dark:border-gray-800" onClick={fechar}>
          <video
            ref={videoRef}
            src="/splash.mp4"
            autoPlay
            muted
            playsInline
            onEnded={fechar}
            onError={fechar}
            className="max-h-[70vh] w-full max-w-md object-contain"
          />
          <button type="button" className="absolute bottom-8 text-xs font-medium text-gray-400">toque para pular</button>
        </div>
      )}
    </>
  );
}
