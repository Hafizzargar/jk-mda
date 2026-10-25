/**
 * District & Event Taxonomy Classifier for Jammu & Kashmir and Ladakh
 * Recognizes 22 official districts, local tehsils/corridors, and event categories.
 */

export interface DistrictMatch {
  districtSlug: string;
  districtName: string;
  division: 'Kashmir' | 'Jammu' | 'Chenab Valley' | 'Pir Panjal' | 'Leh & Ladakh';
  matchedKeyword: string;
}

// Landmark towns and tehsils mapped to their parent district
const DISTRICT_KEYWORDS: Record<
  string,
  { name: string; division: 'Kashmir' | 'Jammu' | 'Chenab Valley' | 'Pir Panjal' | 'Leh & Ladakh'; keywords: string[] }
> = {
  // Chenab Valley
  doda: {
    name: 'Doda',
    division: 'Chenab Valley',
    keywords: ['doda', 'bhaderwah', 'bhadarwah', 'thathri', 'gandoh', 'bhalessa', 'pul doda', 'asssar', 'marmat', 'kastigarh', 'kahara'],
  },
  kishtwar: {
    name: 'Kishtwar',
    division: 'Chenab Valley',
    keywords: ['kishtwar', 'padder', 'paddar', 'marwah', 'warwan', 'dachhan', 'chhatroo', 'sinthan top', 'machail'],
  },
  ramban: {
    name: 'Ramban',
    division: 'Chenab Valley',
    keywords: ['ramban', 'banihal', 'batote', 'gool', 'ramsoo', 'panthyal', 'nashri', 'mehar', 'dalwas', 'chanderkote'],
  },

  // Pir Panjal
  rajouri: {
    name: 'Rajouri',
    division: 'Pir Panjal',
    keywords: ['rajouri', 'nowshera', 'sunderbani', 'kalakote', 'manjakote', 'kotranka', 'thanamandi'],
  },
  poonch: {
    name: 'Poonch',
    division: 'Pir Panjal',
    keywords: ['poonch', 'mendhar', 'surankote', 'mandi', 'haveli', 'loran', 'saujiyan', 'chakan da bagh'],
  },

  // Kashmir Valley
  srinagar: {
    name: 'Srinagar',
    division: 'Kashmir',
    keywords: ['srinagar', 'lal chowk', 'dal lake', 'dalgate', 'batamaloo', 'soura', 'pantha chowk', 'bemina', 'rajbagh'],
  },
  anantnag: {
    name: 'Anantnag',
    division: 'Kashmir',
    keywords: ['anantnag', 'pahalgam', 'bijbehara', 'kokernag', 'dooru', 'achabal', 'qazigund'],
  },
  baramulla: {
    name: 'Baramulla',
    division: 'Kashmir',
    keywords: ['baramulla', 'sopore', 'gulmarg', 'tangmarg', 'pattan', 'uri', 'rafiabad'],
  },
  budgam: {
    name: 'Budgam',
    division: 'Kashmir',
    keywords: ['budgam', 'beerwah', 'chadoora', 'khansahib', 'charar-i-sharief', 'magam'],
  },
  bandipora: {
    name: 'Bandipora',
    division: 'Kashmir',
    keywords: ['bandipora', 'gurez', 'wular', 'hajan', 'sumbal', 'tulail'],
  },
  ganderbal: {
    name: 'Ganderbal',
    division: 'Kashmir',
    keywords: ['ganderbal', 'sonamarg', 'kangan', 'gund', 'manasbal'],
  },
  kulgam: {
    name: 'Kulgam',
    division: 'Kashmir',
    keywords: ['kulgam', 'yaripora', 'damhal hanjipora', 'frisal', 'devsar', 'qaimoh'],
  },
  kupwara: {
    name: 'Kupwara',
    division: 'Kashmir',
    keywords: ['kupwara', 'handwara', 'karnah', 'lolab', 'tangdhar', 'machil'],
  },
  pulwama: {
    name: 'Pulwama',
    division: 'Kashmir',
    keywords: ['pulwama', 'pampore', 'tral', 'awantipora', 'kakapora', 'rajpora'],
  },
  shopian: {
    name: 'Shopian',
    division: 'Kashmir',
    keywords: ['shopian', 'zainapora', 'herpora', 'peer ki gali', 'keller'],
  },

  // Jammu Plains
  jammu: {
    name: 'Jammu',
    division: 'Jammu',
    keywords: ['jammu', 'r s pura', 'akhnoor', 'bishnah', 'bahu fort', 'nagrota', 'gandhi nagar'],
  },
  kathua: {
    name: 'Kathua',
    division: 'Jammu',
    keywords: ['kathua', 'hiranagar', 'billawar', 'basohli', 'bani', 'marheen', 'lakhanpur'],
  },
  reasi: {
    name: 'Reasi',
    division: 'Jammu',
    keywords: ['reasi', 'katra', 'vaishno devi', 'mahore', 'pouni', 'chassana', 'chenab bridge'],
  },
  samba: {
    name: 'Samba',
    division: 'Jammu',
    keywords: ['samba', 'vijaypur', 'bari brahmana', 'ghagwal', 'ramgarh'],
  },
  udhampur: {
    name: 'Udhampur',
    division: 'Jammu',
    keywords: ['udhampur', 'chenani', 'ramnagar', 'patnitop', 'majalta', 'dudu basantgarh'],
  },

  // Leh & Ladakh
  leh: {
    name: 'Leh',
    division: 'Leh & Ladakh',
    keywords: ['leh', 'nubra', 'khardung la', 'pangong', 'changthang', 'nyoma'],
  },
  kargil: {
    name: 'Kargil',
    division: 'Leh & Ladakh',
    keywords: ['kargil', 'drass', 'zanskar', 'sankoo', 'shakar chiktan'],
  },
};

export type EventCategory =
  | 'accidents'
  | 'road_closures'
  | 'weather_disaster'
  | 'public_safety'
  | 'school_closures'
  | 'public_services'
  | 'demonstrations_restrictions'
  | 'administration'
  | 'public_health'
  | 'global_humanitarian'
  | 'general';

const CATEGORY_KEYWORDS: Record<EventCategory, string[]> = {
  road_closures: ['highway blocked', 'traffic suspended', 'road closed', 'traffic halt', 'landslide blocks', 'jammu-srinagar highway', 'batote-kishtwar', 'moughal road', 'nh-44', 'stranded vehicles', 'traffic advisory'],
  weather_disaster: ['snowfall', 'flash flood', 'cloudburst', 'avalanche', 'heavy rain', 'western disturbance', 'imd alert', 'water level', 'freezing cold', 'landslide', 'shooting stones'],
  accidents: ['road accident', 'vehicle plunges', 'collision', 'passengers injured', 'bus accident', 'cab accident', 'tragic accident', 'injured in road', 'casualties'],
  school_closures: ['schools closed', 'college suspended', 'class suspended', 'winter vacation', 'institutions shut', 'holiday declared', 'examinations postponed'],
  public_safety: ['fire breaks out', 'gas leak', 'building collapse', 'security cordon', 'search operation', 'safety alert', 'evacuation', 'siren'],
  public_services: ['power outage', 'electricity blackout', 'water supply snapped', 'pipeline burst', 'ration distribution', 'telecom snapped'],
  demonstrations_restrictions: ['curfew', 'section 144', 'protest', 'dharna', 'shutdown', 'hartal', 'demonstration', 'security restrictions'],
  administration: ['district magistrate order', 'deputy commissioner', 'divisional commissioner', 'administrative inspection', 'anti-encroachment', 'official directive', 'gazette notice'],
  public_health: ['dengue', 'cholera', 'hepatitis', 'outbreak', 'epidemic', 'hospital emergency', 'vaccination drive', 'contamination', 'quarantine', 'who alert'],
  global_humanitarian: ['refugee', 'humanitarian aid', 'who disease outbreak', 'un security council', 'unicef', 'crisis response', 'cross-border aid'],
  general: [],
};

/**
 * Identify district and division from text snippet
 */
export function classifyDistrict(text: string): DistrictMatch | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  for (const [slug, data] of Object.entries(DISTRICT_KEYWORDS)) {
    for (const kw of data.keywords) {
      // Word boundary match
      const regex = new RegExp(`\\b${kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
      if (regex.test(lower)) {
        return {
          districtSlug: slug,
          districtName: data.name,
          division: data.division,
          matchedKeyword: kw,
        };
      }
    }
  }

  return null;
}

/**
 * Identify event category from text snippet
 */
export function classifyEventCategory(text: string): EventCategory {
  if (!text) return 'general';
  const lower = text.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [EventCategory, string[]][]) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        return category;
      }
    }
  }

  return 'general';
}
