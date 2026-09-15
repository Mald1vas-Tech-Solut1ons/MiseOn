// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AuthRecoveryRedirect from './AuthRecoveryRedirect';
import { registrarEventoAuth } from '../lib/authCallback';

const auth = vi.hoisted(() => ({ listener: (_event: string) => {}, unsubscribe: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { auth: { onAuthStateChange: vi.fn((callback) => {
  auth.listener = callback;
  return { data: { subscription: { unsubscribe: auth.unsubscribe } } };
}) } } }));
beforeEach(() => registrarEventoAuth('SIGNED_OUT'));
afterEach(cleanup);
function abrir(path: string) {
  window.history.replaceState(null, '', path);
  render(<BrowserRouter><AuthRecoveryRedirect /></BrowserRouter>);
}
describe('destino real do callback', () => {
  it.each(['/admin#access_token=falso&refresh_token=falso&token_type=bearer', '/meus-pedidos#access_token=falso&type=magiclink', '/admin?error=access_denied'])('não transforma login em troca de senha: %s', (path) => {
    abrir(path);
    expect(window.location.pathname).toBe(path.split(/[?#]/)[0]);
  });
  it('encaminha apenas o link de recuperação e preserva o fragmento', () => {
    abrir('/#access_token=falso&type=recovery');
    expect(window.location.pathname).toBe('/redefinir-senha');
    expect(window.location.hash).toContain('type=recovery');
  });
  it('ouve recuperação após o SDK consumir o token, sem depender do hash', () => {
    abrir('/admin');
    act(() => auth.listener('PASSWORD_RECOVERY'));
    expect(window.location.pathname).toBe('/redefinir-senha');
  });
  it('SIGNED_IN não redireciona usuário Google', () => {
    abrir('/admin');
    act(() => auth.listener('SIGNED_IN'));
    expect(window.location.pathname).toBe('/admin');
  });
});
