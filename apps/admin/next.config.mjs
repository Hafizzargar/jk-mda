export const PRODUCTION_SUPABASE_PROJECT_ID = 'uaaajvcmjivszrkzdmvu';
export const LEGACY_SUPABASE_PROJECT_ID = 'ptvfidufwlswbjgsjvzl';
export const AUTHORIZED_SUPABASE_HOST = `${PRODUCTION_SUPABASE_PROJECT_ID}.supabase.co`;

let configuredSupabaseHost = AUTHORIZED_SUPABASE_HOST;
if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    const raw = process.env.NEXT_PUBLIC_SUPABASE_URL.trim();
    const parsed = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    configuredSupabaseHost = parsed.host;
  } catch {
    configuredSupabaseHost = AUTHORIZED_SUPABASE_HOST;
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@supabase/supabase-js', '@supabase/ssr'],
  devIndicators: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: process.env.NODE_ENV !== 'production',
    remotePatterns: [
      { protocol: 'https', hostname: configuredSupabaseHost },
      { protocol: 'https', hostname: `${PRODUCTION_SUPABASE_PROJECT_ID}.supabase.co` },
      { protocol: 'https', hostname: `${LEGACY_SUPABASE_PROJECT_ID}.supabase.co` },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'i1.ytimg.com' },
      { protocol: 'https', hostname: 'i2.ytimg.com' },
      { protocol: 'https', hostname: 'i3.ytimg.com' },
      { protocol: 'https', hostname: 'i4.ytimg.com' },
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'ytimg.googleusercontent.com' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
    ],
  },
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
