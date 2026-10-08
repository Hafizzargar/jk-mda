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
  
  const isDev = process.env.NODE_ENV === 'development';
  supabaseResponse.headers.set(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:;`
  );

  const { pathname } = request.nextUrl;
  
  // Skip middleware auth checks for API routes as they handle their own auth
  if (pathname.startsWith('/api/')) {
    return supabaseResponse;
  }

  // getUser verifies the token against the Supabase Auth server.
  // This ensures disabled/banned users immediately lose access without waiting for JWT expiry.
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;

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
      const { data: profile, error: profileError } = await supabase.from('profiles').select('role_key').eq('id', user.id).single();
      
      if (profileError || !profile) {
        // Fail closed if we cannot determine the user's role
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
      }
      
      if (requiresMfa(profile.role_key)) {
        const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        if (aalError || !aalData) {
          // Fail closed
          const url = request.nextUrl.clone();
          url.pathname = '/login';
          return NextResponse.redirect(url);
        }
        
        if (aalData.currentLevel !== 'aal2') {
          const url = request.nextUrl.clone();
          
          const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
          if (factorsError) {
            // Fail closed if we can't determine MFA enrollment status
            url.pathname = '/login';
            return NextResponse.redirect(url);
          }
          
          const hasVerifiedFactor = factors?.totp?.some(f => f.status === 'verified');
          
          url.pathname = hasVerifiedFactor ? '/mfa/challenge' : '/mfa/enroll';
          url.searchParams.set('next', pathname);
          return NextResponse.redirect(url);
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
