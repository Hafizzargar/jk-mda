import sanitizeHtml from 'sanitize-html';

export const PRODUCTION_SUPABASE_PROJECT_ID = 'ptvfidufwlswbjgsjvzl';

export interface ImageValidationOptions {
  isProduction?: boolean;
  configuredSupabaseUrl?: string;
  allowLoopback?: boolean;
}

/**
 * Approved host patterns for embedded article images.
 * Restricts remote connections strictly to approved media sources (the application's
 * specific Supabase project storage, exact official site domains, trusted editorial CDNs) to protect
 * reader privacy from third-party tracking beacons, other Supabase tenants, and remote IP harvesting.
 */
export function isAllowedImageSrc(
  src: string | null | undefined,
  options?: ImageValidationOptions
): boolean {
  if (!src || typeof src !== 'string') return false;

  const trimmed = src.trim();

  // Explicitly reject protocol-relative URLs (e.g. //tracker.evil.com/img.png)
  if (trimmed.startsWith('//') || trimmed.startsWith('\\\\')) return false;

  // Allow relative URLs that start with / (single leading slash only, not followed by / or \)
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.startsWith('/\\')) {
    return true;
  }

  // Parse absolute URL safely
  try {
    const parsed = new URL(trimmed);

    // Enforce HTTPS exclusively for remote URLs (rejects http, data, ftp, javascript, etc.)
    if (parsed.protocol !== 'https:') {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    const isProduction =
      options?.isProduction ?? process.env.NODE_ENV === 'production';

    // Loopback hosts: strictly rejected in production to prevent local-network exposure / SSRF.
    // In non-production environments (development/test), loopback image loading is strictly opt-in
    // via options.allowLoopback === true or process.env.ALLOW_LOOPBACK_IMAGES === 'true'.
    const isLoopback =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname === '[::1]';

    if (isLoopback) {
      if (isProduction) {
        return false;
      }
      return (
        options?.allowLoopback === true ||
        process.env.ALLOW_LOOPBACK_IMAGES === 'true'
      );
    }

    // Determine approved Supabase project hostnames (exact match only - NEVER wildcard *.supabase.co)
    const approvedSupabaseHosts = new Set<string>();

    if (isProduction) {
      // In production, strictly lock down to the authorized production project host
      approvedSupabaseHosts.add(`${PRODUCTION_SUPABASE_PROJECT_ID}.supabase.co`);
    } else {
      // In non-production (staging/test/preview), allow production storage for read-only fixtures plus staging test projects
      approvedSupabaseHosts.add(`${PRODUCTION_SUPABASE_PROJECT_ID}.supabase.co`);
      approvedSupabaseHosts.add('kjin-staging-test.supabase.co');
      approvedSupabaseHosts.add('kjin-isolated-test.supabase.co');

      const stagingProjectIds = process.env.ALLOWED_STAGING_PROJECT_IDS
        ? process.env.ALLOWED_STAGING_PROJECT_IDS.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
        : [];
      for (const pid of stagingProjectIds) {
        approvedSupabaseHosts.add(`${pid}.supabase.co`);
      }

      // Include the explicitly configured application Supabase URL hostname in non-production
      const configuredUrl =
        options?.configuredSupabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (configuredUrl) {
        try {
          const confParsed = new URL(
            configuredUrl.startsWith('http') ? configuredUrl : `https://${configuredUrl}`
          );
          const confHost = confParsed.hostname.toLowerCase();
          // Allow the app's own configured Supabase host (e.g., in staging or preview deployment)
          if (confHost.endsWith('.supabase.co')) {
            approvedSupabaseHosts.add(confHost);
          }
        } catch {
          // ignore malformed env URL
        }
      }
    }

    // Exact trusted application and media CDN hostnames (no wildcard subdomains)
    const exactTrustedHosts = new Set<string>([
      'kjin.in',
      'media.kjin.in',
      'kjin.org',
      'cdn.kjin.org',
      'media.kjin.org',
      'images.unsplash.com',
    ]);

    // Additional allowed image hosts from environment configuration (strictly normalized, no wildcards, no loopback in prod)
    const extraHosts = process.env.ALLOWED_IMAGE_HOSTS
      ? process.env.ALLOWED_IMAGE_HOSTS.split(',')
          .map((h) => {
            const raw = h.trim().toLowerCase();
            try {
              if (raw.includes('://')) return new URL(raw).hostname.toLowerCase();
            } catch {
              // fallback
            }
            return raw.replace(/^\/+|\/+$/g, '');
          })
          .filter((h) => {
            if (!h || h.includes('*')) return false;
            if (isProduction && (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '::1' || h === '[::1]')) {
              return false;
            }
            return true;
          })
      : [];

    // Check against approved hostnames (exact matching)
    const isApprovedHost =
      approvedSupabaseHosts.has(hostname) ||
      exactTrustedHosts.has(hostname) ||
      extraHosts.includes(hostname);

    return isApprovedHost;
  } catch {
    return false;
  }
}

const SANITIZE_BASE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'blockquote', 'pre', 'code',
    'ul', 'ol', 'li',
    'b', 'i', 'strong', 'em', 'strike', 's', 'u', 'sub', 'sup',
    'hr', 'br',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption',
    'figure', 'figcaption', 'img',
    'a',
  ],
  allowedAttributes: {
    a: ['href', 'name', 'target', 'rel', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'referrerpolicy'],
    th: ['scope', 'colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
    '*': ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    img: ['https'],
  },
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => {
      // Force external links to open safely with noopener noreferrer
      const href = attribs.href || '';
      const isExternal = href.startsWith('http://') || href.startsWith('https://');
      return {
        tagName: 'a',
        attribs: {
          ...attribs,
          ...(isExternal
            ? {
                target: '_blank',
                rel: 'noopener noreferrer',
              }
            : {}),
        },
      };
    },
  },
  disallowedTagsMode: 'discard',
};

export function createSanitizeOptions(options?: ImageValidationOptions): sanitizeHtml.IOptions {
  return {
    ...SANITIZE_BASE_OPTIONS,
    transformTags: {
      ...SANITIZE_BASE_OPTIONS.transformTags,
      img: (tagName, attribs) => {
        const src = attribs.src || '';
        // Drop unapproved, other-tenant, insecure, loopback-in-prod, or protocol-relative image URLs
        if (!isAllowedImageSrc(src, options)) {
          return { tagName: 'span', attribs: {} };
        }
        return {
          tagName: 'img',
          attribs: {
            ...attribs,
            loading: 'lazy',
            referrerpolicy: 'no-referrer',
          },
        };
      },
    },
  };
}

/**
 * Sanitizes rich-text HTML string using a strict allowlist.
 * Removes any script tags, malicious handlers, unapproved tags or schemes.
 */
export function sanitizeArticleHtml(
  dirtyHtml: string | null | undefined,
  options?: ImageValidationOptions
): string {
  if (!dirtyHtml) return '';
  return sanitizeHtml(dirtyHtml, createSanitizeOptions(options));
}

/**
 * Safely serializes data for injection into an inline <script> tag (like application/ld+json).
 * Escapes characters that can break out of a <script> block in HTML parser.
 */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
