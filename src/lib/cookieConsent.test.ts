// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  obterConsentimento,
  salvarConsentimento,
  aceitarTodos,
  aceitarApenasEssenciais,
  temPermissao,
  STORAGE_KEY,
  EVENT_COOKIE_UPDATED,
} from './cookieConsent';

describe('Módulo cookieConsent (LGPD)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('deve retornar consentimento indefinido por padrão', () => {
    const estado = obterConsentimento();
    expect(estado.tipo).toBe('indefinido');
    expect(estado.preferencias.essenciais).toBe(true);
    expect(estado.preferencias.analiticos).toBe(false);
    expect(estado.preferencias.marketing).toBe(false);
  });

  it('deve salvar consentimento e persistir no localStorage', () => {
    const estado = salvarConsentimento('personalizado', { analiticos: true, marketing: false });

    expect(estado.tipo).toBe('personalizado');
    expect(estado.preferencias.analiticos).toBe(true);
    expect(estado.preferencias.marketing).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();

    const salvo = obterConsentimento();
    expect(salvo.tipo).toBe('personalizado');
    expect(salvo.preferencias.analiticos).toBe(true);
  });

  it('deve aceitar todos os cookies corretamente', () => {
    aceitarTodos();
    const estado = obterConsentimento();
    expect(estado.tipo).toBe('aceito_todos');
    expect(estado.preferencias.analiticos).toBe(true);
    expect(estado.preferencias.marketing).toBe(true);
    expect(temPermissao('analiticos')).toBe(true);
    expect(temPermissao('marketing')).toBe(true);
  });

  it('deve aceitar apenas essenciais e recusas analíticos e marketing', () => {
    aceitarApenasEssenciais();
    const estado = obterConsentimento();
    expect(estado.tipo).toBe('apenas_essenciais');
    expect(estado.preferencias.analiticos).toBe(false);
    expect(estado.preferencias.marketing).toBe(false);
    expect(temPermissao('analiticos')).toBe(false);
    expect(temPermissao('marketing')).toBe(false);
  });

  it('deve disparar evento nativo miseon:cookie-consent-updated ao salvar', () => {
    const listener = vi.fn();
    window.addEventListener(EVENT_COOKIE_UPDATED, listener);

    aceitarTodos();

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(EVENT_COOKIE_UPDATED, listener);
  });
});
