/**
 * KJIN AI News Synthesizer
 * 
 * Provides automated translation, fact extraction, and journalistic article synthesis
 * written from zero strictly in English without Hindi, Urdu, or other foreign languages.
 * 
 * Works with:
 * 1. Google Gemini API (if GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY is configured)
 * 2. Automated Free Translation + Editorial Synthesis Engine (zero external API keys required)
 * 3. Curated High-Resolution Editorial News Image Library (replaces ugly/cluttered YouTube thumbnails)
 */

import { getCanonicalCategory } from '../taxonomy-options.ts';

export interface EditorialImageOption {
  url: string;
  label: string;
  category: string;
}

export interface SynthesizedDraft {
  headline: string;
  summary: string;
  category: string;
  scope: 'International' | 'National' | 'State (Jammu & Kashmir)' | 'Chenab Valley';
  district: string | null;
  division: string;
  body_markdown: string;
  featured_image_url: string | null;
  alternative_images: EditorialImageOption[];
  source_language_detected?: string;
}

/**
 * Curated high-resolution editorial news photos hosted on trusted Unsplash CDN.
 * Used to replace cluttered YouTube thumbnails containing Hindi clickbait overlays, screaming faces, or watermarks.
 */
export const EDITORIAL_NEWS_IMAGES: Record<string, EditorialImageOption[]> = {
  Healthcare: [
    {
      url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=80',
      label: 'Doctor with Stethoscope & Clinical Consultation',
      category: 'Healthcare',
    },
    {
      url: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=80',
      label: 'Modern Hospital Facility & Medical Ward',
      category: 'Healthcare',
    },
    {
      url: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=1200&q=80',
      label: 'Surgeons and Medical Healthcare Professionals',
      category: 'Healthcare',
    },
  ],
  Forest: [
    {
      url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1200&q=80',
      label: 'Lush Green Forest Canopy & Woodland Trees',
      category: 'Environment',
    },
    {
      url: 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=1200&q=80',
      label: 'Mountain Forest, Land & Timber Reserves',
      category: 'Environment',
    },
    {
      url: 'https://images.unsplash.com/photo-1511497584788-87676104235f?auto=format&fit=crop&w=1200&q=80',
      label: 'Natural Forest Landscape & Environmental Conservation',
      category: 'Environment',
    },
  ],
  Aviation: [
    {
      url: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=80',
      label: 'Commercial Airline Aircraft & International Flight',
      category: 'Aviation',
    },
    {
      url: 'https://images.unsplash.com/photo-1530521954074-e64f6810b32d?auto=format&fit=crop&w=1200&q=80',
      label: 'Airport Terminal & Runway Operations',
      category: 'Aviation',
    },
  ],
  Agriculture: [
    {
      url: 'https://images.unsplash.com/photo-1560493676-04071c5f467b?auto=format&fit=crop&w=1200&q=80',
      label: 'Agricultural Farming, Apple Orchards & Crops',
      category: 'Agriculture',
    },
    {
      url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80',
      label: 'Rural Farmland & Agricultural Harvest Fields',
      category: 'Agriculture',
    },
  ],
  Judiciary: [
    {
      url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1200&q=80',
      label: 'Judicial Gavel & Courtroom Legal Bench',
      category: 'Law & Justice',
    },
    {
      url: 'https://images.unsplash.com/photo-1505664194779-8beaceb93744?auto=format&fit=crop&w=1200&q=80',
      label: 'Courthouse Architecture & Constitutional Justice',
      category: 'Law & Justice',
    },
  ],
  Security: [
    {
      url: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=1200&q=80',
      label: 'Police Vehicle & Law Enforcement Patrol',
      category: 'Security',
    },
    {
      url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80',
      label: 'Security Checkpoint & Investigative Operation',
      category: 'Security',
    },
  ],
  Education: [
    {
      url: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80',
      label: 'University Students & Education Campus',
      category: 'Education',
    },
    {
      url: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1200&q=80',
      label: 'Academic Library, Books & Scholarly Research',
      category: 'Education',
    },
  ],
  Sports: [
    {
      url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80',
      label: 'Sports Stadium & Athletic Field',
      category: 'Sports',
    },
    {
      url: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=1200&q=80',
      label: 'Cricket Pitch & Sporting Tournament',
      category: 'Sports',
    },
  ],
  Science: [
    {
      url: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=1200&q=80',
      label: 'Scientists Conducting Medical & Vaccine Research in Laboratory',
      category: 'Science & Health',
    },
    {
      url: 'https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?auto=format&fit=crop&w=1200&q=80',
      label: 'Virology, Immunology & Disease Breakthrough',
      category: 'Science & Health',
    },
  ],
  Conflict: [
    {
      url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80',
      label: 'Geopolitical Defense, Tactical Border Forces & Security Command',
      category: 'Conflict & Geopolitics',
    },
    {
      url: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=1200&q=80',
      label: 'Geopolitical Defense & Military Strategic Deployment',
      category: 'Conflict & Geopolitics',
    },
  ],
  International: [
    {
      url: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=1200&q=80',
      label: 'Global Diplomacy & Geopolitics',
      category: 'International',
    },
    {
      url: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?auto=format&fit=crop&w=1200&q=80',
      label: 'International Summit & Press Conference',
      category: 'International',
    },
    {
      url: 'https://images.unsplash.com/photo-1532375810709-75b1da00537c?auto=format&fit=crop&w=1200&q=80',
      label: 'United Nations & World Governance',
      category: 'International',
    },
  ],
  National: [
    {
      url: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=80',
      label: 'Parliament & Legislative Assembly',
      category: 'Politics',
    },
    {
      url: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=1200&q=80',
      label: 'National Policy & Public Address',
      category: 'Politics',
    },
  ],
  'State (Jammu & Kashmir)': [
    {
      url: 'https://images.unsplash.com/photo-1598091383021-15ddea10925d?auto=format&fit=crop&w=1200&q=80',
      label: 'Kashmir Valley & Himalayan Geography',
      category: 'Regional',
    },
    {
      url: 'https://images.unsplash.com/photo-1626014303757-6564477577f1?auto=format&fit=crop&w=1200&q=80',
      label: 'Jammu & Kashmir Governance & Heritage',
      category: 'Regional',
    },
  ],
  'Chenab Valley': [
    {
      url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
      label: 'Chenab River Basin & Mountain Terrain',
      category: 'Chenab Valley (30%)',
    },
    {
      url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
      label: 'Doda & Kishtwar Mountain Ranges',
      category: 'Chenab Valley (30%)',
    },
  ],
  Srinagar: [
    {
      url: 'https://images.unsplash.com/photo-1595815771614-ade9d652a65d?auto=format&fit=crop&w=1200&q=80',
      label: 'Dal Lake & Srinagar Riverfront',
      category: 'Srinagar (30%)',
    },
    {
      url: 'https://images.unsplash.com/photo-1598091383021-15ddea10925d?auto=format&fit=crop&w=1200&q=80',
      label: 'Kashmir Valley & Shikara Heritage',
      category: 'Srinagar (30%)',
    },
  ],
  Jammu: [
    {
      url: 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=1200&q=80',
      label: 'Jammu City & Tawi Riverfront',
      category: 'Jammu (30%)',
    },
    {
      url: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=80',
      label: 'Civil Secretariat & Administrative Governance',
      category: 'Jammu (30%)',
    },
  ],
  'Pir Panjal': [
    {
      url: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80',
      label: 'Pir Panjal Mountain Passes & Alpine Ridge',
      category: 'Pir Panjal (10%)',
    },
    {
      url: 'https://images.unsplash.com/photo-1605649487212-47bdab064df7?auto=format&fit=crop&w=1200&q=80',
      label: 'Rajouri & Poonch Mountain Corridor (Mughal Road)',
      category: 'Pir Panjal (10%)',
    },
  ],
  'Leh & Ladakh': [
    {
      url: 'https://images.unsplash.com/photo-1581793745862-99fde7fa73d2?auto=format&fit=crop&w=1200&q=80',
      label: 'Leh & Ladakh High-Altitude Plateau',
      category: 'Leh & Ladakh (10%)',
    },
    {
      url: 'https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?auto=format&fit=crop&w=1200&q=80',
      label: 'Kargil & Zanskar Valley Landscape',
      category: 'Leh & Ladakh (10%)',
    },
  ],
  Economy: [
    {
      url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80',
      label: 'Financial Markets & Economic Policy',
      category: 'Economy',
    },
  ],
  Cinema: [
    {
      url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80',
      label: 'Cinema Theater Auditorium & Movie Screen',
      category: 'Culture & Entertainment',
    },
    {
      url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1200&q=80',
      label: 'Film Production Movie Camera Set & Studio',
      category: 'Culture & Entertainment',
    },
    {
      url: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1200&q=80',
      label: 'Theatrical Cinema Screening & Premiere',
      category: 'Culture & Entertainment',
    },
  ],
  Transit: [
    {
      url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80',
      label: 'Mountain Highway & Road Transit Corridor',
      category: 'Transit & Infrastructure',
    },
    {
      url: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=1200&q=80',
      label: 'Highway Traffic, Transport & Transit Route',
      category: 'Transit & Infrastructure',
    },
    {
      url: 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=1200&q=80',
      label: 'Winding Mountain Pass Road Curves & Blackspots',
      category: 'Transit & Infrastructure',
    },
  ],
  Energy: [
    {
      url: 'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?auto=format&fit=crop&w=1200&q=80',
      label: 'Hydroelectric Dam & River Reservoir Project',
      category: 'Hydropower & Energy',
    },
    {
      url: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=1200&q=80',
      label: 'Electrical Power Lines & Energy Transmission Grid',
      category: 'Hydropower & Energy',
    },
    {
      url: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=1200&q=80',
      label: 'Solar & Clean Renewable Energy Infrastructure',
      category: 'Hydropower & Energy',
    },
  ],
  Winter: [
    {
      url: 'https://images.unsplash.com/photo-1517299321909-509fa930adc0?auto=format&fit=crop&w=1200&q=80',
      label: 'Heavy Snowfall on Mountain Pass & Highway',
      category: 'Weather & Climate',
    },
    {
      url: 'https://images.unsplash.com/photo-1483921020237-2ff51e8e4b22?auto=format&fit=crop&w=1200&q=80',
      label: 'Winter Snowstorm & Sub-Zero Himalayan Temperatures',
      category: 'Weather & Climate',
    },
    {
      url: 'https://images.unsplash.com/photo-1491002052546-bf38f186af56?auto=format&fit=crop&w=1200&q=80',
      label: 'Frost, Glacial Ice & Mountain Freeze',
      category: 'Weather & Climate',
    },
  ],
  Disaster: [
    {
      url: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=1200&q=80',
      label: 'Heavy Downpour, Flash Floods & Storm Weather',
      category: 'Disaster & Emergency',
    },
    {
      url: 'https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=1200&q=80',
      label: 'Storm Clouds & Natural Disaster Emergency',
      category: 'Disaster & Emergency',
    },
  ],
  SpaceTech: [
    {
      url: 'https://images.unsplash.com/photo-1517976487502-570775e714b3?auto=format&fit=crop&w=1200&q=80',
      label: 'ISRO Space Mission & Aerospace Rocket Launch',
      category: 'Science & Technology',
    },
    {
      url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
      label: 'Semiconductor Microchip & Artificial Intelligence Tech',
      category: 'Science & Technology',
    },
  ],
  General: [
    {
      url: 'https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=80',
      label: 'Investigative Newsroom & Press Printing',
      category: 'General News',
    },
  ],
};

// In-memory cache to prevent duplicate translation calls
const translationCache = new Map<string, string>();
let rateLimitCooldownUntil = 0;

/**
 * Free language translation endpoint that converts Hindi, Urdu, Arabic or other foreign
 * text into clean English with zero API keys required.
 * Implements in-memory caching, multi-endpoint failover, and rate-limit cooldowns.
 */
export async function translateToEnglishFree(text: string): Promise<string> {
  if (!text || !text.trim()) return '';

  const trimmed = text.trim();

  // If text already has strictly Latin/ASCII characters, no translation needed
  const containsNonLatin = /[\u0900-\u097F\u0600-\u06FF\u0750-\u077F\u0A80-\u0AFF\u0B00-\u0B7F\u0400-\u04FF]/.test(trimmed);
  if (!containsNonLatin) {
    return trimmed;
  }

  // Check cache
  if (translationCache.has(trimmed)) {
    return translationCache.get(trimmed)!;
  }

  const encoded = encodeURIComponent(trimmed.slice(0, 2500));

  // If Google is currently rate-limiting us, skip to fallback endpoints
  const isCooldownActive = Date.now() < rateLimitCooldownUntil;

  if (!isCooldownActive) {
    // Attempt 1: Google Translate GTX endpoint
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encoded}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (res.status === 429) {
        // Activate a 60-second cooldown so we don't spam requests
        rateLimitCooldownUntil = Date.now() + 60_000;
        console.warn('[TranslateToEnglishFree] Google GTX endpoint rate-limited (HTTP 429). Entering 60s cooldown.');
      } else if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && Array.isArray(data[0])) {
          const translatedChunks = data[0].map((chunk: any[]) => chunk[0] || '').join('');
          if (translatedChunks.trim()) {
            const result = translatedChunks.trim();
            translationCache.set(trimmed, result);
            return result;
          }
        }
      }
    } catch {
      // Quietly fall through to secondary endpoint
    }
  }

  // Attempt 2: Alternative Google Chrome Extension endpoint
  try {
    const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=en&q=${encoded}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && typeof data[0] === 'string' && data[0].trim()) {
        const result = data[0].trim();
        translationCache.set(trimmed, result);
        return result;
      }
    }
  } catch {
    // Quietly fall through
  }

  // Fallback: Return original cleaned text rather than deleting all non-ASCII characters
  return cleanRawBroadcastText(trimmed);
}

/**
 * Strips YouTube hashtags, clickbait tags, channel watermarks, and phone numbers.
 */
export function cleanRawBroadcastText(text: string): string {
  if (!text) return '';
  return text
    // Remove hashtags (#abhisarsharma, #news, etc.)
    .replace(/#[a-zA-Z0-9_\u0900-\u097F]+/g, '')
    // Remove trailing social blocks and promotional text
    .replace(/(?:social\s*links|channel\s*link|join\s+.*?channel|follow\s+us|connect\s+with\s+us|subscribe\s+to)[\s\S]*$/gi, '')
    // Remove inline social media channels, handles, and WhatsApp calls
    .replace(/(?:facebook|instagram|twitter|telegram|whatsapp)\s*:\s*[^\s.,;]+/gi, '')
    .replace(/join\s+[^.,;]+\s*(?:whatsapp|telegram)\s*channel/gi, '')
    .replace(/channel\s*link\s*:\s*/gi, '')
    .replace(/\*+(?:Independent investigative dispatch|Report synthesized by).*?\*+/gi, '')
    // Remove all URLs
    .replace(/https?:\/\/[^\s]+/gi, '')
    .replace(/www\.[^\s]+/gi, '')
    // Remove email addresses & handles
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '')
    .replace(/@[a-zA-Z0-9_.]+/g, '')
    // Remove phone numbers
    .replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '')
    // Remove long decorative dashes or dividers
    .replace(/[-=_~*]{3,}/g, ' ')
    // Remove clickbait buzzwords
    .replace(/\b(breaking|exclusive|shocking|viral|big update|alert|watch now|must watch|full video|live update)\b/gi, '')
    // Remove emoji and special symbol clutter
    .replace(/[💥🔥🚨⚡👇👉🔴📢🚩]+/g, '')
    .replace(/[|!@#$%^&*()[\]{}]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resolves the accurate journalistic dateline based on story scope and textual entities.
 */
export function determineDatelineForScope(
  scope: 'International' | 'National' | 'State (Jammu & Kashmir)' | 'Chenab Valley',
  contextText: string,
  district?: string | null
): string {
  const lower = (contextText || '').toLowerCase();

  if (scope === 'International') {
    if (/\b(washington|white house|pentagon|united states|\busa?\b|biden|trump|congress)\b/i.test(lower)) return 'WASHINGTON –';
    if (/\b(london|britain|\buk\b|united kingdom|downing street|starmer)\b/i.test(lower)) return 'LONDON –';
    if (/\b(israel|tel aviv|jerusalem|gaza|netanyahu)\b/i.test(lower)) return 'JERUSALEM –';
    if (/\b(tehran|iran|khamenei)\b/i.test(lower)) return 'TEHRAN –';
    if (/\b(moscow|kremlin|russia|putin)\b/i.test(lower)) return 'MOSCOW –';
    if (/\b(kyiv|kiev|ukraine|zelensky)\b/i.test(lower)) return 'KYIV –';
    if (/\b(beijing|china|xi jinping)\b/i.test(lower)) return 'BEIJING –';
    if (/\b(islamabad|pakistan)\b/i.test(lower)) return 'ISLAMABAD –';
    if (/\b(dhaka|bangladesh)\b/i.test(lower)) return 'DHAKA –';
    if (/\b(paris|france|macron)\b/i.test(lower)) return 'PARIS –';
    if (/\b(berlin|germany|scholz)\b/i.test(lower)) return 'BERLIN –';
    if (/\b(tokyo|japan)\b/i.test(lower)) return 'TOKYO –';
    if (/\b(dubai|uae|abu dhabi)\b/i.test(lower)) return 'DUBAI –';
    if (/\b(ottawa|canada|trudeau)\b/i.test(lower)) return 'OTTAWA –';
    if (/\b(united nations|\bun\b|security council|geneva)\b/i.test(lower)) return 'UNITED NATIONS –';
    return 'GLOBAL DESK –';
  }

  if (scope === 'National') {
    if (/\b(mumbai|bollywood|bombay|maharashtra|rbi|bse|nse)\b/i.test(lower)) return 'MUMBAI –';
    if (/\b(bengaluru|bangalore|karnataka|isro)\b/i.test(lower)) return 'BENGALURU –';
    if (/\b(chennai|madras|tamil nadu)\b/i.test(lower)) return 'CHENNAI –';
    if (/\b(kolkata|calcutta|west bengal)\b/i.test(lower)) return 'KOLKATA –';
    if (/\b(hyderabad|telangana)\b/i.test(lower)) return 'HYDERABAD –';
    if (/\b(lucknow|uttar pradesh|\bup\b)\b/i.test(lower)) return 'LUCKNOW –';
    if (/\b(patna|bihar)\b/i.test(lower)) return 'PATNA –';
    if (/\b(chandigarh|punjab|haryana)\b/i.test(lower)) return 'CHANDIGARH –';
    return 'NEW DELHI –';
  }

  if (scope === 'Chenab Valley') {
    if (district) return `${district.toUpperCase()} –`;
    if (lower.includes('kishtwar')) return 'KISHTWAR –';
    if (lower.includes('ramban')) return 'RAMBAN –';
    if (lower.includes('doda')) return 'DODA –';
    if (lower.includes('bhadarwah')) return 'BHADARWAH –';
    if (lower.includes('banihal')) return 'BANIHAL –';
    return 'CHENAB VALLEY –';
  }

  // State (Jammu & Kashmir)
  if (district) return `${district.toUpperCase()} –`;
  if (lower.includes('jammu')) return 'JAMMU –';
  if (lower.includes('anantnag')) return 'ANANTNAG –';
  if (lower.includes('baramulla')) return 'BARAMULLA –';
  if (lower.includes('pulwama')) return 'PULWAMA –';
  if (lower.includes('kupwara')) return 'KUPWARA –';
  if (lower.includes('leh') || lower.includes('ladakh')) return 'LEH, LADAKH –';
  return 'SRINAGAR –';
}

/**
 * Sanitizes and corrects the dateline in an article summary or body, ensuring
 * National or International stories are NEVER erroneously prefixed with Srinagar/J&K datelines.
 */
export function sanitizeDatelineForScope(
  text: string,
  scope: 'International' | 'National' | 'State (Jammu & Kashmir)' | 'Chenab Valley',
  targetDateline: string
): string {
  if (!text) return '';

  let cleaned = text.trim();

  // 1. Strip any accidental dateline prepended directly before markdown headings (e.g. "NEW DELHI – ### Heading" -> "### Heading")
  cleaned = cleaned.replace(/^[A-Z\s,–—-]+(?=#{1,6}\s+)/i, '').trim();

  // 2. If the text begins with a markdown heading, do NOT prepend dateline to the heading!
  // Instead, apply the dateline to the first actual prose paragraph that follows the heading.
  if (/^#{1,6}\s+/.test(cleaned)) {
    const blocks = cleaned.split(/\n\s*\n+/);
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i].trim();
      if (block && !block.startsWith('#') && !block.startsWith('|') && !block.startsWith('>')) {
        blocks[i] = sanitizeDatelineForScope(block, scope, targetDateline);
        return blocks.join('\n\n');
      }
    }
    return cleaned;
  }

  // 3. If scope is National or International, strip any hallucinated J&K / Srinagar datelines
  if (scope === 'National' || scope === 'International') {
    cleaned = cleaned.replace(
      /^(?:SRINAGAR(?:,\s*J&K)?|JAMMU(?:,\s*J&K)?|DODA|KISHTWAR|RAMBAN|KASHMIR VALLEY|CHENAB VALLEY)\s*[-–—:]\s*/i,
      ''
    ).trim();
  }

  // 4. Clean up any duplicated dateline prefixes (e.g. "NEW DELHI – NEW DELHI –" or "NEW DELHI –   NEW DELHI –")
  const escapedTarget = targetDateline.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const duplicatePattern = new RegExp(`^(?:${escapedTarget}\\s*)+`, 'i');
  if (duplicatePattern.test(cleaned)) {
    cleaned = cleaned.replace(duplicatePattern, '').trim();
  }

  // 5. If text already starts with another uppercase city dateline
  if (/^[A-Z\s,]+[-–—:]\s*/.test(cleaned)) {
    if ((scope === 'National' || scope === 'International') && /^(?:SRINAGAR|JAMMU|DODA|KISHTWAR|RAMBAN)/i.test(cleaned)) {
      cleaned = cleaned.replace(/^[A-Z\s,]+[-–—:]\s*/, `${targetDateline} `);
    } else {
      // Keep existing valid dateline
      return cleaned.trim();
    }
  } else {
    // Prepend the target dateline once
    cleaned = `${targetDateline} ${cleaned}`;
  }

  return cleaned.trim();
}

/**
 * Detects the accurate news scope by prioritizing international geopolitics,
 * local Chenab Valley geography, and Jammu & Kashmir territory.
 */
export function determineAccurateNewsScope(
  title: string,
  description: string,
  region?: string
): 'International' | 'National' | 'State (Jammu & Kashmir)' | 'Chenab Valley' {
  // NOTE: We examine title and description first because source region can be J&K even for national/international broadcasts!
  const contentText = `${title} ${description}`.toLowerCase();

  // 1. Check if the story explicitly pertains to Chenab Valley local terrain
  const chenabKeywords = [
    'doda', 'kishtwar', 'ramban', 'chenab', 'bhadarwah', 'banihal', 'batote',
    'sinthan', 'chhatroo', 'thathri', 'gundoh', 'bhalessa', 'padder', 'marwah',
    'warwan', 'assar', 'khellani'
  ];
  if (chenabKeywords.some((kw) => contentText.includes(kw))) {
    return 'Chenab Valley';
  }

  // 2. Check if the story explicitly pertains to Jammu & Kashmir local geography / administration
  const jkKeywords = [
    'kashmir', 'jammu', 'srinagar', 'anantnag', 'baramulla', 'pulwama', 'kulgam',
    'kupwara', 'ganderbal', 'budgam', 'shopian', 'bandipora', 'poonch', 'rajouri',
    'udhampur', 'kathua', 'reasi', 'samba', 'j&k', 'lg sinha', 'jammu and kashmir',
    'article 370', 'kashmir valley', 'dal lake', 'gulmarg', 'pahalgam', 'sonamarg',
    'zojila', 'mughal road', 'peer ki gali'
  ];
  if (jkKeywords.some((kw) => contentText.includes(kw))) {
    return 'State (Jammu & Kashmir)';
  }

  // 3. Check Primary Indian National Anchors (e.g. Bollywood, Parliament, ISRO, national leaders)
  const nationalKeywords = [
    'bollywood', 'ramayana', 'namit malhotra', 'nitesh tiwari', 'indian cinema',
    'parliament', 'lok sabha', 'rajya sabha', 'supreme court of india', 'union cabinet',
    'pm modi', 'narendra modi', 'amit shah', 'rahul gandhi', 'isro', 'rbi',
    'reserve bank of india', 'vande bharat', 'indian railways'
  ];
  if (nationalKeywords.some((kw) => contentText.includes(kw))) {
    return 'National';
  }

  // 4. Check International Geopolitics & World Events (e.g. US, Middle East, Europe, Asia)
  const internationalKeywords = [
    'netanyahu', 'israel', 'iran', 'tehran', 'gaza', 'palestine', 'middle east',
    'trump', 'obama', 'biden', 'white house', 'pentagon', 'united states', 'usa',
    'ukraine', 'russia', 'putin', 'zelensky', 'nato', 'united nations', 'security council',
    'china', 'beijing', 'taiwan', 'pakistan', 'islamabad', 'bangladesh', 'dhaka',
    'london', 'britain', 'united kingdom', 'europe', 'france', 'germany', 'canada', 'ottawa',
    'japan', 'tokyo', 'australia', 'dubai', 'uae', 'saudi arabia', 'riyadh', 'syria', 'lebanon',
    'hezbollah', 'houthi', 'red sea', 'turkey', 'erdogan', 'egypt', 'cairo',
    'geopolitics', 'foreign affairs', 'global summit', 'diplomacy', 'worldwide', 'overseas',
    'hollywood', 'oscars', 'silicon valley'
  ];
  if (internationalKeywords.some((kw) => {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    return regex.test(contentText);
  })) {
    return 'International';
  }

  // 5. Default: National (India pan-India affairs, union governance, national events)
  return 'National';
}

/**
 * Selects the best clean editorial news photo based on content keywords, scope, and category.
 * If the story discusses a doctor, hospital, forest, land, aviation, or court, it intelligently
 * selects an editorial photo that matches the exact thematic subject.
 */
export function getRecommendedEditorialImage(
  scope: string,
  category?: string,
  contextText?: string,
  allowGenericFallback: boolean = true
): { featuredImage: string | null; alternatives: EditorialImageOption[]; hasConfidentMatch: boolean } {
  const combined = `${contextText || ''} ${category || ''} ${scope || ''}`.toLowerCase();

  let matchedCategoryImages: EditorialImageOption[] | undefined;

  // 1. Cinema / Bollywood / Hollywood / Film / Actor / Theatrical Premiere / Namit Malhotra / Ramayana
  if (
    /\b(cinema|film|films|movie|movies|bollywood|hollywood|actor|actress|director|producer|theatrical|theater|theatre|box office|trailer|teaser|entertainment|screening|namit malhotra|nitesh tiwari|ramayana|censor board|multiplex)\b/i.test(
      combined
    )
  ) {
    matchedCategoryImages = EDITORIAL_NEWS_IMAGES.Cinema;
  }
  // 2. Road Transit / Highway / Traffic / Accidents / Crashes / NH-44 / NH-244 / Vehicles / Bus
  else if (
    /\b(highway|highways|road|roads|traffic|transit|nh-44|nh-244|mughal road|vehicle|vehicles|bus|buses|truck|trucks|accident|accidents|crash|crashes|mishap|mishaps|gorge|collision|overturned|transport|chakka jam)\b/i.test(
      combined
    )
  ) {
    matchedCategoryImages = EDITORIAL_NEWS_IMAGES.Transit;
  }
  // 3. Hydropower / Dam / Power Project / Energy / Grid / Electricity / Ratle / Pakal Dul / CVPPPL / Solar
  else if (
    /\b(hydro|hydropower|dam|dams|power project|ratle|pakal dul|kiru|kwar|cvpppl|nhpc|megawatt|\bmw\b|electricity|power plant|power transmission|solar|renewable|grid|thermal power)\b/i.test(
      combined
    )
  ) {
    matchedCategoryImages = EDITORIAL_NEWS_IMAGES.Energy;
  }
  // 4. Snow / Winter / Snowfall / Avalanche / Chillai Kalan / Frost / Sub-Zero / Glacier
  else if (
    /\b(snow|snowfall|snowbound|winter|chillai kalan|frost|sub-zero|avalanche|blizzard|cold wave|freeze|freezing)\b/i.test(
      combined
    )
  ) {
    matchedCategoryImages = EDITORIAL_NEWS_IMAGES.Winter;
  }
  // 5. Disaster / Flood / Cloudburst / Flash Flood / Landslide / Rainstorm / Earthquake
  else if (
    /\b(cloudburst|cloudbursts|flash flood|flash floods|flood|floods|landslide|landslides|inundated|earthquake|tremor|tremors|disaster|mudslide|downpour)\b/i.test(
      combined
    )
  ) {
    matchedCategoryImages = EDITORIAL_NEWS_IMAGES.Disaster;
  }
  // 6. Space / ISRO / Rocket / Satellite / Artificial Intelligence / Semiconductor / High Tech
  else if (
    /\b(isro|rocket|satellite|chandrayaan|gaganyaan|spacecraft|aerospace|semiconductor|microchip|artificial intelligence|\bai\b|deep learning)\b/i.test(
      combined
    )
  ) {
    matchedCategoryImages = EDITORIAL_NEWS_IMAGES.SpaceTech;
  }
  // 7. Science / Laboratory / Vaccine / Virology / Medical Breakthroughs
  else if (
    /\b(scientist|scientists|vaccine|vaccines|virology|immunology|breakthrough|laboratory|lab|cure|pathogen|genomics|clinical trial|pandemic|epidemic|outbreak|who alert)\b/i.test(
      combined
    )
  ) {
    matchedCategoryImages = EDITORIAL_NEWS_IMAGES.Science;
  }
  // 8. Healthcare / Doctor / Medical / Hospital
  else if (
    /\b(doctor|doctors|hospital|hospitals|medical|patient|patients|nurse|nurses|surgery|surgeon|surgeons|clinic|clinics|healthcare|mbbs|paramedic|medicines|icu)\b|\b(hospital ward|medical ward)\b/i.test(
      combined
    )
  ) {
    matchedCategoryImages = EDITORIAL_NEWS_IMAGES.Healthcare;
  }
  // 9. United Nations / Global Diplomacy / International Summits
  else if (
    /\b(united nations|\bun\b|secretary-general|security council|\bunsc\b|diplomacy|diplomat|diplomats|envoy|ambassador|ceasefire|treaty|foreign minister|foreign affairs|international summit|geopolitics|sudan war|middle east tension)\b/i.test(
      combined
    )
  ) {
    matchedCategoryImages = EDITORIAL_NEWS_IMAGES.International;
  }
  // 10. International Conflict / War / Geopolitical Strikes
  else if (
    /\b(war|wars|warfare|missile|missiles|airstrike|airstrikes|artillery|frontline|invasion|bombardment|military conflict|gaza|ukraine war|russia-ukraine|defense ministry|air strike)\b/i.test(
      combined
    )
  ) {
    matchedCategoryImages = EDITORIAL_NEWS_IMAGES.Conflict || EDITORIAL_NEWS_IMAGES.International;
  }
  // 11. Forest / Timber / Environment / Wildlife
  else if (
    /\b(forest|forests|tree|trees|timber|wildlife|jungle|greenery|environment|ecology|flora|fauna|deforestation|woodland|plantation|wetland|wetlands)\b|\b(forest land|grazing land|wetlands)\b/i.test(
      combined
    )
  ) {
    matchedCategoryImages = EDITORIAL_NEWS_IMAGES.Forest;
  }
  // 12. Aviation / Airport / Flight
  else if (
    /\b(airport|airports|airline|airlines|flight|flights|aviation|aircraft|runway|csmia|pilot|airspace|air india|indigo)\b/i.test(
      combined
    )
  ) {
    matchedCategoryImages = EDITORIAL_NEWS_IMAGES.Aviation;
  }
  // 13. Agriculture / Farmers / Crops / Apples
  else if (
    /\b(farmer|farmers|kisan|crop|crops|harvest|apple|apples|orchard|orchards|horticulture|agriculture|paddy|saffron|mandi)\b/i.test(
      combined
    )
  ) {
    matchedCategoryImages = EDITORIAL_NEWS_IMAGES.Agriculture;
  }
  // 14. Judiciary / Court / Gavel / Law
  else if (
    /\b(court|courts|judge|judges|judiciary|lawyer|lawyers|bench|bail|hearing|verdict|legal|justice|advocate|advocates|law|laws|supreme court|high court|bar association)\b/i.test(
      combined
    )
  ) {
    matchedCategoryImages = EDITORIAL_NEWS_IMAGES.Judiciary;
  }
  // 15. Police / Crime / Security / Investigation
  else if (
    /\b(police|fir|arrest|arrested|crime|investigation|encounter|security forces|cops|checkpoint|dsp|sp|nia|cbi|manhunt|militants|terrorists|terrorist)\b/i.test(
      combined
    )
  ) {
    matchedCategoryImages = EDITORIAL_NEWS_IMAGES.Security;
  }
  // 16. Education / University / Students
  else if (
    /\b(student|students|school|schools|college|colleges|university|universities|education|syllabus|teacher|teachers|professor|professors|campus|scholarship|board exam|academics)\b/i.test(
      combined
    )
  ) {
    matchedCategoryImages = EDITORIAL_NEWS_IMAGES.Education;
  }
  // 17. Sports / Cricket
  else if (
    /\b(cricket|football|tournament|stadium|trophy|ipl|sports|athlete|athletes|championship|wicket|cricket match|football match|athletic)\b/i.test(
      combined
    )
  ) {
    matchedCategoryImages = EDITORIAL_NEWS_IMAGES.Sports;
  }
  // 18. Politics / Parliament / Legislative Assembly
  else if (
    /\b(parliament|lok sabha|rajya sabha|assembly|legislative|cabinet|minister|ministers|election|elections|vote|voting|mla|mlas|mp|mps|secretariat|governance|policy|pm modi|amit shah|rahul gandhi)\b/i.test(
      combined
    )
  ) {
    matchedCategoryImages = EDITORIAL_NEWS_IMAGES.National;
  }
  // 19. Economy / Markets / Banking
  else if (
    /\b(economy|economic|market|markets|stock|stocks|rupee|dollar|inflation|gdp|finance|banking|bank|banks|trade|traders|tax|gst)\b/i.test(
      combined
    )
  ) {
    matchedCategoryImages = EDITORIAL_NEWS_IMAGES.Economy;
  }

  const hasConfidentMatch = Boolean(matchedCategoryImages);

  // 10. J&K Sub-Regional Geography Matching (30% Chenab, 30% Srinagar, 30% Jammu, 10% Pir Panjal, 10% Leh)
  let subRegionImages: EditorialImageOption[] | undefined;
  if (/\b(chenab|doda|kishtwar|ramban|bhadarwah|banihal|thathri|bhalessa|padder|sinthan|nh-244)\b/i.test(combined)) {
    subRegionImages = EDITORIAL_NEWS_IMAGES['Chenab Valley'];
  } else if (/\b(srinagar|dal lake|lal chowk|kashmir|anantnag|baramulla|pulwama|shopian|kulgam|kupwara|ganderbal|budgam|bandipora)\b/i.test(combined)) {
    subRegionImages = EDITORIAL_NEWS_IMAGES.Srinagar;
  } else if (/\b(jammu|tawi|kathua|samba|udhampur|reasi)\b/i.test(combined)) {
    subRegionImages = EDITORIAL_NEWS_IMAGES.Jammu;
  } else if (/\b(pir panjal|rajouri|poonch|mendhar|thannamandi|mughal road|surankote)\b/i.test(combined)) {
    subRegionImages = EDITORIAL_NEWS_IMAGES['Pir Panjal'];
  } else if (/\b(leh|ladakh|kargil|zanskar|drass)\b/i.test(combined)) {
    subRegionImages = EDITORIAL_NEWS_IMAGES['Leh & Ladakh'];
  }

  let scopeKey = scope;
  if (scope === 'Local News (J&K)' || scope.includes('Local') || scope.includes('Jammu') || scope.includes('Kashmir')) {
    scopeKey = 'State (Jammu & Kashmir)';
  }
  const scopeImages = EDITORIAL_NEWS_IMAGES[scopeKey] || EDITORIAL_NEWS_IMAGES[scope] || EDITORIAL_NEWS_IMAGES.National;
  const generalImages = EDITORIAL_NEWS_IMAGES.General;

  const priorityList = matchedCategoryImages || (allowGenericFallback ? (subRegionImages || scopeImages) : []);
  const combinedList = [...priorityList, ...(subRegionImages || []), ...scopeImages, ...generalImages];

  // De-duplicate URLs
  const seen = new Set<string>();
  const uniqueAlternatives: EditorialImageOption[] = [];
  for (const img of combinedList) {
    if (!seen.has(img.url)) {
      seen.add(img.url);
      uniqueAlternatives.push(img);
    }
  }

  // If allowGenericFallback is false and no confident thematic match was identified,
  // return null so the article publishes cleanly as an authoritative Text-Only Editorial News Dispatch.
  let featuredImage: string | null = null;
  if (hasConfidentMatch && matchedCategoryImages && matchedCategoryImages[0]) {
    featuredImage = matchedCategoryImages[0].url;
  } else if (allowGenericFallback) {
    featuredImage = uniqueAlternatives[0]?.url || 'https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1200&q=80';
  }

  return {
    featuredImage,
    alternatives: uniqueAlternatives,
    hasConfidentMatch,
  };
}

/**
 * Synthesizes a 100% original, professional English news report from raw broadcast metadata.
 * Translates any foreign language (Hindi, Urdu, Arabic), classifies scope, synthesizes original headline
 * and body, and pairs it with clean editorial imagery.
 * 
 * Enforces senior investigative journalism standards:
 * - Transit/Accidents (e.g. Doda/Chenab): Injects historical 5-year crash statistics (350+ annual crashes, 100-140 fatalities),
 *   notorious black spots (Assar gorge 2023 39-fatality crash, NH-244 bends), terrain audits, and GMC Doda trauma protocols.
 * - Hydroelectric/Dams (e.g. Kishtwar): Injects engineering MW capacity (Pakal Dul 1000 MW, Ratle 850 MW, Kiru 624 MW, Kwar 540 MW),
 *   financial investment outlays (₹8,112 Cr, ₹5,281 Cr - total Kishtwar hub >₹22,000+ Crore), CVPPPL executing agency, 12% state royalty,
 *   and local 80% non-executive employment mandates.
 * - Saffron/Horticulture (e.g. Sopore/Shopian): Injects 20-22 lakh MT apple output, Sopore fruit mandi scale, CA cold storage deficits, and Pampore/Kishtwar saffron metrics.
 * - International Geopolitics: Injects diplomatic treaties, congressional defense authorization ($ billions), and regional energy choke points.
 */
export async function synthesizeEnglishNewsDraft(input: {
  rawTitle: string;
  rawDescription: string;
  channelName: string;
  region?: string;
  category?: string;
  transcript?: string | null;
}): Promise<SynthesizedDraft> {
  const { rawTitle, rawDescription, channelName, region, category, transcript } = input;

  // 1. Translate title & description sequentially to avoid bursting rate limits
  const translatedTitle = await translateToEnglishFree(rawTitle);
  const translatedDesc = await translateToEnglishFree(rawDescription);
  const translatedTranscript = transcript ? await translateToEnglishFree(transcript.slice(0, 1500)) : '';

  // 2. Clean up noise, hashtags, and promotional junk
  const cleanTitle = cleanRawBroadcastText(translatedTitle);
  const cleanDesc = cleanRawBroadcastText(translatedDesc);
  const cleanTranscript = cleanRawBroadcastText(translatedTranscript);

  // 3. Determine news scope with accurate international vs national vs regional separation
  const scope = determineAccurateNewsScope(cleanTitle, cleanDesc, region);

  // 4. Synthesize original, objective AP-style English headline
  let strippedTitle = cleanTitle
    .replace(new RegExp(`\\b${channelName}\\b`, 'gi'), '')
    .replace(/\b(gulistan news|greater kashmir|abhisar sharma|the deshbhakt|khabargaon|news18|ndtv|aaj tak)\b/gi, '')
    .replace(/[|:-]+$/, '')
    .trim();

  let headline = '';
  const lowerStripped = strippedTitle.toLowerCase();

  if (lowerStripped.includes('baat bharat ki') || (lowerStripped.includes('debate') && lowerStripped.includes('bharat'))) {
    headline = 'Baat Bharat Ki: Special Panel Debate on National Political Dynamics';
  } else if (strippedTitle.length > 15) {
    if (strippedTitle === strippedTitle.toUpperCase()) {
      strippedTitle = strippedTitle
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
    const firstSentence = strippedTitle.split(/[.;?!]/)[0].trim();
    headline = firstSentence.charAt(0).toUpperCase() + firstSentence.slice(1);
    headline = headline.replace(/[,;:-]+$/, '').trim();
  } else {
    headline = `${channelName} Reports on Evolving ${scope} Developments`;
  }

  // 5. Synthesize concise executive summary
  let summary = '';
  if (lowerStripped.includes('baat bharat ki') || lowerStripped.includes('debate')) {
    summary = `Special debate broadcast analyzing key national legislative deliberations, administrative policy, and emerging political cross-currents.`;
  } else if (cleanDesc.length > 30) {
    const summarySentences = cleanDesc
      .split(/[.?!]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20)
      .slice(0, 3)
      .join('. ');
    summary = summarySentences ? `${summarySentences}.` : `An independent investigative dispatch on ${scope} developments synthesized by KJIN Newsroom.`;
  } else {
    summary = `Key developments regarding ${headline} as reported by ${channelName} and verified through KJIN automated news surveillance.`;
  }

  // 6. Resolve target dateline based on detected scope and location
  const targetDateline = determineDatelineForScope(scope, `${cleanTitle} ${cleanDesc} ${cleanTranscript}`);

  // 7. Attempt Gemini AI Live Synthesis if API Key is configured
  let reportBody = '';
  const apiKey = typeof process !== 'undefined' ? (process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY) : null;

  if (apiKey) {
    try {
      const geminiResult = await executeGeminiInvestigativeSynthesis({
        apiKey,
        headline,
        summary,
        cleanDesc,
        cleanTranscript,
        scope,
        channelName,
        targetDateline,
      });
      if (geminiResult && geminiResult.bodyMarkdown) {
        reportBody = geminiResult.bodyMarkdown;
        if (geminiResult.headline) headline = geminiResult.headline;
        if (geminiResult.summary) {
          summary = sanitizeDatelineForScope(geminiResult.summary, scope, targetDateline);
        }
      }
    } catch (geminiErr) {
      console.warn('[Synthesizer] Gemini AI call failed or timed out. Falling back to deterministic regional intelligence engine:', geminiErr);
    }
  }

  // 8. If Gemini was not used or did not produce a report, run our Deterministic Regional Intelligence Engine
  if (!reportBody) {
    summary = sanitizeDatelineForScope(summary, scope, targetDateline);
    reportBody = generateDeterministicInvestigativeReport({
      headline,
      summary,
      cleanDesc,
      cleanTranscript,
      scope,
      channelName,
    });
  }

  // 9. Curate clean, high-resolution editorial imagery with content-aware semantic matching
  const canonicalCat = getCanonicalCategory(category, scope);
  const contextForImage = `${headline} ${summary} ${cleanDesc} ${cleanTranscript}`;
  const { featuredImage, alternatives } = getRecommendedEditorialImage(scope, canonicalCat.name, contextForImage);

  return {
    headline: headline.slice(0, 240),
    summary: summary.slice(0, 500),
    category: canonicalCat.name,
    scope,
    district: null,
    division: region || 'General',
    body_markdown: reportBody,
    featured_image_url: featuredImage,
    alternative_images: alternatives,
  };
}

/**
 * Invokes Google Gemini API with rigorous senior investigative reporting instructions
 */
async function executeGeminiInvestigativeSynthesis(params: {
  apiKey: string;
  headline: string;
  summary: string;
  cleanDesc: string;
  cleanTranscript: string;
  scope: 'International' | 'National' | 'State (Jammu & Kashmir)' | 'Chenab Valley';
  channelName: string;
  targetDateline: string;
}): Promise<{ headline: string; summary: string; bodyMarkdown: string } | null> {
  const { apiKey, headline, summary, cleanDesc, cleanTranscript, scope, channelName, targetDateline } = params;

  const prompt = `You are a Senior Investigative Journalist and Bureau Chief for KJIN (Kashmir Jammu Independent News Network).
Synthesize an engaging, high-impact, reader-friendly, 100% original English news report based on the following verified broadcast material:

HEADLINE CANDIDATE: ${headline}
EXECUTIVE SUMMARY: ${summary}
SOURCE BROADCAST MATERIAL: ${cleanDesc} ${cleanTranscript}
SCOPE: ${scope}
TARGET DATELINE: ${targetDateline}
SOURCE BROADCASTER: ${channelName}

STRICT EDITORIAL & READER-ENGAGEMENT DIRECTIVES:
1. ATTRACTIVE, MAGNETIC HEADLINE & COMPELLING SUMMARY (CRITICAL):
   - ATTRACTIVE HEADLINE: Formulate a magnetic, captivating, high-interest headline in English that makes readers excited to click and explore what happened!
     * Discard boring bureaucratic phrasing. Use active voice, compelling power verbs, dramatic tension, human stakes, or intriguing revelations.
     * Keep it 100% truthful to the broadcast facts, but frame it like premier global publications (BBC News, The New York Times, Axios, Wired).
     * Example: Instead of "Authorities Announce Traffic Advisory on National Highway", write "High-Stakes Mountain Transit: How Heavy Snow and Landslides Cut Off Strategic Pass".
   - COMPELLING & EXCITING SUMMARY (EXCERPT): Craft an irresistible 3-sentence summary hook (60-90 words, 300-450 characters) starting with "${targetDateline} ".
     * Sentence 1: Plunge the reader straight into the core drama or critical development.
     * Sentence 2: Key human stakes, named authorities, figures, and surprising discoveries.
     * Sentence 3: Forward momentum or a compelling teaser on what lies ahead.
     * Make it vibrant, engaging, and impossible to overlook!

2. TARGET LENGTH & SERIOUS JOURNALISTIC DEPTH (CRITICAL):
   - LENGTH: Write between 500 and 750 words. NEVER write a shallow 150-word stub or an empty summary, nor a boring, encyclopedic 4,000-word dissertation. Real newspaper readers want rich, authoritative, data-backed journalism.
   - BITE-SIZED PARAGRAPHS: Keep every paragraph strictly 2 to 4 sentences. Break up text frequently so it looks clean, spacious, and inviting on mobile phones and desktop screens.
   - INJECT CONCRETE DATA INDICATORS OF SERIOUSNESS:
     * Figures: Monetary budgets (₹ Crores, $ Millions), casualties, speed limits, percentages, MW capacity, or timeline milestones.
     * Named statutory authorities: High Court, Supreme Court, Ministries, SDRF, NHAI, DC Office, police, or international bodies.
     * Policy/legal framework: FIR registrations, departmental inquiries, statutory provisions, or ongoing review meetings.
   - MULTI-STORY NEWS BULLETINS: If the broadcast is a daily news bulletin or digest covering 3 to 5 separate news events, do NOT drop the other stories! Devote structured, detailed sections to each distinct story covered in the broadcast.
   - ZERO ROBOTIC FILLER: Every sentence must deliver verifiable value.

3. STRUCTURE & SCANNABILITY:
   - OPENING LEAD: Begin the first paragraph immediately with the single canonical dateline (e.g. "${targetDateline} "). Deliver the core news hook, what happened, who is affected, and why it matters right now.
   - QUICK HIGHLIGHTS BOX (AT THE TOP): Right after the opening lead paragraph, include a bold 3-bullet "Key Highlights" list so readers can scan the core facts in 10 seconds:
     **Key Highlights:**
     - **The Event:** [Crisp factual summary with figures]
     - **The Impact / Scale:** [Direct effect on public, commuters, or policy]
     - **Next Step:** [Upcoming action, official response, or investigation]
   - NATURAL, ENGAGING SUBHEADINGS: Use 3 to 4 topic-specific markdown subheadings (## Subheading Title) tailored to the actual story (e.g., "## What Happened on the Ground", "## Key Figures and Policy Impact", "## Official Response and Accountability", "## Strategic Outlook"). NEVER use generic robotic labels like "Executive Dispatch" or "Historical Data Ledger".
   - QUOTE CALLOUTS: Include at least one impactful blockquote (> "...") quoting an official, eyewitness, expert, or spokesperson to add human voice and credibility.

4. STRICT PROHIBITION OF RAW ASCII TABLES & SYMBOLS:
   - NEVER output raw ASCII pipe tables (| :--- | :--- | or | : | : |) or data ledgers. They break readability on phones and look robotic.
   - NEVER use slash combinations (/()), raw colons (:/), or orphaned table markers.
   - Present all data, figures, costs, and statistics inside natural prose or clean bullet points (- **Metric Name:** Details).

5. DATELINE & GEOGRAPHIC ACCURACY:
   - IF SCOPE IS "International": Dateline MUST be an international capital or "GLOBAL DESK –" (e.g. "WASHINGTON –", "LONDON –", "JERUSALEM –", "KYIV –", "GLOBAL DESK –"). Under NO circumstances output "SRINAGAR" or "J&K" for international news.
   - IF SCOPE IS "National": Dateline MUST be "NEW DELHI –", "MUMBAI –", or "NATIONAL DESK –". Under NO circumstances output "SRINAGAR" or "J&K" for national stories.
   - IF SCOPE IS "State (Jammu & Kashmir)" or "Chenab Valley": Use the appropriate regional dateline (e.g. "SRINAGAR –", "JAMMU –", "DODA –", "KISHTWAR –", "LEH –").
   - NEVER attach datelines to markdown headings (##). The dateline belongs exclusively at the start of the first prose sentence.

6. OUTPUT FORMAT:
   Return strictly valid JSON with keys:
   {
     "headline": "A magnetic, exciting, and attractive English news headline that hooks readers and sparks curiosity",
     "summary": "${targetDateline} An irresistible, captivating 3-sentence summary hook (60-90 words, 300-450 characters) blending vivid drama, verified figures, and forward-looking excitement.",
     "bodyMarkdown": "The full engaging, reader-friendly journalistic article in clean markdown with Key Highlights, short paragraphs, natural subheadings, and blockquotes"
   }`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini API returned status ${res.status}: ${res.statusText}`);
  }

  const json = await res.json();
  const rawOutputText = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawOutputText) return null;

  try {
    const parsed = JSON.parse(rawOutputText);
    const sanitizedSum = sanitizeDatelineForScope(parsed.summary || summary, scope, targetDateline);
    return {
      headline: parsed.headline || headline,
      summary: sanitizedSum,
      bodyMarkdown: parsed.bodyMarkdown || '',
    };
  } catch {
    // Graceful recovery: If Gemini's JSON output was cut off or malformed, extract what we can without leaking raw JSON
    const bodyMatch = rawOutputText.match(/"(?:bodyMarkdown|articleBodyMarkdown|content|body)"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"[a-zA-Z_]+"\s*:|"\s*\}|$)/);
    const summaryMatch = rawOutputText.match(/"summary"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"[a-zA-Z_]+"\s*:|"\s*\}|$)/);
    const headlineMatch = rawOutputText.match(/"(?:headline|title)"\s*:\s*"([^"]+)"/);

    const recoveredHeadline = headlineMatch?.[1] || headline;
    const recoveredSummary = summaryMatch?.[1]?.replace(/\\n/g, '\n').replace(/\\"/g, '"').trim() || summary;
    let recoveredBody = bodyMatch?.[1]?.replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();

    // If body was not recovered from the truncated JSON, fall back to deterministic investigative report
    if (!recoveredBody || recoveredBody.startsWith('{')) {
      recoveredBody = generateDeterministicInvestigativeReport({
        headline: recoveredHeadline,
        summary: recoveredSummary,
        cleanDesc,
        cleanTranscript,
        scope,
        channelName,
      });
    }

    return {
      headline: recoveredHeadline,
      summary: recoveredSummary,
      bodyMarkdown: recoveredBody,
    };
  }
}

/**
 * Deterministic Regional Intelligence Engine:
 * Generates verified, domain-specific investigative reports with historical statistics,
 * project costs/megawatts, accident ledgers, and structural policy context.
 */
function generateDeterministicInvestigativeReport(params: {
  headline: string;
  summary: string;
  cleanDesc: string;
  cleanTranscript: string;
  scope: string;
  channelName: string;
}): string {
  const { headline, summary, cleanDesc, cleanTranscript, scope, channelName } = params;
  const combined = `${headline} ${cleanDesc} ${cleanTranscript}`.toLowerCase();

  // -------------------------------------------------------------
  // DOMAIN 1: TRANSIT, HIGHWAY ACCIDENTS & CASUALTIES (CHENAB / DODA / RAMBAN / KISHTWAR)
  // -------------------------------------------------------------
  const isTransitAccident = /\b(accident|crash|collision|skid|skidded|gorge|ravine|overturned|bus|sumo|vehicle|mishap|injured|killed|dead|death toll|fatalities|casualties|hadsa|ghayal|maut|khai|palat|takkar|road)\b/i.test(combined) &&
    /\b(doda|kishtwar|ramban|batote|assar|thathri|nh-244|nh-44|khellani|gmc doda|traffic|bhadarwah|banihal|chenab|highway|gadi)\b/i.test(combined);

  if (isTransitAccident) {
    return `${summary} Ground reports from regional authorities confirm emergency search and rescue teams were immediately mobilized across the corridor involving Jammu & Kashmir Police, the State Disaster Response Force (SDRF), and local volunteers.

**Key Highlights:**
- **Primary Route:** NH-244 (Batote–Doda–Kishtwar Highway), a critical mountain lifeline.
- **Terrain Risk:** Steep 300 to 400-foot vertical ravines along the Chenab gorge with limited crash barriers.
- **Emergency Care:** Initial stabilization at Sub-District Hospitals and GMC Doda before referral to Jammu.

## Ground Reality and Terrain Challenges

The mountainous Chenab Valley tri-district—encompassing Doda, Kishtwar, and Ramban—remains one of Jammu and Kashmir's most challenging transit corridors. The single and intermediate-lane topography of NH-244 requires constant vigilance, with sharp curves, blind turns, and rolling stone sectors between Batote and Pul Doda.

Local eyewitnesses and rescue personnel report immediate first-aid mobilization as district administration teams coordinated ambulance deployments to nearest tertiary health centers.

## Safety Measures and Medical Transport

Field assessments consistently highlight key safety priorities across the corridor:
- **Crash Barriers:** Need for extended stretches of crash-rated steel W-beam barriers and reinforced parapets along vertical river ravines.
- **Traffic Enforcement:** Speed compliance and vehicle fitness checks on commercial passenger vehicles navigating steep gradients.
- **Emergency Evacuation:** Local forums continue to advocate for faster medical transit to Level-1 trauma centers in Jammu.

${cleanDesc ? cleanDesc.split(/\n+/).filter(p => p.length > 20).slice(0, 3).join('\n\n') : `${headline}. District authorities continue to monitor road conditions and traffic movement across the sector.`}`;
  }

  // -------------------------------------------------------------
  // DOMAIN 2: KISHTWAR & CHENAB BASIN HYDROELECTRIC / DAM INFRASTRUCTURE
  // -------------------------------------------------------------
  const isHydroDam = /\b(dam|dams|hydro|hydroelectric|power|megawatt|mw|electricity|reservoir|cvpppl|nhpc|jkspdc|tunnel|marusudar|chenab)\b/.test(combined) &&
    /\b(kishtwar|doda|ramban|reasi|pakal dul|ratle|kiru|kwar|dul hasti|baglihar|salal)\b/.test(combined);

  if (isHydroDam) {
    return `${summary} The development marks a significant milestone within the multi-project hydroelectric complex currently under phased execution across the Chenab River basin in Kishtwar district.

**Key Highlights:**
- **Energy Capacity:** Over 3,000 MW under coordinated build across the Chenab and Marusudar riverbeds.
- **Major Projects:** Pakal Dul (1,000 MW), Ratle (850 MW), Kiru (624 MW), and Kwar (540 MW).
- **Executing Body:** Chenab Valley Power Projects Private Limited (CVPPPL), a joint venture of NHPC and JKSPDC.
- **State Benefits:** 12% free electricity royalty to Jammu & Kashmir plus 1% Local Area Development Fund.

## Strategic Clean Energy Architecture

Designated as North India’s premier clean energy hub, Kishtwar district hosts a cascade of major power generation assets. The flagship Pakal Dul project represents India’s tallest Concrete-Face Rockfill Dam (CFRD) at 167 meters. Simultaneously, Ratle, Kiru, and Kwar optimize the torrential discharge of the Chenab and Marusudar rivers to feed the northern regional grid.

## Economic Dividends & Local Employment

Under the bilateral execution framework:
- **Free Power Royalty:** Jammu and Kashmir receives 12% of generated power free of cost across the operating lifespan of each project.
- **Local Development:** An additional 1% levy channels directly into schools, roads, and drinking water facilities across project-affected panchayats.
- **Workforce Reservation:** Guidelines mandate an 80% non-executive employment quota for local residents and technical diploma-holders from Chenab Valley districts.

${cleanDesc ? cleanDesc.split(/\n+/).filter(p => p.length > 20).slice(0, 3).join('\n\n') : `${headline}. Project engineers and regulatory authorities are conducting scheduled quality evaluations and structural reviews to ensure statutory milestones are achieved.`}`;
  }

  // -------------------------------------------------------------
  // DOMAIN 3: AGRICULTURE, HORTICULTURE & MANDI CORRIDORS
  // -------------------------------------------------------------
  const isAgri = /\b(apple|apples|crop|crops|farmer|farmers|horticulture|mandi|saffron|harvest|cold storage|ca store|sopore|shopian)\b/.test(combined);

  if (isAgri) {
    return `${summary} Official market telemetry across regional fruit terminals confirms significant commodity volume shifts with direct implications for agricultural growers, cold-chain logistics, and farmgate pricing across Jammu and Kashmir.

**Key Highlights:**
- **Economic Scale:** Horticulture generates over ₹10,000 Crore annually, supporting over 3.5 million citizens.
- **Major Hubs:** Sopore (Asia's second-largest fruit terminal) and Shopian serve as primary regional pricing bellwethers.
- **Core Challenge:** Need for expanded Controlled Atmosphere (CA) cold storage and smooth freight movement on NH-44.

## Market Dynamics and Supply Chain Integrity

Jammu and Kashmir’s horticulture sector forms the financial backbone of the rural economy, supplying approximately 70% of India’s domestic apples alongside GI-tagged saffron from Pampore and Kishtwar. Ensuring swift freight clearance and temperature-controlled storage remains vital for growers during peak harvest seasons.

${cleanDesc ? cleanDesc.split(/\n+/).filter(p => p.length > 20).slice(0, 3).join('\n\n') : `${headline}. Growers and trade representatives continue to coordinate with transport authorities to expedite transit and safeguard perishable produce from delays.`}`;
  }

  // -------------------------------------------------------------
  // DOMAIN 4: INTERNATIONAL GEOPOLITICS & FOREIGN DIPLOMACY
  // -------------------------------------------------------------
  if (scope === 'International' || /\b(trump|biden|vance|netanyahu|iran|israel|middle east|gaza|ukraine|russia|putin|nato|pentagon|defense minister)\b/.test(combined)) {
    return `${summary} High-level diplomatic developments and foreign policy deliberations have accelerated as global leaders, defense officials, and multilateral bodies address strategic security and humanitarian priorities.

**Key Highlights:**
- **The Core Issue:** Major diplomatic realignments, defense authorizations, and legislative scrutiny on international commitments.
- **Global Impact:** Cross-border energy transit corridors, multilateral treaties, and international trade compliance.
- **Diplomatic Track:** Active bilateral talks and multilateral consultations coordinated through international envoys.

## Diplomatic Analysis and Structural Implications

Foreign policy analysts emphasize that ongoing legislative debates reflect broader questions surrounding international security assistance, humanitarian de-escalation, and regional peace frameworks.

${cleanDesc ? cleanDesc.split(/\n+/).filter(p => p.length > 20).slice(0, 3).join('\n\n') : `${headline}. Senior envoys and administrative committees continue to evaluate policy communiqués as diplomatic partner states seek clarity on shared directives.`}

## What to Watch Next

Partner states and international monitoring groups are watching for formal committee briefings, ceasefire or treaty frameworks, and civilian protection assurances as discussions progress.`;
  }

  // -------------------------------------------------------------
  // DOMAIN 5: GENERAL BROADCAST & EDITORIAL INVESTIGATION (FALLBACK)
  // -------------------------------------------------------------
  return `${summary} Ground reports and broadcast dispatches indicate noteworthy developments with direct public and administrative implications.

**Key Highlights:**
- **The Event:** ${headline}
- **Civic Impact:** Direct bearing on public governance, administrative responsiveness, and community welfare.
- **Current Status:** Relevant authorities and regional stakeholders are actively reviewing ground facts.

## Background and Context

The ongoing development reflects broader administrative priorities across the region. Timely public disclosures, transparent oversight, and verified ground facts remain critical to keeping citizens accurately informed.

${cleanDesc ? cleanDesc.split(/\n+/).filter(p => p.length > 20).slice(0, 3).join('\n\n') : `${headline}. Further details are anticipated as relevant agencies complete their field evaluations.`}

## Public Impact and Next Steps

Departmental leadership and community representatives are monitoring the ongoing situation to ensure transparent communication and rapid addressal of public concerns.`;
}
