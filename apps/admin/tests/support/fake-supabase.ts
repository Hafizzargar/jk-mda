// Test double for `@supabase/supabase-js`, wired to the active test harness.
import { getHarness } from './harness.ts';

export function createClient(_url: string, key: string, options?: unknown) {
  return getHarness().createClient(key, options);
}

export function createServerClient(_url: string, key: string, options?: unknown) {
  return getHarness().createClient(key, options);
}

export type SupabaseClient = unknown;
export type User = { id: string };
