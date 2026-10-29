import { createClient } from '@supabase/supabase-js';
import { env } from '@kjin/config';
import { sendMfaResetEmail } from '@/lib/mailer';
import crypto from 'node:crypto';

// In-memory store for 15-minute recovery codes: key = user_id, value = { codeHash, expiresAt, attempts }
const recoveryCodes = new Map<string, { codeHash: string; expiresAt: number; attempts: number }>();

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];

    if (!token) {
      return Response.json({ error: 'Sign-in required.' }, { status: 401 });
    }

    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return Response.json({ error: 'Service unavailable' }, { status: 503 });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return Response.json({ error: 'Valid user session required.' }, { status: 401 });
    }

    const userId = userData.user.id;
    const userEmail = userData.user.email;

    const service = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile } = await service
      .from('profiles')
      .select('id, display_name, role_key, status')
      .eq('id', userId)
      .maybeSingle();

    if (!profile || profile.status !== 'active') {
      return Response.json({ error: 'Active employee profile required.' }, { status: 403 });
    }

    const body = (await request.json()) as { action: 'request-code' | 'verify-and-reset'; code?: string };

    if (body.action === 'request-code') {
      // Generate 6-digit recovery code
      const codeNumber = crypto.randomInt(100000, 999999);
      const code = String(codeNumber);
      const codeHash = crypto.createHash('sha256').update(code).digest('hex');
      const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins

      recoveryCodes.set(userId, { codeHash, expiresAt, attempts: 0 });

      // Send via email
      const emailResult = await sendMfaResetEmail({
        to: userEmail || '',
        displayName: profile.display_name || 'Staff Member',
        code,
      });

      if (!emailResult.success) {
        console.error('Failed to send MFA reset email:', emailResult.error);
        return Response.json({ error: 'Failed to dispatch verification email. Please contact an administrator.' }, { status: 500 });
      }

      // Record audit log
      await service.from('audit_logs').insert({
        actor_profile_id: userId,
        action: 'employee.mfa_reset_requested',
        target_type: 'profile',
        target_id: userId,
        result: 'success',
        details: { email: userEmail },
      });

      return Response.json({
        success: true,
        message: `A 6-digit recovery code has been sent to ${userEmail}.`,
      });
    }

    if (body.action === 'verify-and-reset') {
      const code = (body.code || '').trim();
      if (!code || code.length !== 6) {
        return Response.json({ error: 'Please enter a valid 6-digit code.' }, { status: 400 });
      }

      const record = recoveryCodes.get(userId);
      if (!record || Date.now() > record.expiresAt) {
        return Response.json({ error: 'The recovery code has expired. Please request a new code.' }, { status: 400 });
      }

      if (record.attempts >= 5) {
        recoveryCodes.delete(userId);
        return Response.json({ error: 'Too many incorrect attempts. Please request a new code.' }, { status: 429 });
      }

      const inputHash = crypto.createHash('sha256').update(code).digest('hex');
      if (inputHash !== record.codeHash) {
        record.attempts += 1;
        return Response.json({ error: 'Incorrect recovery code. Please check your email and try again.' }, { status: 400 });
      }

      // Code is valid! Delete the recovery code record
      recoveryCodes.delete(userId);

      // Unenroll all TOTP factors for this user
      try {
        const { data: userFactors } = await service.auth.admin.mfa.listFactors({
          userId,
        });

        const all = [...(userFactors?.factors ?? [])];
        for (const factor of all) {
          await service.auth.admin.mfa.deleteFactor({
            id: factor.id,
            userId,
          });
        }
      } catch (adminErr) {
        console.warn('admin.mfa.deleteFactor fallback in self-reset:', adminErr);
      }

      // Write audit log
      await service.from('audit_logs').insert({
        actor_profile_id: userId,
        action: 'employee.mfa_self_reset',
        target_type: 'profile',
        target_id: userId,
        result: 'success',
        reason: 'Employee self-reset MFA via verified email code',
        details: { email: userEmail, role: profile.role_key },
      });

      return Response.json({
        success: true,
        message: 'Authenticator unlinked successfully! Redirecting to scan new QR code...',
        redirect: '/mfa/enroll',
      });
    }

    return Response.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (err) {
    console.error('MFA self-reset error:', err);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
