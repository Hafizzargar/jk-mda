import type { SupabaseClient } from '@supabase/supabase-js';

export interface HomepageCurationSettings {
  lead_hero_id: string | null;
  sub_lead_ids: string[];
  wire_ids: string[];
  dossier_ids: string[];
  editorial_id: string | null;
  developing_headline?: string;
  developing_is_active?: boolean;
  developing_article_id?: string | null;
  corridor_assignments?: Record<string, string>; // corridorId -> articleId
  takeaways?: string[];
  last_curated_at?: string;
  curated_by?: string;
}

export const DEFAULT_CURATION_SETTINGS: HomepageCurationSettings = {
  lead_hero_id: null, // null = auto-select top trending
  sub_lead_ids: [],
  wire_ids: [],
  dossier_ids: [],
  editorial_id: null,
  developing_headline: '',
  developing_is_active: false,
  developing_article_id: null,
  corridor_assignments: {},
  takeaways: [],
};

export async function getCurationSettings(supabase: SupabaseClient): Promise<HomepageCurationSettings> {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'homepage_curation')
      .maybeSingle();

    if (error || !data?.value) {
      return DEFAULT_CURATION_SETTINGS;
    }

    const val = data.value as Partial<HomepageCurationSettings>;
    return {
      lead_hero_id: val.lead_hero_id ?? DEFAULT_CURATION_SETTINGS.lead_hero_id,
      sub_lead_ids: Array.isArray(val.sub_lead_ids) ? val.sub_lead_ids : [],
      wire_ids: Array.isArray(val.wire_ids) ? val.wire_ids : [],
      dossier_ids: Array.isArray(val.dossier_ids) ? val.dossier_ids : [],
      editorial_id: val.editorial_id ?? DEFAULT_CURATION_SETTINGS.editorial_id,
      developing_headline: val.developing_headline ?? '',
      developing_is_active: Boolean(val.developing_is_active),
      developing_article_id: val.developing_article_id ?? null,
      corridor_assignments: val.corridor_assignments ?? {},
      takeaways: Array.isArray(val.takeaways) ? val.takeaways : [],
      last_curated_at: val.last_curated_at,
      curated_by: val.curated_by,
    };
  } catch (err) {
    console.warn('[Curation] Failed to fetch homepage_curation, using defaults:', err);
    return DEFAULT_CURATION_SETTINGS;
  }
}
