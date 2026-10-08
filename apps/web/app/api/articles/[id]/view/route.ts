import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Basic in-memory cache for anti-abuse (resets when Lambda/Vercel function cold starts)
// Tracks IP+ArticleID string -> timestamp of last view
const viewCache = new Map<string, number>();

// Clean up cache periodically to avoid memory leaks
const CACHE_TTL_MS = 1000 * 60 * 15; // 15 minutes cooldown per IP per article
const MAX_CACHE_SIZE = 10000;

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const articleId = params.id;
    if (!articleId) {
      return NextResponse.json({ error: 'Missing article ID' }, { status: 400 });
    }

    // Get IP address for rate limiting
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ip = forwardedFor?.split(',')[0] || realIp || 'unknown-ip';

    const cacheKey = `${ip}:${articleId}`;
    const now = Date.now();

    // 1. Application-layer rate limiting / deduplication
    if (viewCache.has(cacheKey)) {
      const lastViewTime = viewCache.get(cacheKey)!;
      if (now - lastViewTime < CACHE_TTL_MS) {
        // Prevent abuse by silently ignoring the view if they requested recently
        return NextResponse.json({ success: true, message: 'View recorded (cached)' });
      }
    }

    // Cache management to prevent memory leak
    if (viewCache.size >= MAX_CACHE_SIZE) {
      // Clear 10% of oldest entries (simplified: just clear the whole map to be safe)
      viewCache.clear();
    }

    viewCache.set(cacheKey, now);

    // 2. Execute the database RPC securely using the service role key
    // We MUST use the service role key because the RPC is revoked from public
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { error } = await supabase.rpc('increment_article_view_count', {
      p_article_id: articleId,
    });

    if (error) {
      console.error('Error incrementing view count:', error);
      return NextResponse.json({ error: 'Failed to record view' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Unexpected error tracking view:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
