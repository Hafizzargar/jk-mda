import sanitizeHtml from 'sanitize-html';

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
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    th: ['scope', 'colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
    '*': ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    img: ['http', 'https'],
  },
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
    img: (tagName, attribs) => ({
      tagName: 'img',
      attribs: {
        ...attribs,
        loading: 'lazy',
      },
    }),
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
