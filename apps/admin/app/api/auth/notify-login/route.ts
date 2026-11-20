import { NextRequest, NextResponse, after } from 'next/server';
import { sendLoginAlertEmail } from '@/lib/mailer';
import { createLogoutToken } from '@/lib/auth-tokens';
import { extractClientIp } from '@/lib/ip';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Deduplication cache: prevent duplicate security emails sent to the same recipient within 60 seconds
const recentNotifications = new Map<string, number>();

function pruneRecentNotifications() {
  const cutoff = Date.now() - 300_000; // 5 minutes
  for (const [key, timestamp] of recentNotifications.entries()) {
    if (timestamp < cutoff) {
      recentNotifications.delete(key);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    let email: string | undefined;
    let displayName: string | undefined;
    let userId: string | undefined;

    const client = createClient(supabaseUrl, serviceRoleKey);

    // 1. Try to verify via Supabase Bearer token if present
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '').trim();
      const { data: userData } = await client.auth.getUser(token);
      if (userData?.user?.email) {
        email = userData.user.email;
        userId = userData.user.id;
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

    // Lookup user id by email if not found from token
    if (!userId) {
      const { data: profile } = await client
        .from('profiles')
        .select('id, display_name')
        .eq('email', email)
        .maybeSingle();
      if (profile?.id) {
        userId = profile.id;
        if (!displayName && profile.display_name) {
          displayName = profile.display_name;
        }
      }
    }

    // Telemetry capture: extract valid IPv4/IPv6 for PostgreSQL inet column
    const validIp = extractClientIp(request);
    const ipDisplay = validIp || '127.0.0.1 (Local)';
    const userAgent = request.headers.get('user-agent') || 'Web Browser';

    const recipientEmail = email;

    // Deduplication check: only send at most one alert email per recipient every 60 seconds
    const recipientKey = recipientEmail.toLowerCase().trim();
    const lastSent = recentNotifications.get(recipientKey);
    const now = Date.now();
    if (lastSent && now - lastSent < 60_000) {
      return NextResponse.json({
        success: true,
        deduplicated: true,
        message: 'Security login notification already sent within last 60 seconds',
      });
    }
    recentNotifications.set(recipientKey, now);
    pruneRecentNotifications();

    // Determine the active admin domain dynamically from request headers or environment
    const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
    const originHeader = request.headers.get('origin') || request.headers.get('referer');

    let effectiveAdminUrl = '';
    if (originHeader && originHeader.startsWith('http') && !originHeader.includes('localhost')) {
      try {
        const u = new URL(originHeader);
        effectiveAdminUrl = `${u.protocol}//${u.host}`;
      } catch {
        effectiveAdminUrl = '';
      }
    }

    if (!effectiveAdminUrl && forwardedHost && !forwardedHost.includes('localhost')) {
      effectiveAdminUrl = `${forwardedProto}://${forwardedHost}`.replace(/\/+$/, '');
    }

    if (!effectiveAdminUrl && request.nextUrl?.origin && !request.nextUrl.origin.includes('localhost')) {
      effectiveAdminUrl = request.nextUrl.origin.replace(/\/+$/, '');
    }

    if (!effectiveAdminUrl) {
      effectiveAdminUrl = (process.env.NEXT_PUBLIC_ADMIN_URL || 'https://jk-mda-admin.vercel.app').replace(/\/+$/, '');
    }

    // Safety fallback: if configured with unrouted admin.kjin.in, fallback to live Vercel domain
    if (effectiveAdminUrl.includes('admin.kjin.in')) {
      effectiveAdminUrl = 'https://jk-mda-admin.vercel.app';
    }

    // Generate cryptographically signed one-click logout link for all devices
    let logoutUrl = `${effectiveAdminUrl}/auth/logout-all`;
    if (userId) {
      const tokenData = createLogoutToken(userId);
      logoutUrl = `${effectiveAdminUrl}/auth/logout-all?uid=${encodeURIComponent(
        tokenData.uid
      )}&sig=${encodeURIComponent(tokenData.sig)}&exp=${tokenData.exp}`;
    }

    // Dispatch login security notification with persistent retry and delivery failure monitoring
    after(async () => {
      const maxAttempts = 3;
      let attempt = 0;
      let delivered = false;
      let lastError: Error | null = null;
      let messageId: string | undefined;

      while (attempt < maxAttempts && !delivered) {
        attempt++;
        try {
          const mailResult = await sendLoginAlertEmail({
            to: recipientEmail,
            displayName,
            loginTime: new Date(),
            ipAddress: ipDisplay,
            userAgent,
            logoutUrl,
          });
          messageId = mailResult.messageId;
          delivered = true;
        } catch (err: unknown) {
          lastError = err instanceof Error ? err : new Error(String(err));
          console.warn(`[Auth Notify] Attempt ${attempt}/${maxAttempts} failed:`, lastError.message);
          if (attempt < maxAttempts) {
            // Exponential backoff before next attempt: 500ms, 1000ms
            await new Promise((res) => setTimeout(res, attempt * 500));
          }
        }
      }

      // Record definitive delivery status in persistent audit_logs table
      try {
        if (delivered) {
          await client.from('audit_logs').insert({
            actor_profile_id: userId || null,
            action: 'auth.login_notification_sent',
            target_type: 'security_notification',
            target_id: userId || null,
            result: 'success',
            reason: 'Login security notification email sent successfully',
            ip_address: validIp,
            user_agent: userAgent,
            details: {
              to: recipientEmail,
              messageId,
              attempts: attempt,
              delivered_at: new Date().toISOString(),
            },
          });
          console.log('[Auth Notify] Background login alert delivered and logged:', messageId);
        } else {
          // Log persistent delivery failure so monitoring services / admins can alert or retry
          await client.from('audit_logs').insert({
            actor_profile_id: userId || null,
            action: 'auth.login_notification_failed',
            target_type: 'security_notification',
            target_id: userId || null,
            result: 'failure',
            reason: lastError?.message || 'Email delivery failed after max retries',
            ip_address: validIp,
            user_agent: userAgent,
            details: {
              to: recipientEmail,
              attempts: attempt,
              error: lastError?.message || 'Unknown delivery failure',
              failed_at: new Date().toISOString(),
              requires_retry: true,
            },
          });
          console.error('[Auth Notify] Background email failed after retries and recorded in audit_logs:', lastError);
        }
      } catch (auditErr) {
        console.error('[Auth Notify] Failed to record delivery status in audit_logs:', auditErr);
      }
    });

    // Return immediately to the client so login UX remains instant and non-blocking
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

/**
 * GET handler to monitor security notification delivery status from audit logs.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }

    const client = createClient(supabaseUrl, serviceRoleKey);
    const token = authHeader.replace('Bearer ', '').trim();
    const { data: userData, error: userError } = await client.auth.getUser(token);

    if (userError || !userData?.user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Fetch recent 50 notification events
    const { data: logs, error: logsError } = await client
      .from('audit_logs')
      .select('id, actor_profile_id, action, result, reason, ip_address, user_agent, details, created_at')
      .in('action', ['auth.login_notification_sent', 'auth.login_notification_failed'])
      .order('created_at', { ascending: false })
      .limit(50);

    if (logsError) {
      return NextResponse.json({ error: logsError.message }, { status: 500 });
    }

    const total = logs?.length || 0;
    const delivered = logs?.filter((l) => l.result === 'success').length || 0;
    const failed = logs?.filter((l) => l.result === 'failure').length || 0;

    return NextResponse.json({
      summary: {
        total,
        delivered,
        failed,
      },
      recent: logs,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Monitoring query failed' },
      { status: 500 }
    );
  }
}
