/**
 * Google AdSense — carregado APENAS nas páginas do blog.
 *
 * POR QUE NÃO VAI NO <head> DO index.html:
 * O index.html é o template de tudo — inclusive do `app.html`, o shell das
 * rotas do sistema (/admin, KDS, /entregador) e do cardápio de cada loja.
 * O snippet do AdSense ativa o Auto Ads: o Google escolhe sozinho onde
 * enfiar anúncio em qualquer página onde o script esteja. Anúncio de
 * terceiro dentro da tela de operação do lojista — ou no cardápio que o
 * cliente dele abre na mesa — não é erro de estilo, é o produto vendendo
 * espaço do cliente. Por isso o loader entra só em /blog e /blog/:slug.
 *
 * Duas portas de entrada, um só script:
 *  • `scripts/prerender.mjs` injeta o snippet no <head> do HTML estático das
 *    rotas de blog — é assim que o robô do Google (e o verificador do
 *    AdSense) encontram o código sem depender de JavaScript;
 *  • `<AdSenseBlog />` cobre a navegação dentro da SPA (quem chega ao blog
 *    vindo da home nunca recarrega a página, então o <head> ali é o da home).
 * Os dois usam o mesmo id e o segundo desiste se o primeiro já rodou.
 *
 * LGPD: anúncio personalizado usa cookie de marketing. O padrão da casa é
 * opt-in estrito (ver `cookieConsent.ts`), então sem consentimento o pedido
 * vai com `requestNonPersonalizedAds = 1` — o anúncio aparece, só não é
 * personalizado.
 */
import { STORAGE_KEY } from './cookieConsent';

/** ID público da conta do AdSense (não é segredo: vai no HTML servido). */
export const ADSENSE_CLIENTE = 'ca-pub-4617008756367381';

export const ADSENSE_SCRIPT_ID = 'adsense-loader';

export const ADSENSE_SRC =
  `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENTE}`;

/**
 * Snippet para o <head> do HTML estático do blog.
 *
 * O bloco inline roda ANTES do loader e lê o consentimento direto do
 * localStorage — no HTML estático não há React ainda, e depois que o
 * adsbygoogle.js sobe a flag já não vale para o primeiro slot.
 */
export function snippetAdSense(): string {
  const linhas = [
    '<script>',
    '  (function () {',
    '    var npa = 1;',
    '    try {',
    `      var c = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) || 'null');`,
    "      if (c && c.tipo !== 'indefinido' && c.preferencias && c.preferencias.marketing) npa = 0;",
    '    } catch (e) { /* localStorage bloqueado: fica em nao-personalizado */ }',
    '    window.adsbygoogle = window.adsbygoogle || [];',
    '    window.adsbygoogle.requestNonPersonalizedAds = npa;',
    '  })();',
    '</script>',
    `<script async src="${ADSENSE_SRC}" crossorigin="anonymous" id="${ADSENSE_SCRIPT_ID}"></script>`,
  ];
  // O prerender injeta com dois espaços de recuo na primeira linha.
  return linhas.join('\n    ');
}
