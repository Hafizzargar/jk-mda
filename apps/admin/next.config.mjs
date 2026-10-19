export const PRODUCTION_SUPABASE_PROJECT_ID = 'ptvfidufwlswbjgsjvzl';
export const AUTHORIZED_SUPABASE_HOST = `${PRODUCTION_SUPABASE_PROJECT_ID}.supabase.co`;

const configuredSupabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
  : AUTHORIZED_SUPABASE_HOST;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            // NOTE: The middleware generates a richer, env-aware CSP that
            // overrides this header at request time for all authenticated routes.
            // This static fallback covers Next.js error pages and any edge-case
            // HTML responses that bypass middleware. Keep both in sync.
            // unsafe-eval is intentionally absent here; the middleware adds it
            // only in development via process.env.NODE_ENV.
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              `img-src 'self' data: https://${configuredSupabaseHost}/storage/v1/object/public/ https://images.unsplash.com`,
              `connect-src 'self' https://${configuredSupabaseHost} wss://${configuredSupabaseHost}`,
              "font-src 'self' data:",
              "object-src 'none'",
              "worker-src 'self' blob:",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          }
        ],
      },
    ];
  },
};

export default nextConfig;
