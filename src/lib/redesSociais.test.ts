/**
 * O que o lojista digita, e o que precisa acontecer.
 *
 * Cada caso aqui é uma forma real de colar link: o arroba, o nome puro, a URL
 * do navegador, a URL que o próprio app copia (com rastreio grudado) e o
 * engano de colar o Instagram no campo do TikTok.
 */
import { describe, it, expect } from 'vitest';
import { urlDaRede, arrobaDaRede } from './redesSociais';

describe('link de rede social da loja', () => {
  it('aceita o arroba, que é como o dono escreve', () => {
    expect(urlDaRede('instagram', '@natureba')).toBe('https://instagram.com/natureba');
    expect(urlDaRede('tiktok', '@natureba')).toBe('https://tiktok.com/@natureba');
    expect(urlDaRede('facebook', '@natureba')).toBe('https://facebook.com/natureba');
  });

  it('aceita o nome puro, sem arroba', () => {
    expect(urlDaRede('instagram', 'natureba.lanches')).toBe('https://instagram.com/natureba.lanches');
  });

  it('aceita a URL inteira, com ou sem protocolo', () => {
    expect(urlDaRede('instagram', 'https://www.instagram.com/natureba/')).toBe('https://instagram.com/natureba');
    expect(urlDaRede('instagram', 'www.instagram.com/natureba')).toBe('https://instagram.com/natureba');
    expect(urlDaRede('instagram', 'instagram.com/natureba/')).toBe('https://instagram.com/natureba');
  });

  it('descarta o rastreio que o proprio app cola junto', () => {
    // "Copiar link" do Instagram entrega ?igsh=...; do Facebook, ?mibextid=...
    expect(urlDaRede('instagram', 'https://instagram.com/natureba?igsh=MXY0aW5rZg==')).toBe('https://instagram.com/natureba');
    expect(urlDaRede('facebook', 'https://facebook.com/natureba?mibextid=LQQJ4d')).toBe('https://facebook.com/natureba');
  });

  it('nao conserta em silencio o link colado no campo errado', () => {
    // Instagram no campo do TikTok tem que sumir da vitrine, nao virar um
    // botao de TikTok que abre o Instagram.
    expect(urlDaRede('tiktok', 'https://instagram.com/natureba')).toBeNull();
    expect(urlDaRede('facebook', 'https://instagram.com/natureba')).toBeNull();
  });

  it('campo vazio ou lixo nao vira botao', () => {
    expect(urlDaRede('instagram', '')).toBeNull();
    expect(urlDaRede('instagram', '   ')).toBeNull();
    expect(urlDaRede('instagram', null)).toBeNull();
    expect(urlDaRede('instagram', 'não sei meu insta')).toBeNull();
    expect(urlDaRede('instagram', 'https://instagram.com/')).toBeNull();
  });

  it('mostra sempre o arroba, venha como vier', () => {
    expect(arrobaDaRede('instagram', 'https://www.instagram.com/natureba/')).toBe('@natureba');
    expect(arrobaDaRede('tiktok', 'natureba')).toBe('@natureba');
    expect(arrobaDaRede('instagram', 'lixo aqui')).toBeNull();
  });
});
