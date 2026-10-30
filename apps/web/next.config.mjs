import { withSentryConfig } from '@sentry/nextjs/config';

export const PRODUCTION_SUPABASE_PROJECT_ID = 'ptvfidufwlswbjgsjvzl';

/** @type {string} */
export const AUTHORIZED_SUPABASE_HOST = `${PRODUCTION_SUPABASE_PROJECT_ID}.supabase.co`;

/**
 * Builds the remotePatterns configuration for Next.js image optimization.
 * Enforces strict origin restrictions:
 * - In production: strictly locks Supabase images to the authorized production project (ptvfidufwlswbjgsjvzl).
 * - In production: rejects loopback (localhost/127.0.0.1) to prevent SSRF vulnerabilities.
 * - In non-production: allows localhost, 127.0.0.1, and approved staging/isolated Supabase projects.
 * - Allows trusted official media CDNs across all environments.
 * - Respects sanitized ALLOWED_IMAGE_HOSTS from env without wildcard subdomains.
 *
 * @param {Record<string, string | undefined>} [env=process.env]
 * @returns {Array<{ protocol: 'http' | 'https', hostname: string, port?: string, pathname?: string }>}
 */
export function buildImageRemotePatterns(env = process.env) {
  const isProd = env.NODE_ENV === 'production';
  /** @type {Array<{ protocol: 'http' | 'https', hostname: string }>} */
  const patterns = [];

  // Authorized Supabase project(s)
  if (isProd) {
    patterns.push({
      protocol: 'https',
      hostname: `${PRODUCTION_SUPABASE_PROJECT_ID}.supabase.co`,
    });
  } else {
    // Non-production (dev/test/staging)
    patterns.push({
      protocol: 'https',
      hostname: `${PRODUCTION_SUPABASE_PROJECT_ID}.supabase.co`,
    });
    patterns.push({
      protocol: 'https',
      hostname: 'kjin-staging-test.supabase.co',
    });
    patterns.push({
      protocol: 'https',
      hostname: 'kjin-isolated-test.supabase.co',
    });

    if (env.ALLOWED_STAGING_PROJECT_IDS) {
      const pids = env.ALLOWED_STAGING_PROJECT_IDS.split(',')
        .map((id) => id.trim().toLowerCase())
        .filter(Boolean);
      for (const pid of pids) {
        if (!pid.includes('*')) {
          patterns.push({
            protocol: 'https',
            hostname: `${pid}.supabase.co`,
          });
        }
      }
    }

    if (env.NEXT_PUBLIC_SUPABASE_URL) {
      try {
        const parsed = new URL(
          env.NEXT_PUBLIC_SUPABASE_URL.startsWith('http')
            ? env.NEXT_PUBLIC_SUPABASE_URL
            : `https://${env.NEXT_PUBLIC_SUPABASE_URL}`
        );
        const host = parsed.hostname.toLowerCase();
        if (host && !host.includes('*')) {
          const proto = parsed.protocol.replace(':', '');
          if (proto === 'http' || proto === 'https') {
            patterns.push({
              protocol: proto,
              hostname: host,
            });
          }
        }
      } catch {
        // ignore malformed env URL
      }
    }

    // Local loopback is permitted ONLY in non-production environments
    patterns.push({
      protocol: 'http',
      hostname: 'localhost',
    });
    patterns.push({
      protocol: 'http',
      hostname: '127.0.0.1',
    });
    patterns.push({
      protocol: 'https',
      hostname: 'localhost',
    });
    patterns.push({
      protocol: 'https',
      hostname: '127.0.0.1',
    });
  }

  // Exact trusted media CDNs
  const trustedHosts = [
    'kjin.in',
    'media.kjin.in',
    'kjin.org',
    'cdn.kjin.org',
    'media.kjin.org',
    'images.unsplash.com',
    'lh3.googleusercontent.com',
    'lh4.googleusercontent.com',
    'lh5.googleusercontent.com',
    'lh6.googleusercontent.com',
    'i.ytimg.com',
    'i1.ytimg.com',
    'i2.ytimg.com',
    'i3.ytimg.com',
    'i4.ytimg.com',
    'img.youtube.com',
    'ytimg.googleusercontent.com',
  ];

  for (const hostname of trustedHosts) {
    patterns.push({
      protocol: 'https',
      hostname,
    });
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
        isProd &&
        (host === 'localhost' ||
          host === '127.0.0.1' ||
          host === '0.0.0.0' ||
          host === '::1' ||
          host === '[::1]')
      ) {
        continue;
      }
      // In production, reject any *.supabase.co hostname that is not the
      // exclusively authorized production project. This prevents a foreign
      // Supabase tenant from being admitted via ALLOWED_IMAGE_HOSTS.
      if (isProd && host.endsWith('.supabase.co') && host !== AUTHORIZED_SUPABASE_HOST) {
        continue;
      }
      patterns.push({
        protocol: 'https',
        hostname: host,
      });
    }
  }

  // Deduplicate patterns by protocol + hostname
  const seen = new Set();
  return patterns.filter((p) => {
    const key = `${p.protocol}://${p.hostname}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const isProd = process.env.NODE_ENV === 'production';

/** @type {import('next').NextConfig} */
export const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@supabase/supabase-js', '@supabase/ssr'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: buildImageRemotePatterns(),
    formats: ['image/avif', 'image/webp'],
    unoptimized: !isProd,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
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
  webpack: (config) => {
    config.output = config.output || {};
    config.output.globalObject = 'globalThis';
    return config;
  },
};

export default isProd
  ? withSentryConfig(nextConfig, {
      org: "education-29y",
      project: "kjin-web",
      silent: !process.env.CI,
      widenClientFileUpload: true,
      tunnelRoute: "/monitoring",
      autoInstrumentMiddleware: false,
      autoInstrumentServerFunctions: false,
      webpack: {
        automaticVercelMonitors: true,
        treeshake: {
          removeDebugLogging: true,
        },
      },
    })
  : nextConfig;

