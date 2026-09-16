import { useEffect } from 'react';
import { ADSENSE_SCRIPT_ID, ADSENSE_SRC, aplicarConsentimentoAds } from '../lib/adsense';
import { EVENT_COOKIE_UPDATED } from '../lib/cookieConsent';

/**
 * Carrega o loader do AdSense na página onde for montado — hoje, só o blog.
 * Ver `src/lib/adsense.ts` para o porquê de não estar no index.html.
 *
 * Não renderiza nada: quem desenha as áreas é o <AdSlot />, e o Auto Ads do
 * painel preenche o resto da página por conta própria.
 */
export default function AdSenseBlog() {
  useEffect(() => {
    aplicarConsentimentoAds();
    window.addEventListener(EVENT_COOKIE_UPDATED, aplicarConsentimentoAds);

    // O HTML prerenderizado do blog já traz o loader no <head>. Só quem
    // chegou aqui por navegação interna (o <head> é o da página de origem)
    // precisa da injeção.
    if (!document.getElementById(ADSENSE_SCRIPT_ID)) {
      const script = document.createElement('script');
      script.id = ADSENSE_SCRIPT_ID;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = ADSENSE_SRC;
      document.head.appendChild(script);
    }

    return () => window.removeEventListener(EVENT_COOKIE_UPDATED, aplicarConsentimentoAds);
  }, []);

  return null;
}
