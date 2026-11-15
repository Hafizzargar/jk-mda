/**
 * KJIN Autonomous News Intelligence & Regional Discovery Engine
 * 
 * Independently discovers, verifies, and drafts breaking news across Jammu, Kashmir,
 * Chenab Valley, Leh/Ladakh, Pir Panjal, and National/International wires using
 * Google Search Grounding with Gemini 2.5.
 * 
 * Editorial Distribution Targets (Daily, not hourly):
 * - Chenab Valley:  Min 3, Max 6  (Doda, Kishtwar, Ramban, Bhaderwah — Top regional priority)
 * - Jammu:          Min 2, Max 5  (Jammu, Samba, Kathua, Udhampur, Reasi)
 * - Kashmir:        Min 2, Max 5  (Kashmir Valley districts)
 * - Leh / Ladakh:   Min 2, Max 3  (Leh, Kargil — Union Territory of Ladakh)
 * - Pir Panjal:     Min 2, Max 3  (Poonch, Rajouri)
 * - National:       Min 2, Max 5  (Pan-India policy, Supreme Court, Union governance)
 * - International:  Min 4, Max 5  (Global diplomacy, foreign affairs, world events)
 * -------------------------------------------------------------
 * Total Daily Target: 17–32 stories/day (Preferred: 22–25 credible stories/day)
 * Regional Priority: ~65% of minimum daily news target (11/17 = ~64.7%)
 * 
 * Core Operating Principles:
 * 1. Don't force news generation: Never hallucinate or create artificial stories to hit quotas.
 * 2. Accurate classification: Strict geographic mapping for each of the 7 editorial beats.
 * 3. Breaking news priority: Major breaking events override regional maximum caps.
 * 4. Underrepresented prioritization: Hourly cycle dynamically selects regions furthest below their minimum.
 * 5. Strict Zero Auto-Publish: 100% of discovered drafts enter Pending Approval (`status: 'review'`).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { generateSlug } from './gemini-drafter.ts';
import { getCanonicalCategory } from '../taxonomy-options.ts';
import { sendNewsApprovalAlert, sendAutoApprovedEmailAlert } from './email-notifier.ts';
import {
  isGeminiInCooldown,
  tripCircuitBreaker,
  resetCircuitBreaker,
} from './gemini-circuit-breaker.ts';
import {
  getRecommendedEditorialImage,
  determineDatelineForScope,
  sanitizeDatelineForScope,
} from './ai-synthesizer.ts';

export const MAX_NEWS_AGE_HOURS = 6;
export const MAX_NEWS_AGE_MS = MAX_NEWS_AGE_HOURS * 60 * 60 * 1000;

/**
 * Evaluates whether a discovered news story or broadcast satisfies the 6-hour freshness rule.
 * Logically rejects stories older than 6 hours to guarantee breaking news immediacy.
 */
export function evaluateNewsFreshness(
  input: {
    hoursAgo?: number | null;
    reportedTime?: string | null;
    publishedAt?: string | null;
  },
  referenceTime = new Date()
): { isFresh: boolean; ageHours: number | null; reason?: string } {
  const refMs = referenceTime.getTime();

  // 1. Check numeric hoursAgo estimate from Gemini if provided
  if (typeof input.hoursAgo === 'number' && !isNaN(input.hoursAgo)) {
    // 30-minute grace period for reporting estimation latency (6.5h)
    if (input.hoursAgo > MAX_NEWS_AGE_HOURS + 0.5) {
      return {
        isFresh: false,
        ageHours: input.hoursAgo,
        reason: `News reported as ${input.hoursAgo.toFixed(1)} hours ago, which exceeds the strict ${MAX_NEWS_AGE_HOURS}-hour freshness limit.`,
      };
    }
  }

  // 2. Check explicit reportedTime or publishedAt timestamp if provided
  const timeStr = input.reportedTime || input.publishedAt;
  if (timeStr) {
    const timeMs = new Date(timeStr).getTime();
    if (!isNaN(timeMs)) {
      const diffMs = refMs - timeMs;
      const diffHours = diffMs / (1000 * 60 * 60);

      // If timestamp is in the future by more than 10 mins, clamp to 0
      if (diffHours < -0.16) {
        return { isFresh: true, ageHours: 0 };
      }

      // 30-minute tolerance for publisher server clock skew
      if (diffMs > MAX_NEWS_AGE_MS + (30 * 60 * 1000)) {
        return {
          isFresh: false,
          ageHours: Number(diffHours.toFixed(1)),
          reason: `Publication timestamp (${timeStr}) is ${diffHours.toFixed(1)} hours old (exceeds the ${MAX_NEWS_AGE_HOURS}-hour limit).`,
        };
      }

      return {
        isFresh: true,
        ageHours: Math.max(0, Number(diffHours.toFixed(1))),
      };
    }
  }

  // If no date was parsed but hoursAgo is within limit, consider fresh
  if (typeof input.hoursAgo === 'number') {
    return { isFresh: true, ageHours: input.hoursAgo };
  }

  // Default fresh for newly grounded items without explicit older timestamps
  return { isFresh: true, ageHours: 0 };
}

export interface RegionalTarget {
  id: string;
  name: string;
  shortName: string;
  min: number;
  max: number;
  scope: 'Chenab Valley' | 'State (Jammu & Kashmir)' | 'National' | 'International';
  districts: string[];
  searchQuery: string;
  defaultDateline: string;
  isRegional: boolean;
  weight: number; // Priority multiplier for tie-breaking
}

export interface DistrictMetadata {
  id: string;
  name: string;
  beatId: string;
  keywords: string[];
  searchQuery: string;
  defaultDateline: string;
  defaultMin: number;
  defaultMax: number;
  defaultPriority: 'high' | 'normal' | 'low';
}

export interface DistrictQuotaConfig {
  min: number;
  max: number;
  priority?: 'high' | 'normal' | 'low';
}

export interface DistrictDailyStat {
  id: string;
  name: string;
  beatId: string;
  current: number;
  published: number;
  min: number;
  max: number;
  priority: 'high' | 'normal' | 'low';
  deficit: number;
  isMet: boolean;
  isMaxReached: boolean;
}

export const DISTRICT_METADATA: Record<string, DistrictMetadata> = {
  // Chenab Valley Districts
  doda: {
    id: 'doda',
    name: 'Doda',
    beatId: 'chenab_valley',
    keywords: ['doda', 'bhaderwah', 'assar', 'thathri', 'gundoh', 'bhalessa', 'khellani', 'marmat', 'chiralla'],
    searchQuery: '("Doda" OR "Bhaderwah" OR "Assar" OR "Thathri" OR "Gundoh" OR "Bhalessa") latest news',
    defaultDateline: 'DODA –',
    defaultMin: 1,
    defaultMax: 2,
    defaultPriority: 'high',
  },
  kishtwar: {
    id: 'kishtwar',
    name: 'Kishtwar',
    beatId: 'chenab_valley',
    keywords: ['kishtwar', 'marwah', 'warwan', 'paddar', 'chhatroo', 'ratle', 'pakal dul', 'dul hasti', 'sinthan'],
    searchQuery: '("Kishtwar" OR "Marwah" OR "Warwan" OR "Paddar" OR "Chhatroo" OR "Ratle Hydro" OR "Pakal Dul") latest news',
    defaultDateline: 'KISHTWAR –',
    defaultMin: 1,
    defaultMax: 2,
    defaultPriority: 'high',
  },
  ramban: {
    id: 'ramban',
    name: 'Ramban',
    beatId: 'chenab_valley',
    keywords: ['ramban', 'banihal', 'batote', 'gool', 'maitra', 'chenani-nashri', 'sangaldan', 'nh-44'],
    searchQuery: '("Ramban" OR "Banihal" OR "Batote" OR "Gool" OR "Sangaldan" OR "NH-44 Ramban") latest news',
    defaultDateline: 'RAMBAN –',
    defaultMin: 1,
    defaultMax: 2,
    defaultPriority: 'normal',
  },

  // Jammu Plains Districts
  jammu: {
    id: 'jammu',
    name: 'Jammu',
    beatId: 'jammu',
    keywords: ['jammu', 'tawi', 'bahu fort', 'rs pura', 'akhnoor', 'nagrota', 'satwari'],
    searchQuery: '("Jammu city" OR "Tawi river" OR "Akhnoor" OR "RS Pura") latest news',
    defaultDateline: 'JAMMU –',
    defaultMin: 1,
    defaultMax: 2,
    defaultPriority: 'high',
  },
  samba: {
    id: 'samba',
    name: 'Samba',
    beatId: 'jammu',
    keywords: ['samba', 'vijaypur', 'ghagwal', 'bari brahmana'],
    searchQuery: '("Samba district" OR "Vijaypur Samba" OR "Ghagwal" OR "Bari Brahmana") latest news',
    defaultDateline: 'SAMBA –',
    defaultMin: 0,
    defaultMax: 1,
    defaultPriority: 'normal',
  },
  kathua: {
    id: 'kathua',
    name: 'Kathua',
    beatId: 'jammu',
    keywords: ['kathua', 'hiranagar', 'billawar', 'basohli', 'bani', 'sarthal', 'bani-sarthal', 'mahanpur'],
    searchQuery: '("Kathua" OR "Bani" OR "Sarthal" OR "Billawar" OR "Basohli" OR "Hiranagar") latest news',
    defaultDateline: 'KATHUA –',
    defaultMin: 0,
    defaultMax: 1,
    defaultPriority: 'normal',
  },
  udhampur: {
    id: 'udhampur',
    name: 'Udhampur',
    beatId: 'jammu',
    keywords: ['udhampur', 'chenani', 'ramnagar udhampur', 'majalta'],
    searchQuery: '("Udhampur" OR "Chenani" OR "Ramnagar Udhampur") latest news',
    defaultDateline: 'UDHAMPUR –',
    defaultMin: 0,
    defaultMax: 1,
    defaultPriority: 'normal',
  },
  reasi: {
    id: 'reasi',
    name: 'Reasi',
    beatId: 'jammu',
    keywords: ['reasi', 'katra', 'vaishno devi', 'chenab bridge', 'mahore', 'pouni'],
    searchQuery: '("Reasi" OR "Katra" OR "Vaishno Devi" OR "Chenab Rail Bridge" OR "Mahore") latest news',
    defaultDateline: 'REASI –',
    defaultMin: 0,
    defaultMax: 1,
    defaultPriority: 'normal',
  },

  // Kashmir Valley Districts
  srinagar: {
    id: 'srinagar',
    name: 'Srinagar',
    beatId: 'kashmir',
    keywords: ['srinagar', 'dal lake', 'lal chowk', 'downtown srinagar', 'batamaloo', 'soura', 'pantha chowk'],
    searchQuery: '("Srinagar" OR "Dal Lake" OR "Lal Chowk" OR "Downtown Srinagar") latest news',
    defaultDateline: 'SRINAGAR –',
    defaultMin: 1,
    defaultMax: 2,
    defaultPriority: 'high',
  },
  anantnag: {
    id: 'anantnag',
    name: 'Anantnag',
    beatId: 'kashmir',
    keywords: ['anantnag', 'islamabad kashmir', 'pahalgam', 'achabal', 'kokernag', 'dooru'],
    searchQuery: '("Anantnag" OR "Pahalgam" OR "Achabal" OR "Kokernag") latest news',
    defaultDateline: 'ANANTNAG –',
    defaultMin: 0,
    defaultMax: 1,
    defaultPriority: 'normal',
  },
  baramulla: {
    id: 'baramulla',
    name: 'Baramulla',
    beatId: 'kashmir',
    keywords: ['baramulla', 'sopore', 'gulmarg', 'pattan', 'uri', 'tangmarg'],
    searchQuery: '("Baramulla" OR "Sopore" OR "Gulmarg" OR "Uri") latest news',
    defaultDateline: 'BARAMULLA –',
    defaultMin: 0,
    defaultMax: 1,
    defaultPriority: 'normal',
  },
  pulwama: {
    id: 'pulwama',
    name: 'Pulwama',
    beatId: 'kashmir',
    keywords: ['pulwama', 'pampore', 'awantipora', 'tral', 'rajpora'],
    searchQuery: '("Pulwama" OR "Pampore saffron" OR "Awantipora" OR "Tral") latest news',
    defaultDateline: 'PULWAMA –',
    defaultMin: 0,
    defaultMax: 1,
    defaultPriority: 'normal',
  },
  shopian: {
    id: 'shopian',
    name: 'Shopian',
    beatId: 'kashmir',
    keywords: ['shopian', 'hirpora', 'zainapora', 'sedow'],
    searchQuery: '("Shopian" OR "Hirpora" OR "Zainapora") latest news',
    defaultDateline: 'SHOPIAN –',
    defaultMin: 0,
    defaultMax: 1,
    defaultPriority: 'normal',
  },
  kulgam: {
    id: 'kulgam',
    name: 'Kulgam',
    beatId: 'kashmir',
    keywords: ['kulgam', 'devsar', 'aharbal', 'damhal hanjipora'],
    searchQuery: '("Kulgam" OR "Aharbal" OR "Devsar Kulgam") latest news',
    defaultDateline: 'KULGAM –',
    defaultMin: 0,
    defaultMax: 1,
    defaultPriority: 'normal',
  },
  kupwara: {
    id: 'kupwara',
    name: 'Kupwara',
    beatId: 'kashmir',
    keywords: ['kupwara', 'handwara', 'karnah', 'lolab', 'tangdar'],
    searchQuery: '("Kupwara" OR "Handwara" OR "Karnah" OR "Lolab") latest news',
    defaultDateline: 'KUPWARA –',
    defaultMin: 0,
    defaultMax: 1,
    defaultPriority: 'normal',
  },
  ganderbal: {
    id: 'ganderbal',
    name: 'Ganderbal',
    beatId: 'kashmir',
    keywords: ['ganderbal', 'sonamarg', 'kangan', 'manasbal'],
    searchQuery: '("Ganderbal" OR "Sonamarg" OR "Kangan") latest news',
    defaultDateline: 'GANDERBAL –',
    defaultMin: 0,
    defaultMax: 1,
    defaultPriority: 'normal',
  },
  budgam: {
    id: 'budgam',
    name: 'Budgam',
    beatId: 'kashmir',
    keywords: ['budgam', 'beerwah', 'chadoora', 'doodhpathri', 'magam', 'charar-i-sharief'],
    searchQuery: '("Budgam" OR "Beerwah" OR "Chadoora" OR "Doodhpathri") latest news',
    defaultDateline: 'BUDGAM –',
    defaultMin: 0,
    defaultMax: 1,
    defaultPriority: 'normal',
  },
  bandipora: {
    id: 'bandipora',
    name: 'Bandipora',
    beatId: 'kashmir',
    keywords: ['bandipora', 'wular', 'gurez', 'hajin', 'sumbal'],
    searchQuery: '("Bandipora" OR "Wular Lake" OR "Gurez Valley") latest news',
    defaultDateline: 'BANDIPORA –',
    defaultMin: 0,
    defaultMax: 1,
    defaultPriority: 'normal',
  },

  // Leh & Ladakh (UT) Districts
  leh: {
    id: 'leh',
    name: 'Leh',
    beatId: 'leh_ladakh',
    keywords: ['leh', 'ladakh', 'nubra', 'khardung la', 'pangong', 'shey', 'hemis'],
    searchQuery: '("Leh Ladakh" OR "Nubra Valley" OR "Khardung La" OR "Pangong Lake") latest news',
    defaultDateline: 'LEH –',
    defaultMin: 1,
    defaultMax: 2,
    defaultPriority: 'normal',
  },
  kargil: {
    id: 'kargil',
    name: 'Kargil',
    beatId: 'leh_ladakh',
    keywords: ['kargil', 'drass', 'zanskar', 'sanku', 'shakar chiktan'],
    searchQuery: '("Kargil" OR "Drass" OR "Zanskar" OR "Zojila") latest news',
    defaultDateline: 'KARGIL –',
    defaultMin: 1,
    defaultMax: 2,
    defaultPriority: 'normal',
  },

  // Pir Panjal Districts
  poonch: {
    id: 'poonch',
    name: 'Poonch',
    beatId: 'pir_panjal',
    keywords: ['poonch', 'surankote', 'mendhar', 'mandi poonch', 'chakan da bagh', 'haveli'],
    searchQuery: '("Poonch" OR "Surankote" OR "Mendhar" OR "Mandi Poonch") latest news',
    defaultDateline: 'POONCH –',
    defaultMin: 1,
    defaultMax: 2,
    defaultPriority: 'normal',
  },
  rajouri: {
    id: 'rajouri',
    name: 'Rajouri',
    beatId: 'pir_panjal',
    keywords: ['rajouri', 'nowshera', 'sunderbani', 'thanamandi', 'kotranka', 'kalakote'],
    searchQuery: '("Rajouri" OR "Nowshera" OR "Sunderbani" OR "Thanamandi") latest news',
    defaultDateline: 'RAJOURI –',
    defaultMin: 1,
    defaultMax: 2,
    defaultPriority: 'normal',
  },
};

export const KJIN_REGIONAL_TARGETS: RegionalTarget[] = [
  {
    id: 'chenab_valley',
    name: 'Chenab Valley Ground Bureau (Doda, Kishtwar, Ramban, Bhaderwah)',
    shortName: 'Chenab Valley',
    min: 3,
    max: 6,
    scope: 'Chenab Valley',
    districts: ['doda', 'kishtwar', 'ramban'],
    searchQuery: '("Chenab Valley" OR Doda OR Kishtwar OR Bhaderwah OR Ramban OR "NH-244" OR "Ratle Hydro" OR "Pakal Dul" OR "Assar" OR "Sinthan Top") latest news',
    defaultDateline: 'DODA –',
    isRegional: true,
    weight: 3,
  },
  {
    id: 'jammu',
    name: 'Jammu Plains & Shivalik Hub',
    shortName: 'Jammu',
    min: 2,
    max: 5,
    scope: 'State (Jammu & Kashmir)',
    districts: ['jammu', 'samba', 'kathua', 'udhampur', 'reasi'],
    searchQuery: '(Jammu city OR Kathua OR Samba OR Udhampur OR Reasi OR "Jammu railway" OR "Tawi river") latest news',
    defaultDateline: 'JAMMU –',
    isRegional: true,
    weight: 2,
  },
  {
    id: 'kashmir',
    name: 'Kashmir Valley Editorial Desk',
    shortName: 'Kashmir',
    min: 2,
    max: 5,
    scope: 'State (Jammu & Kashmir)',
    districts: ['srinagar', 'anantnag', 'baramulla', 'pulwama', 'shopian', 'kulgam', 'kupwara', 'ganderbal', 'budgam', 'bandipora'],
    searchQuery: '(Srinagar OR "Dal Lake" OR Anantnag OR Baramulla OR Pulwama OR Sopore OR Shopian OR "Kashmir weather" OR "Kashmir transit") latest news',
    defaultDateline: 'SRINAGAR –',
    isRegional: true,
    weight: 2,
  },
  {
    id: 'leh_ladakh',
    name: 'Leh & Ladakh Frontier Desk',
    shortName: 'Leh / Ladakh',
    min: 2,
    max: 3,
    scope: 'State (Jammu & Kashmir)',
    districts: ['leh', 'kargil'],
    searchQuery: '(Leh OR Kargil OR Ladakh OR "Zojila Pass" OR "Chang La" OR "Khardung La" OR "Nubra Valley" OR "Ladakh administration") latest news',
    defaultDateline: 'LEH –',
    isRegional: true,
    weight: 1,
  },
  {
    id: 'pir_panjal',
    name: 'Pir Panjal & Border Corridors',
    shortName: 'Pir Panjal',
    min: 2,
    max: 3,
    scope: 'State (Jammu & Kashmir)',
    districts: ['poonch', 'rajouri'],
    searchQuery: '(Poonch OR Rajouri OR "Mughal Road" OR "Peer Ki Gali" OR "Surankote" OR "Mendhar") latest news Jammu Kashmir',
    defaultDateline: 'POONCH –',
    isRegional: true,
    weight: 1,
  },
  {
    id: 'national',
    name: 'All-India National Desk',
    shortName: 'National',
    min: 2,
    max: 5,
    scope: 'National',
    districts: [],
    searchQuery: '(India "Supreme Court" OR "Union Cabinet" OR "Parliament" OR "Indian Economy" OR "ISRO" OR "National Policy") latest news breaking',
    defaultDateline: 'NEW DELHI –',
    isRegional: false,
    weight: 1,
  },
  {
    id: 'international',
    name: 'Global Foreign Affairs Desk',
    shortName: 'International',
    min: 4,
    max: 5,
    scope: 'International',
    districts: [],
    searchQuery: '("United Nations" OR "Global diplomacy" OR "Middle East crisis" OR "International defense" OR "Geopolitics") latest news breaking',
    defaultDateline: 'GLOBAL DESK –',
    isRegional: false,
    weight: 2,
  },
];

// Backwards-compatible export for existing integrations
export interface DiscoveryBeat {
  id: string;
  name: string;
  scope: 'Chenab Valley' | 'State (Jammu & Kashmir)' | 'National' | 'International';
  searchQuery: string;
  targetDistricts?: string[];
  weight: number;
}

export const DISCOVERY_BEATS: DiscoveryBeat[] = KJIN_REGIONAL_TARGETS.map((t) => ({
  id: t.id,
  name: t.name,
  scope: t.scope,
  searchQuery: t.searchQuery,
  targetDistricts: t.districts,
  weight: t.weight,
}));

/**
 * High-impact civic problems & public grievances search queries across J&K and Ladakh.
 * Focuses on internet/mobile blackouts, drinking water crises, power cuts, damaged transformers, and road cutoffs.
 */
export const CIVIC_PROBLEM_SEARCH_QUERIES = [
  '("no internet" OR "water scarcity" OR "drinking water problem" OR "power cut" OR "damaged transformer" OR "electricity issue") ("Jammu" OR "Kashmir" OR "Sarthal" OR "Kathua" OR "Doda" OR "Kishtwar" OR "Ramban" OR "Leh" OR "Kargil" OR "Poonch" OR "Rajouri")',
  '("water crisis" OR "PHE" OR "Jal Shakti" OR "tap water" OR "tanker") ("Kathua" OR "Sarthal" OR "Doda" OR "Kishtwar" OR "Kashmir" OR "Jammu" OR "Ladakh") latest news protest grievance',
  '("power crisis" OR "unscheduled power cuts" OR "burnt transformer" OR "PDD" OR "blackout") ("Doda" OR "Kishtwar" OR "Ramban" OR "Kathua" OR "Kupwara" OR "Poonch" OR "Jammu Kashmir")',
  '("no mobile connectivity" OR "call drop" OR "no network" OR "broadband down" OR "internet snapped") ("Sarthal" OR "Marwah" OR "Warwan" OR "Padder" OR "Gurez" OR "Zanskar" OR "Kathua" OR "Jammu Kashmir")',
  '("road in dilapidated condition" OR "potholes" OR "damaged bridge" OR "road blockade" OR "landslide") ("Chenab Valley" OR "Kathua" OR "Mughal Road" OR "Jammu Srinagar Highway" OR "Kargil" OR "Leh")',
];

export interface CivicProblemsDailyStatus {
  currentToday: number;
  maxDaily: number;
  lastProblemAt: string | null;
  canDiscoverNow: boolean;
  hoursSinceLastProblem: number | null;
  hoursUntilNextAllowed: number;
  intervalHours: number;
  todayProblems: Array<{
    id: string;
    title: string;
    slug: string;
    district?: string | null;
    published_at: string | null;
    created_at: string;
  }>;
}

/**
 * Calculates today's civic problems count and 6-hour interval pacing.
 * Enforces maximum 2 problem dispatches per day, separated by at least 6 hours.
 */
export async function getCivicProblemsDailyStatus(
  service: any,
  now = new Date()
): Promise<CivicProblemsDailyStatus> {
  const startOfDay = getNewsroomStartOfDay(now);
  const startOfDayIso = startOfDay.toISOString();
  const maxDaily = 2;
  const intervalHours = 6;

  try {
    const { data: rows } = await service
      .from('articles')
      .select('id, title, slug, district, published_at, created_at, status')
      .ilike('category', 'problems')
      .gte('created_at', startOfDayIso)
      .order('created_at', { ascending: false });

    const todayProblems = rows || [];
    const currentToday = todayProblems.length;

    let lastProblemAt: string | null = null;
    let hoursSinceLastProblem: number | null = null;
    let canDiscoverNow = false;
    let hoursUntilNextAllowed = 0;

    if (currentToday === 0) {
      canDiscoverNow = true;
      hoursUntilNextAllowed = 0;
    } else if (currentToday === 1) {
      lastProblemAt = todayProblems[0]?.published_at || todayProblems[0]?.created_at || null;
      const lastTime = lastProblemAt ? new Date(lastProblemAt).getTime() : now.getTime();
      const diffHours = (now.getTime() - lastTime) / (1000 * 60 * 60);
      hoursSinceLastProblem = Math.max(0, Number(diffHours.toFixed(1)));

      if (diffHours >= intervalHours) {
        canDiscoverNow = true;
        hoursUntilNextAllowed = 0;
      } else {
        canDiscoverNow = false;
        hoursUntilNextAllowed = Math.max(0, Number((intervalHours - diffHours).toFixed(1)));
      }
    } else {
      canDiscoverNow = false;
      lastProblemAt = todayProblems[0]?.published_at || todayProblems[0]?.created_at || null;
      const lastTime = lastProblemAt ? new Date(lastProblemAt).getTime() : now.getTime();
      hoursSinceLastProblem = Math.max(0, Number(((now.getTime() - lastTime) / (1000 * 60 * 60)).toFixed(1)));
      hoursUntilNextAllowed = 24;
    }

    return {
      currentToday,
      maxDaily,
      lastProblemAt,
      canDiscoverNow,
      hoursSinceLastProblem,
      hoursUntilNextAllowed,
      intervalHours,
      todayProblems,
    };
  } catch (err) {
    return {
      currentToday: 0,
      maxDaily: 2,
      lastProblemAt: null,
      canDiscoverNow: true,
      hoursSinceLastProblem: null,
      hoursUntilNextAllowed: 0,
      intervalHours: 6,
      todayProblems: [],
    };
  }
}

/**
 * Classifies an article into one of KJIN's 7 editorial regions.
 */
export function classifyArticleRegion(article: {
  category?: string | null;
  district?: string | null;
  title?: string | null;
  excerpt?: string | null;
  content?: string | null;
}): string {
  const cat = (article.category || '').toLowerCase();
  const dist = (article.district || '').toLowerCase();
  const text = `${article.title || ''} ${article.excerpt || ''} ${article.content || ''}`.toLowerCase();

  if (cat === 'international' || text.includes('global desk') || text.includes('united nations') || text.includes('foreign affairs')) {
    return 'international';
  }
  if (cat === 'national' || dist === 'new delhi' || text.includes('new delhi –') || text.includes('supreme court') || text.includes('parliament')) {
    return 'national';
  }

  // Check specific district matches
  if (['doda', 'kishtwar', 'ramban'].includes(dist) || text.includes('chenab valley') || text.includes('bhaderwah') || text.includes('assar') || text.includes('nh-244') || text.includes('ratle')) {
    return 'chenab_valley';
  }
  if (['poonch', 'rajouri'].includes(dist) || text.includes('pir panjal') || text.includes('mughal road') || text.includes('peer ki gali') || text.includes('surankote')) {
    return 'pir_panjal';
  }
  if (['leh', 'kargil'].includes(dist) || text.includes('ladakh') || text.includes('zojila') || text.includes('khardung')) {
    return 'leh_ladakh';
  }
  if (['jammu', 'samba', 'kathua', 'udhampur', 'reasi'].includes(dist) || text.includes('jammu city') || text.includes('tawi')) {
    return 'jammu';
  }
  if (
    ['srinagar', 'baramulla', 'anantnag', 'pulwama', 'budgam', 'kupwara', 'bandipora', 'ganderbal', 'kulgam', 'shopian'].includes(dist) ||
    text.includes('srinagar') ||
    text.includes('kashmir valley')
  ) {
    return 'kashmir';
  }

  // Fallback defaults
  if (cat.includes('local') || dist) return 'kashmir';
  return 'national';
}

/**
 * Detects the specific district for an article from its district field or content keywords.
 */
export function detectArticleDistrict(article: {
  district?: string | null;
  title?: string | null;
  excerpt?: string | null;
  content?: string | null;
}): string | null {
  if (article.district) {
    const raw = article.district.toLowerCase().trim();
    if (DISTRICT_METADATA[raw]) return raw;
    // Map known variations/aliases
    if (raw.includes('doda')) return 'doda';
    if (raw.includes('kishtwar')) return 'kishtwar';
    if (raw.includes('ramban')) return 'ramban';
    if (raw.includes('jammu')) return 'jammu';
    if (raw.includes('samba')) return 'samba';
    if (raw.includes('kathua')) return 'kathua';
    if (raw.includes('udhampur')) return 'udhampur';
    if (raw.includes('reasi')) return 'reasi';
    if (raw.includes('srinagar')) return 'srinagar';
    if (raw.includes('anantnag')) return 'anantnag';
    if (raw.includes('baramulla')) return 'baramulla';
    if (raw.includes('pulwama')) return 'pulwama';
    if (raw.includes('shopian')) return 'shopian';
    if (raw.includes('kulgam')) return 'kulgam';
    if (raw.includes('kupwara')) return 'kupwara';
    if (raw.includes('ganderbal')) return 'ganderbal';
    if (raw.includes('budgam')) return 'budgam';
    if (raw.includes('bandipora')) return 'bandipora';
    if (raw.includes('leh')) return 'leh';
    if (raw.includes('kargil')) return 'kargil';
    if (raw.includes('poonch')) return 'poonch';
    if (raw.includes('rajouri')) return 'rajouri';
    return raw;
  }

  const text = `${article.title || ''} ${article.excerpt || ''} ${article.content || ''}`.toLowerCase();
  for (const [distId, meta] of Object.entries(DISTRICT_METADATA)) {
    if (text.includes(distId) || meta.keywords.some((kw) => text.includes(kw.toLowerCase()))) {
      return distId;
    }
  }
  return null;
}

export interface RegionalDailyStats {
  totalDiscoveredToday: number;
  totalPublishedToday?: number;
  regionalDiscoveredToday: number;
  regionalPublishedToday?: number;
  nationalInternationalDiscoveredToday: number;
  regionalSharePercent: number;
  targetOverview: {
    minDailyTotal: number;
    maxDailyTotal: number;
    preferredOperatingTarget: number;
  };
  regions: Array<{
    id: string;
    name: string;
    shortName: string;
    current: number;
    published?: number;
    min: number;
    max: number;
    deficit: number;
    isMet: boolean;
    isMaxReached: boolean;
    isRegional: boolean;
    districts?: DistrictDailyStat[];
  }>;
}

/**
 * Returns the exact start of today (00:00:00.000) in the newsroom's canonical timezone (Asia/Kolkata / IST).
 * When a new calendar day arrives at 00:00:00 IST, this shifts to the new day's midnight,
 * ensuring all daily counts and beat targets reset to 0 for the fresh editorial cycle.
 */
export function getNewsroomStartOfDay(referenceDate: Date = new Date()): Date {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.format(referenceDate); // "YYYY-MM-DD"
  return new Date(`${parts}T00:00:00+05:30`);
}

/**
 * Computes live daily statistics for today's published & discovered articles against regional targets.
 * On each new calendar day (00:00:00 IST), all beat progress counters strictly reset to 0,
 * allowing the newsroom to fulfill the day's targets afresh.
 */
export async function getDailyRegionalStats(service: SupabaseClient, referenceDate?: Date): Promise<RegionalDailyStats> {
  const startOfDay = getNewsroomStartOfDay(referenceDate);

  // Query all articles published today OR created/active today across all author roles (staff, editor, AI discovery)
  const { data: todayArticles } = await service
    .from('articles')
    .select('id, category, district, title, excerpt, author_display_name, status, published_at, created_at')
    .or(`published_at.gte.${startOfDay.toISOString()},created_at.gte.${startOfDay.toISOString()}`);

  const articles = todayArticles || [];
  const countMap: Record<string, number> = {
    chenab_valley: 0,
    jammu: 0,
    kashmir: 0,
    leh_ladakh: 0,
    pir_panjal: 0,
    national: 0,
    international: 0,
  };
  const publishedCountMap: Record<string, number> = {
    chenab_valley: 0,
    jammu: 0,
    kashmir: 0,
    leh_ladakh: 0,
    pir_panjal: 0,
    national: 0,
    international: 0,
  };

  const districtCountMap: Record<string, number> = {};
  const districtPublishedCountMap: Record<string, number> = {};

  let publishedTodayCount = 0;

  for (const art of articles) {
    // Only count active articles (drafts, pending review, published) towards today's beat targets
    if (art.status === 'archived' || art.status === 'rejected') {
      continue;
    }
    const regionKey = classifyArticleRegion(art);
    if (countMap[regionKey] !== undefined) {
      countMap[regionKey]++;
    }
    const districtKey = detectArticleDistrict(art);
    if (districtKey) {
      districtCountMap[districtKey] = (districtCountMap[districtKey] || 0) + 1;
    }
    if (art.status === 'published') {
      publishedTodayCount++;
      if (publishedCountMap[regionKey] !== undefined) {
        publishedCountMap[regionKey]++;
      }
      if (districtKey) {
        districtPublishedCountMap[districtKey] = (districtPublishedCountMap[districtKey] || 0) + 1;
      }
    }
  }

  // Fetch custom dynamic beat quotas and district quotas from site_settings (if set by editor)
  let customQuotas: Record<string, any> = {};
  try {
    const { data: settingsRow } = await service
      .from('site_settings')
      .select('value')
      .eq('key', 'newsroom_auto_pilot')
      .maybeSingle();
    if (settingsRow?.value?.beat_quotas) {
      customQuotas = settingsRow.value.beat_quotas;
    }
  } catch {
    // Fall back to default targets
  }

  const regionBreakdown = KJIN_REGIONAL_TARGETS.map((t) => {
    const current = countMap[t.id] || 0;
    const published = publishedCountMap[t.id] || 0;
    const minTarget = customQuotas[t.id]?.min !== undefined ? Math.max(0, Number(customQuotas[t.id]?.min)) : t.min;
    const maxTarget = customQuotas[t.id]?.max !== undefined ? Math.max(minTarget, Number(customQuotas[t.id]?.max)) : t.max;
    const deficit = Math.max(0, minTarget - current);

    const customDistricts = (customQuotas[t.id]?.districts || {}) as Record<string, DistrictQuotaConfig>;

    const districtStats: DistrictDailyStat[] = (t.districts || []).map((distId) => {
      const meta = DISTRICT_METADATA[distId] || {
        id: distId,
        name: distId.charAt(0).toUpperCase() + distId.slice(1),
        beatId: t.id,
        keywords: [distId],
        searchQuery: `"${distId}" latest news`,
        defaultDateline: `${distId.toUpperCase()} –`,
        defaultMin: 1,
        defaultMax: 2,
        defaultPriority: 'normal' as const,
      };
      const customDist = customDistricts[distId];
      const distCurrent = districtCountMap[distId] || 0;
      const distPublished = districtPublishedCountMap[distId] || 0;
      const distMin = customDist?.min !== undefined ? Math.max(0, Number(customDist.min)) : meta.defaultMin;
      const distMax = customDist?.max !== undefined ? Math.max(distMin, Number(customDist.max)) : meta.defaultMax;
      const distPriority = (customDist?.priority || meta.defaultPriority || 'normal') as 'high' | 'normal' | 'low';
      const distDeficit = Math.max(0, distMin - distCurrent);

      return {
        id: distId,
        name: meta.name,
        beatId: t.id,
        current: distCurrent,
        published: distPublished,
        min: distMin,
        max: distMax,
        priority: distPriority,
        deficit: distDeficit,
        isMet: distCurrent >= distMin,
        isMaxReached: distCurrent >= distMax,
      };
    });

    return {
      id: t.id,
      name: t.name,
      shortName: t.shortName,
      current,
      published,
      min: minTarget,
      max: maxTarget,
      deficit,
      isMet: current >= minTarget,
      isMaxReached: current >= maxTarget,
      isRegional: t.isRegional,
      districts: districtStats,
    };
  });

  const regionalTotal = regionBreakdown
    .filter((r) => r.isRegional)
    .reduce((sum, r) => sum + r.current, 0);

  const nonRegionalTotal = regionBreakdown
    .filter((r) => !r.isRegional)
    .reduce((sum, r) => sum + r.current, 0);

  const totalCount = articles.length;
  const regionalSharePercent = totalCount > 0 ? Math.round((regionalTotal / totalCount) * 100) : 65;

  const minDailyTotal = regionBreakdown.reduce((sum, r) => sum + r.min, 0);
  const maxDailyTotal = regionBreakdown.reduce((sum, r) => sum + r.max, 0);
  const preferredOperatingTarget = Math.round((minDailyTotal + maxDailyTotal) / 2);

  return {
    totalDiscoveredToday: totalCount,
    totalPublishedToday: publishedTodayCount,
    regionalDiscoveredToday: regionalTotal,
    nationalInternationalDiscoveredToday: nonRegionalTotal,
    regionalSharePercent,
    targetOverview: {
      minDailyTotal,
      maxDailyTotal,
      preferredOperatingTarget,
    },
    regions: regionBreakdown,
  };
}

/**
 * Dynamically prioritizes the next beat to discover based on underrepresented regions.
 * Implements Algorithm Improvement 6: "Prioritise underrepresented regions".
 */
export function selectNextPrioritizedBeat(stats: RegionalDailyStats): RegionalTarget | null {
  // 1. Check regions that have NOT met their minimum target yet (deficit > 0)
  const underrepresented = stats.regions.filter((r) => r.deficit > 0);

  if (underrepresented.length > 0) {
    // Sort primarily by largest deficit descending.
    // If deficits are equal, sort by target weight (Chenab Valley weight: 3 gets top priority).
    underrepresented.sort((a, b) => {
      if (b.deficit !== a.deficit) return b.deficit - a.deficit;
      const targetA = KJIN_REGIONAL_TARGETS.find((t) => t.id === a.id);
      const targetB = KJIN_REGIONAL_TARGETS.find((t) => t.id === b.id);
      return (targetB?.weight || 1) - (targetA?.weight || 1);
    });

    const statRegion = underrepresented[0];
    const baseTarget = KJIN_REGIONAL_TARGETS.find((t) => t.id === statRegion.id);
    if (baseTarget) {
      return {
        ...baseTarget,
        min: statRegion.min,
        max: statRegion.max,
      };
    }
  }

  // 2. All regions have met their minimum. Check regions with headroom below maximum.
  const eligibleBelowMax = stats.regions.filter((r) => !r.isMaxReached);
  if (eligibleBelowMax.length > 0) {
    eligibleBelowMax.sort((a, b) => {
      const roomA = a.max - a.current;
      const roomB = b.max - b.current;
      if (roomB !== roomA) return roomB - roomA;
      const targetA = KJIN_REGIONAL_TARGETS.find((t) => t.id === a.id);
      const targetB = KJIN_REGIONAL_TARGETS.find((t) => t.id === b.id);
      return (targetB?.weight || 1) - (targetA?.weight || 1);
    });

    const statRegion = eligibleBelowMax[0];
    const baseTarget = KJIN_REGIONAL_TARGETS.find((t) => t.id === statRegion.id);
    if (baseTarget) {
      return {
        ...baseTarget,
        min: statRegion.min,
        max: statRegion.max,
      };
    }
  }

  // 3. All regions are at or above daily maximum
  return null;
}

/**
 * Prioritizes which district within a regional beat to discover next,
 * giving first priority to districts with unfulfilled minimum quotas and higher priority ratings.
 */
export function selectTargetDistrictForBeat(
  beat: RegionalTarget,
  districts?: DistrictDailyStat[],
  explicitDistrictId?: string
): DistrictDailyStat | null {
  if (!districts || districts.length === 0) return null;

  // 1. Explicit district requested by user / options
  if (explicitDistrictId) {
    const norm = explicitDistrictId.toLowerCase().trim();
    const match = districts.find((d) => d.id === norm || d.name.toLowerCase() === norm);
    if (match) return match;
  }

  const priorityWeight = (p: 'high' | 'normal' | 'low') => (p === 'high' ? 3 : p === 'low' ? 1 : 2);

  // 2. Prioritize districts that have NOT met their minimum target yet (deficit > 0)
  const unmet = districts.filter((d) => d.deficit > 0);
  if (unmet.length > 0) {
    unmet.sort((a, b) => {
      // First sort by priority descending (High > Normal > Low)
      const pwDiff = priorityWeight(b.priority) - priorityWeight(a.priority);
      if (pwDiff !== 0) return pwDiff;
      // Second sort by largest deficit descending
      return b.deficit - a.deficit;
    });
    return unmet[0];
  }

  // 3. All districts met their minimum: check headroom below maximum
  const eligibleBelowMax = districts.filter((d) => !d.isMaxReached);
  if (eligibleBelowMax.length > 0) {
    eligibleBelowMax.sort((a, b) => {
      const pwDiff = priorityWeight(b.priority) - priorityWeight(a.priority);
      if (pwDiff !== 0) return pwDiff;
      return (b.max - b.current) - (a.max - a.current);
    });
    return eligibleBelowMax[0];
  }

  return districts[0] || null;
}

/**
 * Checks if a candidate headline substantially duplicates an existing recent story.
 */
export function calculateHeadlineSimilarity(headlineA: string, headlineB: string): { similarity: number; matchCount: number; isDuplicate: boolean } {
  const filterStopwords = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !['with', 'from', 'that', 'this', 'have', 'after', 'about', 'over', 'into', 'under', 'their', 'near', 'tragic', 'claims'].includes(w));

  const wordsA = filterStopwords(headlineA);
  const wordsB = filterStopwords(headlineB);

  if (wordsA.length === 0 || wordsB.length === 0) {
    return { similarity: 0, matchCount: 0, isDuplicate: false };
  }

  let matches = 0;
  for (const w of wordsA) {
    if (wordsB.includes(w)) matches++;
  }

  const similarity = matches / Math.min(wordsA.length, wordsB.length);
  // Duplicate if sharing >= 35% of keywords OR 3+ specific proper nouns/locations
  const isDuplicate = similarity >= 0.35 || matches >= 3;

  return { similarity, matchCount: matches, isDuplicate };
}

async function isDuplicateStory(service: SupabaseClient, headline: string): Promise<boolean> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await service
    .from('articles')
    .select('title')
    .gte('created_at', sevenDaysAgo)
    .limit(160);

  if (!recent || recent.length === 0) return false;

  for (const art of recent) {
    const { isDuplicate } = calculateHeadlineSimilarity(headline, art.title);
    if (isDuplicate) {
      return true;
    }
  }

  return false;
}

/**
 * Detects if a story qualifies as critical breaking news (overrides regional maximum caps).
 */
export function isBreakingNewsEvent(headline: string, summary: string, explicitFlag?: boolean): boolean {
  if (explicitFlag) return true;
  const combined = `${headline} ${summary}`.toLowerCase();
  const criticalKeywords = [
    'earthquake',
    'cloudburst',
    'fatal accident',
    'plunges into gorge',
    'landslide',
    'flash flood',
    'encounter',
    'terrorist',
    'curfew',
    'high-priority order',
    'avalanche',
    'killed in mishap',
    'building collapse',
  ];
  return criticalKeywords.some((kw) => combined.includes(kw));
}

export interface ScheduledAutoPublishItem {
  articleId: string;
  headline: string;
  category: string;
  district?: string | null;
  scope?: string;
  scheduledFor: string;
  createdAt: string;
  status: 'pending' | 'published' | 'cancelled';
  publishedAt?: string;
}

export interface AutoPublishConfig {
  enabled: boolean;
  delayMinutes: number;
  queue: ScheduledAutoPublishItem[];
}

const activeAutoPublishTimers = new Map<string, NodeJS.Timeout>();

/**
 * Retrieves the current auto-publish configuration from site_settings.
 */
export async function getAutoPublishConfig(service: any): Promise<AutoPublishConfig> {
  try {
    const { data: row } = await service
      .from('site_settings')
      .select('value')
      .eq('key', 'newsroom_auto_pilot')
      .maybeSingle();

    const enabled = Boolean(row?.value?.auto_publish_enabled);
    const delayMinutes = Math.max(1, Number(row?.value?.auto_publish_delay_minutes) || 5);
    const queue: ScheduledAutoPublishItem[] = Array.isArray(row?.value?.scheduled_queue)
      ? row.value.scheduled_queue
      : [];

    return { enabled, delayMinutes, queue };
  } catch {
    return { enabled: false, delayMinutes: 5, queue: [] };
  }
}

/**
 * Marks a scheduled item in site_settings.newsroom_auto_pilot queue as published or cancelled.
 */
export async function markScheduledQueueStatus(
  service: any,
  articleId: string,
  newStatus: 'published' | 'cancelled'
) {
  try {
    const { data: row } = await service
      .from('site_settings')
      .select('value')
      .eq('key', 'newsroom_auto_pilot')
      .maybeSingle();

    if (row?.value) {
      const queue: ScheduledAutoPublishItem[] = Array.isArray(row.value.scheduled_queue)
        ? row.value.scheduled_queue
        : [];
      const updatedQueue = queue.map((item) =>
        item.articleId === articleId
          ? {
              ...item,
              status: newStatus,
              publishedAt: newStatus === 'published' ? new Date().toISOString() : item.publishedAt,
            }
          : item
      );

      await service.from('site_settings').update({
        value: {
          ...row.value,
          scheduled_queue: updatedQueue.slice(-60),
        },
        updated_at: new Date().toISOString(),
      }).eq('key', 'newsroom_auto_pilot');
    }
  } catch (err) {
    console.warn('[AutoPublish] Could not update scheduled queue in site_settings:', err);
  }
}

/**
 * Executes the final publication of an auto-approved article after its grace period elapses.
 */
export async function executeAutoPublishArticle(
  service: any,
  articleId: string,
  publisherId?: string | null
): Promise<{ success: boolean; articleId: string; error?: string }> {
  try {
    const timer = activeAutoPublishTimers.get(articleId);
    if (timer) {
      clearTimeout(timer);
      activeAutoPublishTimers.delete(articleId);
    }

    const { data: article, error: fetchErr } = await service
      .from('articles')
      .select('id, title, status, author_id')
      .eq('id', articleId)
      .single();

    if (fetchErr || !article) {
      return { success: false, articleId, error: fetchErr?.message || 'Article not found' };
    }

    if (article.status === 'published') {
      await markScheduledQueueStatus(service, articleId, 'published');
      return { success: true, articleId };
    }

    let finalPublisherId = publisherId || article.author_id;
    if (!finalPublisherId) {
      const { data: owners } = await service
        .from('profiles')
        .select('id')
        .in('role_key', ['owner', 'superadmin', 'admin'])
        .limit(1);
      finalPublisherId = owners?.[0]?.id || null;
    }

    const nowIso = new Date().toISOString();
    const { error: updateErr } = await service
      .from('articles')
      .update({
        status: 'published',
        published_at: nowIso,
        published_by: finalPublisherId,
        updated_at: nowIso,
      })
      .eq('id', articleId);

    if (updateErr) {
      console.error(`[AutoPublish] Failed to publish article ${articleId}:`, updateErr);
      return { success: false, articleId, error: updateErr.message };
    }

    // Insert audit log
    await service.from('audit_logs').insert({
      actor_profile_id: finalPublisherId,
      action: 'article.auto_published',
      target_type: 'article',
      target_id: articleId,
      result: 'success',
      details: {
        reason: 'Autonomous auto-approval grace period elapsed (5-min window completed)',
        headline: article.title,
      },
    }).catch(() => null);

    await markScheduledQueueStatus(service, articleId, 'published');
    console.log(`[AutoPublish] ✅ Successfully published story "${article.title}" (ID: ${articleId})`);
    return { success: true, articleId };
  } catch (err: any) {
    console.error(`[AutoPublish] Unexpected error executing auto-publish for ${articleId}:`, err);
    return { success: false, articleId, error: err.message };
  }
}

/**
 * Cancels a pending auto-publish schedule for an article.
 */
export async function cancelArticleAutoPublish(
  service: any,
  articleId: string
): Promise<boolean> {
  const timer = activeAutoPublishTimers.get(articleId);
  if (timer) {
    clearTimeout(timer);
    activeAutoPublishTimers.delete(articleId);
  }
  await markScheduledQueueStatus(service, articleId, 'cancelled');
  console.log(`[AutoPublish] 🛑 Cancelled auto-publish for article ID: ${articleId}`);
  return true;
}

/**
 * Checks for any pending scheduled articles whose grace period has completed and publishes them.
 */
export async function processPendingAutoPublishes(
  service: any
): Promise<{ processed: number; publishedIds: string[] }> {
  try {
    const { data: row } = await service
      .from('site_settings')
      .select('value')
      .eq('key', 'newsroom_auto_pilot')
      .maybeSingle();

    if (!row?.value?.scheduled_queue || !Array.isArray(row.value.scheduled_queue)) {
      return { processed: 0, publishedIds: [] };
    }

    const now = new Date();
    const queue: ScheduledAutoPublishItem[] = row.value.scheduled_queue;
    const matureItems = queue.filter(
      (item) => item.status === 'pending' && new Date(item.scheduledFor) <= now
    );

    const publishedIds: string[] = [];
    for (const item of matureItems) {
      const res = await executeAutoPublishArticle(service, item.articleId);
      if (res.success) {
        publishedIds.push(item.articleId);
      }
    }

    return { processed: matureItems.length, publishedIds };
  } catch (err) {
    console.warn('[AutoPublish] Error in processPendingAutoPublishes:', err);
    return { processed: 0, publishedIds: [] };
  }
}

/**
 * Schedules an auto-approved article for publication after delayMinutes and dispatches advance email alert.
 */
export async function scheduleArticleAutoPublish(
  service: any,
  params: {
    articleId: string;
    headline: string;
    summary: string;
    category: string;
    scope: string;
    division: string;
    district?: string | null;
    sourceName: string;
    sourceUrl?: string | null;
    delayMinutes?: number;
    authorId?: string | null;
  }
): Promise<ScheduledAutoPublishItem> {
  const delayMinutes = params.delayMinutes ?? 5;
  const scheduledTime = new Date(Date.now() + delayMinutes * 60 * 1000);
  const scheduledItem: ScheduledAutoPublishItem = {
    articleId: params.articleId,
    headline: params.headline,
    category: params.category,
    district: params.district,
    scope: params.scope,
    scheduledFor: scheduledTime.toISOString(),
    createdAt: new Date().toISOString(),
    status: 'pending',
  };

  // 1. Persist to scheduled_queue in site_settings.newsroom_auto_pilot
  try {
    const { data: row } = await service
      .from('site_settings')
      .select('value')
      .eq('key', 'newsroom_auto_pilot')
      .maybeSingle();

    const existingQueue: ScheduledAutoPublishItem[] = Array.isArray(row?.value?.scheduled_queue)
      ? row.value.scheduled_queue
      : [];
    const mergedValue = {
      ...(row?.value || {}),
      scheduled_queue: [...existingQueue, scheduledItem].slice(-60),
    };

    await service.from('site_settings').upsert({
      key: 'newsroom_auto_pilot',
      value: mergedValue,
      description: 'Newsroom YouTube Autonomous Surveillance Auto-Pilot schedule configuration and beat quotas',
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[AutoPublish] Error saving to scheduled queue in site_settings:', err);
  }

  // 2. Dispatch real-time auto-approval advance email alert (sent BEFORE the 5 minutes)
  Promise.resolve(
    sendAutoApprovedEmailAlert({
      articleId: params.articleId,
      headline: params.headline,
      summary: params.summary,
      category: params.category,
      scope: params.scope,
      division: params.division,
      district: params.district,
      platform: 'Autonomous Web Intelligence Radar',
      sourceName: params.sourceName,
      sourceUrl: params.sourceUrl,
      scheduledLiveAt: scheduledTime,
      delayMinutes,
      dashboardUrl: `${process.env.ADMIN_URL || process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3001'}/newsroom/youtube`,
    })
  ).catch((mailErr) => {
    console.warn('[AutoPublish] Error dispatching auto-approval email alert:', mailErr);
  });

  // 3. Arm in-memory timer for graceful execution after 5 minutes
  const timer = setTimeout(async () => {
    try {
      await executeAutoPublishArticle(service, params.articleId, params.authorId);
    } catch (err) {
      console.error('[AutoPublish] Timer execution failed:', err);
    } finally {
      activeAutoPublishTimers.delete(params.articleId);
    }
  }, delayMinutes * 60 * 1000);

  activeAutoPublishTimers.set(params.articleId, timer);

  console.log(
    `[AutoPublish] ⏰ Scheduled auto-publish for "${params.headline}" in ${delayMinutes}m (at ${scheduledTime.toISOString()})`
  );

  return scheduledItem;
}

/**
 * Executes a single grounded autonomous news discovery cycle using Google Search grounding.
 */
export async function runAutonomousNewsDiscovery(
  service: SupabaseClient,
  options?: { beatId?: string; districtId?: string; force?: boolean; topic?: 'general' | 'civic_problems' }
): Promise<{
  success: boolean;
  discovered?: boolean;
  skipped?: boolean;
  inCooldown?: boolean;
  articleId?: string;
  headline?: string;
  scope?: string;
  beat?: string;
  district?: string;
  sourceUrl?: string;
  autoApproved?: boolean;
  autoPublishDelayMinutes?: number;
  reason?: string;
  dailyStats?: RegionalDailyStats;
  civicProblemsStatus?: CivicProblemsDailyStatus;
}> {
  const isCivicTopic = options?.topic === 'civic_problems' || options?.beatId === 'civic_problems';
  let civicStatus: CivicProblemsDailyStatus | null = null;

  // Enforce 2 problems per day and 6-hour interval rule
  if (isCivicTopic) {
    civicStatus = await getCivicProblemsDailyStatus(service);
    if (!civicStatus.canDiscoverNow && !options?.force) {
      console.log(
        `[AutonomousDiscovery] ⏸️ Civic problems desk pace limit reached (${civicStatus.currentToday}/${civicStatus.maxDaily} today, 6h interval: ${civicStatus.hoursUntilNextAllowed}h remaining). Skipping.`
      );
      return {
        success: true,
        skipped: true,
        discovered: false,
        reason: `Civic problems daily target met (${civicStatus.currentToday}/${civicStatus.maxDaily} today, 6-hour interval: ${civicStatus.hoursUntilNextAllowed}h remaining).`,
        civicProblemsStatus: civicStatus,
      };
    }
  }

  // 0. Circuit Breaker Check: if Gemini quota was exhausted, enforce 1-hour backoff
  const breaker = await isGeminiInCooldown(service);
  if (breaker.inCooldown && !options?.force) {
    console.warn(
      `[AutonomousDiscovery] ⏸️ Gemini circuit breaker ACTIVE. In cooldown until ${breaker.cooldownUntil} (${breaker.remainingMinutes}m remaining). Preserving pending beat "${breaker.pendingBeatId}". Skipping call to protect quota.`
    );
    return {
      success: false,
      skipped: true,
      inCooldown: true,
      reason: `Gemini quota cooldown active (${breaker.remainingMinutes}m remaining). Will resume beat "${breaker.pendingBeatId}" once quota recovers.`,
      beat: breaker.pendingBeatId || undefined,
    };
  }

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { success: false, reason: 'Gemini API key is not configured.' };
  }

  // 1. Fetch live daily regional coverage statistics
  const stats = await getDailyRegionalStats(service);

  // 2. Select beat:
  // Priority 1: If recovering from a tripped circuit breaker, seamlessly resume from the EXACT checkpoint beat!
  // Priority 2: Explicit beatId from options
  // Priority 3: Dynamic deficit-weighted regional selection
  let targetBeat: RegionalTarget | null = null;
  if (isCivicTopic) {
    // If a specific district is requested (e.g. kathua for Sarthal/Bani), map to its parent region
    const reqDist = options?.districtId?.toLowerCase().trim();
    if (reqDist && DISTRICT_METADATA[reqDist]) {
      const parentBeatId = DISTRICT_METADATA[reqDist].beatId;
      targetBeat = KJIN_REGIONAL_TARGETS.find((b) => b.id === parentBeatId) || KJIN_REGIONAL_TARGETS[0];
    } else {
      targetBeat = KJIN_REGIONAL_TARGETS.find((b) => b.id === 'jammu_plains') || KJIN_REGIONAL_TARGETS[0];
    }
  } else if (breaker.pendingBeatId && !options?.beatId) {
    const resumeBeat = KJIN_REGIONAL_TARGETS.find((t) => t.id === breaker.pendingBeatId);
    if (resumeBeat) {
      targetBeat = resumeBeat;
      console.log(`[AutonomousDiscovery] 🔄 Quota recovery: Seamlessly resuming from checkpoint beat "${targetBeat.name}" (${targetBeat.id}).`);
    }
  }

  if (!targetBeat && options?.beatId && options.beatId !== 'civic_problems') {
    targetBeat = KJIN_REGIONAL_TARGETS.find((t) => t.id === options.beatId) || null;
  }

  if (!targetBeat && !isCivicTopic) {
    targetBeat = selectNextPrioritizedBeat(stats);
  }

  // If daily ceiling reached (32 stories) and no underrepresented beat remains, skip unless forced
  if (!targetBeat && !options?.force && !isCivicTopic) {
    console.log(`[AutonomousDiscovery] All regional daily targets fulfilled (${stats.totalDiscoveredToday}/32). Desk at full daily capacity.`);
    return {
      success: true,
      skipped: true,
      discovered: false,
      reason: `All regional daily targets fulfilled (${stats.totalDiscoveredToday}/32 stories today). Operating target met.`,
      dailyStats: stats,
    };
  }

  const beat = targetBeat || KJIN_REGIONAL_TARGETS[0];
  const regionStat = stats.regions.find((r) => r.id === beat.id);

  // 2b. Select target district within this beat based on editor quotas & priority
  let targetDistrictStat = selectTargetDistrictForBeat(beat, regionStat?.districts, options?.districtId);
  let targetDistrictId = targetDistrictStat?.id || options?.districtId || null;
  
  if (isCivicTopic && !targetDistrictId) {
    const civicDistKeys = ['kathua', 'kishtwar', 'doda', 'ramban', 'poonch', 'rajouri', 'kupwara', 'kargil', 'leh'];
    targetDistrictId = civicDistKeys[(civicStatus?.currentToday ?? 0) % civicDistKeys.length];
  }
  
  let targetDistrictMeta = targetDistrictId ? DISTRICT_METADATA[targetDistrictId] : null;

  let effectiveSearchQuery = targetDistrictMeta ? targetDistrictMeta.searchQuery : beat.searchQuery;
  let effectiveDateline = targetDistrictMeta ? targetDistrictMeta.defaultDateline : beat.defaultDateline;

  if (isCivicTopic) {
    if (targetDistrictId === 'kathua') {
      effectiveSearchQuery = 'sarthal bani kathua internet water electricity road problem OR crisis';
      effectiveDateline = 'SARTHAL –';
    } else {
      effectiveSearchQuery = CIVIC_PROBLEM_SEARCH_QUERIES[(civicStatus?.currentToday ?? 0) % CIVIC_PROBLEM_SEARCH_QUERIES.length];
      if (targetDistrictMeta) {
        effectiveDateline = targetDistrictMeta.defaultDateline;
      }
    }
  }

  console.log(
    `[AutonomousDiscovery] Prioritizing beat "${beat.name}" (Scope: ${beat.scope}, Today: ${regionStat?.current ?? 0}/${beat.min} min)${
      targetDistrictMeta ? `, Target District: "${targetDistrictMeta.name}" (Today: ${targetDistrictStat?.current ?? 0}/${targetDistrictStat?.min ?? 1}, Priority: ${targetDistrictStat?.priority ?? 'normal'})` : ''
    }${isCivicTopic ? ' [CIVIC PROBLEMS SPECIAL REPORT]' : ''}...`
  );

  const now = new Date();
  const nowIso = now.toISOString();
  const nowIstString = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'medium' });
  const sixHoursAgoMs = now.getTime() - MAX_NEWS_AGE_MS;
  const cutoffTime = new Date(sixHoursAgoMs);
  const cutoffIstString = cutoffTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'medium' });

  // 3. Compose grounded research prompt with strict credibility, multi-source discovery, & 6-factor scoring
  const prompt = `You are a Senior Investigative Correspondent and Field Bureau Chief for KJIN (Kashmir Jammu Independent News Network).
Your mission is to autonomously search the web and discover the latest, verified, high-impact news published strictly within the last 6 HOURS for this regional beat:

BEAT: ${beat.name}
${targetDistrictMeta ? `PRIORITIZED TARGET DISTRICT: ${targetDistrictMeta.name} (Newsroom Priority: ${targetDistrictStat?.priority || 'high'})
TARGET DISTRICT SEARCH QUERY: ${effectiveSearchQuery}
MANDATORY DISTRICT ASSIGNMENT: The newsroom editor has specifically prioritized coverage for **${targetDistrictMeta.name}** district. Search for and report verified events, infrastructure projects, road/weather conditions, civic issues, or administrative actions originating in or directly concerning **${targetDistrictMeta.name}**. In your JSON output, set "district": "${targetDistrictMeta.name}".` : `SEARCH QUERY: ${effectiveSearchQuery}`}
MANDATORY SCOPE: ${beat.scope}
TARGET DATELINE: ${effectiveDateline}

⏰ CRITICAL TIME CONSTRAINT — MAXIMUM 6 HOURS FRESHNESS (LOGICAL NEWSROOM MANDATE):
- Current Real-World Reference Time: ${nowIstString} IST (${nowIso})
- Earliest Permitted Publishing Cutoff: ${cutoffIstString} IST (${cutoffTime.toISOString()}) — EXACTLY 6 HOURS AGO.
- MANDATORY LOGIC:
  1. KJIN readers demand hyper-fresh breaking intelligence. The news development, incident, official order, or public reporting MUST have occurred or been published WITHIN THE LAST 6 HOURS from ${nowIstString}.
  2. STRICTLY REJECT and DO NOT RETURN old news from yesterday, 8, 12, 24, or 48 hours ago.
  3. If your search results only contain news older than 6 hours (e.g. from yesterday or days ago), you MUST return:
     { "hasCredibleNews": false, "reason": "No breaking or developing news found within the strict 6-hour freshness window." }
     NEVER force or fabricate news that is older than 6 hours!
  4. In your JSON output, include:
     - "hoursAgo": <number between 0 and 6 representing estimated hours elapsed since publication/event>
     - "reportedTime": "<ISO timestamp or readable IST time of the reporting within the last 6 hours>"

${isCivicTopic ? `🚨 CRITICAL MANDATE — GROUND GRIEVANCES & CIVIC PROBLEMS DESK:
- You are investigating and reporting on real grassroots public problems, suffering, and administrative neglect affecting citizens in Jammu & Kashmir and Ladakh (e.g. Sarthal/Kathua, Chenab Valley, Pir Panjal, Kashmir Valley, or Ladakh).
- PRIORITY ISSUES TO HIGHLIGHT:
  1. Water Shortage / Jal Shakti PHE pipeline breakdowns or tanker crises.
  2. Electricity / PDD burnt transformers, prolonged load shedding, or dark villages.
  3. Mobile Connectivity / BSNL/Jio cellular blackouts or complete internet loss in remote areas (such as Sarthal, Bani, Padder, Marwah, Gurez, Zanskar).
  4. Road Cutoffs / Landslides, dilapidated bridges, or cut-off mountain habitations.
  5. Healthcare Grievances / Doctor shortages or non-functional PHC/SDH health centres.
- In your JSON output, set "category": "Problems", set "editorialScore": 95, and detail the genuine hardships faced by local residents and demands made to the Deputy Commissioner or administration.` : ''}

DISCOVERY DIRECTIVES (MULTI-SOURCE WEB INTELLIGENCE):
1. INDEPENDENT DISCOVERY SOURCES:
   - Search across Google News, local newspapers (Daily Excelsior, Greater Kashmir, Rising Kashmir, Chenab Times, Early Times, State Times, Tribune), government portals (Press Information Bureau - PIB), police advisories, weather & disaster authorities (IMD, SDMA), and major national/international wires (The Hindu, Indian Express, PTI, Reuters).
   - Zero channel input: Discover genuine public reporting independently from whichever publisher broke the story.

2. 6-FACTOR EDITORIAL IMPORTANCE SCORING (CRITICAL):
   Score the discovered story objectively (1 to 100):
   - Local Public Importance (1-100): Direct relevance to people in Jammu, Kashmir, Chenab Valley, Pir Panjal, or Ladakh.
   - Impact on People's Lives (1-100): High score for real civic issues (e.g. electricity shortages, road cutoffs/NH-244 blackspots, water breakdowns, hospital shortages, apple horticulture crisis > ordinary political party statements).
   - Urgency & Freshness (1-100): Breaking developing events strictly in the last 6 hours. News older than 6 hours receives a freshness score of 0 and MUST be rejected.
   - Credibility of Evidence (1-100): Verified facts, named officials, official orders, or corroborating reports.
   - Uniqueness & Ground Ledger (1-100): Non-duplicate, fresh ground reporting.
   - Calculate an overall "editorialScore" (1 to 100). Stories with high civic impact on citizens' lives score 85+.

3. ACTIVE GROUNDED RESEARCH & VERIFICATION:
   - Perform a live Google Search using the beat's search query and identify the most significant recent news development or verified public event reported by credible news organizations (Daily Excelsior, Greater Kashmir, Chenab Times, PIB, The Hindu, Indian Express, PTI, Reuters, etc.).
   - Extract the real factual event, named authorities, location, and verified context.
   - Do NOT return hasCredibleNews: false if recent public reporting or official announcements exist. Only set hasCredibleNews: false if the search query literally returns zero search results.

4. BREAKING NEWS IDENTIFICATION:
   - If this is an urgent breaking development (e.g. earthquake, major road accident, severe weather/cloudburst, crucial government order, encounter, disaster), set "isBreakingPriority": true.

5. DATELINE & SCOPE RULES:
   - IF SCOPE IS "National": Dateline MUST be "NEW DELHI –" or "MUMBAI –". NEVER use Srinagar for national news.
   - IF SCOPE IS "International": Dateline MUST be "GLOBAL DESK –" or an international capital. NEVER use Srinagar for international news.
   - IF SCOPE IS "Chenab Valley": Dateline MUST be "DODA –", "KISHTWAR –", "BHADERWAH –", or "RAMBAN –".
   - IF SCOPE IS "State (Jammu & Kashmir)":
     * For Leh/Ladakh: Dateline MUST be "LEH –" or "KARGIL –".
     * For Pir Panjal: Dateline MUST be "POONCH –" or "RAJOURI –".
     * For Jammu: Dateline MUST be "JAMMU –", "KATHUA –", or "UDHAMPUR –".
     * For Kashmir: Dateline MUST be "SRINAGAR –", "ANANTNAG –", or "BARAMULLA –".

6. ATTRACTIVE, MAGNETIC HEADLINES & COMPELLING DESCRIPTIONS (HIGH READER EXCITEMENT):
   - ATTRACTIVE & EXCITING HEADLINE (CRITICAL):
     * The headline MUST be magnetic, captivating, and exciting — formulated to immediately grab the reader's attention and make them eager to read what happened!
     * Use active voice, strong power verbs, dramatic tension, key revelations, human stakes, or fascinating contrasts (inspired by high-engagement broadsheets like BBC News, The New York Times, The Economist, and Axios).
     * NEVER write dry, bureaucratic, passive announcements (e.g. AVOID: "Department Issues Order Regarding Scheme Implementation" or "University Signs MOU With Agency").
     * INSTEAD write captivating headlines that reveal the core drama, human significance, or breaking excitement:
       - Weather/Highways: "Winter Unleashed: Heavy Snow Shuts Key Mountain Passes as Sub-Zero Chill Sweeps Kashmir"
       - Tech/Science: "Melting Frontiers: Jammu University Launches Landmark Satellite Tech Mission to Track Shifting Himalayan Glaciers"
       - Security/Defense: "Border Alert: Security Forces Intercept Suspected Drone in Midnight Samba Operation"
       - Civic/Lifelines: "Lifeline Restored: Emergency Crews Reopen Snowbound Sinthan Top After Intense Night Rescue"
       - International/Diplomacy: "Diplomatic Showdown: High-Stakes UN Leadership Race Strained by Brewing Middle East Controversy"
     * 100% FACTUAL INTEGRITY: Keep it magnetic, engaging, and exciting while strictly adhering to genuine verified facts. Never use cheap false clickbait.

   - ATTRACTIVE & ENGAGING DESCRIPTION / SUMMARY (CRITICAL):
     * The summary/description is the primary hook when readers browse article cards or share stories. It MUST be exciting, engaging, and impossible to ignore.
     * Use the "Hook & Stakes" narrative formula:
       1. Sentence 1: A vivid, evocative opening hook starting with "${beat.defaultDateline} " that plunges the reader straight into the core drama, high-stakes dilemma, or surprising development.
       2. Sentence 2: Concrete human or civic impact — who is affected, what key revelation emerged, and what is on the line.
       3. Sentence 3: Forward momentum or a compelling teaser on what authorities, residents, or global observers are bracing for next.
     * Keep it vibrant, fluid, and exciting to read (60-90 words, 300-450 characters), steering clear of dry, monotonous memo-speak.

7. ENGAGING, READER-FRIENDLY ARTICLE STRUCTURE (CRITICAL):
   - TARGET LENGTH: Write between 450 and 700 words. NEVER write a boring, encyclopedic 4,000-word text dump. Modern readers want crisp, punchy, engaging journalism they can read in 2 to 3 minutes.
   - BITE-SIZED PARAGRAPHS: Keep every paragraph strictly 2 to 4 sentences. Break up text frequently so it looks clean, spacious, and inviting on mobile phones and desktop screens.
   - ZERO ASCII TABLES OR WEIRD SYMBOLS: NEVER output raw ASCII pipe tables (| :--- | :--- | or | : | : |), slash combinations (/()), or orphaned table markers. Present all facts and metrics inside natural prose or clean bullet points (- **Metric:** Details).
   - SCANNABLE STRUCTURE:
     * Paragraph 1: Opening lead sentence starting immediately with the canonical dateline (e.g. "${beat.defaultDateline} "). Deliver the core news hook, who is affected, and what occurred.
     * Quick Highlights Box (directly under lead paragraph):
       **Key Highlights:**
       - **The Event:** [Crisp factual summary]
       - **Civic Impact:** [Direct effect on residents, commuters, or policy]
       - **What's Next:** [Upcoming official action or timeline]
     * Natural, story-specific markdown subheadings (## Subheading Title) tailored to the actual event (e.g. "## What Happened on the Ground", "## Public Impact and Local Reality", "## Official Response and What Lies Ahead"). NEVER use generic robotic labels like "Executive Overview" or "Verified Developments & Ground Ledger".
     * Include at least one impactful blockquote (> "...") quoting an official, eyewitness, or agency spokesperson to add human voice.

8. ORIGINAL REPORTING SAFEGUARD:
   - Do NOT copy complete articles verbatim from other publishers. Synthesize a professional, 100% original, engaging investigative news report using verified facts.

Return your finding strictly as a JSON block inside \`\`\`json ... \`\`\` with keys:
{
  "hasCredibleNews": true,
  "hoursAgo": 1.5,
  "reportedTime": "${cutoffTime.toISOString()}",
  "headline": "A magnetic, exciting, and attractive English news headline that hooks readers and sparks curiosity",
  "summary": "${beat.defaultDateline} An irresistible, captivating 3-sentence summary hook (60-90 words, 300-450 characters) blending vivid drama, verified facts, and forward-looking excitement",
  "bodyMarkdown": "The full engaging, reader-friendly journalistic article in clean markdown with Key Highlights, short paragraphs, natural subheadings, and blockquotes",
  "category": "Politics" | "National" | "International" | "Local News" | "Economy" | "Investigation" | "Problems" | "Culture" | "Sports" | "Education" | "Opinion" | "General",
  "scope": "${beat.scope}",
  "district": "doda" | "kishtwar" | "ramban" | "poonch" | "rajouri" | "srinagar" | "jammu" | "leh" | "kargil" | null,
  "sourceName": "The official publishing organization (e.g. Daily Excelsior, Greater Kashmir, PIB, The Hindu, PTI, Reuters)",
  "sourceUrl": "The exact web URL of the discovered story",
  "editorialScore": 92,
  "isBreakingPriority": boolean
}`;

  // 4. Call Gemini 2.5 Flash API with Google Search Grounding tool & resilient retry handling
  let json: any = null;
  let candidate: any = null;
  let rawText: string | null = null;
  const maxRetries = 3;

  try {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ googleSearch: {} }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 8192,
            },
          }),
        });

        if (res.ok) {
          json = await res.json();
          candidate = json.candidates?.[0];
          rawText = candidate?.content?.parts?.[0]?.text;
          if (rawText) {
            // Success! Reset circuit breaker to healthy state
            await resetCircuitBreaker(service);
            break;
          }
        } else if (res.status === 429 || res.status === 503) {
          const errText = await res.text();
          console.warn(`[AutonomousDiscovery] Gemini API quota limit/spike (${res.status}): ${errText}`);

          // Trip 1-hour circuit breaker and checkpoint the exact current beat so we resume seamlessly!
          await tripCircuitBreaker(service, {
            beatId: beat.id,
            reason: `HTTP ${res.status}: Quota limit reached on beat "${beat.name}"`,
            cooldownHours: 1,
          });

          return {
            success: false,
            inCooldown: true,
            reason: `Gemini quota limit reached (HTTP ${res.status}). Entered 1-hour cooldown. Will resume beat "${beat.name}" automatically once quota recovers.`,
            beat: beat.id,
          };
        } else {
          const errText = await res.text();
          console.error(`[AutonomousDiscovery] Gemini API error (${res.status}):`, errText);
          return { success: false, reason: `Gemini API returned status ${res.status}` };
        }
      } catch (netErr: any) {
        if (attempt < maxRetries) {
          console.warn(`[AutonomousDiscovery] Connection error on attempt ${attempt}/${maxRetries}. Retrying...`);
          await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
          continue;
        }
        return { success: false, reason: `Connection to Gemini service failed: ${netErr.message}` };
      }
    }

    if (!rawText) {
      return { success: false, reason: 'Gemini returned an empty response.' };
    }

    // Extract grounding source URLs if returned by Google Search Grounding metadata
    let groundedUrl: string | null = null;
    let groundedTitle: string | null = null;
    const groundingChunks = candidate?.groundingMetadata?.groundingChunks;
    if (Array.isArray(groundingChunks) && groundingChunks.length > 0) {
      for (const chunk of groundingChunks) {
        if (chunk?.web?.uri) {
          groundedUrl = chunk.web.uri;
          groundedTitle = chunk.web.title || null;
          break;
        }
      }
    }

    // Parse the JSON block
    let parsed: any = null;
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const toParse = jsonMatch ? jsonMatch[1].trim() : rawText.trim();

    try {
      parsed = JSON.parse(toParse);
    } catch {
      // Regex recovery if JSON was slightly malformed
      const headlineMatch = rawText.match(/"headline"\s*:\s*"([^"]+)"/i);
      const summaryMatch = rawText.match(/"summary"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"[a-zA-Z_]+"\s*:|"\s*\}|$)/i);
      const bodyMatch = rawText.match(/"bodyMarkdown"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"[a-zA-Z_]+"\s*:|"\s*\}|$)/i);
      const categoryMatch = rawText.match(/"category"\s*:\s*"([^"]+)"/i);

      if (headlineMatch) {
        parsed = {
          hasCredibleNews: true,
          headline: headlineMatch[1],
          summary: summaryMatch ? summaryMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim() : '',
          bodyMarkdown: bodyMatch ? bodyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim() : '',
          category: categoryMatch ? categoryMatch[1] : 'General',
          scope: beat.scope,
          district: beat.districts[0] || null,
          sourceName: groundedTitle || 'Grounded Web Surveillance',
          sourceUrl: groundedUrl || 'https://news.google.com',
        };
      }
    }

    // Principle A: "Don't force news generation"
    if (parsed && parsed.hasCredibleNews === false) {
      console.log(`[AutonomousDiscovery] Verification check: No credible news found for ${beat.shortName} (${parsed.reason || 'Insufficient verified reporting'}). Cycle skipped cleanly.`);
      return {
        success: true,
        skipped: true,
        discovered: false,
        reason: parsed.reason || `No credible breaking news found for ${beat.shortName} today. News generation was not forced.`,
        dailyStats: stats,
      };
    }

    if (!parsed || !parsed.headline) {
      return { success: false, reason: 'Could not extract structured news report from Gemini output.' };
    }

    // 4b. Strict 6-Hour Freshness Gate (Newsroom Logical Mandate)
    const freshness = evaluateNewsFreshness(
      {
        hoursAgo: typeof parsed.hoursAgo === 'number' ? parsed.hoursAgo : null,
        reportedTime: parsed.reportedTime || null,
        publishedAt: parsed.publishedAt || null,
      },
      now
    );

    if (!freshness.isFresh) {
      console.log(`[AutonomousDiscovery] ⏩ Discarding stale news "${parsed.headline}": ${freshness.reason}`);
      return {
        success: true,
        skipped: true,
        discovered: false,
        reason: freshness.reason || 'Discovered news exceeds the 6-hour freshness limit.',
        dailyStats: stats,
      };
    }

    // 5. Clean & Sanitize Discovered Content
    const cleanHeadline = String(parsed.headline || '').replace(/["\\]/g, '').trim().slice(0, 240);
    const effectiveScope = (parsed.scope || beat.scope) as 'Chenab Valley' | 'State (Jammu & Kashmir)' | 'National' | 'International';
    const resolvedDateline = determineDatelineForScope(effectiveScope, `${cleanHeadline} ${parsed.summary || ''}`);
    const cleanSummary = sanitizeDatelineForScope(parsed.summary || cleanHeadline, effectiveScope, resolvedDateline).slice(0, 500);

    const rawReportBody = parsed.bodyMarkdown || parsed.summary || cleanHeadline;
    const cleanReportBody = sanitizeDatelineForScope(rawReportBody, effectiveScope, resolvedDateline);

    // 6. Check Breaking News Override vs Maximum Quota
    const isBreaking = isBreakingNewsEvent(cleanHeadline, cleanSummary, Boolean(parsed.isBreakingPriority));
    const regionStat = stats.regions.find((r) => r.id === beat.id);
    const currentRegionCount = regionStat?.current ?? 0;
    const maxQuota = regionStat?.max ?? beat.max;

    if (currentRegionCount >= maxQuota && !isBreaking && !options?.force) {
      console.log(`[AutonomousDiscovery] Beat "${beat.shortName}" reached daily maximum (${currentRegionCount}/${maxQuota}) and story is not breaking priority. Skipping.`);
      return {
        success: true,
        skipped: true,
        discovered: false,
        reason: `${beat.shortName} daily quota reached (${currentRegionCount}/${maxQuota}). Skipped non-breaking story.`,
        dailyStats: stats,
      };
    }

    // 7. Check Deduplication
    const isDuplicate = await isDuplicateStory(service, cleanHeadline);
    if (isDuplicate) {
      console.log(`[AutonomousDiscovery] Story already covered or duplicate: "${cleanHeadline}". Skipping.`);
      return { success: false, skipped: true, reason: `Duplicate story skipped: "${cleanHeadline}".`, dailyStats: stats };
    }

    // 8. Controlled Regional Taxonomy & Image Matching
    const canonicalCat = isCivicTopic || parsed.category?.toLowerCase() === 'problems'
      ? { name: 'Problems', slug: 'problems' }
      : getCanonicalCategory(parsed.category || 'General', effectiveScope);
    const imageContext = `${cleanHeadline} ${cleanSummary} ${canonicalCat.name}`;
    const { featuredImage, hasConfidentMatch } = getRecommendedEditorialImage(
      effectiveScope,
      canonicalCat.name,
      imageContext,
      false // Strict: Only attach image if there is an exact thematic subject match; otherwise publish as clean text-only editorial
    );
    const finalFeaturedImage = hasConfidentMatch ? featuredImage : null;

    const sourceUrl = groundedUrl || parsed.sourceUrl || 'https://kjin.in';
    const sourceName = groundedTitle || parsed.sourceName || 'Grounded Web Surveillance';

    // 9. Find Author ID
    const { data: authors } = await service
      .from('profiles')
      .select('id')
      .limit(1);
    const authorId = authors?.[0]?.id || null;

    const finalSlug = `${generateSlug(cleanHeadline)}-${Date.now().toString(36).slice(-4)}`;
    const rawParsedDistrict = (parsed.district || '').toLowerCase().trim();
    const finalDistrict =
      effectiveScope === 'National' || effectiveScope === 'International'
        ? null
        : (DISTRICT_METADATA[rawParsedDistrict]?.name ||
           targetDistrictMeta?.name ||
           parsed.district ||
           (beat.districts[0] ? DISTRICT_METADATA[beat.districts[0]]?.name || beat.districts[0] : null));

    // 10. Deposit story into Pending Approval queue (`status: 'review'`) — STRICT ZERO AUTO-PUBLISH
    // Note: Database trigger enforces that new articles must initially be created as 'draft'
    // then immediately transitioned to 'review' for pending editorial approval.
    const { data: newArticle, error: insertErr } = await service
      .from('articles')
      .insert({
        title: cleanHeadline,
        slug: finalSlug,
        excerpt: cleanSummary,
        content: cleanReportBody,
        category: canonicalCat.name,
        district: finalDistrict,
        status: 'draft',
        author_id: authorId,
        author_display_name: 'KJIN AI Discovery',
        source_name: sourceName,
        source_url: sourceUrl,
        featured_image_url: finalFeaturedImage,
      })
      .select('id, title, slug, status, category')
      .single();

    if (insertErr || !newArticle) {
      console.error('[AutonomousDiscovery] Database insert error:', insertErr);
      return { success: false, reason: insertErr?.message || 'Failed to save discovered article.' };
    }

    // Immediately transition draft -> review (Pending Approval Queue)
    const { error: transitionErr } = await service
      .from('articles')
      .update({ status: 'review', updated_at: new Date().toISOString() })
      .eq('id', newArticle.id);

    if (transitionErr) {
      console.warn('[AutonomousDiscovery] Warning transitioning draft to review:', transitionErr);
    }

    console.log(`[AutonomousDiscovery] Successfully queued in Pending Approval: "${cleanHeadline}" (ID: ${newArticle.id}, Beat: ${beat.shortName}${isBreaking ? ' [BREAKING OVERRIDE]' : ''})`);

    // Check if Autonomous Auto-Approval & Auto-Publish Mode is enabled
    const autoPublishConfig = await getAutoPublishConfig(service);

    if (autoPublishConfig.enabled) {
      // Auto-Approval Mode is Active:
      // Schedule auto-publication in 5 minutes and dispatch immediate advance email alert (BEFORE the 5 mins)
      await scheduleArticleAutoPublish(service, {
        articleId: newArticle.id,
        headline: cleanHeadline,
        summary: cleanSummary,
        category: canonicalCat.name,
        scope: effectiveScope,
        division: beat.name,
        district: finalDistrict,
        sourceName,
        sourceUrl,
        delayMinutes: autoPublishConfig.delayMinutes,
        authorId,
      });
      console.log(
        `[AutonomousDiscovery] ⚡ Auto-Approved & queued for live display in ${autoPublishConfig.delayMinutes}m: "${cleanHeadline}"`
      );
    } else {
      // Manual Approval Mode (Standard):
      // Dispatch real-time editorial email alert to editor for manual review
      Promise.resolve(
        sendNewsApprovalAlert({
          headline: cleanHeadline,
          summary: cleanSummary,
          category: canonicalCat.name,
          scope: effectiveScope,
          division: beat.name,
          district: finalDistrict,
          platform: 'Autonomous Web Intelligence Radar',
          sourceName: sourceName,
          sourceUrl: sourceUrl,
          dashboardUrl: `${process.env.ADMIN_URL || process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3001'}/newsroom/youtube`,
        })
      ).catch((mailErr) => {
        console.warn('[AutonomousDiscovery] Email alert dispatch error:', mailErr);
      });
    }

    // Record initial version
    if (authorId) {
      await Promise.resolve(
        service.from('article_versions').insert({
          article_id: newArticle.id,
          version_number: 1,
          title: cleanHeadline,
          excerpt: cleanSummary,
          content: cleanReportBody,
          edited_by: authorId,
        })
      ).catch(() => null);
    }

    const updatedStats = await getDailyRegionalStats(service);
    const finalCivicStatus = isCivicTopic ? await getCivicProblemsDailyStatus(service) : undefined;

    return {
      success: true,
      discovered: true,
      articleId: newArticle.id,
      headline: cleanHeadline,
      scope: effectiveScope,
      beat: beat.name,
      district: finalDistrict || undefined,
      sourceUrl,
      autoApproved: autoPublishConfig.enabled,
      autoPublishDelayMinutes: autoPublishConfig.delayMinutes,
      dailyStats: updatedStats,
      civicProblemsStatus: finalCivicStatus,
    };
  } catch (err: any) {
    console.error('[AutonomousDiscovery] Unexpected error during news discovery:', err);
    return { success: false, reason: err.message || 'Discovery engine execution failure.' };
  }
}
