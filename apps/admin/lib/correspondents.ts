export interface CorrespondentConfig {
  name: string;
  role: string;
  beat: string;
  region: string;
}

export const TRUSTED_CORRESPONDENTS: CorrespondentConfig[] = [
  {
    name: 'KJCPL Srinagar Bureau',
    role: 'Central Valley Editorial Bureau',
    beat: 'Governance, Valley Affairs, Lake Ecology & Public Interest',
    region: 'Kashmir Valley',
  },
  {
    name: 'KJCPL Jammu Bureau',
    role: 'Jammu Plains Bureau',
    beat: 'Commerce, Union Economy, Agriculture & Industry',
    region: 'Jammu Plains',
  },
  {
    name: 'KJCPL Pir Panjal Bureau',
    role: 'Frontier Corridors Desk',
    beat: 'Frontier Dispatches, Border Infrastructure, Tourism',
    region: 'Pir Panjal',
  },
  {
    name: 'KJCPL Chenab Valley Bureau',
    role: 'Chenab Corridors Desk',
    beat: 'Mountain Passes, Civic Works, Telemetry & Hydro Projects',
    region: 'Chenab Valley',
  },
  {
    name: 'KJCPL Leh & Ladakh Desk',
    role: 'Trans-Himalayan Desk',
    beat: 'High Passes, Glaciology & Strategic Transit',
    region: 'Leh & Ladakh',
  },
  {
    name: 'KJCPL National Bureau',
    role: 'Union & Constitutional Affairs',
    beat: 'Union Governance, Science, Space & Public Health',
    region: 'National / All Regions',
  },
  {
    name: 'KJCPL Special Reports Desk',
    role: 'Heritage & In-Depth Investigations',
    beat: 'Crafts, Architecture, Archeology & Oral Traditions',
    region: 'Cultural Corridors',
  },
  {
    name: 'KJCPL World News Desk',
    role: 'Foreign & Diplomatic Affairs',
    beat: 'Multilateral Treaties, Maritime, Trade & International Wire',
    region: 'Global Desk',
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
    return 'KJCPL Chenab Valley Bureau';
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
    return 'KJCPL Pir Panjal Bureau';
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
    return 'KJCPL Leh & Ladakh Desk';
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
    return 'KJCPL Jammu Bureau';
  }

  // Culture, Heritage & Special Features
  if (
    cat.includes('culture') ||
    cat.includes('heritage') ||
    cat.includes('environment') ||
    title.includes('saffron') ||
    title.includes('craft') ||
    title.includes('heritage') ||
    title.includes('shawl') ||
    title.includes('trout')
  ) {
    return 'KJCPL Special Reports Desk';
  }

  // National & Space / Constitutional
  if (
    cat.includes('national') ||
    cat.includes('space') ||
    title.includes('supreme court') ||
    title.includes('isro') ||
    title.includes('parliament') ||
    title.includes('rbi')
  ) {
    return 'KJCPL National Bureau';
  }

  // International / Maritime / Diplomatic
  if (
    cat.includes('international') ||
    title.includes('imo') ||
    title.includes('un ') ||
    title.includes('diploma') ||
    title.includes('treaty')
  ) {
    return 'KJCPL World News Desk';
  }

  // Kashmir Valley default
  return 'KJCPL Srinagar Bureau';
}
