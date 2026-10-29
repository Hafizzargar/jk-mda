import {
  DEFAULT_NAVBAR_SETTINGS,
  type NavbarBrandConfig,
  getNavbarSettings,
} from './navbar';

/**
 * Universal Brand Settings accessor for apps/web.
 * Fetches dynamic brand identity (acronym name, full organization name, tagline, logo emblem)
 * using the high-performance in-memory site settings cache.
 */
export async function getBrandSettings(supabase: SupabaseClient): Promise<NavbarBrandConfig> {
  try {
    const navbar = await getNavbarSettings(supabase);
    if (navbar.brand) {
      return navbar.brand;
    }
  } catch (err) {
    console.warn('[getBrandSettings] Falling back to default brand settings:', err);
  }
  return DEFAULT_NAVBAR_SETTINGS.brand;
}
