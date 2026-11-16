import { createClient } from '@supabase/supabase-js';
import { env } from '@kjin/config';
import crypto from 'node:crypto';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];

    const body = (await request.json().catch(() => ({}))) as { email?: string; code?: string };

    if (!body.code || body.code.length !== 6) {
      return Response.json({ error: 'Please enter a valid 6-digit verification code.' }, { status: 400 });
    }

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

    if (token) {
      const userClient = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: userData } = await userClient.auth.getUser(token);
      if (userData?.user) {
        targetUserId = userData.user.id;
      }
    }

    if (!targetUserId && body.email) {
      const normalizedEmail = body.email.toLowerCase().trim();
      const { data: profiles } = await service
        .from('profiles')
        .select('id, email, status')
        .eq('email', normalizedEmail)
        .eq('status', 'active')
        .limit(1);

      if (profiles && profiles.length > 0) {
        targetUserId = profiles[0].id;
      }
    }

    if (!targetUserId) {
      return Response.json({ error: 'Session expired. Please sign in again.' }, { status: 401 });
    }

    const { data: userData, error: userErr } = await service.auth.admin.getUserById(targetUserId);
    if (userErr || !userData.user) {
      return Response.json({ error: 'Unable to locate user account.' }, { status: 404 });
    }

    const meta = userData.user.user_metadata || {};
    const savedHash = meta.email_otp_hash;
    const expiresAt = Number(meta.email_otp_expires_at) || 0;
    const attempts = Number(meta.email_otp_attempts) || 0;

    if (!savedHash || Date.now() > expiresAt) {
      return Response.json({ error: 'Verification code has expired. Please request a new code.' }, { status: 400 });
    }

    if (attempts >= 5) {
      return Response.json({ error: 'Too many incorrect attempts. Please request a new code.' }, { status: 429 });
    }

    const incomingHash = crypto.createHash('sha256').update(body.code.trim()).digest('hex');
    if (incomingHash !== savedHash) {
      await service.auth.admin.updateUserById(targetUserId, {
        user_metadata: {
          ...meta,
          email_otp_attempts: attempts + 1,
        },
      });
      return Response.json({ error: 'Invalid verification code. Please check your email and try again.' }, { status: 400 });
    }

    // Success! Clear OTP from metadata and mark verified
    await service.auth.admin.updateUserById(targetUserId, {
      user_metadata: {
        ...meta,
        email_otp_hash: null,
        email_otp_expires_at: null,
        email_otp_attempts: 0,
        email_otp_verified_at: Date.now(),
      },
    });

    return Response.json({
      success: true,
      message: 'Verification successful.',
    });
  } catch (error) {
    console.error('[OTP Verify Error]:', error);
    return Response.json({ error: 'Internal server error verifying code.' }, { status: 500 });
  }
}
