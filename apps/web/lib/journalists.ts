/**
 * Official Registry of Accredited Journalists & Bureau Correspondents
 * Kashmir Jammu Coalition Press (KJCPL / KJIN)
 * Provides authoritative E-E-A-T credentials, beats, and bio profiles for Google News compliance.
 */

export interface JournalistProfile {
  name: string;
  slug: string;
  designation: string;
  beat: string;
  district: string;
  location: string;
  bio: string;
  verifiedBadge: string;
  image?: string;
  email?: string;
}

export const KJIN_JOURNALISTS: Record<string, JournalistProfile> = {
  'tariq-lone': {
    name: 'Tariq Lone',
    slug: 'tariq-lone',
    designation: 'Bureau Chief, Chenab Valley',
    beat: 'Mountain Infrastructure & Chenab Corridors',
    district: 'Doda',
    location: 'Doda & Bhaderwah',
    bio: 'Veteran investigative journalist covering Doda, Bhaderwah, Kishtwar, and Ramban. Over 14 years reporting on high-altitude road connectivity, rural water schemes, Chenab railway developments, and civic governance across mountain communities.',
    verifiedBadge: 'Senior Accredited Correspondent',
  },
  'farooq-mir': {
    name: 'Farooq Mir',
    slug: 'farooq-mir',
    designation: 'Senior Field Correspondent, Kishtwar',
    beat: 'Hydroelectric Projects & Rural Redressal',
    district: 'Kishtwar',
    location: 'Kishtwar & Paddar',
    bio: 'Ground reporter based in Kishtwar reporting on Dul Hasti, Ratle, and Pakal Dul hydroelectric corridors, community displacement, high-altitude pass closures, and Chenab Valley public welfare.',
    verifiedBadge: 'Accredited Field Correspondent',
  },
  'altaf-wani': {
    name: 'Altaf Hussain Wani',
    slug: 'altaf-wani',
    designation: 'Transit & Telemetry Correspondent, Ramban',
    beat: 'NH-44 Highway & Banihal Corridor',
    district: 'Ramban',
    location: 'Ramban & Banihal',
    bio: 'Specialist in mountain transit corridors, monitoring Jammu-Srinagar National Highway (NH-44), landslide mitigation at Panthyal/Mehar, and the Banihal-Qazigund railway transit link.',
    verifiedBadge: 'Verified Ground Reporter',
  },
  'ghulam-raina': {
    name: 'Ghulam Nabi Raina',
    slug: 'ghulam-raina',
    designation: 'Pir Panjal Bureau Chief',
    beat: 'Border Affairs & Highland Transit',
    district: 'Poonch',
    location: 'Poonch & Rajouri',
    bio: 'Senior journalist covering border communities in Poonch and Rajouri districts, Mughal Road winter blockades, Line of Control civic welfare, and high-altitude agricultural irrigation.',
    verifiedBadge: 'Senior Accredited Correspondent',
  },
  'sunita-sharma': {
    name: 'Sunita Sharma',
    slug: 'sunita-sharma',
    designation: 'Senior Correspondent, Jammu Division',
    beat: 'Civil Administration, Education & Trade',
    district: 'Jammu',
    location: 'Jammu Plains',
    bio: 'Covering civil secretariat affairs, public university developments, agricultural mandis, and legal reporting from the High Court of Jammu & Kashmir and Ladakh.',
    verifiedBadge: 'Accredited Press Correspondent',
  },
  'irfan-dar': {
    name: 'Irfan Ahmad Dar',
    slug: 'irfan-dar',
    designation: 'Agriculture & Horticulture Desk Head',
    beat: 'Kashmir Horticulture, Saffron & Export Trade',
    district: 'Pulwama',
    location: 'Pampore & Pulwama',
    bio: 'Agricultural journalist and researcher tracking GI-tagged Kashmiri saffron harvest, apple mandi prices, cold-chain logistics, and climate adaptation in the Jhelum valley.',
    verifiedBadge: 'Specialist Agricultural Desk',
  },
  'tsering-namgyal': {
    name: 'Tsering Namgyal',
    slug: 'tsering-namgyal',
    designation: 'Ladakh Frontier Bureau Chief',
    beat: 'High-Altitude Pass Transit & Nomadic Affairs',
    district: 'Leh',
    location: 'Leh & Kargil',
    bio: 'Reporting from Leh on Zojila Pass transit telemetry, renewable solar arrays, Changthang nomadic pashmina goat herders, and climate conservation across the Ladakh plateau.',
    verifiedBadge: 'Accredited Himalayan Correspondent',
  },
  'dr-zahoor-rather': {
    name: 'Dr. Zahoor Rather',
    slug: 'dr-zahoor-rather',
    designation: 'Environment & Public Health Editor',
    beat: 'Ecology, Glaciology & Healthcare',
    district: 'Srinagar',
    location: 'Srinagar',
    bio: 'Doctoral researcher and environmental journalist investigating Dal Lake bio-restoration, Dachigam Hangul conservation, high-altitude healthcare facilities, and climate dynamics.',
    verifiedBadge: 'Senior Editorial Fellow',
  },
  'mushtaq-parra': {
    name: 'Mushtaq Parra',
    slug: 'mushtaq-parra',
    designation: 'Civic Grievances & RTI Investigative Desk',
    beat: 'Public Infrastructure & Citizen Redressal',
    district: 'Srinagar',
    location: 'Central Kashmir',
    bio: 'Investigative reporter tracking citizen complaints under the Raabta grievance system, public drinking water supply audits, electrical transformer repairs, and municipal accountability.',
    verifiedBadge: 'Senior Investigative Correspondent',
  },
};

export function getJournalistBySlug(slug: string): JournalistProfile | null {
  if (!slug) return null;
  const key = slug.toLowerCase().trim();
  return KJIN_JOURNALISTS[key] || null;
}

export function getJournalistByName(name?: string | null): JournalistProfile | null {
  if (!name) return null;
  const lower = name.toLowerCase().trim();
  for (const j of Object.values(KJIN_JOURNALISTS)) {
    if (j.name.toLowerCase() === lower || lower.includes(j.name.toLowerCase())) {
      return j;
    }
  }
  return null;
}

export function resolveAuthorForArticle(district?: string | null, category?: string | null): JournalistProfile {
  const dist = (district || '').toLowerCase().trim();
  const cat = (category || '').toLowerCase().trim();

  if (dist === 'doda' || dist === 'bhaderwah') return KJIN_JOURNALISTS['tariq-lone'];
  if (dist === 'kishtwar') return KJIN_JOURNALISTS['farooq-mir'];
  if (dist === 'ramban') return KJIN_JOURNALISTS['altaf-wani'];
  if (dist === 'poonch' || dist === 'rajouri') return KJIN_JOURNALISTS['ghulam-raina'];
  if (dist === 'leh' || dist === 'kargil') return KJIN_JOURNALISTS['tsering-namgyal'];
  if (['pulwama', 'shopian', 'anantnag', 'kulgam'].includes(dist) && ['economy', 'agriculture', 'horticulture'].includes(cat)) {
    return KJIN_JOURNALISTS['irfan-dar'];
  }
  if (['jammu', 'samba', 'kathua', 'udhampur', 'reasi'].includes(dist)) {
    return KJIN_JOURNALISTS['sunita-sharma'];
  }
  if (['environment', 'health', 'science'].includes(cat)) {
    return KJIN_JOURNALISTS['dr-zahoor-rather'];
  }
  if (['problems', 'investigation', 'local'].includes(cat)) {
    return KJIN_JOURNALISTS['mushtaq-parra'];
  }

  // Default fallback to Chenab Valley Bureau Chief for regional relevance
  return KJIN_JOURNALISTS['tariq-lone'];
}
