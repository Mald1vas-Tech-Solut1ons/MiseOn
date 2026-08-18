import { createClient } from '@supabase/supabase-js';

const url = ((import.meta.env.VITE_SUPABASE_URL as string) || 'https://placeholder.supabase.co').replace(/%0A/g, '').replace(/[\r\n\s]+/g, '').trim();
const anon = ((import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'placeholder-anon-key').replace(/%0A/g, '').replace(/[\r\n\s]+/g, '').trim();

if (url.includes('placeholder')) {
  console.warn('Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(url, anon);
