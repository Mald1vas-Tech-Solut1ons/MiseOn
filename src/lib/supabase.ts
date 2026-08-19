import { createClient } from '@supabase/supabase-js';

/** Remove trailing newlines / whitespace that Vercel sometimes injects into env vars.
 *  The SDK puts the key as-is into the WebSocket query string, so a stray \n
 *  becomes %0A and the connection fails. */
const clean = (v: string) =>
  (v || '')
    .replace(/%0[aAdD]/g, '')
    .replace(/[\r\n\t\0\s]+/g, '')
    .trim();

const url = clean((import.meta.env.VITE_SUPABASE_URL as string) || 'https://placeholder.supabase.co');
const anon = clean((import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'placeholder-anon-key');

if (url.includes('placeholder')) {
  console.warn('Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
}

/** Sessão do chat anônimo da vitrine.
 *
 *  Vai como cabeçalho em toda requisição porque virou credencial: a RLS de
 *  `chat_conversations`/`chat_messages` liberava TODA conversa com
 *  `canal = 'VITRINE'`, de todas as lojas, para qualquer anônimo — o filtro
 *  por sessão existia só no front, que é escolha do cliente, não garantia.
 *  Agora o banco confere `session_id` contra este cabeçalho.
 *
 *  Lê o mesmo valor que o useChat grava, sem criá-lo: quem cria é o hook, na
 *  primeira vez que o chat abre. Ausente, o cabeçalho vai vazio e nenhuma
 *  conversa é liberada — que é o comportamento correto para quem nunca
 *  conversou. */
const sessaoChat = (() => {
  try {
    return localStorage.getItem('miseon_chat_session') ?? '';
  } catch {
    return ''; // SSR/prerender e navegador com storage bloqueado
  }
})();

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: sessaoChat ? { 'x-chat-session': sessaoChat } : {},
  },
  realtime: {
    params: {
      apikey: anon,
    },
  },
});
