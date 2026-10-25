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
    'a', 'span',
  ],
  allowedAttributes: {
    a: ['href', 'name', 'target', 'rel', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    th: ['scope', 'colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
    '*': ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => {
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

/**
 * Sanitizes rich-text HTML string using an editorial allowlist.
 */
export function sanitizeArticleHtml(dirtyHtml: string | null | undefined): string {
  if (!dirtyHtml) return '';
  return sanitizeHtml(dirtyHtml, SANITIZE_OPTIONS);
}

/**
 * Converts markdown or plaintext blocks to clean HTML if not already HTML.
 */
export function markdownToHtml(raw: string | null | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (/<(p|h[1-6]|div|article|section|ul|ol|blockquote)/i.test(trimmed)) {
    return trimmed;
  }
  const blocks = trimmed.split(/\n\s*\n/);
  const htmlBlocks = blocks.map((block) => {
    const b = block.trim();
    if (!b) return '';
    if (b.startsWith('### ')) {
      return `<h3>${b.slice(4).trim()}</h3>`;
    }
    if (b.startsWith('## ')) {
      return `<h2>${b.slice(3).trim()}</h2>`;
    }
    if (b.startsWith('# ')) {
      return `<h1>${b.slice(2).trim()}</h1>`;
    }
    if (b.startsWith('> ')) {
      return `<blockquote>${b.slice(2).trim()}</blockquote>`;
    }
    return `<p>${b.replace(/\n/g, '<br/>')}</p>`;
  });
  return htmlBlocks.filter(Boolean).join('\n\n');
}
