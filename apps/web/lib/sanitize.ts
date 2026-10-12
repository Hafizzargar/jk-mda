import sanitizeHtml from 'sanitize-html';

/**
 * Approved host patterns for embedded article images.
 * Restricts remote connections strictly to approved media sources (Supabase storage,
 * official site domains, local testing hosts, and trusted editorial CDNs) to protect
 * reader privacy from third-party tracking beacons and remote IP harvesting.
 */
export function isAllowedImageSrc(src: string | null | undefined): boolean {
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

    // Check against approved hostnames / domain patterns
    const isAllowed =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === 'supabase.co' ||
      hostname.endsWith('.supabase.co') ||
      hostname === 'kjin.in' ||
      hostname.endsWith('.kjin.in') ||
      hostname === 'kjin.org' ||
      hostname.endsWith('.kjin.org') ||
      hostname === 'images.unsplash.com';

    return isAllowed;
  } catch {
    return false;
  }
}

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
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
    img: (tagName, attribs) => {
      const src = attribs.src || '';
      // Drop unapproved, insecure, or protocol-relative image URLs to mitigate tracking and privacy leakage
      if (!isAllowedImageSrc(src)) {
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
  disallowedTagsMode: 'discard',
};

/**
 * Sanitizes rich-text HTML string using a strict allowlist.
 * Removes any script tags, malicious handlers, unapproved tags or schemes.
 */
export function sanitizeArticleHtml(dirtyHtml: string | null | undefined): string {
  if (!dirtyHtml) return '';
  return sanitizeHtml(dirtyHtml, SANITIZE_OPTIONS);
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
