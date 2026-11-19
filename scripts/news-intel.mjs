import Parser from 'rss-parser';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
  console.error('Missing SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const sb = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) KJCPL-NewsIntel/1.0',
    'Accept': 'application/rss+xml, application/xml, text/xml; q=0.9, */*; q=0.8',
  },
});

// Verified public and official feeds (PIB English, National, Regional, Science & Weather)
const FEEDS = [
  { name: 'PIB National News', url: 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=2' },
  { name: 'AIR News Regional', url: 'https://www.newsonair.gov.in/feed/' },
  { name: 'DD News National', url: 'https://ddnews.gov.in/en/feed/' },
  { name: 'The Hindu National', url: 'https://www.thehindu.com/news/national/feeder/default.rss' },
  { name: 'Greater Kashmir RSS', url: 'https://www.greaterkashmir.com/feed/' },
];

const defaultModels = [
  'openrouter/free',
  'nvidia/nemotron-3.5-lightning:free',
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'particle-ai/particle-1:free',
  'liquid/lfm-3-1.7b:free',
  'inclusionai/ling-3.2-flash:free',
];

const rawModels = process.env.AI_MODELS ? process.env.AI_MODELS.split(',').map((m) => m.trim()).filter(Boolean) : defaultModels;
const MODELS = rawModels.length > 0 ? rawModels : defaultModels;
const openrouterKey = process.env.OPENROUTER_KEY || process.env.OPENROUTER_API_KEY;

async function ai(prompt) {
  if (!openrouterKey) {
    console.warn('[NewsIntel] No OPENROUTER_KEY provided. Skipping AI processing.');
    return null;
  }

  for (const model of MODELS) {
    try {
      console.log(`  [AI] Querying model: ${model}...`);
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openrouterKey}`,
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
        console.warn(`  [AI] Model ${model} returned HTTP ${res.status}: ${errText.slice(0, 120)}`);
        continue;
      }

      const json = await res.json();
      const content = json.choices?.[0]?.message?.content;
      if (content) {
        return content.replace(/```json|```/g, '').trim();
      }
    } catch (err) {
      console.warn(`  [AI] Model ${model} network error: ${err.message}`);
    }
  }
  return null;
}

export async function runNewsIntel() {
  console.log(`\n========================================`);
  console.log(`Starting $0 Autonomous News Intelligence`);
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`OpenRouter Configured: ${Boolean(openrouterKey)}`);
  console.log(`Models Pool: ${MODELS.join(', ')}`);
  console.log(`========================================\n`);

  let made = 0;
  const MAX_PER_RUN = 5;

  for (const feed of FEEDS) {
    if (made >= MAX_PER_RUN) break;
    console.log(`\nFetching Feed: [${feed.name}] (${feed.url})...`);

    let items = [];
    try {
      const parsed = await parser.parseURL(feed.url);
      items = parsed.items || [];
      console.log(`  Found ${items.length} raw feed items.`);
    } catch (err) {
      console.warn(`  Feed fetch failed for ${feed.name}: ${err.message}`);
      continue;
    }

    for (const it of items.slice(0, 10)) {
      if (made >= MAX_PER_RUN) break;

      const link = (it.link || it.guid || '').trim();
      const title = (it.title || '').trim();

      if (!link || !title) continue;

      // 1. Skip items older than 48 hours
      const pubDate = new Date(it.isoDate || it.pubDate || Date.now());
      if (Date.now() - pubDate.getTime() > 48 * 3600 * 1000) {
        continue;
      }

      // 2. URL Deduplication in ai_drafts
      const { data: seenUrl, error: seenUrlErr } = await sb
        .from('ai_drafts')
        .select('id')
        .eq('source_url', link)
        .maybeSingle();

      if (seenUrlErr && seenUrlErr.code === 'PGRST205') {
        console.error('\n[NewsIntel] Table "public.ai_drafts" not found in Supabase.');
        console.error('Please execute the SQL in supabase/migrations/20261119110000_ai_drafts_free_stack.sql in your Supabase SQL editor.');
        return { made: 0, error: 'Table not found' };
      }

      if (seenUrl) {
        continue;
      }

      // Also check articles table so we never duplicate existing published articles
      const { data: seenArticle } = await sb
        .from('articles')
        .select('id')
        .eq('source_url', link)
        .maybeSingle();

      if (seenArticle) {
        continue;
      }

      // 3. Duplicate headline check using pg_trgm similarity via similar_recent RPC
      try {
        const { data: duplicateCount, error: rpcErr } = await sb.rpc('similar_recent', { t: title });
        if (!rpcErr && typeof duplicateCount === 'number' && duplicateCount > 0) {
          console.log(`  Skipping duplicate headline (>60% similar to recent item): "${title.slice(0, 60)}..."`);
          continue;
        }
      } catch {
        // If extension / RPC not yet applied, fallback smoothly
      }

      console.log(`\n  Processing candidate: "${title}"`);
      const rawSnippet = (it.contentSnippet || it.content || it.summary || '').slice(0, 3000);

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
Text: ${rawSnippet || title}`;

      const rawAi = await ai(prompt);
      if (!rawAi) {
        console.warn(`  Failed to get AI output for "${title.slice(0, 40)}..."`);
        continue;
      }

      let parsedAi;
      try {
        parsedAi = JSON.parse(rawAi);
      } catch (err) {
        console.warn(`  JSON parse failed: ${err.message}`);
        continue;
      }

      const hasDevanagariOrArabic = /[\u0900-\u097F\u0600-\u06FF\u0750-\u077F]/.test(title);
      const cleanEnglishHeadline = parsedAi.headline?.trim() || (hasDevanagariOrArabic ? (parsedAi.summary?.split(/[.?!]\s+/)[0]?.trim() || 'National News Dispatch') : title);

      const insertPayload = {
        source_name: feed.name,
        source_url: link,
        source_title: cleanEnglishHeadline,
        published_at: pubDate.toISOString(),
        summary: parsedAi.summary || cleanEnglishHeadline,
        summary_hi: parsedAi.summary_hi || null,
        summary_ur: parsedAi.summary_ur || null,
        category: parsedAi.category || 'Local News',
        district: parsedAi.district ? String(parsedAi.district).toLowerCase() : null,
        tags: Array.isArray(parsedAi.tags) ? parsedAi.tags : [],
        claims: Array.isArray(parsedAi.claims) ? parsedAi.claims : [],
        status: 'pending',
      };

      const { data: inserted, error: insErr } = await sb
        .from('ai_drafts')
        .insert(insertPayload)
        .select('id')
        .single();

      if (insErr) {
        console.error(`  Failed to insert draft into ai_drafts:`, insErr.message);
      } else {
        console.log(`  ✓ Successfully stored Pending Draft [${inserted.id}]: "${title.slice(0, 60)}..."`);
        made++;
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`Cycle Finished: Generated ${made} new pending AI drafts.`);
  console.log(`========================================\n`);
  return { made };
}

// Direct CLI invocation
if (process.argv[1] && process.argv[1].endsWith('news-intel.mjs')) {
  runNewsIntel()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal execution error:', err);
      process.exit(1);
    });
}
