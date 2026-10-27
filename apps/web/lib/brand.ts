import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_NAVBAR_SETTINGS,
  type NavbarBrandConfig,
  sanitizeNavbarSettings,
} from './navbar';

/**
 * Universal Brand Settings accessor for apps/web.
 * Fetches dynamic brand identity (acronym name, full organization name, tagline, logo emblem)
 * from public.site_settings.
 */
export async function getBrandSettings(supabase: SupabaseClient): Promise<NavbarBrandConfig> {
  try {
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'navbar_settings')
      .maybeSingle();

    if (data?.value) {
      const sanitized = sanitizeNavbarSettings(data.value);
      if (sanitized.brand) {
        return sanitized.brand;
      }
    }
  } catch (err) {
    console.warn('[getBrandSettings] Falling back to default brand settings:', err);
  }
  return DEFAULT_NAVBAR_SETTINGS.brand;
}
