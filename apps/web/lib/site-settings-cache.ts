import type { SupabaseClient } from '@supabase/supabase-js';

let settingsCache: Map<string, unknown> | null = null;
let lastSettingsFetchTime = 0;
const SETTINGS_CACHE_TTL_MS = 60 * 1000; // 60 seconds

/**
 * Universal high-performance cache for public.site_settings.
 * Batches all settings into a single database round-trip and serves subsequent
 * reads from memory with a 60-second TTL to eliminate redundant waterfall requests.
 */
export async function getAllCachedSiteSettings(
  supabase: SupabaseClient
): Promise<Map<string, unknown>> {
  const now = Date.now();
  if (settingsCache && now - lastSettingsFetchTime < SETTINGS_CACHE_TTL_MS) {
    return settingsCache;
  }

  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('key, value');

    if (!error && data) {
      const map = new Map<string, unknown>();
      for (const row of data) {
        map.set(row.key, row.value);
      }
      settingsCache = map;
      lastSettingsFetchTime = now;
      return map;
    }
  } catch (err) {
    console.warn('[SiteSettingsCache] Failed to fetch settings, using fallback memory cache:', err);
  }

  return settingsCache || new Map<string, unknown>();
}

export async function getCachedSiteSetting<T = unknown>(
  supabase: SupabaseClient,
  key: string
): Promise<T | null> {
  const allSettings = await getAllCachedSiteSettings(supabase);
  return (allSettings.get(key) as T) ?? null;
}
