import type { SupabaseClient } from '@supabase/supabase-js';
import { getCachedSiteSetting } from './site-settings-cache';

export type FestiveEffectType =
  | 'firelight_sparkles' // Ambient rising golden embers & warm firelight
  | 'fireworks'          // Sky burst fireworks with cascading particle physics
  | 'crescent_stars'     // Floating crescent lanterns & twinkling starlight
  | 'color_burst'        // Vibrant holi powder gulal bursts
  | 'tricolor_burst';    // Saffron, white & green national celebration

export interface FestiveCelebrationItem {
  id: string;
  occasion_name: string;
  greeting_title: string;
  greeting_message: string;
  effect_type: FestiveEffectType;
  colors: string[];
  start_date: string; // ISO or YYYY-MM-DDTHH:mm
  end_date: string;   // ISO or YYYY-MM-DDTHH:mm
  enabled: boolean;
  force_active_now?: boolean; // For manual testing override
  duration_seconds: number;
  play_frequency: 'once_per_session' | 'always';
  show_greeting_banner: boolean;
  sound_enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

// Backwards-compatible alias
export type FestiveCelebrationSettings = FestiveCelebrationItem;

export type CelebrationStatus = 'active' | 'scheduled' | 'ended' | 'disabled';

export const FESTIVE_PRESETS: Record<string, {
  label: string;
  icon: string;
  occasion_name: string;
  greeting_title: string;
  greeting_message: string;
  effect_type: FestiveEffectType;
  colors: string[];
  suggested_date?: string;
}> = {
  custom_28_nov: {
    label: '28 Nov (Special Important Day)',
    icon: '🌟',
    occasion_name: 'Special Broadsheet Occasion — 28 Nov',
    greeting_title: 'Commemorating 28 November',
    greeting_message: 'Marking this important day with dedicated coverage, cultural celebration, and community reflections.',
    effect_type: 'fireworks',
    colors: ['#F59E0B', '#06B6D4', '#8B5CF6', '#10B981'],
    suggested_date: '2026-11-28',
  },
  diwali: {
    label: 'Diwali (Festival of Lights)',
    icon: '🪔',
    occasion_name: 'Diwali — Festival of Lights',
    greeting_title: 'Happy Deepavali to All!',
    greeting_message: 'May the festival of lights bring peace, brightness, and warmth to every home across Jammu & Kashmir and Ladakh.',
    effect_type: 'firelight_sparkles',
    colors: ['#F59E0B', '#EF4444', '#FBBF24', '#D97706', '#FEF08A'],
    suggested_date: '2026-11-14',
  },
  eid: {
    label: 'Eid Mubarak',
    icon: '🌙',
    occasion_name: 'Eid Mubarak',
    greeting_title: 'Eid Mubarak to All!',
    greeting_message: 'Wishing peace, health, prosperity, and blessings to you and your loved ones across our corridors.',
    effect_type: 'crescent_stars',
    colors: ['#10B981', '#F59E0B', '#059669', '#FBBF24', '#34D399'],
    suggested_date: '2027-03-10',
  },
  holi: {
    label: 'Holi (Festival of Colors)',
    icon: '🎨',
    occasion_name: 'Holi — Festival of Colors',
    greeting_title: 'Happy Holi!',
    greeting_message: 'Celebrating the vibrant arrival of spring, friendship, and shared cultural joy across our communities.',
    effect_type: 'color_burst',
    colors: ['#EC4899', '#8B5CF6', '#F59E0B', '#10B981', '#06B6D4', '#F43F5E'],
    suggested_date: '2027-03-24',
  },
  national: {
    label: 'National Day (Tricolor)',
    icon: '🇮🇳',
    occasion_name: 'Republic Day — National Pride',
    greeting_title: 'Warm Greetings to All Citizens',
    greeting_message: 'Upholding democracy, integrity, and progress for every citizen across Jammu, Kashmir, and Ladakh.',
    effect_type: 'tricolor_burst',
    colors: ['#FF9933', '#FFFFFF', '#138808', '#000080'],
    suggested_date: '2027-01-26',
  },
};

export const DEFAULT_CELEBRATION_ITEMS: FestiveCelebrationItem[] = [
  {
    id: 'diwali-2026',
    occasion_name: 'Diwali — Festival of Lights',
    greeting_title: 'Happy Deepavali to All!',
    greeting_message: 'May the festival of lights bring peace, brightness, and warmth to every home across Jammu & Kashmir and Ladakh.',
    effect_type: 'firelight_sparkles',
    colors: ['#F59E0B', '#EF4444', '#FBBF24', '#D97706', '#FEF08A'],
    start_date: '2026-11-14T00:00',
    end_date: '2026-11-14T23:59',
    enabled: true,
    force_active_now: true,
    duration_seconds: 8,
    play_frequency: 'always',
    show_greeting_banner: true,
    sound_enabled: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'nov28-milestone',
    occasion_name: 'Special Broadsheet Occasion — 28 Nov',
    greeting_title: 'Commemorating 28 November',
    greeting_message: 'Marking this important day with dedicated coverage, cultural celebration, and community reflections.',
    effect_type: 'fireworks',
    colors: ['#F59E0B', '#06B6D4', '#8B5CF6', '#10B981'],
    start_date: '2026-11-28T00:00',
    end_date: '2026-11-28T23:59',
    enabled: true,
    force_active_now: false,
    duration_seconds: 10,
    play_frequency: 'always',
    show_greeting_banner: true,
    sound_enabled: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'eid-mubarak',
    occasion_name: 'Eid Mubarak',
    greeting_title: 'Eid Mubarak to All!',
    greeting_message: 'Wishing peace, health, prosperity, and blessings to you and your loved ones across our corridors.',
    effect_type: 'crescent_stars',
    colors: ['#10B981', '#F59E0B', '#059669', '#FBBF24', '#34D399'],
    start_date: '2027-03-10T00:00',
    end_date: '2027-03-12T23:59',
    enabled: true,
    force_active_now: false,
    duration_seconds: 8,
    play_frequency: 'always',
    show_greeting_banner: true,
    sound_enabled: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'republic-day',
    occasion_name: 'Republic Day — National Pride',
    greeting_title: 'Warm Greetings to All Citizens',
    greeting_message: 'Upholding democracy, integrity, and progress for every citizen across Jammu, Kashmir, and Ladakh.',
    effect_type: 'tricolor_burst',
    colors: ['#FF9933', '#FFFFFF', '#138808', '#000080'],
    start_date: '2027-01-26T00:00',
    end_date: '2027-01-26T23:59',
    enabled: true,
    force_active_now: false,
    duration_seconds: 8,
    play_frequency: 'always',
    show_greeting_banner: true,
    sound_enabled: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'holi-colors',
    occasion_name: 'Holi — Festival of Colors',
    greeting_title: 'Happy Holi!',
    greeting_message: 'Celebrating the vibrant arrival of spring, friendship, and shared cultural joy across our communities.',
    effect_type: 'color_burst',
    colors: ['#EC4899', '#8B5CF6', '#F59E0B', '#10B981', '#06B6D4', '#F43F5E'],
    start_date: '2027-03-24T00:00',
    end_date: '2027-03-25T23:59',
    enabled: true,
    force_active_now: false,
    duration_seconds: 8,
    play_frequency: 'always',
    show_greeting_banner: true,
    sound_enabled: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const DEFAULT_FESTIVE_SETTINGS: FestiveCelebrationItem = DEFAULT_CELEBRATION_ITEMS[0];

/**
 * Checks whether an individual celebration should actively render based on settings and time.
 */
export function isFestiveCelebrationActive(
  item: FestiveCelebrationItem | null | undefined,
  currentDate: Date = new Date()
): boolean {
  if (!item || !item.enabled) return false;
  if (item.force_active_now) return true;

  if (!item.start_date || !item.end_date) return false;
  const start = new Date(item.start_date).getTime();
  const end = new Date(item.end_date).getTime();
  const now = currentDate.getTime();
  return now >= start && now <= end;
}

/**
 * Calculates human-readable status for a celebration event.
 */
export function getCelebrationStatus(
  item: FestiveCelebrationItem,
  currentDate: Date = new Date()
): CelebrationStatus {
  if (!item.enabled) return 'disabled';
  if (item.force_active_now) return 'active';

  const start = new Date(item.start_date).getTime();
  const end = new Date(item.end_date).getTime();
  const now = currentDate.getTime();

  if (now >= start && now <= end) return 'active';
  if (now < start) return 'scheduled';
  return 'ended';
}

/**
 * Returns the currently active celebration from a list of celebrations.
 * Priority:
 * 1. An enabled item with force_active_now = true
 * 2. An enabled item whose start_date <= now <= end_date
 */
export function getActiveCelebration(
  items: FestiveCelebrationItem[],
  currentDate: Date = new Date()
): FestiveCelebrationItem | null {
  if (!Array.isArray(items) || items.length === 0) return null;

  // 1. Force active overrides
  const forced = items.find((i) => i.enabled && i.force_active_now);
  if (forced) return forced;

  // 2. Active by scheduled date
  const now = currentDate.getTime();
  const active = items.find((i) => {
    if (!i.enabled || !i.start_date || !i.end_date) return false;
    const s = new Date(i.start_date).getTime();
    const e = new Date(i.end_date).getTime();
    return now >= s && now <= e;
  });

  return active || null;
}

/**
 * Normalizes any celebration JSON from site_settings into a clean array of FestiveCelebrationItem.
 */
export function normalizeCelebrationItems(raw: unknown): FestiveCelebrationItem[] {
  if (!raw || typeof raw !== 'object') return DEFAULT_CELEBRATION_ITEMS;

  const data = raw as Record<string, unknown>;

  // Case 1: Already has items array
  if (Array.isArray(data.items) && data.items.length > 0) {
    return data.items.map((item, idx) => sanitizeCelebrationItem(item, `item-${idx}`));
  }

  // Case 2: Legacy single celebration object (has occasion_name)
  if (typeof data.occasion_name === 'string') {
    const single = sanitizeCelebrationItem(data, 'diwali-legacy');
    const filteredDefaults = DEFAULT_CELEBRATION_ITEMS.filter((d) => d.id !== single.id);
    return [single, ...filteredDefaults];
  }

  return DEFAULT_CELEBRATION_ITEMS;
}

/**
 * Sanitizes an individual celebration item, applying safe defaults.
 */
export function sanitizeCelebrationItem(
  raw: unknown,
  fallbackId: string = `celebration-${Date.now()}`
): FestiveCelebrationItem {
  const item = (raw && typeof raw === 'object' ? raw : {}) as Partial<FestiveCelebrationItem>;

  const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : fallbackId;
  const occasion_name = item.occasion_name?.trim() || 'Festive Celebration';
  const greeting_title = item.greeting_title?.trim() || `Happy ${occasion_name}!`;
  const greeting_message = item.greeting_message?.trim() || 'Warm greetings and joy to all citizens.';
  const effect_type = (item.effect_type && ['firelight_sparkles', 'fireworks', 'crescent_stars', 'color_burst', 'tricolor_burst'].includes(item.effect_type))
    ? item.effect_type
    : 'firelight_sparkles';

  const colors = Array.isArray(item.colors) && item.colors.length > 0
    ? item.colors.filter((c) => typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c))
    : ['#F59E0B', '#EF4444', '#FBBF24'];

  const start_date = item.start_date || '2026-11-14T00:00';
  const end_date = item.end_date || '2026-11-14T23:59';
  const enabled = typeof item.enabled === 'boolean' ? item.enabled : true;
  const force_active_now = typeof item.force_active_now === 'boolean' ? item.force_active_now : false;
  const duration_seconds = typeof item.duration_seconds === 'number' && item.duration_seconds >= 3 && item.duration_seconds <= 30
    ? item.duration_seconds
    : 8;
  const play_frequency = item.play_frequency === 'once_per_session' ? 'once_per_session' : 'always';
  const show_greeting_banner = typeof item.show_greeting_banner === 'boolean' ? item.show_greeting_banner : true;
  const sound_enabled = typeof item.sound_enabled === 'boolean' ? item.sound_enabled : false;

  return {
    id,
    occasion_name,
    greeting_title,
    greeting_message,
    effect_type,
    colors: colors.length > 0 ? colors : ['#F59E0B', '#EF4444'],
    start_date,
    end_date,
    enabled,
    force_active_now,
    duration_seconds,
    play_frequency,
    show_greeting_banner,
    sound_enabled,
    created_at: item.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Retrieves all celebrations and calculates the currently active celebration.
 */
export async function getAllCelebrations(
  supabase: SupabaseClient
): Promise<{ items: FestiveCelebrationItem[]; active: FestiveCelebrationItem | null }> {
  try {
    const rawValue = await getCachedSiteSetting(supabase, 'festive_celebration');

    if (!rawValue) {
      const items = DEFAULT_CELEBRATION_ITEMS;
      return { items, active: getActiveCelebration(items) };
    }

    const items = normalizeCelebrationItems(rawValue);
    const active = getActiveCelebration(items);
    return { items, active };
  } catch (err) {
    console.warn('Failed to get celebrations, using defaults:', err);
    return { items: DEFAULT_CELEBRATION_ITEMS, active: getActiveCelebration(DEFAULT_CELEBRATION_ITEMS) };
  }
}

/**
 * Returns the currently active festive celebration settings (backwards compatible).
 */
export async function getFestiveSettings(
  supabase: SupabaseClient
): Promise<FestiveCelebrationSettings | null> {
  const { active } = await getAllCelebrations(supabase);
  return active;
}
