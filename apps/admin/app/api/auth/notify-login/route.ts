import { NextRequest, NextResponse, after } from 'next/server';
import { sendLoginAlertEmail } from '@/lib/mailer';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    let email: string | undefined;
    let displayName: string | undefined;

    // 1. Try to verify via Supabase Bearer token if present
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '').trim();
      const client = createClient(supabaseUrl, serviceRoleKey);
      const { data: userData } = await client.auth.getUser(token);
      if (userData?.user?.email) {
        email = userData.user.email;
        // Lookup display name
        const { data: profile } = await client
          .from('profiles')
          .select('display_name')
          .eq('id', userData.user.id)
          .maybeSingle();
        if (profile?.display_name) {
          displayName = profile.display_name;
        }
      }
    }

    // 2. If token wasn't provided or payload has explicit email
    if (!email) {
      try {
        const body = await request.json();
        if (typeof body?.email === 'string' && body.email.includes('@')) {
          email = body.email.trim();
        }
        if (typeof body?.display_name === 'string' && body.display_name.trim()) {
          displayName = body.display_name.trim();
        }
      } catch {
        // Body was empty or non-json
      }
    }

    if (!email) {
      return NextResponse.json({ error: 'Missing recipient email' }, { status: 400 });
    }

    // Telemetry capture
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor
      ? forwardedFor.split(',')[0].trim()
      : request.headers.get('x-real-ip') || '127.0.0.1 (Local)';
    const userAgent = request.headers.get('user-agent') || 'Web Browser';

    const recipientEmail = email;

    // Dispatch login security notification in the background after the response is sent
    after(async () => {
      try {
        const mailResult = await sendLoginAlertEmail({
          to: recipientEmail,
          displayName,
          loginTime: new Date(),
          ipAddress,
          userAgent,
        });
        console.log('[Auth Notify] Background login alert sent:', mailResult.messageId);
      } catch (err) {
        console.error('[Auth Notify] Background email error:', err);
      }
    });

    // Return immediately to the client so login is 100% instant
    return NextResponse.json({
      success: true,
      queued: true,
    });
  } catch (err: unknown) {
    console.error('Error in /api/auth/notify-login:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown login notification error' },
      { status: 500 }
    );
  }
}
