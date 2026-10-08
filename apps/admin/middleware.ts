import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { requiresMfa } from '@/lib/mfa';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Security Headers
  supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff');
  supabaseResponse.headers.set('X-Frame-Options', 'DENY');
  supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  supabaseResponse.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  supabaseResponse.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:;"
  );

  const { pathname } = request.nextUrl;
  
  // Skip middleware auth checks for API routes as they handle their own auth
  if (pathname.startsWith('/api/')) {
    return supabaseResponse;
  }

  // getUser verifies the token against the Supabase Auth server.
  // This ensures disabled/banned users immediately lose access without waiting for JWT expiry.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = pathname === '/login';

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (user) {
    const isMfaRoute = pathname.startsWith('/mfa/');
    
    if (!isMfaRoute) {
      // Check MFA requirement
      const { data: profile } = await supabase.from('profiles').select('role_key').eq('id', user.id).single();
      
      if (profile && requiresMfa(profile.role_key)) {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          // Decode AAL from JWT
          try {
            const tokenPayload = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url').toString('utf8'));
            const currentAal = tokenPayload.aal;
            
            if (currentAal !== 'aal2') {
              const url = request.nextUrl.clone();
              
              const { data: factors } = await supabase.auth.mfa.listFactors();
              const hasVerifiedFactor = factors?.totp?.some(f => f.status === 'verified');
              
              url.pathname = hasVerifiedFactor ? '/mfa/challenge' : '/mfa/enroll';
              url.searchParams.set('next', pathname);
              return NextResponse.redirect(url);
            }
          } catch (e) {
            // If we can't parse the token, force re-login
            const url = request.nextUrl.clone();
            url.pathname = '/login';
            return NextResponse.redirect(url);
          }
        }
      }
    }

    if (isAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
