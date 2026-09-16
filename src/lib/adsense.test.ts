// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { snippetAdSense, aplicarConsentimentoAds, ADSENSE_CLIENTE, ADSENSE_SLOTS } from './adsense';
import { aceitarTodos, aceitarApenasEssenciais, STORAGE_KEY } from './cookieConsent';

/**
 * O que estes testes protegem: o anúncio é a única coisa do site que fala com
 * um terceiro sobre quem está lendo. A regra da casa é que, sem consentimento
 * de marketing, ele vai NÃO personalizado — e isso precisa valer nos dois
 * caminhos de entrada, o HTML estático e o React.
 */

describe('snippet do <head> do blog', () => {
  const snippet = snippetAdSense();

  it('carrega o loader da conta certa', () => {
    expect(snippet).toContain(`adsbygoogle.js?client=${ADSENSE_CLIENTE}`);
    expect(snippet).toContain('crossorigin="anonymous"');
  });

  it('começa com tudo negado no Consent Mode v2', () => {
    // As quatro chaves importam: o Google trata a ausência de qualquer uma
    // como "não informado", e no EEE isso vira anúncio nenhum.
    expect(snippet).toContain("ad_storage: 'denied'");
    expect(snippet).toContain("ad_user_data: 'denied'");
    expect(snippet).toContain("ad_personalization: 'denied'");
    expect(snippet).toContain("analytics_storage: 'denied'");
  });

  it('decide a personalização ANTES de o loader subir', () => {
    const posConsentimento = snippet.indexOf('requestNonPersonalizedAds');
    const posLoader = snippet.indexOf('<script async');
    expect(posConsentimento).toBeGreaterThan(-1);
    expect(posConsentimento).toBeLessThan(posLoader);
  });

  it('lê o consentimento da mesma chave que o banner grava', () => {
    expect(snippet).toContain(JSON.stringify(STORAGE_KEY));
  });
});

describe('sinal de consentimento em tempo de execução', () => {
  beforeEach(() => {
    localStorage.clear();
    delete (window as unknown as { adsbygoogle?: unknown }).adsbygoogle;
    delete (window as unknown as { dataLayer?: unknown }).dataLayer;
  });

  const lerNpa = () =>
    (window as unknown as { adsbygoogle?: { requestNonPersonalizedAds?: number } }).adsbygoogle
      ?.requestNonPersonalizedAds;

  const ultimoConsentimento = () => {
    const camada = (window as unknown as { dataLayer?: unknown[] }).dataLayer ?? [];
    return camada[camada.length - 1] as [string, string, Record<string, string>];
  };

  it('sem escolha registrada, o anúncio vai não personalizado', () => {
    aplicarConsentimentoAds();
    expect(lerNpa()).toBe(1);
    expect(ultimoConsentimento()[2]).toMatchObject({
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
  });

  it('só essenciais mantém o anúncio não personalizado', () => {
    aceitarApenasEssenciais();
    aplicarConsentimentoAds();
    expect(lerNpa()).toBe(1);
  });

  it('aceitar tudo libera a personalização nos dois sinais', () => {
    aceitarTodos();
    aplicarConsentimentoAds();
    expect(lerNpa()).toBe(0);
    expect(ultimoConsentimento()[2]).toMatchObject({
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
    });
  });

  it('não atropela a fila que o loader já criou', () => {
    // O adsbygoogle.js empurra os slots pedidos nesse mesmo array; trocá-lo
    // por um novo apagaria anúncio já solicitado.
    const fila: unknown[] = [{ slotPedido: true }];
    (window as unknown as { adsbygoogle?: unknown }).adsbygoogle = fila;
    aplicarConsentimentoAds();
    expect((window as unknown as { adsbygoogle?: unknown }).adsbygoogle).toBe(fila);
    expect(fila).toHaveLength(1);
  });
});

describe('áreas de anúncio do blog', () => {
  it('toda posição declarada tem uma entrada — vazia significa desligada', () => {
    expect(Object.keys(ADSENSE_SLOTS).sort()).toEqual(['artigoFim', 'artigoMeio', 'hub']);
    for (const [posicao, id] of Object.entries(ADSENSE_SLOTS)) {
      expect(typeof id, `${posicao} precisa ser string`).toBe('string');
      // Quando preenchido, o data-ad-slot do AdSense é só dígitos.
      if (id) expect(id, `${posicao} não parece um data-ad-slot`).toMatch(/^[0-9]+$/);
    }
  });
});
