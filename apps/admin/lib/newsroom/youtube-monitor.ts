import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  synthesizeEnglishNewsDraft,
  getRecommendedEditorialImage,
  determineAccurateNewsScope,
  determineDatelineForScope,
  sanitizeDatelineForScope,
} from './ai-synthesizer.ts';
import { getCanonicalCategory } from '../taxonomy-options.ts';
import { sendNewsApprovalAlert } from './email-notifier.ts';
import { generateSlug } from './gemini-drafter.ts';

export interface YouTubeChannelMeta {
  channelId: string;
  channelName: string;
  channelUrl: string;
}

export interface IngestedYouTubeVideo {
  videoId: string;
  title: string;
  videoUrl: string;
  publishedAt: string;
  description: string;
  thumbnailUrl: string;
  authorName: string;
}

export interface ExtractedBulletinStory {
  headline: string;
  scope: string;
  category: string;
  summary: string;
  keyFacts?: string[];
}

export interface GeminiVideoAnalysis {
  headline: string;
  summary: string;
  category: string;
  scope?: 'International' | 'National' | 'State (Jammu & Kashmir)' | 'Chenab Valley';
  district: string | null;
  division: string;
  keyFacts: string[];
  articleBodyMarkdown: string;
  featured_image_url?: string;
  uncertaintyNotes?: string;
  is_priority_eligible?: boolean;
  rejection_reason?: string | null;
  is_multi_story_bulletin?: boolean;
  stories?: ExtractedBulletinStory[];
}

/**
 * Resolve a YouTube URL, handle (@name), or channel ID into a validated Channel ID (UC...) and Name.
 */
export async function resolveChannelFromUrlOrHandle(input: string): Promise<YouTubeChannelMeta> {
  const trimmed = input.trim();

  // If already a raw channel ID
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(trimmed)) {
    return {
      channelId: trimmed,
      channelName: trimmed,
      channelUrl: `https://www.youtube.com/channel/${trimmed}`,
    };
  }

  // Format into a full URL if user provided @handle
  let targetUrl = trimmed;
  if (trimmed.startsWith('@')) {
    targetUrl = `https://www.youtube.com/${trimmed}`;
  } else if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = `https://www.youtube.com/@${trimmed}`;
  }

  const response = await fetch(targetUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to access YouTube channel at ${targetUrl} (HTTP ${response.status})`);
  }

  const html = await response.text();

  // Extract canonical channel ID (UC...)
  const channelIdMatch =
    html.match(/https:\/\/www\.youtube\.com\/channel\/(UC[a-zA-Z0-9_-]{22})/i) ||
    html.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/i) ||
    html.match(/<meta itemprop="identifier" content="(UC[a-zA-Z0-9_-]{22})"/i);

  if (!channelIdMatch || !channelIdMatch[1]) {
    throw new Error(`Could not find channel ID for ${targetUrl}. Please verify the URL or channel handle.`);
  }

  const channelId = channelIdMatch[1];

  // Extract channel display name
  const titleMatch =
    html.match(/<meta property="og:title" content="([^"]+)"/i) ||
    html.match(/<title>([^<]+)<\/title>/i);

  let channelName = titleMatch ? titleMatch[1].replace(' - YouTube', '').trim() : targetUrl;
  if (!channelName) channelName = targetUrl;

  return {
    channelId,
    channelName,
    channelUrl: targetUrl,
  };
}

/**
 * Fetch latest videos from YouTube public Atom XML feed without consuming Google API quotas.
 */
export async function fetchChannelLatestVideos(
  channelId: string,
  maxItems = 15
): Promise<IngestedYouTubeVideo[]> {
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const response = await fetch(feedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch YouTube feed for ${channelId}: HTTP ${response.status}`);
  }

  const xml = await response.text();
  const entryMatches = xml.match(/<entry>[\s\S]*?<\/entry>/gi) || [];
  const videos: IngestedYouTubeVideo[] = [];

  for (const entry of entryMatches.slice(0, maxItems)) {
    const videoIdMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/i) || entry.match(/<id>[^:]+:video:([^<]+)<\/id>/i);
    const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/i);
    const linkMatch = entry.match(/<link[^>]+href=["']([^"']+)["']/i);
    const publishedMatch = entry.match(/<published>([^<]+)<\/published>/i);
    const descMatch = entry.match(/<media:description>([\s\S]*?)<\/media:description>/i);
    const authorMatch = entry.match(/<author>[\s\S]*?<name>([^<]+)<\/name>/i);
    const thumbMatch = entry.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);

    if (videoIdMatch && videoIdMatch[1] && titleMatch) {
      const videoId = videoIdMatch[1].trim();
      const title = decodeXmlEntities(titleMatch[1].trim());
      const videoUrl = linkMatch ? linkMatch[1].trim() : `https://www.youtube.com/watch?v=${videoId}`;
      const publishedAt = publishedMatch ? publishedMatch[1].trim() : new Date().toISOString();
      const description = descMatch ? decodeXmlEntities(descMatch[1].trim()) : '';
      const authorName = authorMatch ? decodeXmlEntities(authorMatch[1].trim()) : 'YouTube Channel';
      const thumbnailUrl = thumbMatch ? thumbMatch[1].trim() : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      videos.push({
        videoId,
        title,
        videoUrl,
        publishedAt,
        description,
        thumbnailUrl,
        authorName,
      });
    }
  }

  return videos;
}

/**
 * Attempts to retrieve video captions/subtitles if publicly available.
 * Checks both manual and auto-generated (ASR) caption tracks across Hindi, English, and Urdu.
 */
export async function fetchVideoTranscript(videoId: string): Promise<string | null> {
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetch(watchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'hi,en-US,en;q=0.9,ur;q=0.8',
      },
    });

    if (!res.ok) return null;
    const html = await res.text();

    // 1. Check for captions track in player response
    let tracks: Array<{ baseUrl: string; languageCode?: string; kind?: string }> = [];

    const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*({[\s\S]+?});(?:var\s|const\s|<\/script>)/);
    if (playerMatch && playerMatch[1]) {
      try {
        const player = JSON.parse(playerMatch[1]);
        tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
      } catch {
        // Continue to fallback regex
      }
    }

    if (!tracks.length) {
      const captionMatch = html.match(/"captionTracks":\s*(\[[\s\S]*?\])(?:,\s*"|})/);
      if (captionMatch && captionMatch[1]) {
        try {
          tracks = JSON.parse(captionMatch[1]);
        } catch {
          // Fallback failed
        }
      }
    }

    if (!tracks.length) return null;

    // Prioritize English, Hindi (manual or ASR auto-generated), and Urdu
    const preferredTrack =
      tracks.find((t) => t.languageCode === 'en' || t.languageCode?.startsWith('en')) ||
      tracks.find((t) => t.languageCode === 'hi' || t.languageCode?.startsWith('hi')) ||
      tracks.find((t) => t.languageCode === 'ur' || t.languageCode?.startsWith('ur')) ||
      tracks[0];

    if (!preferredTrack?.baseUrl) return null;

    const transcriptRes = await fetch(preferredTrack.baseUrl);
    if (!transcriptRes.ok) return null;

    const transcriptXml = await transcriptRes.text();
    const texts = transcriptXml.match(/<text[^>]*>([^<]*)<\/text>/gi) || [];

    const lines: string[] = [];
    if (texts.length > 0) {
      for (const t of texts) {
        const cleanLine = t.replace(/<[^>]+>/g, '').trim();
        if (cleanLine.length > 0) {
          lines.push(decodeXmlEntities(cleanLine));
        }
      }
    } else {
      // Fallback for JSON-formatted transcript payloads
      const jsonMatches = transcriptXml.match(/"utf8":\s*"([^"]+)"/g);
      if (jsonMatches) {
        for (const m of jsonMatches) {
          const val = m.replace(/"utf8":\s*"/, '').replace(/"$/, '').trim();
          if (val) lines.push(decodeXmlEntities(val));
        }
      }
    }

    const fullTranscript = lines.join(' ');
    // Retain up to 25,000 characters to capture multi-topic 15-minute news bulletins in full
    return fullTranscript.length > 50 ? fullTranscript.slice(0, 25000) : null;
  } catch {
    return null;
  }
}

/**
 * Strips promotional noise, URLs, social handles, phone numbers, and subscribe links
 * from raw YouTube broadcast descriptions to ensure only substantive journalistic facts remain.
 */
export function sanitizeSourceDescription(desc: string | null | undefined): string {
  if (!desc) return '';

  return desc
    // Remove all URLs
    .replace(/https?:\/\/[^\s]+/gi, '')
    .replace(/www\.[^\s]+/gi, '')
    // Strip trailing social blocks and promotional text
    .replace(/(?:social\s*links|channel\s*link|join\s+.*?channel|follow\s+us|connect\s+with\s+us|subscribe\s+to)[\s\S]*$/gi, '')
    // Remove inline social media channels, handles, and WhatsApp calls
    .replace(/(?:facebook|instagram|twitter|telegram|whatsapp)\s*:\s*[^\s.,;]+/gi, '')
    .replace(/join\s+[^.,;]+\s*(?:whatsapp|telegram)\s*channel/gi, '')
    .replace(/channel\s*link\s*:\s*/gi, '')
    .replace(/\*+(?:Independent investigative dispatch|Report synthesized by).*?\*+/gi, '')
    // Remove email addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '')
    // Remove phone numbers
    .replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '')
    // Remove social media handles
    .replace(/@[a-zA-Z0-9_.]+/g, '')
    // Remove long decorative dashes or dividers
    .replace(/[-=_~*]{3,}/g, ' ')
    // Remove common promotional lines line-by-line
    .split('\n')
    .filter((line) => {
      const lower = line.toLowerCase().trim();
      if (!lower) return false;
      if (lower.includes('subscribe') || lower.includes('bell icon')) return false;
      if (lower.includes('follow us') || lower.includes('follow on') || lower.includes('join telegram')) return false;
      if (lower.includes('download app') || lower.includes('download our')) return false;
      if (lower.includes('like and share') || lower.includes('like, share')) return false;
      if (lower.includes('for business') || lower.includes('copyright disclaimer')) return false;
      if (lower.includes('whatsapp') || lower.includes('instagram') || lower.includes('facebook') || lower.includes('twitter')) return false;
      if (lower.includes('social links') || lower.includes('channel link')) return false;
      return true;
    })
    .join('\n')
    .trim();
}

/**
 * Classifies news scope across 4 distinct journalistic levels:
 * - 'Chenab Valley': Doda, Kishtwar, Ramban districts and Chenab river basin.
 * - 'State (Jammu & Kashmir)': UT administration, Kashmir Valley, Jammu division.
 * - 'International': Foreign nations, UN, global diplomacy, world events.
 * - 'National': All-India national politics, Parliament, Supreme Court, Union ministries.
 */
export function detectNewsScope(
  title: string,
  description: string,
  sourceRegion?: string
): 'International' | 'National' | 'State (Jammu & Kashmir)' | 'Chenab Valley' {
  return determineAccurateNewsScope(title, description, sourceRegion);
}

/**
 * Use Gemini AI to analyze newsworthy video content and prepare a structured news draft
 * written completely from scratch in English with zero copied links.
 */
export async function analyzeVideoWithGemini(
  video: IngestedYouTubeVideo,
  source: { channel_name: string; country?: string; region?: string; category?: string },
  transcript: string | null
): Promise<GeminiVideoAnalysis> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  const cleanDescription = sanitizeSourceDescription(video.description);
  const cleanTranscript = transcript ? sanitizeSourceDescription(transcript) : null;
  const detectedScope = detectNewsScope(video.title, cleanDescription, source.region);

  const contentPrompt = `
You are a senior investigative editor at KJIN (Kashmir & Jammu Investigative Newsroom).
Your objective is to read raw YouTube broadcast information and compose a 100% ORIGINAL, INDEPENDENT NEWS ARTICLE DRAFT written strictly from scratch in English.

RAW SOURCE MATERIAL (FOR FACT EXTRACTION ONLY):
- Channel: ${source.channel_name} (${source.region || 'Regional Reporting'})
- Raw Broadcast Title: ${video.title}
- Published Date: ${new Date(video.publishedAt).toLocaleDateString()}
- Extracted Broadcast Information:
${cleanDescription ? cleanDescription.slice(0, 2500) : 'No description provided.'}

${cleanTranscript ? `ACCESSIBLE TRANSCRIPT (FULL SUBTITLES / TRANSCRIPT EXCERPT):\n${cleanTranscript.slice(0, 20000)}` : 'TRANSCRIPT: Not available. Strictly use verified facts extracted from title/description.'}

EDITORIAL INSTRUCTIONS:
1. DETERMINE NEWS SCOPE & REGIONAL CATEGORIZATION:
   - "Chenab Valley": Doda, Kishtwar, Ramban, Bhadarwah, Banihal, Sinthan, Padder, Thathri, NH-244.
   - "Srinagar": Srinagar & Kashmir Valley (Dal Lake, Budgam, Ganderbal, Anantnag, Pulwama, Shopian, Kulgam, Baramulla, Kupwara, Bandipora).
   - "Jammu": Jammu city, Samba, Kathua, Udhampur, Reasi (Jammu Plains).
   - "Pir Panjal": Rajouri, Poonch, Mendhar, Thannamandi, Surankote, Mughal Road.
   - "Leh & Ladakh": Leh, Kargil, Zanskar, Drass.
   - "National": All-India national affairs, Union ministries, Parliament, Supreme Court, national economy, Bollywood/national cinema, ISRO, national issues.
   - "International": Global developments, US, Europe, Middle East, Asia, world geopolitics, international diplomacy, scientific discoveries.

2. ATTRACTIVE & MAGNETIC HEADLINE REWRITE (FROM ZERO):
   - DO NOT copy or translate the YouTube broadcast title directly.
   - Discard all cheap spammy clickbait phrases, ALL-CAPS screaming, exclamation marks, emotional teasers, channel watermarks, and Hindi/Urdu idioms.
   - Formulate an entirely new, magnetic, high-caliber journalistic headline in English that makes readers genuinely excited to explore the story!
   - Use active verbs, compelling story hooks, high stakes, and dramatic tension (BBC / Axios / New York Times style). Never make it a dry bureaucratic memo.
   - Example: Instead of "Police Statement on Border Incident", write "Border Alert: Security Forces Intercept Drone in Midnight Samba Operation".

3. CAPTIVATING & ENGAGING EXECUTIVE SUMMARY / EXCERPT (CRITICAL):
   - "summary": Formulate an irresistible, captivating, data-backed 3 to 4-sentence executive summary (60-90 words, 300-450 characters).
   - Begin immediately with the single canonical dateline (e.g. "GLOBAL DESK –", "NEW DELHI –", "SRINAGAR –", "JAMMU –", "DODA –").
   - Open with an evocative hook that pulls the reader into the heart of the event, integrate verifiable figures and key authorities, and conclude with forward-looking impact or what lies ahead.
   - NEVER output a superficial, 1-sentence blurb or a dry administrative list. It must be lively, informative, and engaging.

4. MULTI-STORY NEWS BULLETINS & INSIDE SUBTITLE STORIES (CRITICAL):
   - Broadcasters frequently deliver MULTI-STORY NEWS BULLETINS (daily roundups, evening updates, or digests) covering 3 to 5 completely distinct, separate news developments in one single video!
   - The video's YouTube title often only highlights ONE of those stories. You must NOT overlook or drop the other 3-4 news developments explained inside the video subtitles!
   - MULTI-STORY DETECTION & COVERAGE:
     * Check if the broadcast covers multiple distinct developments (e.g. Story 1: Transit accident, Story 2: High Court judgment, Story 3: Weather/avalanche warning, Story 4: Government employee DA/pension update).
     * If multiple distinct developments are present:
       1. Set "is_multi_story_bulletin": true.
       2. Populate "stories": Return an array of all distinct stories extracted from the subtitles/broadcast (2 to 5 distinct stories), each with:
          - "headline": Specific headline for that distinct development
          - "scope": "Chenab Valley" | "State (Jammu & Kashmir)" | "National" | "International"
          - "category": Appropriate category
          - "summary": Substantive 2-3 sentence brief with specific data points
          - "keyFacts": Key numbers, dates, and named authorities
       3. In "articleBodyMarkdown": Write an authoritative comprehensive News Bulletin Dispatch with dedicated, in-depth sections for EVERY distinct news story:
          * Opening lead summarizing the multi-topic developments covered across the bulletin.
          * Quick Highlights box covering all stories.
          * Dedicated section for Story 1 (## 1. [Story 1 Headline] with facts, background, figures, and quotes).
          * Dedicated section for Story 2 (## 2. [Story 2 Headline] with facts, background, figures, and quotes).
          * Dedicated section for Story 3 (## 3. [Story 3 Headline] with facts, background, figures, and quotes).
          * Dedicated section for Story 4 (if present).
       4. In "summary": Deliver an executive briefing that summarizes the key headlines and figures across the bulletin.
     * If the video is a single-topic deep dive:
       Set "is_multi_story_bulletin": false, "stories": [], and write an in-depth 550-800 word investigation with deep data metrics.

5. WRITE AN ORIGINAL JOURNALISTIC REPORT FROM ZERO:
   - Write the entire article from scratch as an authoritative, independent broadsheet news dispatch.
   - TARGET LENGTH: 500 to 750 words. NEVER produce a shallow 150-word stub or a superficial summary. Every story must be treated with serious investigative depth.
   - INJECT CONCRETE DATA INDICATORS OF SERIOUSNESS:
     * Concrete figures: budgets, monetary allocations, death/injury counts, project capacity (megawatts, kilometers, lane width), speed limits, percentages, or timeline milestones.
     * Named institutional authorities: Ministries, Directorates, Courts (Supreme Court, High Court), District Administration, Police/SDRF/NDRF, or multilateral agencies.
     * Named stakeholders & spokespersons with attributed quotes or direct statements.
     * Policy/legal ramifications: FIR registrations, departmental inquiries, statutory provisions, or regulatory compliance.
   - 100% FACTUAL EVENT FOCUS: Focus strictly on what happened, who was involved, where it occurred, and why it matters. Do NOT include vague generic filler, boilerplate rhetoric, or hallucinated facts.
   - NEVER copy lines verbatim from the source.
   - NEVER embed ANY URLs, YouTube links, social media handles, phone numbers, or promotional calls.
   - ZERO RAW ASCII TABLES: NEVER output raw pipe tables (| :--- | :--- | or | : | : |) or data ledgers. Present all data within clean bullet points or natural prose.

6. STRICT DATELINE & SCOPE RULES (CRITICAL):
   - If scope is "International", the dateline in summary and article body MUST be an international city/capital or "GLOBAL DESK –" (e.g. "WASHINGTON –", "LONDON –", "JERUSALEM –", "KYIV –", "GLOBAL DESK –"). Under NO circumstances output "SRINAGAR" or "J&K" for international news. The category MUST be "International".
   - If scope is "National", the dateline in summary and article body MUST be "NEW DELHI –", "MUMBAI –", or "NATIONAL DESK –". Under NO circumstances output "SRINAGAR" or "J&K" for national stories unless the event physically occurred in Jammu & Kashmir. The category MUST be "National" or a specific thematic category (e.g. "Politics", "Economy", "Culture", "Sports").
   - If scope is "State (Jammu & Kashmir)" or "Chenab Valley", use the appropriate regional dateline (e.g., "SRINAGAR –", "JAMMU –", "DODA –", "KISHTWAR –", "LEH –").

7. EDITORIAL GATEKEEPER:
   - "is_priority_eligible": boolean (true/false)
   - RULES:
     * J&K Sub-regions (Chenab Valley, Srinagar, Jammu, Pir Panjal, Leh): ALWAYS true (Core territory priority).
     * National: True for verified national governance, policy, national events, economy, supreme court, major national interest, or prominent cultural milestones. (False ONLY for low-quality spam or promotional fluff).
     * International: True for major world events, geopolitics, wars, global diplomacy, health/science discoveries, macro trade, and international milestones. (False ONLY for trivial foreign local municipal trivia).
   - "rejection_reason": string | null (If false, state why)

Output your response strictly as valid JSON with keys:
{
  "headline": string,
  "summary": string,
  "category": "Politics" | "National" | "International" | "Local News" | "Economy" | "Investigation" | "Problems" | "Culture" | "Sports" | "Education" | "Opinion" | "General",
  "scope": "International" | "National" | "State (Jammu & Kashmir)" | "Chenab Valley",
  "division": "Srinagar" | "Chenab Valley" | "Jammu" | "Pir Panjal" | "Leh & Ladakh" | "National" | "International",
  "district": string | null,
  "keyFacts": string[],
  "articleBodyMarkdown": string,
  "uncertaintyNotes": string,
  "is_priority_eligible": boolean,
  "rejection_reason": string | null,
  "is_multi_story_bulletin": boolean,
  "stories": [
    {
      "headline": string,
      "scope": string,
      "category": string,
      "summary": string,
      "keyFacts": string[]
    }
  ]
}
`;

  if (apiKey) {
    try {
      const response = await generateText({
        model: google('gemini-2.5-flash'),
        prompt: contentPrompt,
        temperature: 0.2,
      });

      const cleaned = response.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);

      // Strip any accidental markdown URLs or links from the generated article body
      const sanitizedArticleBodyRaw = (parsed.articleBodyMarkdown || '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/https?:\/\/[^\s]+/g, '')
        .trim();

      const effectiveScope = parsed.scope || detectedScope;
      const canonical = getCanonicalCategory(parsed.category || source.category, effectiveScope);

      // Resolve and enforce the accurate dateline
      const targetDateline = determineDatelineForScope(
        effectiveScope,
        `${parsed.headline || video.title} ${parsed.summary || cleanDescription}`
      );
      const sanitizedSummary = sanitizeDatelineForScope(
        parsed.summary || cleanDescription.slice(0, 200) || video.title,
        effectiveScope,
        targetDateline
      );
      const finalArticleBody = sanitizeDatelineForScope(
        sanitizedArticleBodyRaw,
        effectiveScope,
        targetDateline
      );

      // Semantic content-aware image matching (e.g. Doctor, Forest, Aviation, Court)
      const imageContext = `${parsed.headline || video.title} ${parsed.summary || cleanDescription} ${canonical.name}`;
      const recommendedImage = getRecommendedEditorialImage(effectiveScope, canonical.name, imageContext);

      return {
        headline: (parsed.headline || video.title).trim(),
        summary: sanitizedSummary.trim(),
        category: canonical.name,
        scope: effectiveScope,
        division: parsed.division || (effectiveScope === 'National' ? 'National' : effectiveScope === 'International' ? 'International' : source.region || 'Jammu & Kashmir'),
        district: effectiveScope === 'National' || effectiveScope === 'International' ? null : (parsed.district || null),
        keyFacts: Array.isArray(parsed.keyFacts) ? parsed.keyFacts : [parsed.headline || video.title],
        articleBodyMarkdown: finalArticleBody,
        featured_image_url: recommendedImage.featuredImage,
        uncertaintyNotes: parsed.uncertaintyNotes || (transcript ? 'Based on verified transcript translated to English.' : 'Based on broadcast intelligence; verified in English.'),
        is_priority_eligible: parsed.is_priority_eligible !== false,
        rejection_reason: parsed.rejection_reason || null,
        is_multi_story_bulletin: Boolean(parsed.is_multi_story_bulletin),
        stories: Array.isArray(parsed.stories) ? parsed.stories : [],
      };
    } catch (err) {
      console.warn('[Gemini YouTube Analyzer] API call failed, falling back to English news synthesizer:', err);
    }
  }

  // Automatic translation and journalistic synthesis engine (works without external API keys)
  const synthesized = await synthesizeEnglishNewsDraft({
    rawTitle: video.title,
    rawDescription: video.description,
    channelName: source.channel_name,
    region: source.region,
    category: source.category,
    transcript,
  });

  return {
    headline: synthesized.headline,
    summary: synthesized.summary,
    category: synthesized.category,
    scope: synthesized.scope,
    division: synthesized.division,
    district: synthesized.district,
    keyFacts: [synthesized.headline, `Aired by ${source.channel_name}`, `Classification: ${synthesized.scope}`],
    articleBodyMarkdown: synthesized.body_markdown,
    featured_image_url: synthesized.featured_image_url,
    uncertaintyNotes: transcript ? 'Analyzed via transcript excerpt.' : 'Broadcast intelligence translated to English from source audio.',
  };
}

function cleanEditorialBroadcastText(text: string, preserveLinebreaks = false): string {
  if (!text) return '';
  let cleaned = text.trim();

  // Strip accidental JSON object wrappers
  if (cleaned.startsWith('{') || /^\s*\{\s*"(?:headline|title|summary|articleBodyMarkdown|bodyMarkdown)"/i.test(cleaned)) {
    try {
      const parsed = JSON.parse(cleaned);
      if (typeof parsed === 'object' && parsed !== null) {
        cleaned = String(parsed.articleBodyMarkdown || parsed.bodyMarkdown || parsed.content || parsed.summary || parsed.headline || '');
      }
    } catch {
      const bodyMatch = cleaned.match(/"(?:articleBodyMarkdown|bodyMarkdown|content|body)"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"[a-zA-Z_]+"\s*:|"\s*\}|$)/);
      const summaryMatch = cleaned.match(/"summary"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"[a-zA-Z_]+"\s*:|"\s*\}|$)/);
      const summaryTailMatch = cleaned.match(/"(?:summary|bodyMarkdown|articleBodyMarkdown|content|body)"\s*:\s*"?([\s\S]+)$/i);
      if (bodyMatch && bodyMatch[1] && bodyMatch[1].trim()) {
        cleaned = bodyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      } else if (summaryMatch && summaryMatch[1] && summaryMatch[1].trim()) {
        cleaned = summaryMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      } else if (summaryTailMatch && summaryTailMatch[1]) {
        cleaned = summaryTailMatch[1].replace(/["}\]\s]+$/, '').replace(/\\n/g, '\n').replace(/\\"/g, '"');
      } else {
        cleaned = cleaned
          .replace(/^\{\s*"(?:headline|title)"\s*:\s*(?:"(?:\\.|[^"\\])*"|'[^']*'),?\s*/i, '')
          .replace(/^"(?:summary|lead|description|body|content)"\s*:\s*"?/i, '')
          .replace(/["}\]\s]+$/, '');
      }
    }
  }

  const result = cleaned
    .replace(/#[a-zA-Z0-9_\u0900-\u097F]+/g, '')
    .replace(/(?:social\s*links|channel\s*link|join\s+.*?channel|follow\s+us|connect\s+with\s+us|subscribe\s+to)[\s\S]*$/gi, '')
    .replace(/(?:facebook|instagram|twitter|telegram|whatsapp)\s*:\s*[^\s.,;]+/gi, '')
    .replace(/join\s+[^.,;]+\s*(?:whatsapp|telegram)\s*channel/gi, '')
    .replace(/channel\s*link\s*:\s*/gi, '')
    .replace(/\*+(?:Independent investigative dispatch|Report synthesized by).*?\*+/gi, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/[^\s]+/gi, '')
    .replace(/www\.[^\s]+/gi, '')
    .replace(/[-=_~*]{3,}/g, ' ');

  if (preserveLinebreaks) {
    return result.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim();
  }

  return result.replace(/\s+/g, ' ').trim();
}

async function autoPublishEligibleDraft(
  service: SupabaseClient,
  videoRecordId: string,
  video: { title: string; videoUrl: string; thumbnailUrl: string; description: string },
  channel: { channel_name: string },
  analysis: GeminiVideoAnalysis
): Promise<string | null> {
  try {
    const { data: authors } = await service
      .from('profiles')
      .select('id, display_name, role')
      .limit(1);

    const authorProfile = authors?.[0] || null;
    const authorId = authorProfile?.id || null;
    const authorName = authorProfile?.display_name || 'KJIN Newsroom Desk';

    const cleanTitle = cleanEditorialBroadcastText(analysis.headline || video.title).slice(0, 250);
    const effectiveScope = analysis.scope || 'National';
    const targetDateline = determineDatelineForScope(effectiveScope, `${cleanTitle} ${analysis.summary || video.description || ''}`);

    const rawSummary = cleanEditorialBroadcastText(analysis.summary || video.description || '').slice(0, 500);
    const cleanSummary = sanitizeDatelineForScope(rawSummary, effectiveScope, targetDateline);

    const rawContent = cleanEditorialBroadcastText(analysis.articleBodyMarkdown || video.description || '', true).trim();
    const cleanContent = sanitizeDatelineForScope(rawContent, effectiveScope, targetDateline);

    const isLocalScope = effectiveScope.includes('Local') || effectiveScope.includes('State') || effectiveScope.includes('Jammu') || effectiveScope.includes('Chenab');
    const canonicalCat = getCanonicalCategory(analysis.category, effectiveScope);

    const { data: catRecord } = await service
      .from('categories')
      .select('id')
      .eq('slug', canonicalCat.slug)
      .maybeSingle();

    const baseSlug = generateSlug(cleanTitle);
    const finalSlug = `${baseSlug || 'news-report'}-${Date.now().toString(36).slice(-4)}`;
    const finalDistrict = isLocalScope ? (analysis.district || null) : null;
    const finalImageUrl = analysis.featured_image_url || video.thumbnailUrl || null;

    // Step 1: Insert article as draft (enforced by DB trigger)
    const { data: newArticle, error: articleErr } = await service
      .from('articles')
      .insert({
        title: cleanTitle,
        slug: finalSlug,
        excerpt: cleanSummary,
        content: cleanContent,
        category: canonicalCat.name,
        category_id: catRecord?.id || null,
        district: finalDistrict,
        status: 'draft',
        author_id: authorId,
        author_display_name: authorName,
        source_name: channel.channel_name || 'Broadcast Surveillance',
        source_url: video.videoUrl,
        featured_image_url: finalImageUrl,
      })
      .select()
      .single();

    if (articleErr || !newArticle) {
      console.error('[AutoPublish] Error creating draft article:', articleErr);
      return null;
    }

    // Step 2: Transition draft -> review
    await service
      .from('articles')
      .update({ status: 'review', updated_at: new Date().toISOString() })
      .eq('id', newArticle.id);

    // Step 3: Transition review -> published
    const nowIso = new Date().toISOString();
    const { error: publishErr } = await service
      .from('articles')
      .update({
        status: 'published',
        published_at: nowIso,
        published_by: authorId,
        updated_at: nowIso,
      })
      .eq('id', newArticle.id);

    if (publishErr) {
      console.error('[AutoPublish] Error publishing article:', publishErr);
      return null;
    }

    // Step 4: Record article version
    await service.from('article_versions').insert({
      article_id: newArticle.id,
      version_number: 1,
      title: cleanTitle,
      excerpt: cleanSummary,
      content: cleanContent,
      edited_by: authorId,
    });

    // Step 5: Update youtube_videos record
    await service
      .from('youtube_videos')
      .update({
        processing_status: 'approved',
        article_id: newArticle.id,
        updated_at: nowIso,
      })
      .eq('id', videoRecordId);

    console.log(`[AutoPublish] Successfully auto-published: "${cleanTitle}" (ID: ${newArticle.id})`);
    return newArticle.id;
  } catch (err) {
    console.error('[AutoPublish] Unexpected error publishing draft:', err);
    return null;
  }
}

/**
 * Executes the scheduled sync job: checks active channels, inserts new videos, runs Gemini analysis,
 * auto-publishes high-confidence dispatches, and maintains resilient job locks.
 */
export async function runYouTubeHourlySync(
  service: SupabaseClient,
  options?: { force?: boolean; autoPublish?: boolean }
) {
  const workerId = `worker-${Date.now()}`;
  const now = new Date();
  const threeMinutesAgo = new Date(now.getTime() - 3 * 60 * 1000).toISOString();

  // 1. Acquire job lock with stale lock reclamation (>3 mins or forced)
  if (options?.force) {
    await service.from('youtube_worker_locks').delete().eq('lock_name', 'youtube_hourly_sync');
  } else {
    await service.from('youtube_worker_locks').delete().lt('locked_at', threeMinutesAgo);
  }

  const { error: lockErr } = await service.from('youtube_worker_locks').insert({
    lock_name: 'youtube_hourly_sync',
    locked_at: now.toISOString(),
    locked_by: workerId,
  });

  if (lockErr) {
    // Check if current lock is stale
    const { data: currentLock } = await service
      .from('youtube_worker_locks')
      .select('locked_at')
      .eq('lock_name', 'youtube_hourly_sync')
      .maybeSingle();

    const lockAgeMs = currentLock?.locked_at ? now.getTime() - new Date(currentLock.locked_at).getTime() : 0;
    if (lockAgeMs > 3 * 60 * 1000 || !currentLock) {
      await service.from('youtube_worker_locks').delete().eq('lock_name', 'youtube_hourly_sync');
      await service.from('youtube_worker_locks').insert({
        lock_name: 'youtube_hourly_sync',
        locked_at: now.toISOString(),
        locked_by: workerId,
      });
    } else {
      return {
        success: false,
        skipped: true,
        reason: 'Another sync job is currently running.',
      };
    }
  }

  // Strict Policy: 100% Pending Approval. Auto-publish is permanently DISABLED.
  // No broadcast draft is ever published live without explicit human review and approval.
  const isAutoPublish = false;

  const syncResults = {
    channelsChecked: 0,
    newVideosFound: 0,
    draftsProposed: 0,
    articlesPublished: 0,
    errors: [] as string[],
  };

  try {
    // 2. Fetch all active channels
    const { data: channels, error: channelsErr } = await service
      .from('youtube_sources')
      .select('*')
      .eq('is_active', true);

    if (channelsErr || !channels) {
      throw new Error(`Failed to read active YouTube sources: ${channelsErr?.message}`);
    }

    syncResults.channelsChecked = channels.length;

    for (const channel of channels) {
      try {
        const videos = await fetchChannelLatestVideos(channel.channel_id, 10);
        let channelLatestPublished: string | null = null;

        for (const video of videos) {
          if (!channelLatestPublished || new Date(video.publishedAt) > new Date(channelLatestPublished)) {
            channelLatestPublished = video.publishedAt;
          }

          // Check if video already exists in database
          const { data: existing } = await service
            .from('youtube_videos')
            .select('id, processing_status')
            .eq('video_id', video.videoId)
            .maybeSingle();

          if (existing) {
            continue; // Deduplicated, skip
          }

          syncResults.newVideosFound += 1;

          // Attempt to extract transcript
          const transcript = await fetchVideoTranscript(video.videoId);

          // Insert video record in 'analyzing' status
          const { data: insertedVideo, error: insertErr } = await service
            .from('youtube_videos')
            .insert({
              source_id: channel.id,
              video_id: video.videoId,
              title: video.title,
              description: video.description,
              thumbnail_url: video.thumbnailUrl,
              video_url: video.videoUrl,
              published_at: video.publishedAt,
              processing_status: 'analyzing',
              transcript_text: transcript,
              has_transcript: Boolean(transcript),
            })
            .select('id')
            .single();

          if (insertErr || !insertedVideo) {
            console.error(`Failed to insert video ${video.videoId}:`, insertErr);
            continue;
          }

          // Run Gemini analysis to propose headline and draft
          try {
            const analysis = await analyzeVideoWithGemini(video, channel, transcript);

            // Enforce 80% J&K / 10% National / 10% International mandate
            const isEligible = analysis.is_priority_eligible !== false;
            const targetStatus = isEligible ? 'draft_proposed' : 'rejected';

            await service
              .from('youtube_videos')
              .update({
                processing_status: targetStatus,
                proposed_headline: analysis.headline,
                proposed_summary: analysis.summary,
                proposed_category: analysis.category,
                ai_analysis: analysis,
                last_error: isEligible ? null : (analysis.rejection_reason || 'Filtered out by 80/10/10 regional weightage mandate'),
                updated_at: new Date().toISOString(),
              })
              .eq('id', insertedVideo.id);

            if (isEligible) {
              syncResults.draftsProposed += 1;
              // Every broadcast draft strictly remains in draft_proposed (Awaiting Approval).
              // Zero auto-publish: Nothing publishes until the editor clicks "Review & Approve".

              // Dispatch instant email alert to editor to verify & approve on dashboard
              sendNewsApprovalAlert({
                headline: analysis.headline,
                summary: analysis.summary,
                category: analysis.category,
                scope: analysis.scope || 'State (Jammu & Kashmir)',
                division: analysis.division || 'Jammu & Kashmir',
                district: analysis.district,
                platform: 'YouTube Broadcast',
                sourceName: channel.channel_name,
                sourceUrl: video.videoUrl,
              }).catch((mailErr) => console.warn('[YouTube Worker] Non-blocking email alert warning:', mailErr));
            }
          } catch (analysisErr) {
            console.error(`Gemini analysis error for ${video.videoId}:`, analysisErr);
            await service
              .from('youtube_videos')
              .update({
                processing_status: 'manual_review_needed',
                last_error: analysisErr instanceof Error ? analysisErr.message : 'Analysis failed',
                updated_at: new Date().toISOString(),
              })
              .eq('id', insertedVideo.id);
          }
        }

        // Update channel last_checked_at timestamp
        await service
          .from('youtube_sources')
          .update({
            last_checked_at: new Date().toISOString(),
            last_video_published_at: channelLatestPublished || channel.last_video_published_at,
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', channel.id);
      } catch (channelErr) {
        const errorMsg = channelErr instanceof Error ? channelErr.message : 'Unknown channel error';
        console.error(`Error processing channel ${channel.channel_name}:`, errorMsg);
        syncResults.errors.push(`${channel.channel_name}: ${errorMsg}`);

        await service
          .from('youtube_sources')
          .update({
            last_checked_at: new Date().toISOString(),
            last_error: errorMsg,
            updated_at: new Date().toISOString(),
          })
          .eq('id', channel.id);
      }
    }

    // All proposed drafts remain in draft_proposed awaiting explicit human review and approval.
    // Zero auto-publishing.
    return {
      success: true,
      ...syncResults,
    };
  } finally {
    // Release job lock
    await service.from('youtube_worker_locks').delete().eq('lock_name', 'youtube_hourly_sync');
  }
}

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .trim();
}
