export const PRODUCTION_SUPABASE_PROJECT_ID = 'ptvfidufwlswbjgsjvzl';
export const AUTHORIZED_SUPABASE_HOST = `${PRODUCTION_SUPABASE_PROJECT_ID}.supabase.co`;

export interface CspOptions {
  nonce: string;
  isDev?: boolean;
  env?: Record<string, string | undefined>;
}

/**
 * Builds the Content Security Policy (CSP) header for the public website.
 * Enforces strict origin restrictions in production:
 * - Restricts Supabase connections strictly to the authorized production project (no *.supabase.co wildcard).
 * - Restricts remote images strictly to authorized project storage and trusted media CDNs.
 * - Blocks loopback / localhost in production.
 * - Enables 'unsafe-eval' for Fast Refresh and local connections only in development.
 */
export function buildCspHeader(options: CspOptions): string {
  const env = options.env ?? process.env;
  const isDev =
    options.isDev ??
    (env.NODE_ENV !== undefined ? env.NODE_ENV !== 'production' : process.env.NODE_ENV !== 'production');

  const trustedImageHosts = [
    `https://${PRODUCTION_SUPABASE_PROJECT_ID}.supabase.co`,
    'https://kjin.in',
    'https://media.kjin.in',
    'https://kjin.org',
    'https://cdn.kjin.org',
    'https://media.kjin.org',
    'https://images.unsplash.com',
    'https://lh3.googleusercontent.com',
    'https://lh4.googleusercontent.com',
    'https://lh5.googleusercontent.com',
    'https://lh6.googleusercontent.com',
    'https://tiles.openfreemap.org',
    'https://i.ytimg.com',
    'https://i1.ytimg.com',
    'https://i2.ytimg.com',
    'https://i3.ytimg.com',
    'https://i4.ytimg.com',
    'https://img.youtube.com',
    'https://ytimg.googleusercontent.com',
  ];

  const trustedConnectHosts = [
    `https://${PRODUCTION_SUPABASE_PROJECT_ID}.supabase.co`,
    `wss://${PRODUCTION_SUPABASE_PROJECT_ID}.supabase.co`,
    'https://tiles.openfreemap.org',
    'https://earthquake.usgs.gov',
    'https://api.open-meteo.com',
  ];

  if (isDev) {
    trustedImageHosts.push(
      'http://localhost:*',
      'http://127.0.0.1:*',
      'https://kjin-staging-test.supabase.co',
      'https://kjin-isolated-test.supabase.co'
    );
    trustedConnectHosts.push(
      'http://localhost:*',
      'http://127.0.0.1:*',
      'ws://localhost:*',
      'ws://127.0.0.1:*',
      'https://kjin-staging-test.supabase.co',
      'wss://kjin-staging-test.supabase.co',
      'https://kjin-isolated-test.supabase.co',
      'wss://kjin-isolated-test.supabase.co'
    );

    if (env.NEXT_PUBLIC_SUPABASE_URL) {
      try {
        const parsed = new URL(
          env.NEXT_PUBLIC_SUPABASE_URL.startsWith('http')
            ? env.NEXT_PUBLIC_SUPABASE_URL
            : `https://${env.NEXT_PUBLIC_SUPABASE_URL}`
        );
        const origin = parsed.origin;
        const wsOrigin = origin.replace(/^http/, 'ws');
        if (!trustedConnectHosts.includes(origin)) {
          trustedConnectHosts.push(origin, wsOrigin);
        }
        if (!trustedImageHosts.includes(origin)) {
          trustedImageHosts.push(origin);
        }
      } catch {
        // ignore malformed env URL
      }
    }
  }

  // Parse extra allowed image hosts if configured
  if (env.ALLOWED_IMAGE_HOSTS) {
    const extra = env.ALLOWED_IMAGE_HOSTS.split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
    for (const h of extra) {
      let host = h;
      if (h.includes('://')) {
        try {
          const u = new URL(h);
          if (u.protocol !== 'https:') continue;
          if (u.username || u.password) continue;
          host = u.hostname.toLowerCase();
        } catch {
          continue;
        }
      } else {
        host = h.replace(/^\/+|\/+$/g, '');
      }
      if (!host || host.includes('*')) continue;
      if (
        !isDev &&
        (host === 'localhost' ||
          host === '127.0.0.1' ||
          host === '0.0.0.0' ||
          host === '::1' ||
          host === '[::1]')
      ) {
        continue;
      }
      // In production, reject any *.supabase.co hostname other than the
      // exclusively authorized production project to prevent foreign-tenant bypass.
      if (!isDev && host.endsWith('.supabase.co') && host !== AUTHORIZED_SUPABASE_HOST) {
        continue;
      }
      const fullOrigin = `https://${host}`;
      if (!trustedImageHosts.includes(fullOrigin)) {
        trustedImageHosts.push(fullOrigin);
      }
    }
  }

  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${options.nonce}' 'strict-dynamic' ${isDev ? "'unsafe-eval'" : ''}`.trim(),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `img-src 'self' data: blob: ${trustedImageHosts.join(' ')}`,
    `connect-src 'self' ${trustedConnectHosts.join(' ')}`,
    "font-src 'self' https://fonts.gstatic.com data:",
    "object-src 'none'",
    "worker-src 'self' blob:",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  return cspDirectives.join('; ').replace(/\s{2,}/g, ' ').trim();
}
