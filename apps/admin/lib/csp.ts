export const PRODUCTION_SUPABASE_PROJECT_ID = 'ptvfidufwlswbjgsjvzl';
export const AUTHORIZED_SUPABASE_HOST = `${PRODUCTION_SUPABASE_PROJECT_ID}.supabase.co`;

export interface AdminCspOptions {
  nonce: string;
  isDev?: boolean;
  env?: Record<string, string | undefined>;
}

/**
 * Builds the strict Content Security Policy (CSP) header for the Admin dashboard.
 * Enforces nonce-based script execution in production:
 * - Employs 'strict-dynamic' with per-request cryptographic nonces (blocks unauthorized scripts & XSS).
 * - Disallows 'unsafe-inline' in production script-src.
 * - Allows 'unsafe-eval' strictly during development for Next.js Fast Refresh / HMR.
 * - Restricts remote storage to authorized Supabase host and trusted assets.
 */
export function buildAdminCspHeader(options: AdminCspOptions): string {
  const env = options.env ?? process.env;
  const isDev =
    options.isDev ??
    (env.NODE_ENV !== undefined ? env.NODE_ENV !== 'production' : process.env.NODE_ENV !== 'production');

  let supabaseHost = AUTHORIZED_SUPABASE_HOST;
  if (env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const parsed = new URL(
        env.NEXT_PUBLIC_SUPABASE_URL.startsWith('http')
          ? env.NEXT_PUBLIC_SUPABASE_URL
          : `https://${env.NEXT_PUBLIC_SUPABASE_URL}`
      );
      supabaseHost = parsed.host;
    } catch {
      supabaseHost = AUTHORIZED_SUPABASE_HOST;
    }
  }

  const imgSrc = [
    "'self'",
    'data:',
    'blob:',
    `https://${supabaseHost}/storage/v1/object/public/`,
    'https://images.unsplash.com',
    'https://i.ytimg.com',
    'https://i1.ytimg.com',
    'https://i2.ytimg.com',
    'https://i3.ytimg.com',
    'https://i4.ytimg.com',
    'https://img.youtube.com',
    'https://ytimg.googleusercontent.com',
    ...(isDev ? ['http://localhost:*', 'http://127.0.0.1:*'] : []),
  ].join(' ');

  const connectSrc = [
    "'self'",
    `https://${supabaseHost}`,
    `wss://${supabaseHost}`,
    ...(isDev ? ['http://localhost:*', 'ws://localhost:*', 'http://127.0.0.1:*', 'ws://127.0.0.1:*'] : []),
  ].join(' ');

  const scriptSrc = isDev
    ? `'self' 'nonce-${options.nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `'self' 'nonce-${options.nonce}' 'strict-dynamic'`;

  const cspDirectives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc}`,
    `connect-src ${connectSrc}`,
    "font-src 'self' data:",
    "object-src 'none'",
    "worker-src 'self' blob:",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  return cspDirectives.join('; ').replace(/\s{2,}/g, ' ').trim();
}
