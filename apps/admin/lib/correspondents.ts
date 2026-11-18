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
    name: 'Dr. Sunita Pandita',
    role: 'Science & National Affairs Correspondent',
    beat: 'Union Governance, Science, Space & Public Health',
    region: 'National / All Regions',
  },
  {
    name: 'KJCPL Ground Bureau',
    role: 'Institutional News Desk',
    beat: 'Breaking Wire, Spot Reports & Verified Dispatches',
    region: 'All Corridors',
  },
];
