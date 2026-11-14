import type { SupabaseClient } from '@supabase/supabase-js';

export type FestiveEffectType =
  | 'firelight_sparkles' // Ambient rising golden embers & warm firelight
  | 'fireworks'          // Sky burst fireworks with cascading particle physics
  | 'crescent_stars'     // Floating crescent lanterns & twinkling starlight
  | 'color_burst'        // Vibrant holi powder gulal bursts
  | 'tricolor_burst';    // Saffron, white & green national celebration

export interface FestiveCelebrationSettings {
  enabled: boolean;
  force_active_now: boolean; // Overrides schedule for immediate test
  mode: 'scheduled' | 'manual';
  start_date: string; // ISO or YYYY-MM-DDTHH:mm
  end_date: string;   // ISO or YYYY-MM-DDTHH:mm
  occasion_name: string;
  greeting_title: string;
  greeting_message: string;
  effect_type: FestiveEffectType;
  colors: string[];
  duration_seconds: number;
  play_frequency: 'once_per_session' | 'always';
  show_greeting_banner: boolean;
  sound_enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

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
  diwali: {
    label: 'Diwali (Festival of Lights)',
    icon: '🪔',
    occasion_name: 'Diwali — Festival of Lights',
    greeting_title: 'Happy Deepavali!',
    greeting_message: 'May the festival of lights bring peace, brightness, and warmth to every home across Jammu & Kashmir and Ladakh.',
    effect_type: 'firelight_sparkles',
    colors: ['#F59E0B', '#EF4444', '#FBBF24', '#D97706', '#FEF08A'],
  },
  eid: {
    label: 'Eid Mubarak',
    icon: '🌙',
    occasion_name: 'Eid Mubarak',
    greeting_title: 'Eid Mubarak to All!',
    greeting_message: 'Wishing peace, health, prosperity, and blessings to you and your loved ones across our corridors.',
    effect_type: 'crescent_stars',
    colors: ['#10B981', '#F59E0B', '#059669', '#FBBF24', '#34D399'],
  },
  holi: {
    label: 'Holi (Festival of Colors)',
    icon: '🎨',
    occasion_name: 'Holi — Festival of Colors',
    greeting_title: 'Happy Holi!',
    greeting_message: 'Celebrating the vibrant arrival of spring, friendship, and shared cultural joy across our communities.',
    effect_type: 'color_burst',
    colors: ['#EC4899', '#8B5CF6', '#F59E0B', '#10B981', '#06B6D4', '#F43F5E'],
  },
  national: {
    label: 'National Day (Tricolor)',
    icon: '🇮🇳',
    occasion_name: 'National Celebration',
    greeting_title: 'Warm Greetings to All Citizens',
    greeting_message: 'Upholding democracy, integrity, and progress for every citizen across Jammu, Kashmir, and Ladakh.',
    effect_type: 'tricolor_burst',
    colors: ['#FF9933', '#FFFFFF', '#138808', '#000080'],
  },
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
};

export const DEFAULT_FESTIVE_SETTINGS: FestiveCelebrationSettings = {
  enabled: true,
  force_active_now: true,
  mode: 'scheduled',
  start_date: '2026-11-14T00:00',
  end_date: '2026-11-14T23:59',
  occasion_name: 'Diwali — Festival of Lights',
  greeting_title: 'Happy Deepavali to All!',
  greeting_message: 'May the festival of lights bring peace, brightness, and warmth to every home across Jammu & Kashmir and Ladakh.',
  effect_type: 'firelight_sparkles',
  colors: ['#F59E0B', '#EF4444', '#FBBF24', '#D97706', '#10B981'],
  duration_seconds: 8,
  play_frequency: 'always',
  show_greeting_banner: true,
  sound_enabled: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/**
 * Checks whether the festive celebration should actively render based on settings and current time.
 */
export function isFestiveCelebrationActive(
  settings: FestiveCelebrationSettings | null | undefined,
  currentDate: Date = new Date()
): boolean {
  if (!settings || !settings.enabled) return false;
  if (settings.force_active_now) return true;

  if (settings.mode === 'manual') return true;

  if (settings.mode === 'scheduled') {
    if (!settings.start_date || !settings.end_date) return false;
    const start = new Date(settings.start_date).getTime();
    const end = new Date(settings.end_date).getTime();
    const now = currentDate.getTime();
    return now >= start && now <= end;
  }

  return false;
}

export async function getFestiveSettings(
  supabase: SupabaseClient
): Promise<FestiveCelebrationSettings> {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'festive_celebration')
      .maybeSingle();

    if (error || !data || !data.value) {
      return DEFAULT_FESTIVE_SETTINGS;
    }

    const val = data.value as Partial<FestiveCelebrationSettings>;
    return {
      enabled: typeof val.enabled === 'boolean' ? val.enabled : DEFAULT_FESTIVE_SETTINGS.enabled,
      force_active_now: typeof val.force_active_now === 'boolean' ? val.force_active_now : false,
      mode: val.mode || DEFAULT_FESTIVE_SETTINGS.mode,
      start_date: val.start_date || DEFAULT_FESTIVE_SETTINGS.start_date,
      end_date: val.end_date || DEFAULT_FESTIVE_SETTINGS.end_date,
      occasion_name: val.occasion_name || DEFAULT_FESTIVE_SETTINGS.occasion_name,
      greeting_title: val.greeting_title || DEFAULT_FESTIVE_SETTINGS.greeting_title,
      greeting_message: val.greeting_message || DEFAULT_FESTIVE_SETTINGS.greeting_message,
      effect_type: val.effect_type || DEFAULT_FESTIVE_SETTINGS.effect_type,
      colors: Array.isArray(val.colors) && val.colors.length > 0 ? val.colors : DEFAULT_FESTIVE_SETTINGS.colors,
      duration_seconds: typeof val.duration_seconds === 'number' ? val.duration_seconds : DEFAULT_FESTIVE_SETTINGS.duration_seconds,
      play_frequency: val.play_frequency || DEFAULT_FESTIVE_SETTINGS.play_frequency,
      show_greeting_banner: typeof val.show_greeting_banner === 'boolean' ? val.show_greeting_banner : true,
      sound_enabled: typeof val.sound_enabled === 'boolean' ? val.sound_enabled : false,
      created_at: val.created_at || DEFAULT_FESTIVE_SETTINGS.created_at,
      updated_at: val.updated_at || DEFAULT_FESTIVE_SETTINGS.updated_at,
    };
  } catch (err) {
    console.error('Failed to get festive celebration settings:', err);
    return DEFAULT_FESTIVE_SETTINGS;
  }
}

