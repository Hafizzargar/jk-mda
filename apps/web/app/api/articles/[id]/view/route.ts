import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractClientIp(request: Request): string | null {
  // On Vercel, x-vercel-forwarded-for is reliably set by the platform and cannot be spoofed.
  const vercelIp = request.headers.get('x-vercel-forwarded-for');
  if (vercelIp) {
    // It can contain a comma-separated list; the left-most is the true client IP provided by Vercel
    return vercelIp.split(',')[0].trim();
  }

  // Reject the request if it doesn't originate from the trusted Vercel proxy
  return null;
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
  if (ip === 'anonymous' || !ip) {
    return NextResponse.json({ error: 'Untrusted client IP' }, { status: 400 });
  }

  // 2. Initialize Supabase client with Service Role Key
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Must use service_role, anon is not allowed

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase Service Role configuration in view counter');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  // 3. Execute DB RPC (Database handles all atomic rate limiting and deduplication)
  const { error } = await supabase.rpc('increment_article_view_count', {
    p_article_id: articleId,
    p_ip_address: ip,
  });

  if (error) {
    console.error('Error incrementing view count via RPC:', error);
    return NextResponse.json({ error: 'Failed to record view' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
