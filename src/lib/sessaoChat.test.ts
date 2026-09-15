// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { obterSessaoChat, fetchComSessaoChat } from './sessaoChat';
beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());
it('primeira mensagem e header usam a mesma credencial, preservando Authorization', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetch);
  const enviar = fetchComSessaoChat('https://teste.supabase.co');
  const sessao = obterSessaoChat();
  await enviar('https://teste.supabase.co/rest/v1/chat_conversations', { headers: { Authorization: 'Bearer teste' } });
  const headers = fetch.mock.calls[0][1].headers as Headers;
  expect(headers.get('x-chat-session')).toBe(sessao);
  expect(headers.get('Authorization')).toBe('Bearer teste');
});
it('acompanha mudança de sessão sem recarregar e não envia credencial a OAuth', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch', fetch);
  const enviar = fetchComSessaoChat('https://teste.supabase.co');
  localStorage.setItem('miseon_chat_session', 'sess_antiga');
  const sessao = obterSessaoChat();
  expect(sessao).not.toContain('sess_');
  const nova = crypto.randomUUID();
  localStorage.setItem('miseon_chat_session', nova);
  await enviar('https://teste.supabase.co/rest/v1/chat_messages');
  expect(fetch.mock.calls[0][1].headers.get('x-chat-session')).toBe(nova);
  await enviar('https://teste.supabase.co/auth/v1/user');
  expect(fetch.mock.calls[1][1]).toBeUndefined();
});
