export interface CategoryOption {
  value: string;
  label: string;
  description: string;
}

export const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: 'Local', label: 'Local — Civic Issues & Ground Reporting', description: 'Area problems, roads, water, electricity, civic grievances, and grassroots district reporting' },
  { value: 'Investigation', label: 'Investigation — In-Depth & Accountability', description: 'Investigative reporting, policy audits, and environmental/public funds investigations' },
  { value: 'Politics', label: 'Politics — Governance & Assemblies', description: 'Elections, legislative deliberations, administrative policy, and public affairs' },
  { value: 'Economy', label: 'Economy — Agriculture, Trade & Industry', description: 'Apple harvests, saffron, horticulture, trade corridors, and tourism' },
  { value: 'Culture', label: 'Culture — Heritage, Arts & Traditions', description: 'Oral histories, crafts, architecture, and festivals of Jammu and Kashmir' },
  { value: 'Sports', label: 'Sports — Athletics & Youth Affairs', description: 'Tournaments, mountain marathons, cricket, and youth sports' },
  { value: 'Education', label: 'Education — Universities & Schools', description: 'Colleges, research patents, literacy, and student affairs' },
  { value: 'Opinion', label: 'Opinion — Columns & Editorials', description: 'Guest essays, expert analysis, and editorial board stances' },
  { value: 'International', label: 'International — Global & Diaspora Relations', description: 'Global developments, diaspora connections, trade diplomacy, and cross-border relations' },
  { value: 'General', label: 'General — Regional News Bulletins', description: 'General interest dispatches and public announcements' },
];

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
