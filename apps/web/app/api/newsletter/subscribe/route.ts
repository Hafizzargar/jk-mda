import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireEnv } from '@kjin/config';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
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
