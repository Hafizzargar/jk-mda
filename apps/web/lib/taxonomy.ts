/**
 * Controlled Taxonomy for Categories and Districts in Kashmir Jammu Information Network (KJIN)
 */

export const JK_DISTRICTS: Record<string, { name: string; region: 'Kashmir' | 'Jammu' }> = {
  // Kashmir Division
  srinagar: { name: 'Srinagar', region: 'Kashmir' },
  anantnag: { name: 'Anantnag', region: 'Kashmir' },
  baramulla: { name: 'Baramulla', region: 'Kashmir' },
  budgam: { name: 'Budgam', region: 'Kashmir' },
  bandipora: { name: 'Bandipora', region: 'Kashmir' },
  ganderbal: { name: 'Ganderbal', region: 'Kashmir' },
  kulgam: { name: 'Kulgam', region: 'Kashmir' },
  kupwara: { name: 'Kupwara', region: 'Kashmir' },
  pulwama: { name: 'Pulwama', region: 'Kashmir' },
  shopian: { name: 'Shopian', region: 'Kashmir' },

  // Jammu Division
  jammu: { name: 'Jammu', region: 'Jammu' },
  doda: { name: 'Doda', region: 'Jammu' },
  kathua: { name: 'Kathua', region: 'Jammu' },
  kishtwar: { name: 'Kishtwar', region: 'Jammu' },
  poonch: { name: 'Poonch', region: 'Jammu' },
  rajouri: { name: 'Rajouri', region: 'Jammu' },
  ramban: { name: 'Ramban', region: 'Jammu' },
  reasi: { name: 'Reasi', region: 'Jammu' },
  samba: { name: 'Samba', region: 'Jammu' },
  udhampur: { name: 'Udhampur', region: 'Jammu' },
};

export const NEWS_CATEGORIES: Record<string, { name: string; description: string }> = {
  politics: { name: 'Politics', description: 'Governance, policy, and public affairs reporting across J&K.' },
  local: { name: 'Local', description: 'Ground reporting, civic issues, and grassroots updates from districts.' },
  economy: { name: 'Economy', description: 'Business, agriculture, tourism, and financial developments.' },
  culture: { name: 'Culture', description: 'Heritage, literature, arts, and traditions of Jammu and Kashmir.' },
  sports: { name: 'Sports', description: 'Athletics, youth sports, and regional championships.' },
  education: { name: 'Education', description: 'Schools, universities, and academic affairs.' },
  investigation: { name: 'Investigation', description: 'In-depth investigative journalism and accountability reporting.' },
  opinion: { name: 'Opinion', description: 'Editorials, columns, and analytical perspectives.' },
  general: { name: 'General', description: 'General regional news and public interest bulletins.' },
};

export function isValidCategory(slug: string): boolean {
  if (!slug) return false;
  return Object.prototype.hasOwnProperty.call(NEWS_CATEGORIES, slug.toLowerCase().trim());
}

export function isValidDistrict(slug: string): boolean {
  if (!slug) return false;
  return Object.prototype.hasOwnProperty.call(JK_DISTRICTS, slug.toLowerCase().trim());
}

export function getCategoryDisplayName(slug: string): string {
  const normalized = slug.toLowerCase().trim();
  return NEWS_CATEGORIES[normalized]?.name || slug.charAt(0).toUpperCase() + slug.slice(1);
}

export function getDistrictDisplayName(slug: string): string {
  const normalized = slug.toLowerCase().trim();
  return JK_DISTRICTS[normalized]?.name || slug.charAt(0).toUpperCase() + slug.slice(1);
}
