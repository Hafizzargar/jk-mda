import type { SupabaseClient } from '@supabase/supabase-js';

export interface CategoryOption {
  value: string;
  label: string;
  description: string;
}

export const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: 'Local News', label: 'Local News — J&K Daily Ground Dispatches & Regional Events', description: 'Daily district news, local developments, community bulletins, and grassroots reporting across J&K' },
  { value: 'Problems', label: 'Problems — Editorial Investigations & Civic Grievances (By Editor)', description: 'In-depth citizen issues, road/water/power breakdowns, hospital shortages, and ground grievances raised on J&K issues' },
  { value: 'National', label: 'National — Union Affairs & Pan-India Policy', description: 'National governance, union ministry directives, Supreme Court rulings, and national security' },
  { value: 'International', label: 'International — Global & Diaspora Relations', description: 'Global developments, diaspora connections, trade diplomacy, and cross-border relations' },
  { value: 'Investigation', label: 'Investigation — In-Depth & Accountability', description: 'Investigative reporting, policy audits, and environmental/public funds investigations' },
  { value: 'Politics', label: 'Politics — Governance & Assemblies', description: 'Elections, legislative deliberations, administrative policy, and public affairs' },
  { value: 'Economy', label: 'Economy — Agriculture, Trade & Industry', description: 'Apple harvests, saffron, horticulture, trade corridors, and tourism' },
  { value: 'Science & Technology', label: 'Science & Technology — Innovation & Digital', description: 'Science, technology, AI, computing, space, and research developments' },
  { value: 'Culture', label: 'Culture — Heritage, Arts & Traditions', description: 'Oral histories, crafts, architecture, and festivals of Jammu and Kashmir' },
  { value: 'Sports', label: 'Sports — Athletics & Youth Affairs', description: 'Tournaments, mountain marathons, cricket, and youth sports' },
  { value: 'Education', label: 'Education — Universities & Schools', description: 'Colleges, research patents, literacy, and student affairs' },
  { value: 'Opinion', label: 'Opinion — Columns & Editorials', description: 'Guest essays, expert analysis, and editorial board stances' },
  { value: 'General', label: 'General — Regional News Bulletins', description: 'General interest dispatches and public announcements' },
];

export const NEWS_SCOPES = [
  { value: 'Local News (J&K)', label: '🏔️ Local News (Jammu & Kashmir)', description: 'Grassroots reporting, district news, UT governance, and valley reporting' },
  { value: 'National', label: '🇮🇳 National News (India)', description: 'Union policy, Parliament, Supreme Court, national economy, and pan-India affairs' },
  { value: 'International', label: '🌍 International News (World)', description: 'Global developments, multilateral diplomacy, foreign affairs, and world reports' },
] as const;

export type NewsScopeValue = (typeof NEWS_SCOPES)[number]['value'];

export const NEWS_TOPICS = [
  { value: 'Politics', label: 'Politics — Governance & Assemblies' },
  { value: 'Economy', label: 'Economy — Business, Markets & Trade' },
  { value: 'Science & Technology', label: 'Science & Technology — Innovation & Digital' },
  { value: 'Sports', label: 'Sports — Athletics & Youth Affairs' },
  { value: 'Education', label: 'Education — Schools & Academia' },
  { value: 'Culture', label: 'Culture — Heritage, Arts & Traditions' },
  { value: 'Problems', label: 'Problems — Civic Grievances & Public Issues' },
  { value: 'Investigation', label: 'Investigation — Accountability & In-Depth' },
  { value: 'Opinion', label: 'Opinion — Columns & Perspectives' },
  { value: 'General', label: 'General — News Bulletins & Breaking' },
] as const;

export type NewsTopicValue = (typeof NEWS_TOPICS)[number]['value'];

export interface DynamicCategoryItem {
  id?: string;
  value: string;
  label: string;
  slug: string;
  description: string;
  is_active: boolean;
}

export function formatCategoryOptions(
  dbCategories: Array<{ id?: string; name_en?: string; slug?: string; description?: string; is_active?: boolean }>
): DynamicCategoryItem[] {
  if (!dbCategories || dbCategories.length === 0) {
    return CATEGORY_OPTIONS.map((c) => ({
      value: c.value,
      label: c.label,
      slug: c.value.toLowerCase().replace(/\s+/g, '-'),
      description: c.description,
      is_active: true,
    }));
  }

  return dbCategories.map((c) => {
    const name = (c.name_en || c.slug || 'General').trim();
    const existing = CATEGORY_OPTIONS.find(
      (o) =>
        o.value.toLowerCase() === (c.slug || '').toLowerCase() ||
        o.value.toLowerCase() === name.toLowerCase() ||
        (c.slug === 'local' && (o.value.toLowerCase() === 'local news' || o.value.toLowerCase() === 'local'))
    );
    return {
      id: c.id,
      value: existing ? existing.value : name,
      label: existing ? existing.label : `${name} — News Desk`,
      slug: (c.slug || name).toLowerCase().trim(),
      description: c.description || (existing ? existing.description : `${name} reporting and ground coverage`),
      is_active: c.is_active ?? true,
    };
  });
}

export async function fetchDynamicCategories(
  supabase: SupabaseClient,
  includeInactive = false
): Promise<DynamicCategoryItem[]> {
  try {
    let query = supabase
      .from('categories')
      .select('id, slug, name_en, description, is_active, display_order')
      .order('display_order', { ascending: true });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      return formatCategoryOptions([]);
    }

    return formatCategoryOptions(data);
  } catch (err) {
    console.error('Failed to fetch dynamic categories, falling back to canonical:', err);
    return formatCategoryOptions([]);
  }
}

export interface DistrictItem {
  slug: string;
  name: string;
}

export interface DistrictGroup {
  region: string;
  districts: DistrictItem[];
}

export const DISTRICT_GROUPS: DistrictGroup[] = [
  {
    region: 'Kashmir Valley',
    districts: [
      { slug: 'srinagar', name: 'Srinagar' },
      { slug: 'anantnag', name: 'Anantnag' },
      { slug: 'baramulla', name: 'Baramulla' },
      { slug: 'budgam', name: 'Budgam' },
      { slug: 'bandipora', name: 'Bandipora' },
      { slug: 'ganderbal', name: 'Ganderbal' },
      { slug: 'kulgam', name: 'Kulgam' },
      { slug: 'kupwara', name: 'Kupwara' },
      { slug: 'pulwama', name: 'Pulwama' },
      { slug: 'shopian', name: 'Shopian' },
    ],
  },
  {
    region: 'Jammu Plains',
    districts: [
      { slug: 'jammu', name: 'Jammu' },
      { slug: 'kathua', name: 'Kathua' },
      { slug: 'reasi', name: 'Reasi' },
      { slug: 'samba', name: 'Samba' },
      { slug: 'udhampur', name: 'Udhampur' },
    ],
  },
  {
    region: 'Chenab Valley',
    districts: [
      { slug: 'doda', name: 'Doda' },
      { slug: 'kishtwar', name: 'Kishtwar' },
      { slug: 'ramban', name: 'Ramban' },
    ],
  },
  {
    region: 'Pir Panjal Range',
    districts: [
      { slug: 'rajouri', name: 'Rajouri' },
      { slug: 'poonch', name: 'Poonch' },
    ],
  },
  {
    region: 'Leh & Ladakh',
    districts: [
      { slug: 'leh', name: 'Leh' },
      { slug: 'kargil', name: 'Kargil' },
    ],
  },
];

export const IMAGE_PRESETS = [
  { label: 'Srinagar Riverfront', url: 'https://images.unsplash.com/photo-1595815771614-ade9d652a65d?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Highway & Roads', url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Valley Landscape', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80' },
  { label: 'Civic Investigation', url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80' },
];

/**
 * Normalizes any category string (including YouTube channel presets or legacy strings)
 * into a canonical category from the official KJIN database taxonomy.
 */
export function getCanonicalCategory(
  rawCategory?: string | null,
  scope?: string | null
): { name: string; slug: string } {
  const raw = (rawCategory || '').trim().toLowerCase();

  // If scope is explicitly National and category is generic or empty
  if (scope === 'National' && (!raw || raw === 'general' || raw.includes('broadcast') || raw.includes('interview'))) {
    return { name: 'National', slug: 'national' };
  }

  // If scope is explicitly International and category is generic or empty
  if (scope === 'International' && (!raw || raw === 'general' || raw.includes('broadcast') || raw.includes('interview'))) {
    return { name: 'International', slug: 'international' };
  }

  // Exact mappings
  if (
    raw === 'local' ||
    raw === 'local news' ||
    raw.includes('state news') ||
    raw.includes('regional broadcast') ||
    raw.includes('regional')
  ) {
    return { name: 'Local News', slug: 'local' };
  }
  if (raw.includes('politic') || raw.includes('debate') || raw.includes('assembly') || raw.includes('election')) {
    return { name: 'Politics', slug: 'politics' };
  }
  if (raw.includes('econom') || raw.includes('business') || raw.includes('trade') || raw.includes('apple')) {
    return { name: 'Economy', slug: 'economy' };
  }
  if (raw.includes('scienc') || raw.includes('technol') || raw.includes('tech') || raw.includes('digital') || raw.includes('space') || raw.includes(' ai')) {
    return { name: 'Science & Technology', slug: 'science' };
  }
  if (raw.includes('investigat') || raw.includes('accountability')) {
    return { name: 'Investigation', slug: 'investigation' };
  }
  if (raw.includes('problem') || raw.includes('grievance') || raw.includes('civic')) {
    return { name: 'Problems', slug: 'problems' };
  }
  if (raw.includes('nation') || raw === 'india') {
    return { name: 'National', slug: 'national' };
  }
  if (raw.includes('internation') || raw.includes('global') || raw.includes('world')) {
    return { name: 'International', slug: 'international' };
  }
  if (raw.includes('cultur') || raw.includes('heritage') || raw.includes('art')) {
    return { name: 'Culture', slug: 'culture' };
  }
  if (raw.includes('sport') || raw.includes('cricket') || raw.includes('athletics')) {
    return { name: 'Sports', slug: 'sports' };
  }
  if (raw.includes('educat') || raw.includes('school') || raw.includes('universit')) {
    return { name: 'Education', slug: 'education' };
  }
  if (raw.includes('opinion') || raw.includes('editorial') || raw.includes('column')) {
    return { name: 'Opinion', slug: 'opinion' };
  }
  if (raw.includes('secur') || raw.includes('defense') || raw.includes('defence')) {
    if (scope === 'National' || scope === 'International') {
      return { name: 'National', slug: 'national' };
    }
    return { name: 'Local News', slug: 'local' };
  }
  if (raw.includes('environment') || raw.includes('climate') || raw.includes('weather') || raw.includes('glacier')) {
    if (scope === 'State (Jammu & Kashmir)' || scope === 'Chenab Valley') {
      return { name: 'Local News', slug: 'local' };
    }
    return { name: 'General', slug: 'general' };
  }

  // Fallback based on scope
  if (scope === 'National') {
    return { name: 'National', slug: 'national' };
  }
  if (scope === 'International') {
    return { name: 'International', slug: 'international' };
  }
  if (scope === 'State (Jammu & Kashmir)' || scope === 'Chenab Valley') {
    return { name: 'Local News', slug: 'local' };
  }

  return { name: 'General', slug: 'general' };
}

