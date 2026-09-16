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
 * CONSENTIMENTO (LGPD e o Consent Mode v2 do Google):
 * O padrão da casa é opt-in estrito (ver `cookieConsent.ts`), então tudo
 * começa negado e o anúncio sai como NÃO personalizado — aparece, só não usa
 * cookie de perfil. Quem aceita marketing no banner libera os dois sinais que
 * o Google lê: `requestNonPersonalizedAds` (Auto Ads) e `gtag('consent', …)`
 * (Consent Mode v2, exigido para tráfego do Espaço Econômico Europeu, Reino
 * Unido e Suíça, onde a mensagem de consentimento do próprio Google assume).
 */
import { STORAGE_KEY, temPermissao } from './cookieConsent';

/** ID público da conta do AdSense (não é segredo: vai no HTML servido). */
export const ADSENSE_CLIENTE = 'ca-pub-4617008756367381';

export const ADSENSE_SCRIPT_ID = 'adsense-loader';

export const ADSENSE_SRC =
  `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENTE}`;

/**
 * IDs das unidades de anúncio, criados em adsense.google.com →
 * Anúncios → Por unidade de anúncio.
 *
 * COMO LIGAR UMA ÁREA: crie a unidade no painel, copie o número do
 * `data-ad-slot` e cole aqui. É o único arquivo a mexer — as áreas já estão
 * posicionadas no blog e ligam sozinhas.
 *
 * Enquanto o campo está vazio a área não renderiza nada em produção (bloco
 * vazio no meio do texto é pior que anúncio nenhum) e o Auto Ads segue
 * preenchendo a página por conta própria. Em desenvolvimento a área aparece
 * como moldura tracejada, para dar de ver onde o anúncio vai cair.
 */
export const ADSENSE_SLOTS = {
  /** Dentro do artigo, depois da abertura. Formato fluido "no artigo". */
  artigoMeio: '',
  /** Fim do artigo, antes dos posts relacionados. Responsivo. */
  artigoFim: '',
  /** Hub do blog (/blog), entre a grade de artigos. Horizontal. */
  hub: '',
} as const;

export type PosicaoAnuncio = keyof typeof ADSENSE_SLOTS;

/**
 * A fila do AdSense é um array com propriedades penduradas — é assim que a
 * própria biblioteca do Google a usa.
 */
export type FilaAdSense = unknown[] & { requestNonPersonalizedAds?: number; loaded?: boolean };

type JanelaComAds = Window & {
  adsbygoogle?: FilaAdSense;
  dataLayer?: unknown[];
};

/**
 * Sinaliza ao Google o consentimento atual. Chamado quando o blog monta e a
 * cada mudança no banner de cookies.
 *
 * O `requestNonPersonalizedAds` vale para o pedido seguinte: depois que o
 * adsbygoogle.js sobe e monta o primeiro slot, mudar a flag não desfaz o que
 * já foi pedido. Por isso o HTML estático do blog resolve isso antes do
 * loader — ver `snippetAdSense()`.
 */
export function aplicarConsentimentoAds(): void {
  const w = window as JanelaComAds;
  const marketing = temPermissao('marketing');

  const fila = w.adsbygoogle ?? ([] as unknown as FilaAdSense);
  fila.requestNonPersonalizedAds = marketing ? 0 : 1;
  w.adsbygoogle = fila;

  // O gtag empurra os próprios `arguments` na dataLayer — este push tem o
  // mesmo formato e não depende de o gtag.js ter carregado.
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push(['consent', 'update', {
    ad_storage: marketing ? 'granted' : 'denied',
    ad_user_data: marketing ? 'granted' : 'denied',
    ad_personalization: marketing ? 'granted' : 'denied',
  }]);
}

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
    '    var marketing = false;',
    '    try {',
    `      var c = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) || 'null');`,
    "      marketing = !!(c && c.tipo !== 'indefinido' && c.preferencias && c.preferencias.marketing);",
    '    } catch (e) { /* localStorage bloqueado: segue no padrao negado */ }',
    '',
    '    // Consent Mode v2 — o padrao e negado, inclusive no EEE, Reino Unido',
    '    // e Suica, onde a mensagem de consentimento do Google assume dali.',
    '    window.dataLayer = window.dataLayer || [];',
    '    function gtag() { window.dataLayer.push(arguments); }',
    "    gtag('consent', 'default', {",
    "      ad_storage: 'denied',",
    "      ad_user_data: 'denied',",
    "      ad_personalization: 'denied',",
    "      analytics_storage: 'denied',",
    '      wait_for_update: 500',
    '    });',
    '    if (marketing) {',
    "      gtag('consent', 'update', {",
    "        ad_storage: 'granted',",
    "        ad_user_data: 'granted',",
    "        ad_personalization: 'granted'",
    '      });',
    '    }',
    '',
    '    window.adsbygoogle = window.adsbygoogle || [];',
    '    window.adsbygoogle.requestNonPersonalizedAds = marketing ? 0 : 1;',
    '  })();',
    '</script>',
    `<script async src="${ADSENSE_SRC}" crossorigin="anonymous" id="${ADSENSE_SCRIPT_ID}"></script>`,
  ];
  // O prerender injeta com dois espaços de recuo na primeira linha.
  return linhas.join('\n    ');
}
