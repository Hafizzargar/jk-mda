import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { requiresMfa } from '@/lib/mfa';
import { buildAdminCspHeader } from '@/lib/csp';

export async function middleware(request: NextRequest) {
  // Generate a cryptographically secure random nonce for this request
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const cspHeader = buildAdminCspHeader({ nonce });

  // Attach nonce and CSP to request headers so Next.js internals pick up the nonce for inline bootstrap scripts
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  const applySecurityHeaders = (res: NextResponse) => {
    res.headers.set('X-Content-Type-Options', 'nosniff');
    res.headers.set('X-Frame-Options', 'DENY');
    res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.headers.set('Content-Security-Policy', cspHeader);
  };

  let supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
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
            request: {
              headers: requestHeaders,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
          applySecurityHeaders(supabaseResponse);
        },
      },
    }
  );

  applySecurityHeaders(supabaseResponse);

  const { pathname } = request.nextUrl;
  
  // Skip middleware auth checks for API routes, Next.js internal assets, and static files
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    /\.(?:css|js|map|json|svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$/i.test(pathname)
  ) {
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
    // Check MFA requirement and active status
    const { data: profile, error: profileError } = await supabase.from('profiles').select('role_key, status').eq('id', user.id).single();
    
    if (profileError || !profile || profile.status !== 'active') {
      // Fail closed if we cannot determine the user's role or they are disabled
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    const isMfaRoute = pathname.startsWith('/mfa/');
    
    if (!isMfaRoute) {
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
    '/((?!_next|favicon.ico|.*\\.(?:css|js|map|json|svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)',
  ],
};
