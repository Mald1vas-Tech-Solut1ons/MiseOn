import { createClient } from '@supabase/supabase-js';
import { registrarEventoAuth } from './authCallback';
import { fetchComSessaoChat } from './sessaoChat';

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



/** A credencial do chat é lida no envio REST, compartilhada com useChat. */
export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    // Não acrescenta headers ao OAuth nem às Edge Functions.
    fetch: fetchComSessaoChat(url),
  },
  realtime: {
    params: {
      apikey: anon,
    },
  },
});

// O listener nasce com o cliente, antes das rotas lazy montarem.
supabase.auth.onAuthStateChange((event) => registrarEventoAuth(event));
