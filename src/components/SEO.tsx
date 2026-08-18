import { useEffect, useState } from 'react';
import { temPermissao, EVENT_COOKIE_UPDATED } from '../lib/cookieConsent';

export interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  canonicalUrl?: string;
  ogType?: string;
  ogImage?: string;
  schemaJson?: Record<string, any> | Record<string, any>[];
  metaPixelId?: string | null;
  ga4MeasurementId?: string | null;
}

export function SEO({
  title,
  description,
  keywords,
  canonicalUrl,
  ogType = 'website',
  ogImage = 'https://miseon.app.br/icon.png',
  schemaJson,
  metaPixelId,
  ga4MeasurementId,
}: SEOProps) {
  const [consentState, setConsentState] = useState(() => ({
    analiticos: temPermissao('analiticos'),
    marketing: temPermissao('marketing'),
  }));

  useEffect(() => {
    const handleConsentChange = () => {
      setConsentState({
        analiticos: temPermissao('analiticos'),
        marketing: temPermissao('marketing'),
      });
    };

    window.addEventListener(EVENT_COOKIE_UPDATED, handleConsentChange);
    return () => window.removeEventListener(EVENT_COOKIE_UPDATED, handleConsentChange);
  }, []);

  useEffect(() => {
    // 1. Atualizar Título da Página
    document.title = title;

    // Helper para atualizar ou criar meta tag
    const setMetaTag = (nameAttr: string, attrValue: string, content: string) => {
      let element = document.querySelector(`meta[${nameAttr}="${attrValue}"]`) as HTMLMetaElement | null;
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(nameAttr, attrValue);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // 2. Meta Tags Padrão
    setMetaTag('name', 'description', description);
    if (keywords) {
      setMetaTag('name', 'keywords', keywords);
    }

    // 3. OpenGraph / Redes Sociais / WhatsApp Previews
    setMetaTag('property', 'og:title', title);
    setMetaTag('property', 'og:description', description);
    setMetaTag('property', 'og:type', ogType);
    setMetaTag('property', 'og:image', ogImage);
    setMetaTag('property', 'og:url', canonicalUrl || window.location.href);

    // 4. Twitter Card
    setMetaTag('name', 'twitter:card', 'summary_large_image');
    setMetaTag('name', 'twitter:title', title);
    setMetaTag('name', 'twitter:description', description);
    setMetaTag('name', 'twitter:image', ogImage);

    // 5. Link Canonical
    let canonicalElement = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonicalElement) {
      canonicalElement = document.createElement('link');
      canonicalElement.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalElement);
    }
    canonicalElement.setAttribute('href', canonicalUrl || window.location.href);

    // 6. Schema.org JSON-LD (Rich Snippets Google)
    let scriptElement = document.getElementById('seo-json-ld') as HTMLScriptElement | null;
    if (schemaJson) {
      if (!scriptElement) {
        scriptElement = document.createElement('script');
        scriptElement.id = 'seo-json-ld';
        scriptElement.type = 'application/ld+json';
        document.head.appendChild(scriptElement);
      }
      scriptElement.textContent = JSON.stringify(schemaJson);
    }

    // 7. Meta Pixel Injection (Requer consentimento de marketing)
    if (consentState.marketing && metaPixelId && /^[0-9]{15,16}$/.test(metaPixelId.trim())) {
      const pid = metaPixelId.trim();
      if (!document.getElementById('meta-pixel-script')) {
        const metaScript = document.createElement('script');
        metaScript.id = 'meta-pixel-script';
        metaScript.textContent = `
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
          n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
          (window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${pid}');
          fbq('track', 'PageView');
        `;
        document.head.appendChild(metaScript);
      }
    }

    // 8. Google Analytics 4 (GA4) Injection (Requer consentimento analítico)
    if (consentState.analiticos && ga4MeasurementId && /^G-[A-Z0-9]{8,12}$/.test(ga4MeasurementId.trim())) {
      const gid = ga4MeasurementId.trim();
      if (!document.getElementById('ga4-script')) {
        const ga4Script = document.createElement('script');
        ga4Script.id = 'ga4-script';
        ga4Script.async = true;
        ga4Script.src = `https://www.googletagmanager.com/gtag/js?id=${gid}`;
        document.head.appendChild(ga4Script);

        const ga4ConfigScript = document.createElement('script');
        ga4ConfigScript.id = 'ga4-config-script';
        ga4ConfigScript.textContent = `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gid}');
        `;
        document.head.appendChild(ga4ConfigScript);
      }
    }
  }, [title, description, keywords, canonicalUrl, ogType, ogImage, schemaJson, metaPixelId, ga4MeasurementId, consentState]);

  return null;
}

export default SEO;
