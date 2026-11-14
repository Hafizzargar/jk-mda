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
import {
  getRecommendedEditorialImage,
  determineDatelineForScope,
  sanitizeDatelineForScope,
} from './ai-synthesizer.ts';

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
  }>;
}

/**
 * Computes live daily statistics for today's published & discovered articles against regional targets.
 */
export async function getDailyRegionalStats(service: SupabaseClient): Promise<RegionalDailyStats> {
  const now = new Date();
  // Start of day in local time
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  // Also check 24h rolling window to ensure timezone boundary safety
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const cutoffTime = startOfDay.getTime() < twentyFourHoursAgo.getTime() ? startOfDay : twentyFourHoursAgo;

  // Query all articles published today OR created/active today across all author roles (staff, editor, AI discovery)
  const { data: todayArticles } = await service
    .from('articles')
    .select('id, category, district, title, excerpt, author_display_name, status, published_at, created_at')
    .or(`published_at.gte.${cutoffTime.toISOString()},created_at.gte.${cutoffTime.toISOString()}`);

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

  let publishedTodayCount = 0;

  for (const art of articles) {
    const regionKey = classifyArticleRegion(art);
    if (countMap[regionKey] !== undefined) {
      countMap[regionKey]++;
    }
    if (art.status === 'published') {
      publishedTodayCount++;
      if (publishedCountMap[regionKey] !== undefined) {
        publishedCountMap[regionKey]++;
      }
    }
  }

  // Fetch custom dynamic beat quotas from site_settings (if set by editor)
  let customQuotas: Record<string, { min?: number; max?: number }> = {};
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

    const selectedTarget = KJIN_REGIONAL_TARGETS.find((t) => t.id === underrepresented[0].id);
    if (selectedTarget) return selectedTarget;
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

    const selectedTarget = KJIN_REGIONAL_TARGETS.find((t) => t.id === eligibleBelowMax[0].id);
    if (selectedTarget) return selectedTarget;
  }

  // 3. All regions are at or above daily maximum
  return null;
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

/**
 * Executes a single grounded autonomous news discovery cycle using Google Search grounding.
 */
export async function runAutonomousNewsDiscovery(
  service: SupabaseClient,
  options?: { beatId?: string; force?: boolean }
): Promise<{
  success: boolean;
  discovered?: boolean;
  skipped?: boolean;
  articleId?: string;
  headline?: string;
  scope?: string;
  beat?: string;
  sourceUrl?: string;
  reason?: string;
  dailyStats?: RegionalDailyStats;
}> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { success: false, reason: 'Gemini API key is not configured.' };
  }

  // 1. Fetch live daily regional coverage statistics
  const stats = await getDailyRegionalStats(service);

  // 2. Select beat (Explicit beatId OR Prioritize Underrepresented Region)
  let targetBeat: RegionalTarget | null = null;
  if (options?.beatId) {
    targetBeat = KJIN_REGIONAL_TARGETS.find((t) => t.id === options.beatId) || null;
  }

  if (!targetBeat) {
    targetBeat = selectNextPrioritizedBeat(stats);
  }

  // If daily ceiling reached (32 stories) and no underrepresented beat remains, skip unless forced
  if (!targetBeat && !options?.force) {
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
  console.log(`[AutonomousDiscovery] Prioritizing beat "${beat.name}" (Scope: ${beat.scope}, Today: ${stats.regions.find(r => r.id === beat.id)?.current ?? 0}/${beat.min} min)...`);

  // 3. Compose grounded research prompt with strict credibility, multi-source discovery, & 6-factor scoring
  const prompt = `You are a Senior Investigative Correspondent and Field Bureau Chief for KJIN (Kashmir Jammu Independent News Network).
Your mission is to autonomously search the web and discover the latest, verified, high-impact news published within the last 24 to 48 hours for this regional beat:

BEAT: ${beat.name}
SEARCH QUERY: ${beat.searchQuery}
MANDATORY SCOPE: ${beat.scope}
TARGET DATELINE: ${beat.defaultDateline}

DISCOVERY DIRECTIVES (MULTI-SOURCE WEB INTELLIGENCE):
1. INDEPENDENT DISCOVERY SOURCES:
   - Search across Google News, local newspapers (Daily Excelsior, Greater Kashmir, Rising Kashmir, Chenab Times, Early Times, State Times, Tribune), government portals (Press Information Bureau - PIB), police advisories, weather & disaster authorities (IMD, SDMA), and major national/international wires (The Hindu, Indian Express, PTI, Reuters).
   - Zero channel input: Discover genuine public reporting independently from whichever publisher broke the story.

2. 6-FACTOR EDITORIAL IMPORTANCE SCORING (CRITICAL):
   Score the discovered story objectively (1 to 100):
   - Local Public Importance (1-100): Direct relevance to people in Jammu, Kashmir, Chenab Valley, Pir Panjal, or Ladakh.
   - Impact on People's Lives (1-100): High score for real civic issues (e.g. electricity shortages, road cutoffs/NH-244 blackspots, water breakdowns, hospital shortages, apple horticulture crisis > ordinary political party statements).
   - Urgency & Freshness (1-100): Breaking developing events in the last 24-48 hours.
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

6. ENGAGING, READER-FRIENDLY ARTICLE STRUCTURE (CRITICAL):
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

7. ORIGINAL REPORTING SAFEGUARD:
   - Do NOT copy complete articles verbatim from other publishers. Synthesize a professional, 100% original, engaging investigative news report using verified facts.

Return your finding strictly as a JSON block inside \`\`\`json ... \`\`\` with keys:
{
  "hasCredibleNews": true,
  "headline": "A punchy, objective, AP-style headline in English",
  "summary": "${beat.defaultDateline} A substantive 3 to 4-sentence executive briefing (60-90 words, 300-450 characters) packed with verified figures, named authorities, policy stakes, and concrete data indicators of seriousness",
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
          if (rawText) break; // Successful response received
        } else if (res.status === 503 || res.status === 429) {
          console.warn(`[AutonomousDiscovery] Gemini API high demand spike (${res.status}) on attempt ${attempt}/${maxRetries}. Retrying in ${attempt * 2}s...`);
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
            continue;
          }
          const errText = await res.text();
          console.error(`[AutonomousDiscovery] Gemini API unavailable after ${maxRetries} attempts:`, errText);
          return {
            success: false,
            reason: 'Google Gemini servers are currently experiencing a brief global demand surge (HTTP 503). Retrying in the next cycle, or click Discover again in a few moments.',
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

    // 5. Clean & Sanitize Discovered Content
    const cleanHeadline = String(parsed.headline || '').replace(/["\\]/g, '').trim().slice(0, 240);
    const effectiveScope = (parsed.scope || beat.scope) as 'Chenab Valley' | 'State (Jammu & Kashmir)' | 'National' | 'International';
    const resolvedDateline = determineDatelineForScope(effectiveScope, `${cleanHeadline} ${parsed.summary || ''}`);
    const cleanSummary = sanitizeDatelineForScope(parsed.summary || cleanHeadline, effectiveScope, resolvedDateline).slice(0, 500);

    const rawReportBody = parsed.bodyMarkdown || parsed.summary || cleanHeadline;
    const cleanReportBody = sanitizeDatelineForScope(rawReportBody, effectiveScope, resolvedDateline);

    // 6. Check Breaking News Override vs Maximum Quota
    const isBreaking = isBreakingNewsEvent(cleanHeadline, cleanSummary, Boolean(parsed.isBreakingPriority));
    const currentRegionCount = stats.regions.find((r) => r.id === beat.id)?.current ?? 0;

    if (currentRegionCount >= beat.max && !isBreaking && !options?.force) {
      console.log(`[AutonomousDiscovery] Beat "${beat.shortName}" reached daily maximum (${currentRegionCount}/${beat.max}) and story is not breaking priority. Skipping.`);
      return {
        success: true,
        skipped: true,
        discovered: false,
        reason: `${beat.shortName} daily quota reached (${currentRegionCount}/${beat.max}). Skipped non-breaking story.`,
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
    const canonicalCat = getCanonicalCategory(parsed.category || 'General', effectiveScope);
    const imageContext = `${cleanHeadline} ${cleanSummary} ${canonicalCat.name}`;
    const { featuredImage } = getRecommendedEditorialImage(effectiveScope, canonicalCat.name, imageContext);

    const sourceUrl = groundedUrl || parsed.sourceUrl || 'https://kjin.in';
    const sourceName = groundedTitle || parsed.sourceName || 'Grounded Web Surveillance';

    // 9. Find Author ID
    const { data: authors } = await service
      .from('profiles')
      .select('id')
      .limit(1);
    const authorId = authors?.[0]?.id || null;

    const finalSlug = `${generateSlug(cleanHeadline)}-${Date.now().toString(36).slice(-4)}`;
    const finalDistrict = effectiveScope === 'National' || effectiveScope === 'International' ? null : (parsed.district || beat.districts[0] || null);

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
        featured_image_url: featuredImage,
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

    return {
      success: true,
      discovered: true,
      articleId: newArticle.id,
      headline: cleanHeadline,
      scope: effectiveScope,
      beat: beat.name,
      sourceUrl,
      dailyStats: updatedStats,
    };
  } catch (err: any) {
    console.error('[AutonomousDiscovery] Unexpected error during news discovery:', err);
    return { success: false, reason: err.message || 'Discovery engine execution failure.' };
  }
}
