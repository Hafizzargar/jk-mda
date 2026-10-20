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
          // NOTE: Content-Security-Policy is intentionally managed dynamically
          // with per-request cryptographic nonces in middleware.ts (via buildAdminCspHeader).
          // Static CSP in nextConfig cannot provide dynamic nonces and would require
          // 'unsafe-inline'. Keeping CSP strictly in middleware eliminates 'unsafe-inline'
          // in production while supporting Next.js inline bootstrap scripts via nonces.
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
