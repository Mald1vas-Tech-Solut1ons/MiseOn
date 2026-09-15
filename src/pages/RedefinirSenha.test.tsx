// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, cleanup, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RedefinirSenha from './RedefinirSenha';
import { registrarEventoAuth } from '../lib/authCallback';
vi.mock('../contexts/I18nContext', () => ({ useI18n: () => ({ tDynamic: (x: string) => x }) }));
vi.mock('../components/LanguageToggle', () => ({ default: () => null }));
vi.mock('../components/MiseOnLogo', () => ({ default: () => null }));
vi.mock('../lib/supabase', () => ({ supabase: { auth: {
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  getSession: async () => ({ data: { session: { user: { id: 'google' } } } }),
} } }));
beforeEach(() => registrarEventoAuth('SIGNED_OUT'));
afterEach(cleanup);
it('sessão Google comum não libera criação de senha ao visitar a rota', async () => {
  render(<MemoryRouter><RedefinirSenha /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText('Confirmando seu link…')).toBeTruthy());
  expect(document.querySelector('input[type="password"]')).toBeNull();
});
it('recuperação reconhecida antes da tela montar libera formulário', async () => {
  registrarEventoAuth('PASSWORD_RECOVERY');
  render(<MemoryRouter><RedefinirSenha /></MemoryRouter>);
  await waitFor(() => expect(document.querySelector('input[type="password"]')).not.toBeNull());
});
