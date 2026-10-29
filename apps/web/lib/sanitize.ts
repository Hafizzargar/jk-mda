import sanitizeHtml from 'sanitize-html';

export const PRODUCTION_SUPABASE_PROJECT_ID = 'ptvfidufwlswbjgsjvzl';

export interface ImageValidationOptions {
  isProduction?: boolean;
  configuredSupabaseUrl?: string;
  allowLoopback?: boolean;
}

/**
 * Validates that a string is a well-formed RFC 1123 hostname.
 * Rejects empty strings, credentials, wildcards, malformed dots, leading/trailing hyphens, etc.
 */
export function isValidHostname(hostname: string | null | undefined): boolean {
  if (!hostname || typeof hostname !== 'string') return false;
  const lower = hostname.toLowerCase();
  if (lower.length > 253) return false;

  // Reject leading/trailing dots or consecutive dots
  if (lower.startsWith('.') || lower.endsWith('.')) return false;

  const labels = lower.split('.');
  if (labels.length === 0) return false;

  for (const label of labels) {
    if (!label || label.length > 63) return false;
    // Each label must start and end with an alphanumeric char, containing alphanumeric or hyphens in between
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) {
      return false;
    }
  }

  return true;
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

    // Reject URLs containing userinfo/credentials (e.g. https://user:pass@kjin.in/hero.jpg)
    if (parsed.username || parsed.password) {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Validate that hostname is structurally well-formed (or IPv6 loopback literal)
    if (!isValidHostname(hostname) && hostname !== '::1' && hostname !== '[::1]') {
      return false;
    }

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
          // Reject URLs with credentials or insecure schemes
          if (
            confParsed.protocol === 'https:' &&
            !confParsed.username &&
            !confParsed.password
          ) {
            const confHost = confParsed.hostname.toLowerCase();
            // Allow the app's own configured Supabase host (e.g., in staging or preview deployment)
            if (confHost.endsWith('.supabase.co') && isValidHostname(confHost)) {
              approvedSupabaseHosts.add(confHost);
            }
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
    ]);

    // Additional allowed image hosts from environment configuration (strictly plain hostnames or validated HTTPS URLs only)
    const extraHosts = process.env.ALLOWED_IMAGE_HOSTS
      ? process.env.ALLOWED_IMAGE_HOSTS.split(',')
          .map((h) => {
            const raw = h.trim().toLowerCase();
            if (!raw) return null;

            // If a URL scheme is provided, strictly enforce https://, disallow credentials, and validate hostname
            if (raw.includes('://')) {
              try {
                const parsedUrl = new URL(raw);
                if (parsedUrl.protocol !== 'https:') {
                  return null; // Reject insecure schemes like http://, ftp://, etc.
                }
                if (parsedUrl.username || parsedUrl.password) {
                  return null; // Reject URLs with credentials
                }
                const hName = parsedUrl.hostname.toLowerCase();
                if (!isValidHostname(hName)) {
                  return null;
                }
                return hName;
              } catch {
                return null;
              }
            }

            // Plain hostname: clean any accidental leading/trailing slashes
            const cleanHost = raw.replace(/^\/+|\/+$/g, '');
            // Validate that plain host is a valid RFC 1123 hostname
            if (!isValidHostname(cleanHost)) {
              return null;
            }
            return cleanHost;
          })
          .filter((h): h is string => {
            if (!h || h.includes('*')) return false;
            if (isProduction && (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '::1' || h === '[::1]')) {
              return false;
            }
            // In production, reject any *.supabase.co hostname that is not the
            // exclusively authorized production project to prevent foreign-tenant bypass.
            if (isProduction && h.endsWith('.supabase.co') && h !== `${PRODUCTION_SUPABASE_PROJECT_ID}.supabase.co`) {
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
