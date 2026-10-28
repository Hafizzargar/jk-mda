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
    // Apply to all paths except Next.js internals, API routes, admin, monitoring, and files with extensions
    '/((?!_next|api|admin|monitoring|.*\\.).*)',
  ],
};
