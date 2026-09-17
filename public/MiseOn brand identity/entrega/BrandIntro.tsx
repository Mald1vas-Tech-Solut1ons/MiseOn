import { useEffect, useState } from 'react';
import './brand.css';

/**
 * Abertura de marca MiseOn — as peças da logomarca voam e se montam,
 * depois revela "MISE ON" + tagline. Substitui o Splash de vídeo.
 *
 * Uso:
 *   <BrandIntro>{<App />}</BrandIntro>
 * ou standalone:
 *   {mostrar && <BrandIntro onFinish={() => setMostrar(false)} />}
 *
 * Requer os PNGs em /public/brand/ (part-*.png + icon.png).
 */
const PARTS = [
  '/brand/part-mbase.png',
  '/brand/part-arrowshaft.png',
  '/brand/part-hat.png',
  '/brand/part-arrowhead.png',
];

export default function BrandIntro({
  children,
  onFinish,
  once = true,
  duration = 3600,
}: {
  children?: React.ReactNode;
  onFinish?: () => void;
  once?: boolean;
  duration?: number;
}) {
  const [visivel, setVisivel] = useState(
    () => !(once && sessionStorage.getItem('miseon_intro'))
  );

  const fechar = () => {
    if (once) sessionStorage.setItem('miseon_intro', '1');
    setVisivel(false);
    onFinish?.();
  };

  useEffect(() => {
    if (!visivel) return;
    const t = setTimeout(fechar, duration);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visivel, duration]);

  return (
    <>
      {children}
      {visivel && (
        <div className="mo-intro" onClick={fechar} role="img" aria-label="MiseOn">
          <div className="mo-intro-stage">
            <div className="mo-mark">
              <div className="mo-spot" />
              <div className="mo-parts">
                {PARTS.map((src) => (
                  <img key={src} src={src} alt="" />
                ))}
              </div>
              <div className="mo-shine">
                <span />
              </div>
            </div>
            <div className="mo-word">
              <b>MISE</b> <i>ON</i>
            </div>
            <div className="mo-line" />
            <div className="mo-tag">Sistema inteligente para sua cozinha</div>
          </div>
        </div>
      )}
    </>
  );
}
