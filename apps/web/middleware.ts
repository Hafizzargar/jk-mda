import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const LOCALES = ['en', 'ur', 'hi'];
const DEFAULT_LOCALE = 'en';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Generate a nonce for the Strict CSP
  const nonce = crypto.randomUUID();
  
  // Construct the CSP with the nonce
  // - We retain 'unsafe-inline' for styles due to Next.js hydration challenges with styled components
  // - We use 'strict-dynamic' to allow scripts added by nonced scripts (like Sentry)
  // - We allow 'unsafe-eval' only in development for Next.js Fast Refresh
  // - We allow 'blob:' for worker-src so Sentry Session Replay can function
  const isDev = process.env.NODE_ENV !== 'production';
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${isDev ? "'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob: https://*.supabase.co;
    connect-src 'self' https://*.supabase.co wss://*.supabase.co;
    font-src 'self';
    worker-src 'self' blob:;
  `.replace(/\s{2,}/g, ' ').trim();

  // Attach nonce and CSP to request headers so Next.js <Script> tags can pick it up
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  // Check if there is any supported locale in the pathname
  const pathnameIsMissingLocale = LOCALES.every(
    (locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
  );

  let response: NextResponse;

  // If missing, rewrite to default locale (en) so URLs remain clean (e.g. /politics -> /en/politics)
  if (pathnameIsMissingLocale) {
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = `/${DEFAULT_LOCALE}${pathname}`;
    response = NextResponse.rewrite(nextUrl, {
      request: {
        headers: requestHeaders,
      },
    });
  } else {
    response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // Also attach the CSP to the response headers so the browser enforces it
  response.headers.set('Content-Security-Policy', cspHeader);

  return response;
}

export const config = {
  matcher: [
    // Apply to all paths except Next.js internals, API routes, admin, and files with extensions
    '/((?!_next|api|admin|.*\\.).*)',
  ],
};
