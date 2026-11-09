import type { SupabaseClient } from '@supabase/supabase-js';

export type HomepageSectionId =
  | 'bureau_wire'
  | 'territorial_map'
  | 'conflict_radar'
  | 'lead_hero_group'
  | 'civic_problems'
  | 'international_wire'
  | 'editorial_record'
  | 'corridor_voices'
  | 'mountain_transit'
  | 'civic_partner'
  | 'discover_wire'
  | 'field_dispatches'
  | 'weather_sensors'
  | 'mandi_telemetry'
  | 'feature_dossiers';

export type HomepageColumnId = 'left' | 'center' | 'right' | 'full_width_bottom';

export interface SectionMetadata {
  id: HomepageSectionId;
  name: string;
  badge: string;
  icon: string;
  defaultColumn: HomepageColumnId;
  description: string;
}

export const HOMEPAGE_SECTION_META: Record<HomepageSectionId, SectionMetadata> = {
  bureau_wire: {
    id: 'bureau_wire',
    name: 'Bureau Wire',
    badge: 'Live Wire',
    icon: '📡',
    defaultColumn: 'left',
    description: 'Chronological field dispatches vetted by resident correspondents',
  },
  territorial_map: {
    id: 'territorial_map',
    name: 'Territorial Bureau Map',
    badge: 'Radar Sync',
    icon: '🗺️',
    defaultColumn: 'left',
    description: 'Live radar telemetry across 5 regional operational hubs with Open-Meteo',
  },
  conflict_radar: {
    id: 'conflict_radar',
    name: 'Conflict & War Radar',
    badge: 'Defense Alert',
    icon: '🚨',
    defaultColumn: 'left',
    description: 'Live international defense and conflict wire (UN Peacekeeping & Reuters)',
  },
  lead_hero_group: {
    id: 'lead_hero_group',
    name: 'Lead Hero & Sub-Leads',
    badge: 'Front Anchor',
    icon: '📰',
    defaultColumn: 'center',
    description: 'Lead investigative anchor, economic takeaways box, and 2 sub-lead stories',
  },
  civic_problems: {
    id: 'civic_problems',
    name: 'Problems & Civic Issues',
    badge: 'Grievances',
    icon: '🏛️',
    defaultColumn: 'right',
    description: 'Ground grievances and local civic issues desk',
  },
  international_wire: {
    id: 'international_wire',
    name: 'International Wire Spotlight',
    badge: 'World Desk',
    icon: '🌐',
    defaultColumn: 'right',
    description: 'Global diplomatic wire, UN General Assembly, and security intelligence',
  },
  editorial_record: {
    id: 'editorial_record',
    name: 'Editorial of Record',
    badge: 'Op-Ed',
    icon: '✒️',
    defaultColumn: 'right',
    description: 'Official broadsheet editorial, volume record, quote, and chancellery author',
  },
  corridor_voices: {
    id: 'corridor_voices',
    name: 'Voices of the Corridors',
    badge: 'Citizen Voices',
    icon: '🗣️',
    defaultColumn: 'right',
    description: 'Verified citizen quotes from Kishtwar, Poonch, Drass, Kashmir, and Jammu',
  },
  mountain_transit: {
    id: 'mountain_transit',
    name: 'Mountain Transit Status',
    badge: 'Pass Telemetry',
    icon: '🏔️',
    defaultColumn: 'right',
    description: 'Live passes & tunnels status (Peer Ki Gali, Zojila, Banihal, Sinthan Top)',
  },
  civic_partner: {
    id: 'civic_partner',
    name: 'Sponsored Partner Content',
    badge: 'Sponsor Unit',
    icon: '☀️',
    defaultColumn: 'right',
    description: 'Renewable infrastructure or verified sponsor unit (active when monetization on)',
  },
  discover_wire: {
    id: 'discover_wire',
    name: 'Discover & Frontier Sciences',
    badge: 'Science Desk',
    icon: '🔭',
    defaultColumn: 'full_width_bottom',
    description: 'Global planetary research, climate models, astrophysics & energy (Phys.org)',
  },
  field_dispatches: {
    id: 'field_dispatches',
    name: 'Broadsheet Dispatches',
    badge: 'News River',
    icon: '🗞️',
    defaultColumn: 'full_width_bottom',
    description: 'Full 4-column river of verified regional field dispatches with pagination',
  },
  weather_sensors: {
    id: 'weather_sensors',
    name: 'Meteorological Sensors',
    badge: 'Open-Meteo',
    icon: '🌡️',
    defaultColumn: 'full_width_bottom',
    description: 'Live 5-station satellite telemetry across Srinagar, Jammu, Chenab, Ladakh',
  },
  mandi_telemetry: {
    id: 'mandi_telemetry',
    name: 'Agricultural Mandi Prices',
    badge: 'Market Desk',
    icon: '🌾',
    defaultColumn: 'full_width_bottom',
    description: 'Commodity prices for Sopore Apple, Kishtwar Saffron, Basmati, Pashmina',
  },
  feature_dossiers: {
    id: 'feature_dossiers',
    name: 'Corridor Feature Dossiers',
    badge: 'In-Depth',
    icon: '📚',
    defaultColumn: 'full_width_bottom',
    description: 'Special investigative dossiers across Anantnag, Kargil, and Jammu corridors',
  },
};

export const ALL_HOMEPAGE_SECTION_IDS = Object.keys(HOMEPAGE_SECTION_META) as HomepageSectionId[];

export interface HomepageLayoutConfig {
  version: 1;
  columns: {
    left: HomepageSectionId[];
    center: HomepageSectionId[];
    right: HomepageSectionId[];
    full_width_bottom: HomepageSectionId[];
  };
  hidden: HomepageSectionId[];
  updated_at?: string;
  updated_by?: string;
}

export const DEFAULT_HOMEPAGE_LAYOUT: HomepageLayoutConfig = {
  version: 1,
  columns: {
    left: ['bureau_wire', 'territorial_map', 'conflict_radar'],
    center: ['lead_hero_group'],
    right: [
      'civic_problems',
      'international_wire',
      'editorial_record',
      'corridor_voices',
      'mountain_transit',
      'civic_partner',
    ],
    full_width_bottom: [
      'discover_wire',
      'field_dispatches',
      'weather_sensors',
      'mandi_telemetry',
      'feature_dossiers',
    ],
  },
  hidden: [],
};

export function sanitizeHomepageLayout(input: unknown): HomepageLayoutConfig {
  if (!input || typeof input !== 'object') {
    return DEFAULT_HOMEPAGE_LAYOUT;
  }

  const raw = input as Record<string, unknown>;
  const rawColumns = (raw.columns && typeof raw.columns === 'object' ? raw.columns : {}) as Record<string, unknown>;

  const filterValidIds = (arr: unknown): HomepageSectionId[] => {
    if (!Array.isArray(arr)) return [];
    return arr.filter((item): item is HomepageSectionId => typeof item === 'string' && item in HOMEPAGE_SECTION_META);
  };

  const left = filterValidIds(rawColumns.left);
  const center = filterValidIds(rawColumns.center);
  const right = filterValidIds(rawColumns.right);
  const fullWidthBottom = filterValidIds(rawColumns.full_width_bottom);
  const hidden = filterValidIds(raw.hidden);

  if (left.length === 0 && center.length === 0 && right.length === 0 && fullWidthBottom.length === 0) {
    return DEFAULT_HOMEPAGE_LAYOUT;
  }

  const allPlaced = new Set([...left, ...center, ...right, ...fullWidthBottom, ...hidden]);
  if (!allPlaced.has('lead_hero_group')) {
    center.unshift('lead_hero_group');
  }

  return {
    version: 1,
    columns: {
      left,
      center,
      right,
      full_width_bottom: fullWidthBottom,
    },
    hidden,
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : undefined,
    updated_by: typeof raw.updated_by === 'string' ? raw.updated_by : undefined,
  };
}

export async function getHomepageLayout(supabase: SupabaseClient): Promise<HomepageLayoutConfig> {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'homepage_layout')
      .maybeSingle();

    if (error || !data?.value) {
      return DEFAULT_HOMEPAGE_LAYOUT;
    }
    return sanitizeHomepageLayout(data.value);
  } catch (err) {
    console.warn('[HomepageLayout] Failed to read homepage_layout, using default:', err);
    return DEFAULT_HOMEPAGE_LAYOUT;
  }
}

