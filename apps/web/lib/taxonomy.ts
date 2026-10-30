/**
 * Controlled Taxonomy for Categories, Districts, and Regional Divisions in Kashmir Jammu Information Network (KJIN)
 * Covers 5 distinct geographical & socio-cultural regions across 22 districts:
 * 1. Pir Panjal Range (Rajouri, Poonch)
 * 2. Chenab Valley (Doda, Kishtwar, Ramban)
 * 3. Kashmir Valley (10 Districts)
 * 4. Jammu Plains (5 Districts)
 * 5. Leh & Ladakh (Leh, Kargil)
 */

export type KJINRegionKey = 'pir-panjal' | 'chenab-valley' | 'kashmir' | 'jammu' | 'leh';
export type KJINRegionName = 'Pir Panjal' | 'Chenab Valley' | 'Kashmir' | 'Jammu' | 'Leh & Ladakh';

export interface RegionalDivision {
  id: KJINRegionKey;
  name: string;
  shortName: string;
  tagline: string;
  accentColor: string;
  borderAccent: string;
  badgeBg: string;
  districts: string[];
}

export const REGIONAL_DIVISIONS: Record<KJINRegionKey, RegionalDivision> = {
  'pir-panjal': {
    id: 'pir-panjal',
    name: 'Pir Panjal Range',
    shortName: 'Pir Panjal',
    tagline: 'Highland passes, Mughal Road corridor, and border communities',
    accentColor: 'text-purple-400',
    borderAccent: 'border-purple-500/40',
    badgeBg: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
    districts: ['rajouri', 'poonch'],
  },
  'chenab-valley': {
    id: 'chenab-valley',
    name: 'Chenab Valley',
    shortName: 'Chenab Valley',
    tagline: 'River basin gorges, hydropower corridors, and mountain towns',
    accentColor: 'text-cyan-400',
    borderAccent: 'border-cyan-500/40',
    badgeBg: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
    districts: ['doda', 'kishtwar', 'ramban'],
  },
  'kashmir': {
    id: 'kashmir',
    name: 'Kashmir Valley',
    shortName: 'Kashmir',
    tagline: 'Jhelum river basin, saffron plateaus, orchard belts, and central valley',
    accentColor: 'text-emerald-400',
    borderAccent: 'border-emerald-500/40',
    badgeBg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    districts: ['srinagar', 'baramulla', 'anantnag', 'pulwama', 'budgam', 'kupwara', 'bandipora', 'ganderbal', 'kulgam', 'shopian'],
  },
  'jammu': {
    id: 'jammu',
    name: 'Jammu Plains',
    shortName: 'Jammu',
    tagline: 'Tawi river plains, Shivalik foothills, commercial hubs, and pilgrimage routes',
    accentColor: 'text-amber-400',
    borderAccent: 'border-amber-500/40',
    badgeBg: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    districts: ['jammu', 'samba', 'kathua', 'udhampur', 'reasi'],
  },
  'leh': {
    id: 'leh',
    name: 'Leh & Ladakh',
    shortName: 'Leh / Ladakh',
    tagline: 'Trans-Himalayan plateau, high passes, and frontier valley settlements',
    accentColor: 'text-sky-300',
    borderAccent: 'border-sky-500/40',
    badgeBg: 'bg-sky-500/10 text-sky-200 border-sky-500/30',
    districts: ['leh', 'kargil'],
  },
};

export const JK_DISTRICTS: Record<string, { name: string; region: KJINRegionName; regionKey: KJINRegionKey }> = {
  // Kashmir Valley (10)
  srinagar: { name: 'Srinagar', region: 'Kashmir', regionKey: 'kashmir' },
  anantnag: { name: 'Anantnag', region: 'Kashmir', regionKey: 'kashmir' },
  baramulla: { name: 'Baramulla', region: 'Kashmir', regionKey: 'kashmir' },
  budgam: { name: 'Budgam', region: 'Kashmir', regionKey: 'kashmir' },
  bandipora: { name: 'Bandipora', region: 'Kashmir', regionKey: 'kashmir' },
  ganderbal: { name: 'Ganderbal', region: 'Kashmir', regionKey: 'kashmir' },
  kulgam: { name: 'Kulgam', region: 'Kashmir', regionKey: 'kashmir' },
  kupwara: { name: 'Kupwara', region: 'Kashmir', regionKey: 'kashmir' },
  pulwama: { name: 'Pulwama', region: 'Kashmir', regionKey: 'kashmir' },
  shopian: { name: 'Shopian', region: 'Kashmir', regionKey: 'kashmir' },

  // Jammu Division (5)
  jammu: { name: 'Jammu', region: 'Jammu', regionKey: 'jammu' },
  kathua: { name: 'Kathua', region: 'Jammu', regionKey: 'jammu' },
  reasi: { name: 'Reasi', region: 'Jammu', regionKey: 'jammu' },
  samba: { name: 'Samba', region: 'Jammu', regionKey: 'jammu' },
  udhampur: { name: 'Udhampur', region: 'Jammu', regionKey: 'jammu' },

  // Chenab Valley (3)
  doda: { name: 'Doda', region: 'Chenab Valley', regionKey: 'chenab-valley' },
  kishtwar: { name: 'Kishtwar', region: 'Chenab Valley', regionKey: 'chenab-valley' },
  ramban: { name: 'Ramban', region: 'Chenab Valley', regionKey: 'chenab-valley' },

  // Pir Panjal Range (2)
  rajouri: { name: 'Rajouri', region: 'Pir Panjal', regionKey: 'pir-panjal' },
  poonch: { name: 'Poonch', region: 'Pir Panjal', regionKey: 'pir-panjal' },

  // Leh & Ladakh (2)
  leh: { name: 'Leh', region: 'Leh & Ladakh', regionKey: 'leh' },
  kargil: { name: 'Kargil', region: 'Leh & Ladakh', regionKey: 'leh' },
};

export const NEWS_CATEGORIES: Record<string, { name: string; description: string }> = {
  politics: { name: 'Politics', description: 'Governance, policy, and public affairs reporting across J&K.' },
  local: { name: 'Local News', description: 'Ground reporting, regional developments, and grassroots updates from districts.' },
  'local-news': { name: 'Local News', description: 'Ground reporting, regional developments, and grassroots updates from districts.' },
  problems: { name: 'Problems & Grievances', description: 'Civic grievances, public infrastructure issues, and ground investigative reports across J&K.' },
  problem: { name: 'Problems & Grievances', description: 'Civic grievances, public infrastructure issues, and ground investigative reports across J&K.' },
  articles: { name: 'Articles Archive', description: 'Editorial articles, wire reports, and latest news across Jammu & Kashmir.' },
  economy: { name: 'Economy', description: 'Business, agriculture, tourism, and financial developments.' },
  culture: { name: 'Culture', description: 'Heritage, literature, arts, and traditions of Jammu and Kashmir.' },
  sports: { name: 'Sports', description: 'Athletics, youth sports, and regional championships.' },
  education: { name: 'Education', description: 'Schools, universities, and academic affairs.' },
  investigation: { name: 'Investigation', description: 'In-depth investigative journalism and accountability reporting.' },
  opinion: { name: 'Opinion', description: 'Editorials, columns, and analytical perspectives.' },
  general: { name: 'General', description: 'General regional news and public interest bulletins.' },
  international: { name: 'International', description: 'Global developments, diaspora connections, trade diplomacy, and cross-border relations.' },
  national: { name: 'National', description: 'National affairs, union governance, Supreme Court rulings, and pan-India developments.' },
  india: { name: 'National', description: 'National affairs, union governance, Supreme Court rulings, and pan-India developments.' },
  health: { name: 'Health & Science', description: 'Public healthcare, medical research, clinical care, and scientific innovation.' },
  science: { name: 'Science & Technology', description: 'Science, digital technology, innovation, and scientific developments.' },
  environment: { name: 'Environment', description: 'Ecology, climate, glaciers, rivers, and environmental conservation across J&K.' },
};

export function isValidCategory(slug: string): boolean {
  if (!slug) return false;
  return Object.prototype.hasOwnProperty.call(NEWS_CATEGORIES, slug.toLowerCase().trim());
}

export function isValidDistrict(slug: string): boolean {
  if (!slug) return false;
  return Object.prototype.hasOwnProperty.call(JK_DISTRICTS, slug.toLowerCase().trim());
}

export function isValidRegion(slug: string): boolean {
  if (!slug) return false;
  return Object.prototype.hasOwnProperty.call(REGIONAL_DIVISIONS, slug.toLowerCase().trim());
}

export function getCategoryDisplayName(slug: string): string {
  const normalized = slug.toLowerCase().trim();
  if (NEWS_CATEGORIES[normalized]?.name) {
    return NEWS_CATEGORIES[normalized].name;
  }
  return normalized
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function getDistrictDisplayName(slug: string): string {
  const normalized = slug.toLowerCase().trim();
  return JK_DISTRICTS[normalized]?.name || slug.charAt(0).toUpperCase() + slug.slice(1);
}

export function getRegion(slug: string): RegionalDivision | null {
  const normalized = slug.toLowerCase().trim();
  return REGIONAL_DIVISIONS[normalized as KJINRegionKey] || null;
}

export function getDistrictsByRegion(regionSlug: string): string[] {
  const reg = getRegion(regionSlug);
  return reg ? reg.districts : [];
}
