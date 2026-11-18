export interface CorrespondentConfig {
  name: string;
  role: string;
  beat: string;
  region: string;
}

export const TRUSTED_CORRESPONDENTS: CorrespondentConfig[] = [
  {
    name: 'Dr. Tariq Ahmad Lone',
    role: 'Senior Environmental & Field Editor',
    beat: 'Ecology, Lakes, High-Altitude Infrastructure',
    region: 'Kashmir Valley',
  },
  {
    name: 'Pooja Jamwal',
    role: 'Bureau Chief (Jammu)',
    beat: 'Commerce, Union Economy, Agriculture & Industry',
    region: 'Jammu Plains',
  },
  {
    name: 'Showkat Ahmad Mir',
    role: 'Senior Ground Correspondent',
    beat: 'Frontier Dispatches, Border Infrastructure, Tourism',
    region: 'Pir Panjal',
  },
  {
    name: 'Tariq Ahmad Mir',
    role: 'Correspondent & Transit Analyst',
    beat: 'Mountain Passes, Civic Works, Telemetry & Hydro',
    region: 'Chenab Valley',
  },
  {
    name: 'Stanzin Dorje',
    role: 'Trans-Himalayan Field Analyst',
    beat: 'High Passes, Glaciology & Strategic Transit',
    region: 'Leh & Ladakh',
  },
  {
    name: 'Dr. Sunita Pandita',
    role: 'Science & National Affairs Correspondent',
    beat: 'Union Governance, Science, Space & Public Health',
    region: 'National / All Regions',
  },
  {
    name: 'Prof. Ramesh Koul',
    role: 'Heritage & Cultural Desk Lead',
    beat: 'Crafts, Architecture, Archeology & Oral Traditions',
    region: 'Cultural Corridors',
  },
  {
    name: 'KJCPL Ground Bureau',
    role: 'Institutional News Desk',
    beat: 'Breaking Wire, Spot Reports & Verified Dispatches',
    region: 'All Corridors',
  },
];

export function getCorrespondentForArticle(article: {
  district?: string | null;
  category?: string | null;
  title?: string | null;
}): string {
  const dist = (article.district || '').toLowerCase().trim();
  const cat = (article.category || '').toLowerCase().trim();
  const title = (article.title || '').toLowerCase();

  // Chenab Valley
  if (
    ['doda', 'kishtwar', 'ramban'].includes(dist) ||
    title.includes('chenab') ||
    title.includes('doda') ||
    title.includes('kishtwar') ||
    title.includes('ramban') ||
    title.includes('bhaderwah') ||
    title.includes('marwah') ||
    title.includes('warwan')
  ) {
    return 'Tariq Ahmad Mir';
  }

  // Pir Panjal
  if (
    ['rajouri', 'poonch'].includes(dist) ||
    title.includes('poonch') ||
    title.includes('rajouri') ||
    title.includes('pir panjal') ||
    title.includes('chakan da bagh') ||
    title.includes('surankote') ||
    title.includes('mandi-lorha')
  ) {
    return 'Showkat Ahmad Mir';
  }

  // Ladakh
  if (
    ['leh', 'kargil'].includes(dist) ||
    title.includes('ladakh') ||
    title.includes('leh') ||
    title.includes('kargil') ||
    title.includes('zojila') ||
    title.includes('drass')
  ) {
    return 'Stanzin Dorje';
  }

  // Jammu Plains / Economy
  if (
    ['jammu', 'samba', 'kathua', 'udhampur', 'reasi'].includes(dist) ||
    cat.includes('economy') ||
    cat.includes('business') ||
    cat.includes('agriculture') ||
    title.includes('jammu') ||
    title.includes('samba') ||
    title.includes('kathua') ||
    title.includes('r.s. pura') ||
    title.includes('mandi')
  ) {
    return 'Pooja Jamwal';
  }

  // Culture & Heritage
  if (
    cat.includes('culture') ||
    cat.includes('heritage') ||
    title.includes('saffron') ||
    title.includes('craft') ||
    title.includes('heritage') ||
    title.includes('shawl')
  ) {
    return 'Prof. Ramesh Koul';
  }

  // National & Science
  if (
    cat.includes('national') ||
    cat.includes('science') ||
    cat.includes('health') ||
    cat.includes('space') ||
    cat.includes('international') ||
    title.includes('supreme court') ||
    title.includes('isro') ||
    title.includes('rbi') ||
    title.includes('un ')
  ) {
    return 'Dr. Sunita Pandita';
  }

  // Kashmir Valley default
  return 'Dr. Tariq Ahmad Lone';
}
