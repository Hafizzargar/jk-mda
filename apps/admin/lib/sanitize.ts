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

export function parseInlineMarkdown(text: string): string {
  if (!text) return '';
  return text
    // Bold: **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic: *text* or _text_ (ensuring no intra-word clash)
    .replace(/(?<!\w)\*([^*]+?)\*(?!\w)/g, '<em>$1</em>')
    .replace(/(?<!\w)_([^_]+?)_(?!\w)/g, '<em>$1</em>')
    // Markdown link: [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');
}

/**
 * Converts markdown or plaintext blocks to clean HTML even if mixed with HTML elements.
 */
export function markdownToHtml(raw: string | null | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();

  // Split into paragraphs / blocks by blank lines
  const rawBlocks = trimmed.split(/\n\s*\n+/);
  const processedBlocks: string[] = [];

  for (let i = 0; i < rawBlocks.length; i++) {
    const b = rawBlocks[i].trim();
    if (!b) continue;

    // 1. If it's a standalone HTML block container (like a callout div, table, figure, or pre-rendered block)
    if (/^<(div|table|figure|section|aside|header|footer|article)/i.test(b)) {
      processedBlocks.push(b);
      continue;
    }

    // 2. Already an existing clean HTML block like <p>...</p> or <h2>...</h2>
    if (/^<(p|h[1-6]|ul|ol|blockquote)/i.test(b) && /<\/(p|h[1-6]|ul|ol|blockquote)>$/i.test(b)) {
      processedBlocks.push(parseInlineMarkdown(b));
      continue;
    }

    // 3. Markdown Headings
    if (b.startsWith('#### ')) {
      processedBlocks.push(`<h4>${parseInlineMarkdown(b.slice(5).trim())}</h4>`);
      continue;
    }
    if (b.startsWith('### ')) {
      const lines = b.split('\n').map(l => l.trim()).filter(Boolean);
      const headingLine = lines[0].replace(/^###\s+/, '').trim();
      let blockResult = `<h3>${parseInlineMarkdown(headingLine)}</h3>`;
      if (lines.length > 1) {
        const remaining = lines.slice(1).join('\n');
        blockResult += '\n' + markdownToHtml(remaining);
      }
      processedBlocks.push(blockResult);
      continue;
    }
    if (b.startsWith('## ')) {
      const lines = b.split('\n').map(l => l.trim()).filter(Boolean);
      const headingLine = lines[0].replace(/^##\s+/, '').trim();
      let blockResult = `<h2>${parseInlineMarkdown(headingLine)}</h2>`;
      if (lines.length > 1) {
        const remaining = lines.slice(1).join('\n');
        blockResult += '\n' + markdownToHtml(remaining);
      }
      processedBlocks.push(blockResult);
      continue;
    }
    if (b.startsWith('# ')) {
      const lines = b.split('\n').map(l => l.trim()).filter(Boolean);
      const headingLine = lines[0].replace(/^#\s+/, '').trim();
      let blockResult = `<h1>${parseInlineMarkdown(headingLine)}</h1>`;
      if (lines.length > 1) {
        const remaining = lines.slice(1).join('\n');
        blockResult += '\n' + markdownToHtml(remaining);
      }
      processedBlocks.push(blockResult);
      continue;
    }

    // 4. Blockquote
    if (b.startsWith('> ')) {
      processedBlocks.push(`<blockquote>${parseInlineMarkdown(b.replace(/^>\s*/gm, ''))}</blockquote>`);
      continue;
    }

    // 5. Unordered List (- item or * item)
    const lines = b.split('\n').map(l => l.trim()).filter(Boolean);
    const isList = lines.length > 0 && lines.every(l => /^[-*]\s+/.test(l));
    if (isList) {
      const items = lines.map(l => `  <li>${parseInlineMarkdown(l.replace(/^[-*]\s+/, ''))}</li>`).join('\n');
      processedBlocks.push(`<ul>\n${items}\n</ul>`);
      continue;
    }

    // 6. Ordered List (1. item)
    const isOrderedList = lines.length > 0 && lines.every(l => /^\d+\.\s+/.test(l));
    if (isOrderedList) {
      const items = lines.map(l => `  <li>${parseInlineMarkdown(l.replace(/^\d+\.\s+/, ''))}</li>`).join('\n');
      processedBlocks.push(`<ol>\n${items}\n</ol>`);
      continue;
    }

    // 7. Mixed list (some lines are list items, some are not)
    const hasSomeListItems = lines.some(l => /^[-*]\s+/.test(l));
    if (hasSomeListItems) {
      let htmlOut = '';
      let inUl = false;
      for (const line of lines) {
        if (/^[-*]\s+/.test(line)) {
          if (!inUl) {
            htmlOut += '<ul>\n';
            inUl = true;
          }
          htmlOut += `  <li>${parseInlineMarkdown(line.replace(/^[-*]\s+/, ''))}</li>\n`;
        } else {
          if (inUl) {
            htmlOut += '</ul>\n';
            inUl = false;
          }
          htmlOut += `<p>${parseInlineMarkdown(line)}</p>\n`;
        }
      }
      if (inUl) htmlOut += '</ul>';
      processedBlocks.push(htmlOut.trim());
      continue;
    }

    // 8. Normal Paragraph
    processedBlocks.push(`<p>${parseInlineMarkdown(b.replace(/\n/g, '<br/>'))}</p>`);
  }

  return processedBlocks.join('\n\n');
}
