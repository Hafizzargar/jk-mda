import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireEnv } from '@kjin/config';
import { extractClientIp } from '@/lib/ip';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const ip = extractClientIp(request);
    
    if (!ip) {
      return NextResponse.json({ error: 'Untrusted client IP' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body.email !== 'string') {
      return NextResponse.json(
        { error: 'Valid email address is required.' },
        { status: 400 }
      );
    }

    const email = body.email.trim().toLowerCase();
    if (email.length > 254 || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format.' },
        { status: 400 }
      );
    }

    // Server-only privileged client. Never expose this key to the browser.
    const supabase = createClient(
      requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    // 1. IP and Rate Limiting
    const { data: allowed, error: rateLimitError } = await supabase.rpc('check_newsletter_rate_limit', {
      p_ip_address: ip
    });

    if (rateLimitError) {
      console.error('Newsletter rate limiting check failed:', rateLimitError);
      return NextResponse.json(
        { error: 'A server error occurred. Please try again later.' },
        { status: 500 }
      );
    }

    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const { error } = await supabase
      .from('newsletter_subscribers')
      .upsert(
        { email, unsubscribed_at: null },
        { onConflict: 'email', ignoreDuplicates: true }
      );

    if (error) {
      console.error('Newsletter database operation failed:', error.code);
      return NextResponse.json(
        { error: 'Could not save your subscription. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Your subscription has been recorded.',
    });
  } catch (error) {
    console.error('Newsletter subscription failed:', error);
    return NextResponse.json(
      { error: 'A server error occurred. Please try again later.' },
      { status: 500 }
    );
  }
}
