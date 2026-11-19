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

// Server-side service role client. Bypasses RLS for trusted newsroom operations.
export function createServerServiceClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
