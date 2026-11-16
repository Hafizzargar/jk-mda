import { createClient } from '@supabase/supabase-js';
import { env } from '@kjin/config';
import { sendLoginOtpEmail } from '@/lib/mailer';
import crypto from 'node:crypto';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];

    const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string };

    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return Response.json({ error: 'Database service unavailable' }, { status: 503 });
    }

    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let targetUserId: string | null = null;
    let targetEmail: string | null = null;
    let targetDisplayName: string = 'KJCPL Employee';

    if (token) {
      const userClient = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: userData } = await userClient.auth.getUser(token);
      if (userData?.user) {
        targetUserId = userData.user.id;
        targetEmail = userData.user.email ?? null;
        targetDisplayName = userData.user.user_metadata?.display_name || 'Staff Member';
      }
    }

    if (!targetUserId && body.email) {
      const normalizedEmail = body.email.toLowerCase().trim();
      const { data: profiles } = await service
        .from('profiles')
        .select('id, email, display_name, status')
        .eq('email', normalizedEmail)
        .eq('status', 'active')
        .limit(1);

      if (profiles && profiles.length > 0) {
        targetUserId = profiles[0].id;
        targetEmail = profiles[0].email;
        targetDisplayName = profiles[0].display_name || 'Staff Member';
      }
    }

    if (!targetUserId || !targetEmail) {
      return Response.json({ error: 'No active employee account found with this email.' }, { status: 404 });
    }

    // Generate cryptographically secure 6-digit code
    const codeNumber = crypto.randomInt(100000, 999999);
    const code = String(codeNumber);
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Save hash to user_metadata
    await service.auth.admin.updateUserById(targetUserId, {
      user_metadata: {
        email_otp_hash: codeHash,
        email_otp_expires_at: expiresAt,
        email_otp_attempts: 0,
      },
    });

    // Send email via Nodemailer
    const mailResult = await sendLoginOtpEmail({
      to: targetEmail,
      displayName: targetDisplayName,
      code,
    });

    if (!mailResult.success) {
      console.warn('[OTP Mailer Warning]: Nodemailer dispatch failed, falling back to Supabase auth OTP:', mailResult.error);
      const { error: sbOtpErr } = await service.auth.signInWithOtp({ email: targetEmail });
      if (sbOtpErr) {
        console.error('[OTP Fallback Error]:', sbOtpErr);
        return Response.json({ error: 'Failed to dispatch email verification code. Please check SMTP settings.' }, { status: 500 });
      }
    }

    // Return masked email
    const parts = targetEmail.split('@');
    const masked = parts[0].slice(0, 3) + '***@' + parts[1];

    return Response.json({
      success: true,
      message: `Verification code sent to ${masked}`,
      email: masked,
    });
  } catch (error) {
    console.error('[OTP Send Error]:', error);
    return Response.json({ error: 'Internal server error processing OTP request.' }, { status: 500 });
  }
}
