import type { SupabaseClient } from '@supabase/supabase-js';

export interface NavItemConfig {
  id: string;
  label: string;
  slug: string;
  enabled: boolean;
}

export interface NavbarLanguagesConfig {
  enabled: boolean;
  en: boolean;
  ur: boolean;
  ks: boolean;
  hi: boolean;
}

export interface NavbarBrandConfig {
  logo_url: string;
  show_logo_image: boolean;
  name: string;
  full_name?: string;
  show_name: boolean;
  tagline: string;
  show_tagline: boolean;
  loader_text?: string;
  show_loader_emblem?: boolean;
  est_badge_text?: string;
  show_est_badge?: boolean;
}

export interface NavbarTopStripConfig {
  enabled: boolean;
  show_date: boolean;
  show_live_wire: boolean;
  live_wire_label: string;
  center_banner_text: string;
  show_center_banner: boolean;
}

export interface NavbarActionsConfig {
  show_regions_dropdown: boolean;
  show_latest_wire_badge: boolean;
  latest_wire_label: string;
  show_submit_tip: boolean;
  submit_tip_label: string;
  submit_tip_url: string;
  daily_corridor_rotation?: boolean;
}

export interface TerritorialCorridor {
  id: string;
  name: string;
  slug: string;
  dotColor: string;
  activeClass: string;
  idleClass: string;
}

export const BASE_TERRITORIAL_CORRIDORS: TerritorialCorridor[] = [
  {
    id: 'kashmir',
    name: 'Kashmir Valley',
    slug: 'kashmir',
    dotColor: 'bg-emerald-600',
    activeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold',
    idleClass: 'bg-white border-stone-300 text-emerald-900 hover:bg-emerald-50/80',
  },
  {
    id: 'chenab-valley',
    name: 'Chenab Valley',
    slug: 'chenab-valley',
    dotColor: 'bg-cyan-600',
    activeClass: 'bg-cyan-100 text-cyan-900 border-cyan-300 font-bold',
    idleClass: 'bg-white border-stone-300 text-cyan-900 hover:bg-cyan-50/80',
  },
  {
    id: 'pir-panjal',
    name: 'Pir Panjal',
    slug: 'pir-panjal',
    dotColor: 'bg-purple-600',
    activeClass: 'bg-purple-100 text-purple-900 border-purple-300 font-bold',
    idleClass: 'bg-white border-stone-300 text-purple-900 hover:bg-purple-50/80',
  },
  {
    id: 'jammu',
    name: 'Jammu Plains',
    slug: 'jammu',
    dotColor: 'bg-amber-600',
    activeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
    idleClass: 'bg-white border-stone-300 text-amber-900 hover:bg-amber-50/80',
  },
  {
    id: 'leh',
    name: 'Leh & Ladakh',
    slug: 'leh',
    dotColor: 'bg-blue-600',
    activeClass: 'bg-blue-100 text-blue-900 border-blue-300 font-bold',
    idleClass: 'bg-white border-stone-300 text-blue-900 hover:bg-blue-50/80',
  },
];

/**
 * Calculates daily cyclic rotation of the 5 regional corridors.
 * On Oct 27, 2026, offset is 0 (Kashmir Valley leads).
 * On Oct 28, 2026, offset is 1 (Chenab Valley leads, followed by Kashmir Valley and other corridors),
 * shifting +1 in position every day.
 */
export function getDailyRotatedCorridors<T>(
  corridors: T[] = BASE_TERRITORIAL_CORRIDORS as unknown as T[],
  currentDate: Date = new Date(),
  mode: 'lead-first' | 'cyclic' = 'lead-first'
): T[] {
  if (!corridors || corridors.length <= 1) return corridors;
  const refMidnight = Date.UTC(2026, 9, 27); // Oct 27, 2026 anchor (month is 0-indexed: 9 = Oct)
  const currentMidnight = Date.UTC(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate()
  );
  const diffDays = Math.floor((currentMidnight - refMidnight) / (1000 * 60 * 60 * 24));
  const leadIndex = ((diffDays % corridors.length) + corridors.length) % corridors.length;

  if (mode === 'lead-first') {
    const lead = corridors[leadIndex];
    const others = corridors.filter((_, idx) => idx !== leadIndex);
    return [lead, ...others];
  }

  return [...corridors.slice(leadIndex), ...corridors.slice(0, leadIndex)];
}

export interface NavbarSettings {
  brand: NavbarBrandConfig;
  nav_items: NavItemConfig[];
  languages: NavbarLanguagesConfig;
  top_strip: NavbarTopStripConfig;
  actions: NavbarActionsConfig;
}

export const DEFAULT_NAVBAR_SETTINGS: NavbarSettings = {
  brand: {
    logo_url: '/kjin-emblem.png',
    show_logo_image: true,
    name: 'KJIN',
    full_name: 'Kashmir & Jammu Information Network',
    show_name: true,
    tagline: 'J&K Journal of Record',
    show_tagline: true,
    loader_text: 'Jammu & Kashmir Journal of Record',
    show_loader_emblem: true,
    est_badge_text: 'EST. 1948',
    show_est_badge: true,
  },
  nav_items: [
    { id: 'national', label: 'NATIONAL', slug: 'india', enabled: true },
    { id: 'international', label: 'INTERNATIONAL', slug: 'international', enabled: true },
    { id: 'politics', label: 'Politics', slug: 'politics', enabled: false },
    { id: 'local', label: 'Local', slug: 'local', enabled: false },
    { id: 'economy', label: 'Economy', slug: 'economy', enabled: false },
    { id: 'culture', label: 'Culture', slug: 'culture', enabled: false },
    { id: 'investigation', label: 'Investigation', slug: 'investigation', enabled: false },
    { id: 'sports', label: 'Sports', slug: 'sports', enabled: false },
  ],
  languages: {
    enabled: true,
    en: true,
    ur: true,
    ks: true,
    hi: true,
  },
  top_strip: {
    enabled: true,
    show_date: true,
    show_live_wire: true,
    live_wire_label: 'Live Verified Wire',
    center_banner_text: 'Jammu & Kashmir Journal of Record',
    show_center_banner: true,
  },
  actions: {
    show_regions_dropdown: true,
    show_latest_wire_badge: true,
    latest_wire_label: 'Latest Wire',
    show_submit_tip: true,
    submit_tip_label: 'Submit Tip',
    submit_tip_url: 'mailto:editorial@kjin.org?subject=News%20Tip%20Dispatch',
    daily_corridor_rotation: true,
  },
};

export function sanitizeNavbarSettings(raw: unknown): NavbarSettings {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_NAVBAR_SETTINGS;
  }

  const obj = raw as Record<string, unknown>;
  const rawBrand = (obj.brand && typeof obj.brand === 'object' ? obj.brand : {}) as Record<string, unknown>;
  const rawLanguages = (obj.languages && typeof obj.languages === 'object' ? obj.languages : {}) as Record<string, unknown>;
  const rawTopStrip = (obj.top_strip && typeof obj.top_strip === 'object' ? obj.top_strip : {}) as Record<string, unknown>;
  const rawActions = (obj.actions && typeof obj.actions === 'object' ? obj.actions : {}) as Record<string, unknown>;

  const brand: NavbarBrandConfig = {
    logo_url: typeof rawBrand.logo_url === 'string' && rawBrand.logo_url.trim() ? rawBrand.logo_url.trim() : DEFAULT_NAVBAR_SETTINGS.brand.logo_url,
    show_logo_image: typeof rawBrand.show_logo_image === 'boolean' ? rawBrand.show_logo_image : true,
    name: typeof rawBrand.name === 'string' && rawBrand.name.trim() ? rawBrand.name.trim().slice(0, 50) : DEFAULT_NAVBAR_SETTINGS.brand.name,
    full_name: typeof rawBrand.full_name === 'string' ? rawBrand.full_name.trim().slice(0, 150) : (DEFAULT_NAVBAR_SETTINGS.brand.full_name || ''),
    show_name: typeof rawBrand.show_name === 'boolean' ? rawBrand.show_name : true,
    tagline: typeof rawBrand.tagline === 'string' ? rawBrand.tagline.trim().slice(0, 100) : DEFAULT_NAVBAR_SETTINGS.brand.tagline,
    show_tagline: typeof rawBrand.show_tagline === 'boolean' ? rawBrand.show_tagline : true,
    loader_text: typeof rawBrand.loader_text === 'string' ? rawBrand.loader_text.trim().slice(0, 150) : (DEFAULT_NAVBAR_SETTINGS.brand.loader_text || ''),
    show_loader_emblem: typeof rawBrand.show_loader_emblem === 'boolean' ? rawBrand.show_loader_emblem : true,
    est_badge_text: typeof rawBrand.est_badge_text === 'string' ? rawBrand.est_badge_text.trim().slice(0, 30) : (DEFAULT_NAVBAR_SETTINGS.brand.est_badge_text || 'EST. 1948'),
    show_est_badge: typeof rawBrand.show_est_badge === 'boolean' ? rawBrand.show_est_badge : true,
  };

  const defaultItemMap = new Map(DEFAULT_NAVBAR_SETTINGS.nav_items.map((i) => [i.id, i]));
  let nav_items: NavItemConfig[] = [];

  if (Array.isArray(obj.nav_items)) {
    nav_items = obj.nav_items
      .filter((item): item is Record<string, unknown> => item && typeof item === 'object')
      .map((item) => {
        const id = String(item.id || '').toLowerCase().replace(/[^a-z0-9-_]/g, '').slice(0, 40);
        const fallback = defaultItemMap.get(id);
        const label = typeof item.label === 'string' && item.label.trim()
          ? item.label.trim().slice(0, 40)
          : fallback?.label || id;
        const slug = typeof item.slug === 'string' && item.slug.trim()
          ? item.slug.trim().toLowerCase().slice(0, 40)
          : fallback?.slug || id;
        const enabled = typeof item.enabled === 'boolean' ? item.enabled : true;
        return { id, label, slug, enabled };
      })
      .filter((item) => item.id.length > 0);
  }

  if (nav_items.length === 0) {
    nav_items = [...DEFAULT_NAVBAR_SETTINGS.nav_items];
  }

  const languages: NavbarLanguagesConfig = {
    enabled: typeof rawLanguages.enabled === 'boolean' ? rawLanguages.enabled : true,
    en: typeof rawLanguages.en === 'boolean' ? rawLanguages.en : true,
    ur: typeof rawLanguages.ur === 'boolean' ? rawLanguages.ur : true,
    ks: typeof rawLanguages.ks === 'boolean' ? rawLanguages.ks : true,
    hi: typeof rawLanguages.hi === 'boolean' ? rawLanguages.hi : true,
  };

  const top_strip: NavbarTopStripConfig = {
    enabled: typeof rawTopStrip.enabled === 'boolean' ? rawTopStrip.enabled : true,
    show_date: typeof rawTopStrip.show_date === 'boolean' ? rawTopStrip.show_date : true,
    show_live_wire: typeof rawTopStrip.show_live_wire === 'boolean' ? rawTopStrip.show_live_wire : true,
    live_wire_label: typeof rawTopStrip.live_wire_label === 'string' && rawTopStrip.live_wire_label.trim()
      ? rawTopStrip.live_wire_label.trim().slice(0, 40)
      : DEFAULT_NAVBAR_SETTINGS.top_strip.live_wire_label,
    center_banner_text: typeof rawTopStrip.center_banner_text === 'string' && rawTopStrip.center_banner_text.trim()
      ? rawTopStrip.center_banner_text.trim().slice(0, 100)
      : DEFAULT_NAVBAR_SETTINGS.top_strip.center_banner_text,
    show_center_banner: typeof rawTopStrip.show_center_banner === 'boolean' ? rawTopStrip.show_center_banner : true,
  };

  const actions: NavbarActionsConfig = {
    show_regions_dropdown: typeof rawActions.show_regions_dropdown === 'boolean' ? rawActions.show_regions_dropdown : true,
    show_latest_wire_badge: typeof rawActions.show_latest_wire_badge === 'boolean' ? rawActions.show_latest_wire_badge : true,
    latest_wire_label: typeof rawActions.latest_wire_label === 'string' && rawActions.latest_wire_label.trim()
      ? rawActions.latest_wire_label.trim().slice(0, 30)
      : DEFAULT_NAVBAR_SETTINGS.actions.latest_wire_label,
    show_submit_tip: typeof rawActions.show_submit_tip === 'boolean' ? rawActions.show_submit_tip : true,
    submit_tip_label: typeof rawActions.submit_tip_label === 'string' && rawActions.submit_tip_label.trim()
      ? rawActions.submit_tip_label.trim().slice(0, 30)
      : DEFAULT_NAVBAR_SETTINGS.actions.submit_tip_label,
    submit_tip_url: typeof rawActions.submit_tip_url === 'string' && rawActions.submit_tip_url.trim()
      ? rawActions.submit_tip_url.trim().slice(0, 200)
      : DEFAULT_NAVBAR_SETTINGS.actions.submit_tip_url,
    daily_corridor_rotation: typeof rawActions.daily_corridor_rotation === 'boolean' ? rawActions.daily_corridor_rotation : true,
  };

  return {
    brand,
    nav_items,
    languages,
    top_strip,
    actions,
  };
}

export async function getNavbarSettings(supabase: SupabaseClient): Promise<NavbarSettings> {
  try {
    const { data: settingRow, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'navbar_settings')
      .maybeSingle();

    if (error || !settingRow?.value) {
      return DEFAULT_NAVBAR_SETTINGS;
    }

    return sanitizeNavbarSettings(settingRow.value);
  } catch (err) {
    console.error('[getNavbarSettings] Failed to fetch settings, using fallback default:', err);
    return DEFAULT_NAVBAR_SETTINGS;
  }
}
