import Parser from 'rss-parser';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@kjin/config';

export interface NewsIntelItem {
  id?: string;
  source_name: string;
  source_url: string;
  source_title: string;
  published_at: string;
  summary: string;
  summary_hi?: string | null;
  summary_ur?: string | null;
  category: string;
  district?: string | null;
  tags: string[];
  claims: string[];
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string | null;
  created_at?: string;
}

export const OFFICIAL_NEWS_FEEDS = [
  { name: 'PIB National News', url: 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=2' },
  { name: 'AIR News Regional', url: 'https://www.newsonair.gov.in/feed/' },
  { name: 'DD News National', url: 'https://ddnews.gov.in/en/feed/' },
  { name: 'The Hindu National', url: 'https://www.thehindu.com/news/national/feeder/default.rss' },
  { name: 'Greater Kashmir RSS', url: 'https://www.greaterkashmir.com/feed/' },
];

export const FALLBACK_FREE_MODELS = [
  'openrouter/free',
  'nvidia/nemotron-3.5-lightning:free',
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'particle-ai/particle-1:free',
  'liquid/lfm-3-1.7b:free',
  'inclusionai/ling-3.2-flash:free',
];

export async function askOpenRouter(
  prompt: string,
  apiKey?: string,
  models: string[] = FALLBACK_FREE_MODELS
): Promise<string | null> {
  const key = apiKey || process.env.OPENROUTER_KEY || process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.warn('[NewsIntel] No OPENROUTER_KEY provided.');
    return null;
  }

  const modelPool = models.length > 0 ? models : FALLBACK_FREE_MODELS;

  for (const model of modelPool) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://www.kjcpl.site',
          'X-Title': 'KJCPL Autonomous News Intelligence',
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.warn(`[NewsIntel] Model ${model} returned HTTP ${res.status}: ${errText.slice(0, 100)}`);
        continue;
      }

      const json = await res.json();
      const content = json.choices?.[0]?.message?.content;
      if (content) {
        return content.replace(/```json|```/g, '').trim();
      }
    } catch (err) {
      console.warn(`[NewsIntel] Model ${model} error:`, err instanceof Error ? err.message : String(err));
    }
  }

  return null;
}

export async function runNewsIntelCycle(
  client?: SupabaseClient,
  options: { maxStories?: number; force?: boolean } = {}
): Promise<{ made: number; skipped: number; errors: string[] }> {
  const maxStories = options.maxStories || 5;
  const errors: string[] = [];
  let made = 0;
  let skipped = 0;

  let sb = client;
  if (!sb) {
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!serviceKey) {
      throw new Error('Supabase service key is missing.');
    }
    sb = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  const parser = new Parser({
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) KJCPL-NewsIntel/1.0',
      Accept: 'application/rss+xml, application/xml, text/xml; q=0.9, */*; q=0.8',
    },
  });

  const rawEnvModels = process.env.AI_MODELS
    ? process.env.AI_MODELS.split(',').map((m) => m.trim()).filter(Boolean)
    : [];
  const activeModels = rawEnvModels.length > 0 ? rawEnvModels : FALLBACK_FREE_MODELS;

  for (const feed of OFFICIAL_NEWS_FEEDS) {
    if (made >= maxStories) break;

    let items: Array<{ title?: string; link?: string; guid?: string; isoDate?: string; pubDate?: string; contentSnippet?: string; content?: string }> = [];
    try {
      const parsed = await parser.parseURL(feed.url);
      items = (parsed.items || []) as typeof items;
    } catch (feedErr) {
      const msg = `Feed fetch failed for ${feed.name}: ${feedErr instanceof Error ? feedErr.message : String(feedErr)}`;
      console.warn(`[NewsIntel] ${msg}`);
      errors.push(msg);
      continue;
    }

    for (const it of items.slice(0, 10)) {
      if (made >= maxStories) break;

      const link = (it.link || it.guid || '').trim();
      const title = (it.title || '').trim();
      if (!link || !title) continue;

      // Skip stale items (> 48h) unless force
      const pubDate = new Date(it.isoDate || it.pubDate || Date.now());
      if (!options.force && Date.now() - pubDate.getTime() > 48 * 3600 * 1000) {
        skipped++;
        continue;
      }

      // Check duplicates in ai_drafts
      const { data: seenDraft, error: seenErr } = await sb
        .from('ai_drafts')
        .select('id')
        .eq('source_url', link)
        .maybeSingle();

      if (seenErr && seenErr.code === 'PGRST205') {
        throw new Error("Table 'public.ai_drafts' not found. Please execute the migration in your Supabase SQL editor.");
      }

      if (seenDraft) {
        skipped++;
        continue;
      }

      // Check duplicates in articles table
      const { data: seenArticle } = await sb
        .from('articles')
        .select('id')
        .eq('source_url', link)
        .maybeSingle();

      if (seenArticle) {
        skipped++;
        continue;
      }

      // Headline similarity check via pg_trgm RPC
      try {
        const { data: duplicateCount } = await sb.rpc('similar_recent', { t: title });
        if (typeof duplicateCount === 'number' && duplicateCount > 0) {
          skipped++;
          continue;
        }
      } catch {
        // RPC might not be present if extension not applied, continue gracefully
      }

      const snippet = (it.contentSnippet || it.content || '').slice(0, 3000);

      const prompt = `Using ONLY the text below, return a valid JSON object with the exact keys:
- "headline": A professional, authoritative news headline strictly in English (Latin script only, regardless of input language).
- "summary": A concise 2-sentence journalistic summary in clear English.
- "category": One of Politics, Economy, Environment, Local News, Culture, Science, Transit, Health & Science, or Investigation.
- "district": The primary J&K or Indian district if identifiable, or null.
- "tags": An array of 3 to 5 lowercase keyword strings.
- "claims": An array of strings extracting every concrete number, date, proper noun, organization name, or testable claim found directly in the text.
- "summary_hi": Accurate 2-sentence Hindi translation of the summary in Devanagari script.
- "summary_ur": Accurate 2-sentence Urdu translation of the summary in Nastaliq/Arabic script.

Strict rule: Add nothing that is not verified in the text. Do not hallucinate.

Title: ${title}
Text: ${snippet || title}`;

      const aiText = await askOpenRouter(prompt, undefined, activeModels);
      if (!aiText) {
        continue;
      }

      let parsed: {
        headline?: string;
        summary?: string;
        category?: string;
        district?: string | null;
        tags?: string[];
        claims?: string[];
        summary_hi?: string;
        summary_ur?: string;
      };

      try {
        parsed = JSON.parse(aiText);
      } catch {
        continue;
      }

      const hasDevanagariOrArabic = /[\u0900-\u097F\u0600-\u06FF\u0750-\u077F]/.test(title);
      const cleanEnglishHeadline = parsed.headline?.trim() || (hasDevanagariOrArabic ? (parsed.summary?.split(/[.?!]\s+/)[0]?.trim() || 'National News Dispatch') : title);

      const payload = {
        source_name: feed.name,
        source_url: link,
        source_title: cleanEnglishHeadline,
        published_at: pubDate.toISOString(),
        summary: parsed.summary || cleanEnglishHeadline,
        summary_hi: parsed.summary_hi || null,
        summary_ur: parsed.summary_ur || null,
        category: parsed.category || 'Local News',
        district: parsed.district ? String(parsed.district).toLowerCase() : null,
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        claims: Array.isArray(parsed.claims) ? parsed.claims : [],
        status: 'pending',
      };

      const { error: insertErr } = await sb.from('ai_drafts').insert(payload);
      if (insertErr) {
        console.error(`[NewsIntel] Insert error:`, insertErr.message);
        errors.push(insertErr.message);
      } else {
        made++;
      }
    }
  }

  return { made, skipped, errors };
}
