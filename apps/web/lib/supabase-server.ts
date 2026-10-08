import { createClient } from '@supabase/supabase-js';
import { requireEnv } from '@kjin/config';

// Server-side anonymous client. Does not persist session since it runs on the server.
export function createServerAnonClient() {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      auth: {
        persistSession: false,
      },
    }
  );
}
