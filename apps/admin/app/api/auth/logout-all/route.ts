import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyLogoutToken } from '@/lib/auth-tokens';

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for global session revocation.');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request: Request) {
  try {
    const sb = getServiceSupabase();
    let targetUserId: string | null = null;
    let authHeaderJwt: string | null = null;

    // 1. Try to read payload (uid, exp, sig) from signed email link
    try {
      const body = await request.json();
      if (body?.uid && body?.exp && body?.sig) {
        const isValid = verifyLogoutToken(
          String(body.uid),
          Number(body.exp),
          String(body.sig)
        );
        if (isValid) {
          targetUserId = String(body.uid);
        } else {
          return NextResponse.json({ error: 'Invalid or expired logout token.' }, { status: 403 });
        }
      }
    } catch {
      // Body wasn't json or empty
    }

    // 2. Fallback: Authenticate caller using Authorization Bearer token
    if (!targetUserId) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        authHeaderJwt = authHeader.slice(7).trim();
        const { data: userData, error: userError } = await sb.auth.getUser(authHeaderJwt);
        if (!userError && userData?.user?.id) {
          targetUserId = userData.user.id;
        }
      }
    }

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'Unauthorized. Missing valid security signature or active session.' },
        { status: 401 }
      );
    }

    // 3. Execute Postgres RPC function to delete all active sessions & refresh tokens
    const { data: rpcResult, error: rpcError } = await sb.rpc('revoke_all_user_sessions', {
      target_user_id: targetUserId,
    });

    if (rpcError) {
      console.error('[Logout All] RPC revoke error:', rpcError);
      return NextResponse.json(
        { error: 'Failed to revoke active sessions in database.' },
        { status: 500 }
      );
    }

    // 4. Also call Supabase admin signOut if JWT is known
    if (authHeaderJwt) {
      try {
        await sb.auth.admin.signOut(authHeaderJwt, 'global');
      } catch (err) {
        console.warn('[Logout All] Admin signOut warn:', err);
      }
    }

    // 5. Create response and clear any session cookies on the caller's browser
    const response = NextResponse.json({
      success: true,
      message: 'All active sessions and refresh tokens have been revoked globally.',
      details: rpcResult,
    });

    // Clear standard Supabase auth cookies
    const cookieNames = [
      'sb-access-token',
      'sb-refresh-token',
      'sb-127-auth-token',
      'sb-localhost-auth-token',
      'supabase-auth-token',
    ];
    for (const name of cookieNames) {
      response.cookies.delete(name);
    }

    return response;
  } catch (err: unknown) {
    console.error('[Logout All] Unhandled error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal session revocation error.' },
      { status: 500 }
    );
  }
}
