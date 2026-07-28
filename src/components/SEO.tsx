import { useEffect } from 'react';

export interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  canonicalUrl?: string;
  ogType?: string;
  ogImage?: string;
  schemaJson?: Record<string, any> | Record<string, any>[];
}

export function SEO({
  title,
  description,
  keywords,
  canonicalUrl,
  ogType = 'website',
  ogImage = 'https://miseon.app.br/icon.png',
  schemaJson,
}: SEOProps) {
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
    // Sem schema próprio: mantém o bloco herdado do index.html (Organization +
    // SoftwareApplication do site). Removê-lo deixaria a página sem nenhum dado
    // estruturado, que é pior do que ter o schema institucional.
  }, [title, description, keywords, canonicalUrl, ogType, ogImage, schemaJson]);

  return null;
}

export default SEO;
