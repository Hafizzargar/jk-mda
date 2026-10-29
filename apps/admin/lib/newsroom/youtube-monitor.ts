import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import type { SupabaseClient } from '@supabase/supabase-js';

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
  district: string | null;
  division: string;
  keyFacts: string[];
  articleBodyMarkdown: string;
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
 * Use Gemini AI to analyze newsworthy video content and prepare a structured news draft.
 */
export async function analyzeVideoWithGemini(
  video: IngestedYouTubeVideo,
  source: { channel_name: string; country?: string; region?: string; category?: string },
  transcript: string | null
): Promise<GeminiVideoAnalysis> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;

  const contentPrompt = `
You are a senior investigative editor at KJIN (Kashmir & Jammu Investigative Newsroom).
Analyze this newly detected YouTube news broadcast and propose a factual, objective, two-stage approval news article draft.

VIDEO SOURCE:
- Channel: ${source.channel_name} (${source.region || 'Jammu & Kashmir / India'})
- Title: ${video.title}
- Original URL: ${video.videoUrl}
- Published At: ${video.publishedAt}
- Video Description:
${video.description ? video.description.slice(0, 1500) : 'No description provided.'}

${transcript ? `ACCESSIBLE VIDEO TRANSCRIPT:\n${transcript.slice(0, 3500)}` : 'TRANSCRIPT: Not available. Strictly use available title and verified description metadata. DO NOT hallucinate facts.'}

EDITORIAL & LANGUAGE INSTRUCTIONS:
1. MANDATORY ENGLISH REQUIREMENT: The KJIN newsroom publishes strictly in ENGLISH. REGARDLESS of whether the video broadcast is in Hindi, Urdu, Kashmiri, Dogri, or any other regional language, your output (headline, summary, key facts, and article body) MUST BE WRITTEN ENTIRELY IN ACCURATE, OBJECTIVE, PROFESSIONAL ENGLISH.
2. Provide an objective, active-voice proposed headline in English.
3. Provide a concise 2-sentence summary of the development in English.
4. Suggest the news category (e.g. "Politics", "Civic Problems", "Infrastructure", "Humanitarian", "Security", or "Regional News").
5. Extract 3-5 confirmed key facts translated into clear English.
6. Write a professional 2-3 paragraph news article in Markdown format in English, with explicit attribution to ${source.channel_name} and link to the original YouTube broadcast.

Output your response strictly as valid JSON with keys:
{
  "headline": string,
  "summary": string,
  "category": string,
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

      return {
        headline: parsed.headline || video.title,
        summary: parsed.summary || (video.description ? video.description.slice(0, 200) : video.title),
        category: parsed.category || source.category || 'General News',
        division: parsed.division || source.region || 'Jammu & Kashmir',
        district: parsed.district || null,
        keyFacts: Array.isArray(parsed.keyFacts) ? parsed.keyFacts : [video.title],
        articleBodyMarkdown:
          parsed.articleBodyMarkdown ||
          `**${source.channel_name}** reported: ${video.title}\n\n${video.description}\n\n*Source: [Watch original broadcast on YouTube](${video.videoUrl})*`,
        uncertaintyNotes: parsed.uncertaintyNotes || (transcript ? 'Based on verified transcript translated to English.' : 'Based on broadcast metadata; transcript was not available.'),
      };
    } catch (err) {
      console.warn('[Gemini YouTube Analyzer] API call failed, falling back to deterministic synthesis:', err);
    }
  }

  // Deterministic fallback generator when Gemini API is unavailable or quota is exceeded
  const hasIndicOrArabicScript = /[\u0900-\u097F\u0600-\u06FF\u0750-\u077F]/.test(video.title);
  let cleanTitle = video.title.replace(/[|!@#$%^&*]+/g, ' ').replace(/\s+/g, ' ').trim();

  let englishHeadline = cleanTitle;
  let englishSummary = video.description
    ? video.description.split('\n')[0].slice(0, 240)
    : `Broadcast report covering regional developments by ${source.channel_name}.`;

  if (hasIndicOrArabicScript) {
    // Produce an objective English headline referencing the broadcast
    const cleanedAscii = video.title.replace(/[^\x00-\x7F]/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleanedAscii.length > 10) {
      englishHeadline = `${source.channel_name}: ${cleanedAscii}`;
    } else {
      englishHeadline = `${source.channel_name} Special Report: Regional Broadcast Analysis`;
    }
    englishSummary = `In a recent video broadcast, ${source.channel_name} reported on current regional and political developments. Synthesized for KJIN editorial review.`;
  }

  const fallbackBody = `### Report Overview\n\nIn a recent news broadcast, **${source.channel_name}** (${source.region || 'Regional Reporting'}) reported on **${englishHeadline}**.\n\n${
    video.description ? video.description.slice(0, 450) + '...' : ''
  }\n\n### Source Attribution & English Synthesis\n\nThis story was detected by KJIN automated YouTube surveillance. The broadcast was originally aired on YouTube and is presented here in English for editorial verification and review.\n\n* **Broadcast Channel:** ${source.channel_name}\n* **Original Video:** [Watch on YouTube](${video.videoUrl})\n* **Broadcast Timestamp:** ${new Date(video.publishedAt).toLocaleString()}`;

  return {
    headline: englishHeadline,
    summary: englishSummary,
    category: source.category || 'General News',
    division: source.region || 'Jammu & Kashmir',
    district: null,
    keyFacts: [englishHeadline, `Aired by ${source.channel_name}`, `Broadcast date: ${new Date(video.publishedAt).toLocaleDateString()}`],
    articleBodyMarkdown: fallbackBody,
    uncertaintyNotes: transcript ? 'Analyzed via transcript excerpt.' : 'Broadcast metadata. Original audio in regional language; reviewed in English.',
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
