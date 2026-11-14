import type { SupabaseClient } from '@supabase/supabase-js';

export type FestiveEffectType =
  | 'firelight_sparkles' // Ambient rising golden embers & warm firelight
  | 'fireworks'          // Sky burst fireworks with cascading particle physics
  | 'crescent_stars'     // Floating crescent lanterns & twinkling starlight
  | 'color_burst'        // Vibrant holi powder gulal bursts
  | 'tricolor_burst';    // Saffron, white & green national celebration

export interface FestiveCelebrationSettings {
  enabled: boolean;
  force_active_now: boolean;
  mode: 'scheduled' | 'manual';
  start_date: string;
  end_date: string;
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
};

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
    };
  } catch (err) {
    console.error('Failed to get festive celebration settings:', err);
    return DEFAULT_FESTIVE_SETTINGS;
  }
}

