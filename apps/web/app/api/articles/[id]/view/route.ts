import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Cooldown per IP per article (15 minutes)
const ARTICLE_VIEW_COOLDOWN_MS = 1000 * 60 * 15;
// Global abuse rate limit: max 30 view attempts per minute per IP
const GLOBAL_RATE_LIMIT_WINDOW_MS = 1000 * 60;
const MAX_GLOBAL_VIEWS_PER_MINUTE = 30;
const MAX_CACHE_SIZE = 10000;

interface ViewRecord {
  lastArticleView: number;
}

interface IpRateRecord {
  count: number;
  resetAt: number;
}

// In-memory caches for edge deduplication and abuse protection
const articleViewCache = new Map<string, ViewRecord>();
const ipRateCache = new Map<string, IpRateRecord>();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanCache() {
  if (articleViewCache.size > MAX_CACHE_SIZE) {
    const now = Date.now();
    for (const [key, record] of articleViewCache.entries()) {
      if (now - record.lastArticleView > ARTICLE_VIEW_COOLDOWN_MS) {
        articleViewCache.delete(key);
      }
    }
    // If still too large, flush older half
    if (articleViewCache.size > MAX_CACHE_SIZE) {
      articleViewCache.clear();
    }
  }

  if (ipRateCache.size > MAX_CACHE_SIZE) {
    const now = Date.now();
    for (const [key, record] of ipRateCache.entries()) {
      if (now > record.resetAt) {
        ipRateCache.delete(key);
      }
    }
  }
}

function extractClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0].trim();
    if (firstIp) return firstIp;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return 'anonymous';
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const articleId = resolvedParams.id;

  // 1. Strict UUID parameter validation
  if (!articleId || !UUID_REGEX.test(articleId)) {
    return NextResponse.json({ error: 'Invalid article ID format' }, { status: 400 });
  }

  const ip = extractClientIp(request);
  const now = Date.now();
  const cacheKey = `${ip}:${articleId}`;

  cleanCache();

  // 2. Global IP rate limiting (prevent distributed or scripted flooding)
  const ipRate = ipRateCache.get(ip);
  if (ipRate) {
    if (now < ipRate.resetAt) {
      if (ipRate.count >= MAX_GLOBAL_VIEWS_PER_MINUTE) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Too many requests.' },
          { status: 429 }
        );
      }
      ipRate.count += 1;
    } else {
      ipRateCache.set(ip, { count: 1, resetAt: now + GLOBAL_RATE_LIMIT_WINDOW_MS });
    }
  } else {
    ipRateCache.set(ip, { count: 1, resetAt: now + GLOBAL_RATE_LIMIT_WINDOW_MS });
  }

  // 3. Per-article deduplication / cooldown check
  const existingRecord = articleViewCache.get(cacheKey);
  if (existingRecord && now - existingRecord.lastArticleView < ARTICLE_VIEW_COOLDOWN_MS) {
    // Return early with success to avoid double-counting legitimate repeated reads
    return NextResponse.json({ success: true, message: 'View already recorded within cooldown window' });
  }

  // 4. Initialize Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase configuration in view counter');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  // 5. Execute DB RPC FIRST before mutating viewCache
  // Try newer hardened signature with IP tracking, fall back to single-arg signature if legacy
  let { error } = await supabase.rpc('increment_article_view_count', {
    p_article_id: articleId,
    p_ip_address: ip,
  });

  if (error && (error.message?.includes('function') || error.message?.includes('argument'))) {
    const fallback = await supabase.rpc('increment_article_view_count', {
      p_article_id: articleId,
    });
    error = fallback.error;
  }

  if (error) {
    console.error('Error incrementing view count via RPC:', error);
    // Notice: We do NOT commit to cache on failure, preserving ability for retry
    return NextResponse.json({ error: 'Failed to record view' }, { status: 500 });
  }

  // 6. Only record in view cache on SUCCESSFUL DB commit
  articleViewCache.set(cacheKey, { lastArticleView: now });

  return NextResponse.json({ success: true });
}
