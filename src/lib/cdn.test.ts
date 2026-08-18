import { describe, it, expect } from 'vitest';
import { getOptimizedImageUrl } from './cdn';

describe('getOptimizedImageUrl', () => {
  it('deve retornar string vazia para valores falsy ou nulos', () => {
    expect(getOptimizedImageUrl(null)).toBe('');
    expect(getOptimizedImageUrl(undefined)).toBe('');
    expect(getOptimizedImageUrl('')).toBe('');
  });

  it('deve converter URLs do Supabase storage público para a CDN Cloudflare', () => {
    const input = 'https://zzuxklwhaoisuuvndtfw.supabase.co/storage/v1/object/public/produtos/hamburguer.jpg';
    const expected = 'https://cdn.miseon.app.br/storage/v1/object/public/produtos/hamburguer.jpg';
    expect(getOptimizedImageUrl(input)).toBe(expected);
  });

  it('deve converter URLs de outro projeto Supabase storage público para a CDN Cloudflare', () => {
    const input = 'https://uvthidnqmezmmdrteqks.supabase.co/storage/v1/object/public/lojas/logo.png';
    const expected = 'https://cdn.miseon.app.br/storage/v1/object/public/lojas/logo.png';
    expect(getOptimizedImageUrl(input)).toBe(expected);
  });

  it('deve manter URLs externas intactas', () => {
    const external = 'https://images.unsplash.com/photo-1550547660-d9450f859349';
    expect(getOptimizedImageUrl(external)).toBe(external);
  });
});
