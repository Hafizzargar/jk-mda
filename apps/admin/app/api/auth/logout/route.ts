import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully. All authentication cookies cleared.',
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    // 1. Terminate session via Supabase SSR client so token is invalidated server-side
    if (supabaseAnonKey) {
      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      });

      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (err) {
        console.warn('[Logout API] Supabase signOut warning:', err);
      }
    }

    // 2. Explicitly expire any remaining server-managed HttpOnly auth cookies (including chunked tokens)
    const requestCookies = request.cookies.getAll();
    const isAuthCookie = (name: string) =>
      name.startsWith('sb-') ||
      name.includes('auth-token') ||
      name.includes('supabase') ||
      name === 'sb-access-token' ||
      name === 'sb-refresh-token';

    for (const cookie of requestCookies) {
      if (isAuthCookie(cookie.name)) {
        response.cookies.set(cookie.name, '', {
          path: '/',
          maxAge: 0,
          expires: new Date(0),
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        });
        response.cookies.delete(cookie.name);
      }
    }

    // Also explicitly expire common standard Supabase fallback cookie names
    const fallbackCookieNames = [
      'sb-access-token',
      'sb-refresh-token',
      'sb-127-auth-token',
      'sb-localhost-auth-token',
      'supabase-auth-token',
    ];
    for (const name of fallbackCookieNames) {
      response.cookies.set(name, '', {
        path: '/',
        maxAge: 0,
        expires: new Date(0),
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
      response.cookies.delete(name);
    }

    return response;
  } catch (err: unknown) {
    console.error('[Logout API] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Logout processing error' },
      { status: 500 }
    );
  }
}
