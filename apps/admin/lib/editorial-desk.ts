import { SupabaseClient } from '@supabase/supabase-js';

export interface EditorialOfRecordSetting {
  enabled: boolean;
  volume_badge: string;
  title: string;
  quote: string;
  author_name: string;
  author_initials: string;
  institution_subtext: string;
  link_mode: 'opinion_category' | 'article' | 'custom';
  article_id?: string | null;
  custom_url?: string;
}

export interface CorridorVoiceItem {
  id: string;
  speaker: string;
  location: string;
  quote: string;
  district?: string;
  enabled: boolean;
  order: number;
}

export interface EditorialDeskSettings {
  editorial_of_record: EditorialOfRecordSetting;
  voices_of_corridors: CorridorVoiceItem[];
}

export const DEFAULT_EDITORIAL_OF_RECORD: EditorialOfRecordSetting = {
  enabled: true,
  volume_badge: 'Vol. LXXIV',
  title: 'The Pluralistic Pulse of the Corridors: Why Regional Federalism Matters',
  quote: 'Jammu and Kashmir’s socio-cultural geography has never been a monolithic plateau, but a rich confluence of mountain rivers, linguistic nuances, and shared resilience.',
  author_name: 'Editorial Board',
  author_initials: 'EB',
  institution_subtext: 'Srinagar & Jammu Joint Chancellery',
  link_mode: 'opinion_category',
  article_id: null,
  custom_url: '/category/opinion',
};

export const DEFAULT_VOICES_OF_CORRIDORS: CorridorVoiceItem[] = [
  {
    id: 'voice-kishtwar-saffron',
    speaker: 'Ghulam Rasool Wani',
    location: 'Padder, Kishtwar',
    quote: 'Our saffron harvest in Kishtwar requires authentic provenance certification if we are to compete with imports.',
    district: 'kishtwar',
    enabled: true,
    order: 1,
  },
  {
    id: 'voice-poonch-tourism',
    speaker: 'Fatima Bukhari',
    location: 'Surankote, Poonch',
    quote: 'Border tourism along Poonch’s historic Mughal route has brought our young homestay entrepreneurs new hope.',
    district: 'poonch',
    enabled: true,
    order: 2,
  },
  {
    id: 'voice-drass-transit',
    speaker: 'Stanzin Dorjey',
    location: 'Drass, Ladakh',
    quote: 'All-weather Z-Morh and Zojila passes aren’t just engineering marvels; they keep our families connected through six months of frozen isolation.',
    district: 'kargil',
    enabled: true,
    order: 3,
  },
];

export const DEFAULT_EDITORIAL_DESK_SETTINGS: EditorialDeskSettings = {
  editorial_of_record: DEFAULT_EDITORIAL_OF_RECORD,
  voices_of_corridors: DEFAULT_VOICES_OF_CORRIDORS,
};

export function sanitizeEditorialDeskSettings(
  raw: unknown
): EditorialDeskSettings {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_EDITORIAL_DESK_SETTINGS;
  }

  const obj = raw as Record<string, unknown>;

  // 1. Sanitize Editorial of Record
  const edRaw = (obj.editorial_of_record || {}) as Record<string, unknown>;
  const editorial_of_record: EditorialOfRecordSetting = {
    enabled: edRaw.enabled !== false,
    volume_badge: typeof edRaw.volume_badge === 'string' && edRaw.volume_badge.trim()
      ? edRaw.volume_badge.trim().slice(0, 50)
      : DEFAULT_EDITORIAL_OF_RECORD.volume_badge,
    title: typeof edRaw.title === 'string' && edRaw.title.trim()
      ? edRaw.title.trim().slice(0, 300)
      : DEFAULT_EDITORIAL_OF_RECORD.title,
    quote: typeof edRaw.quote === 'string' && edRaw.quote.trim()
      ? edRaw.quote.trim().slice(0, 1000)
      : DEFAULT_EDITORIAL_OF_RECORD.quote,
    author_name: typeof edRaw.author_name === 'string' && edRaw.author_name.trim()
      ? edRaw.author_name.trim().slice(0, 100)
      : DEFAULT_EDITORIAL_OF_RECORD.author_name,
    author_initials: typeof edRaw.author_initials === 'string' && edRaw.author_initials.trim()
      ? edRaw.author_initials.trim().slice(0, 6)
      : (typeof edRaw.author_name === 'string' && edRaw.author_name.trim()
          ? edRaw.author_name.split(' ').map(s => s[0]).join('').slice(0, 3).toUpperCase()
          : DEFAULT_EDITORIAL_OF_RECORD.author_initials),
    institution_subtext: typeof edRaw.institution_subtext === 'string' && edRaw.institution_subtext.trim()
      ? edRaw.institution_subtext.trim().slice(0, 150)
      : DEFAULT_EDITORIAL_OF_RECORD.institution_subtext,
    link_mode: edRaw.link_mode === 'article' || edRaw.link_mode === 'custom'
      ? edRaw.link_mode
      : 'opinion_category',
    article_id: typeof edRaw.article_id === 'string' && edRaw.article_id.trim()
      ? edRaw.article_id.trim()
      : null,
    custom_url: typeof edRaw.custom_url === 'string' && edRaw.custom_url.trim()
      ? edRaw.custom_url.trim().slice(0, 300)
      : DEFAULT_EDITORIAL_OF_RECORD.custom_url,
  };

  // 2. Sanitize Voices of Corridors
  const voicesRaw = Array.isArray(obj.voices_of_corridors)
    ? obj.voices_of_corridors
    : DEFAULT_VOICES_OF_CORRIDORS;

  const voices_of_corridors: CorridorVoiceItem[] = voicesRaw
    .filter((v): v is Record<string, unknown> => Boolean(v && typeof v === 'object'))
    .map((v, idx) => ({
      id: typeof v.id === 'string' && v.id.trim() ? v.id.trim() : `voice-${Date.now()}-${idx}`,
      speaker: typeof v.speaker === 'string' && v.speaker.trim() ? v.speaker.trim().slice(0, 100) : 'Citizen Correspondent',
      location: typeof v.location === 'string' && v.location.trim() ? v.location.trim().slice(0, 120) : 'J&K Territorial Corridor',
      quote: typeof v.quote === 'string' && v.quote.trim() ? v.quote.trim().slice(0, 1000) : '',
      district: typeof v.district === 'string' ? v.district.trim().toLowerCase() : undefined,
      enabled: v.enabled !== false,
      order: typeof v.order === 'number' ? v.order : idx + 1,
    }))
    .filter(v => Boolean(v.quote.trim()))
    .sort((a, b) => a.order - b.order);

  return {
    editorial_of_record,
    voices_of_corridors: voices_of_corridors.length > 0 ? voices_of_corridors : DEFAULT_VOICES_OF_CORRIDORS,
  };
}

export async function getEditorialDeskSettings(
  supabase: SupabaseClient
): Promise<EditorialDeskSettings> {
  try {
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'editorial_desk_settings')
      .maybeSingle();

    if (data?.value) {
      return sanitizeEditorialDeskSettings(data.value);
    }
  } catch (err) {
    console.warn('Failed to fetch editorial_desk_settings, falling back to defaults:', err);
  }

  return DEFAULT_EDITORIAL_DESK_SETTINGS;
}

