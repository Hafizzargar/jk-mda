import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import type { SupabaseClient } from '@supabase/supabase-js';
import { synthesizeEnglishNewsDraft } from './ai-synthesizer';
import { getCanonicalCategory } from '@/lib/taxonomy-options';

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
    // Remove email addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '')
    // Remove phone numbers
    .replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '')
    // Remove social media handles
    .replace(/@[a-zA-Z0-9_.]+/g, '')
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
1. DETERMINE NEWS SCOPE:
   Classify the news story into exactly ONE of the following 4 scopes:
   - "International" (World news, global conflicts, foreign policy, foreign elections, multilateral treaties)
   - "National" (India-wide politics, Supreme Court, Parliament, Union Cabinet, national parties, country-wide policy)
   - "State (Jammu & Kashmir)" (UT administration, Srinagar, Jammu, J&K governance, High Court of J&K, regional policy)
   - "Chenab Valley" (Specifically pertains to Doda, Kishtwar, Ramban districts, Chenab river basin, NH-244, mountain passes)

2. REWRITE THE HEADLINE FROM ZERO:
   - DO NOT copy or translate the YouTube broadcast title directly.
   - Discard all clickbait phrases, exclamation marks, emotional teasers, channel watermarks, and Hindi/Urdu idioms.
   - Formulate an entirely new, objective, high-caliber journalistic news headline in English (AP / Reuters style).

3. WRITE AN ORIGINAL SCRIPT/ARTICLE FROM ZERO:
   - Write the entire article from scratch ("at new from zero") as an independent KJIN investigative news report.
   - NEVER copy lines verbatim from the source.
   - NEVER embed ANY URLs, YouTube links, social media handles, phone numbers, or promotional text.
   - Organize the article in clear Markdown with the following 4 structured sections:
     ### Executive Overview
     (A crisp 2-3 sentence lead answering Who, What, Where, When, and Why in professional English)
     ### Background & Regional Context
     (Explain the broader background, significance within its scope, and historical/political setting)
     ### Key Developments & Statements
     (The verified facts, official statements, figures, orders, or arguments reported in the broadcast)
     ### Strategic Implications & Next Steps
     (What this means for citizens, governance, economy, or policy moving forward)

4. NO EXTERNAL LINKS:
   - The article text must NOT contain any external URLs or markdown links.
   - Conclude cleanly with: "*Report synthesized by KJIN Newsroom from verified broadcast intelligence.*"

Output your response strictly as valid JSON with keys:
{
  "headline": string,
  "summary": string,
  "category": "Politics" | "National" | "International" | "Local News" | "Economy" | "Investigation" | "Problems" | "Culture" | "Sports" | "Education" | "Opinion" | "General",
  "scope": "International" | "National" | "State (Jammu & Kashmir)" | "Chenab Valley",
  "division": string,
  "district": string | null,
  "keyFacts": string[],
  "articleBodyMarkdown": string,
  "uncertaintyNotes": string
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

      return {
        headline: (parsed.headline || video.title).trim(),
        summary: (parsed.summary || cleanDescription.slice(0, 200) || video.title).trim(),
        category: canonical.name,
        scope: effectiveScope,
        division: parsed.division || source.region || 'Jammu & Kashmir',
        district: parsed.district || null,
        keyFacts: Array.isArray(parsed.keyFacts) ? parsed.keyFacts : [parsed.headline || video.title],
        articleBodyMarkdown: sanitizedArticleBody,
        uncertaintyNotes: parsed.uncertaintyNotes || (transcript ? 'Based on verified transcript translated to English.' : 'Based on broadcast intelligence; verified in English.'),
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

/**
 * Executes the scheduled sync job: checks active channels, inserts new videos, runs Gemini analysis,
 * and maintains job locks to prevent overlapping runs.
 */
export async function runYouTubeHourlySync(service: SupabaseClient) {
  const workerId = `railway-worker-${Date.now()}`;
  const now = new Date();
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

  // 1. Acquire job lock with stale lock reclamation (>10 mins)
  await service.from('youtube_worker_locks').delete().lt('locked_at', tenMinutesAgo);

  const { error: lockErr } = await service.from('youtube_worker_locks').insert({
    lock_name: 'youtube_hourly_sync',
    locked_at: now.toISOString(),
    locked_by: workerId,
  });

  if (lockErr) {
    return {
      success: false,
      skipped: true,
      reason: 'Another sync job is currently running.',
    };
  }

  const syncResults = {
    channelsChecked: 0,
    newVideosFound: 0,
    draftsProposed: 0,
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

            await service
              .from('youtube_videos')
              .update({
                processing_status: 'draft_proposed',
                proposed_headline: analysis.headline,
                proposed_summary: analysis.summary,
                proposed_category: analysis.category,
                ai_analysis: analysis,
                updated_at: new Date().toISOString(),
              })
              .eq('id', insertedVideo.id);

            syncResults.draftsProposed += 1;
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
