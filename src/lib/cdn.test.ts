import { describe, it, expect, vi, afterEach } from 'vitest';
import { getOptimizedImageUrl } from './cdn';

const SUPABASE_IMG =
  'https://zzuxklwhaoisuuvndtfw.supabase.co/storage/v1/object/public/produtos/hamburguer.jpg';

/** O host da CDN é lido no import, então cada cenário precisa de módulo novo. */
async function carregarComCdn(host?: string) {
  vi.resetModules();
  if (host === undefined) vi.stubEnv('VITE_CDN_HOST', '');
  else vi.stubEnv('VITE_CDN_HOST', host);
  return (await import('./cdn')).getOptimizedImageUrl;
}

describe('getOptimizedImageUrl', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('deve retornar string vazia para valores falsy ou nulos', () => {
    expect(getOptimizedImageUrl(null)).toBe('');
    expect(getOptimizedImageUrl(undefined)).toBe('');
    expect(getOptimizedImageUrl('')).toBe('');
  });

  it('deve manter a URL do Supabase intacta quando não há CDN configurada', async () => {
    const fn = await carregarComCdn(undefined);
    expect(fn(SUPABASE_IMG)).toBe(SUPABASE_IMG);
  });

  it('deve apontar para a CDN quando VITE_CDN_HOST está definida', async () => {
    const fn = await carregarComCdn('https://cdn.exemplo.com.br');
    expect(fn(SUPABASE_IMG)).toBe(
      'https://cdn.exemplo.com.br/storage/v1/object/public/produtos/hamburguer.jpg'
    );
  });

  it('deve reescrever qualquer projeto Supabase e tolerar barra sobrando no host', async () => {
    const fn = await carregarComCdn('https://cdn.exemplo.com.br/');
    const input = 'https://uvthidnqmezmmdrteqks.supabase.co/storage/v1/object/public/lojas/logo.png';
    expect(fn(input)).toBe('https://cdn.exemplo.com.br/storage/v1/object/public/lojas/logo.png');
  });

  it('deve manter URLs externas intactas', async () => {
    const fn = await carregarComCdn('https://cdn.exemplo.com.br');
    const external = 'https://images.unsplash.com/photo-1550547660-d9450f859349';
    expect(fn(external)).toBe(external);
  });
});
