// Ensure global self is defined in all runtimes (Edge / Node.js emulation)
if (typeof (globalThis as unknown as { self: unknown }).self === 'undefined') {
  (globalThis as unknown as { self: unknown }).self = globalThis;
}

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { buildCspHeader } from './lib/csp';

const LOCALES = ['en', 'ur', 'ks', 'hi'];
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

  // If missing, redirect to default locale (en) so the App Router [lang] root layout resolves seamlessly
  if (pathnameIsMissingLocale) {
    const targetPath = pathname === '/' ? `/${DEFAULT_LOCALE}` : `/${DEFAULT_LOCALE}${pathname}`;
    const redirectUrl = new URL(targetPath, request.url);
    redirectUrl.search = request.nextUrl.search;
    return NextResponse.redirect(redirectUrl);
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
