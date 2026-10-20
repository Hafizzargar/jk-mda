import { createBrowserClient } from '@supabase/ssr';
import { requireEnv } from '@kjin/config';

export const supabase = createBrowserClient(
  requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
);

