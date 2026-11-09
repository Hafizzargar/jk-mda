import { createClient } from '@supabase/supabase-js';
import { requireEnv } from '@kjin/config';

// Server-side anonymous client. Does not persist session since it runs on the server.
export function createServerAnonClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
    },
  });
}
