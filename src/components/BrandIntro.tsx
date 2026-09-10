import { useEffect, useState } from 'react';

export default function BrandIntro({
  children,
  onFinish,
  once = true,
  duration = 4500, // Tempo suficiente para rodar o splash.mp4
}: {
  children?: React.ReactNode;
  onFinish?: () => void;
  once?: boolean;
  duration?: number;
}) {
  const [visivel, setVisivel] = useState(
    () => !(once && sessionStorage.getItem('miseon_intro_v4'))
  );

  const fechar = () => {
    if (once) sessionStorage.setItem('miseon_intro_v4', '1');
    setVisivel(false);
    onFinish?.();
  };

  useEffect(() => {
    if (!visivel) return;
    const t = setTimeout(fechar, duration);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visivel, duration]);

  if (!visivel) return <>{children}</>;

  return (
    <>
      {children}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999999,
          background: '#FFFFFF', // Fundo branco/claro para combinar com o videoIntro
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'introFadeOut 0.5s ease forwards',
          animationDelay: '6.5s', // Fallback caso onEnded não dispare
        }}
      >
        <video
          src="/videoIntro.mp4"
          autoPlay
          muted
          playsInline
          onEnded={fechar}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover', // Preenche a tela toda
          }}
        />
        
        <button type="button" 
          onClick={fechar}
          style={{
            position: 'absolute',
            bottom: 40,
            padding: '8px 20px',
            background: 'rgba(0,0,0,0.1)',
            color: 'rgba(0,0,0,0.4)',
            borderRadius: 20,
            fontSize: 12,
            fontFamily: "'Sora', sans-serif",
            border: 'none',
            cursor: 'pointer',
            transition: '0.3s',
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.2)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.1)'}
        >
          Pular Abertura
        </button>

        <style>{`
          @keyframes introFadeOut {
            to { opacity: 0; pointer-events: none; }
          }
        `}</style>
      </div>
    </>
  );
}
