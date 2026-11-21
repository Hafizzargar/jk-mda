// Ensure global self is defined in all runtimes (Edge / Node.js emulation)
if (typeof (globalThis as unknown as { self: unknown }).self === 'undefined') {
  (globalThis as unknown as { self: unknown }).self = globalThis;
}

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { buildCspHeader } from './lib/csp';
import { getArticleRedirectPath } from './lib/article-redirects';

const LOCALES = ['en'];
const DEFAULT_LOCALE = 'en';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ignore static assets, internal endpoints, .well-known (Chrome devtools), and files with extensions
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/monitoring') ||
    pathname.startsWith('/.well-known') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Gracefully 301 redirect legacy non-English locales (/ur, /ks, /hi) directly to English (/en)
  const legacyMatch = pathname.match(/^\/(?:ur|ks|hi)(?:\/|$)(.*)/);
  if (legacyMatch) {
    const remaining = legacyMatch[1] ? `/${legacyMatch[1]}` : '';
    const redirectUrl = new URL(`/en${remaining}`, request.url);
    redirectUrl.search = request.nextUrl.search;
    return NextResponse.redirect(redirectUrl, 301);
  }

  const articleRedirectPath = getArticleRedirectPath(pathname);
  if (articleRedirectPath) {
    const redirectUrl = new URL(articleRedirectPath, request.url);
    redirectUrl.search = request.nextUrl.search;
    return NextResponse.redirect(redirectUrl, 301);
  }

  // Instant 301 redirect for known messy slugs and malformed categories
  if (pathname.includes('2-31-1j47-ca84')) {
    const redirectUrl = new URL('/en/international/india-calls-for-equitable-second-global-stocktake-cop31', request.url);
    return NextResponse.redirect(redirectUrl, 301);
  }
  if (pathname.includes('doda-mla-mehraj-malik-demands-accountability-for-crippling-power-water-crisis-pxid')) {
    const redirectUrl = new URL('/en/doda/mla-mehraj-malik-power-water-crisis', request.url);
    return NextResponse.redirect(redirectUrl, 301);
  }
  if (pathname.includes('kishtwar-rocked-bullet-riddled-bodies-of-two-special-police-5wdd-rbxr')) {
    const redirectUrl = new URL('/en/kishtwar/two-spos-found-dead-investigation', request.url);
    return NextResponse.redirect(redirectUrl, 301);
  }
  if (pathname.includes('gmc-doda-advanced-trauma-dialysis-wing-commissioned-chenab-relief-1qkn')) {
    const redirectUrl = new URL('/en/doda/gmc-doda-advanced-trauma-dialysis-wing-commissioned', request.url);
    return NextResponse.redirect(redirectUrl, 301);
  }
  if (pathname.includes('bhaderwah-under-simulated-lockdown-police-crpf-test-emergenc-nzpz-k7z4')) {
    const redirectUrl = new URL('/en/bhaderwah/bhaderwah-emergency-response-drill', request.url);
    return NextResponse.redirect(redirectUrl, 301);
  }
  if (pathname.includes('science-&-technology') || pathname.includes('science-technology')) {
    const cleaned = pathname.replace('science-&-technology', 'science').replace('science-technology', 'science');
    const target = cleaned.startsWith('/en') ? cleaned : `/en${cleaned}`;
    const redirectUrl = new URL(target, request.url);
    return NextResponse.redirect(redirectUrl, 301);
  }

  // Generate a nonce for the Strict CSP
  const nonce = crypto.randomUUID();
  const cspHeader = buildCspHeader({ nonce });

  // Attach nonce and CSP to request headers so Next.js <Script> tags can pick it up
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  // Check if there is any supported locale in the pathname
  const pathnameIsMissingLocale = LOCALES.every(
    (locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
  );

  // If missing, 301 redirect to default locale (/en) so search engines index ONE canonical copy
  if (pathnameIsMissingLocale) {
    const targetPath = pathname === '/' ? `/${DEFAULT_LOCALE}` : `/${DEFAULT_LOCALE}${pathname}`;
    const redirectUrl = new URL(targetPath, request.url);
    redirectUrl.search = request.nextUrl.search;
    return NextResponse.redirect(redirectUrl, 301);
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Attach CSP to the response headers so the browser enforces it
  response.headers.set('Content-Security-Policy', cspHeader);

  return response;
}

export const config = {
  matcher: [
    // Apply to all paths except Next.js internals, API routes, admin, monitoring, .well-known, and files with extensions
    '/((?!_next|api|admin|monitoring|\\.well-known|.*\\.).*)',
  ],
};
