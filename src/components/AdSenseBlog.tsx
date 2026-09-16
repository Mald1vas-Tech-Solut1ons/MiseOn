import { useEffect } from 'react';
import { ADSENSE_SCRIPT_ID, ADSENSE_SRC } from '../lib/adsense';
import { temPermissao, EVENT_COOKIE_UPDATED } from '../lib/cookieConsent';

/**
 * Carrega o loader do AdSense na página onde for montado — hoje, só o blog.
 * Ver `src/lib/adsense.ts` para o porquê de não estar no index.html.
 *
 * Não renderiza nada: quem escolhe onde o anúncio entra é o Auto Ads do
 * painel do Google. Quando houver unidade manual (data-ad-slot), o bloco
 * entra no JSX do artigo e este componente continua sendo quem sobe o script.
 */
type FilaAdSense = unknown[] & { requestNonPersonalizedAds?: number };

export default function AdSenseBlog() {
  useEffect(() => {
    const aplicarConsentimento = () => {
      const w = window as Window & { adsbygoogle?: FilaAdSense };
      // A fila do AdSense é um array com propriedades penduradas — é assim
      // que a própria biblioteca do Google a usa.
      const fila = w.adsbygoogle ?? ([] as unknown as FilaAdSense);
      fila.requestNonPersonalizedAds = temPermissao('marketing') ? 0 : 1;
      w.adsbygoogle = fila;
    };

    aplicarConsentimento();
    window.addEventListener(EVENT_COOKIE_UPDATED, aplicarConsentimento);

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

    return () => window.removeEventListener(EVENT_COOKIE_UPDATED, aplicarConsentimento);
  }, []);

  return null;
}
