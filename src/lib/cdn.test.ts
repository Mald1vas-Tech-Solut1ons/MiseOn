// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://miseon.app.br" }
// Este helper roda no navegador (monta URL a partir de window.location.origin),
// então o teste precisa do mesmo ambiente — e de uma origem real, já que em
// localhost o comportamento é outro de propósito.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getOptimizedImageUrl } from './cdn';

const SUPABASE_IMG =
  'https://zzuxklwhaoisuuvndtfw.supabase.co/storage/v1/object/public/produtos/hamburguer.jpg';

/** O host da CDN é lido no import, então cada cenário precisa de módulo novo. */
async function carregarComCdn(host: string) {
  vi.resetModules();
  vi.stubEnv('VITE_CDN_HOST', host);
  return (await import('./cdn')).getOptimizedImageUrl;
}

describe('getOptimizedImageUrl', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('deve retornar string vazia para valores falsy ou nulos', () => {
    expect(getOptimizedImageUrl(null)).toBe('');
    expect(getOptimizedImageUrl(undefined)).toBe('');
    expect(getOptimizedImageUrl('')).toBe('');
  });

  it('deve servir a imagem por /img no próprio domínio', () => {
    expect(getOptimizedImageUrl(SUPABASE_IMG)).toBe(
      `${window.location.origin}/img/produtos/hamburguer.jpg`
    );
  });

  it('deve devolver URL absoluta, porque o helper alimenta og:image', () => {
    expect(getOptimizedImageUrl(SUPABASE_IMG)).toMatch(/^https?:\/\//);
  });

  it('deve funcionar para qualquer projeto Supabase, preservando subpastas', () => {
    const input =
      'https://uvthidnqmezmmdrteqks.supabase.co/storage/v1/object/public/loja-assets/abc/produtos/x.png';
    expect(getOptimizedImageUrl(input)).toBe(
      `${window.location.origin}/img/loja-assets/abc/produtos/x.png`
    );
  });

  it('deve buscar direto do Supabase em localhost, onde /img não existe', () => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } });
    expect(getOptimizedImageUrl(SUPABASE_IMG)).toBe(SUPABASE_IMG);
    vi.unstubAllGlobals();
  });

  it('deve manter URLs externas intactas', () => {
    const external = 'https://images.unsplash.com/photo-1550547660-d9450f859349';
    expect(getOptimizedImageUrl(external)).toBe(external);
  });

  it('deve preferir VITE_CDN_HOST quando existir uma CDN externa configurada', async () => {
    const fn = await carregarComCdn('https://cdn.exemplo.com.br');
    expect(fn(SUPABASE_IMG)).toBe(
      'https://cdn.exemplo.com.br/storage/v1/object/public/produtos/hamburguer.jpg'
    );
  });
});
