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

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      apikey: anon,
    },
  },
});
