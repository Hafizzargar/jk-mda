import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeArticleHtml, safeJsonLd } from '@/lib/sanitize';
import { parsePageParam, getPaginationRange } from '@/lib/pagination';
import { isValidCategory, isValidDistrict, getCategoryDisplayName, getDistrictDisplayName } from '@/lib/taxonomy';
import { SITE_URL } from '@/lib/config';

describe('P0: Article HTML XSS Prevention', () => {
  it('strips malicious <script> tags and executable payloads', () => {
    const maliciousHtml = '<p>Normal text</p><script>alert(document.cookie)</script>';
    const cleaned = sanitizeArticleHtml(maliciousHtml);
    assert.ok(!cleaned.includes('<script>'), 'script tag must be removed');
    assert.ok(!cleaned.includes('alert(document.cookie)'), 'script body must be discarded');
    assert.ok(cleaned.includes('<p>Normal text</p>'), 'legitimate paragraphs must be preserved');
  });

  it('strips inline event handlers such as onerror and onclick', () => {
    const maliciousImg = '<img src="x" onerror="alert(document.cookie)" alt="Test" />';
    const cleaned = sanitizeArticleHtml(maliciousImg);
    assert.ok(!cleaned.includes('onerror'), 'onerror attribute must be removed');
    assert.ok(!cleaned.includes('alert'), 'payload must be removed');
  });

  it('blocks javascript: URI schemes in anchor hrefs', () => {
    const maliciousLink = '<a href="javascript:alert(1)">Click Here</a>';
    const cleaned = sanitizeArticleHtml(maliciousLink);
    assert.ok(!cleaned.includes('javascript:'), 'javascript: scheme must be stripped');
  });

  it('enforces safe rel="noopener noreferrer" and target="_blank" on external links', () => {
    const externalLink = '<a href="https://example.com/source">Source Reference</a>';
    const cleaned = sanitizeArticleHtml(externalLink);
    assert.ok(cleaned.includes('target="_blank"'), 'must include target="_blank"');
    assert.ok(cleaned.includes('rel="noopener noreferrer"'), 'must include rel="noopener noreferrer"');
  });

  it('preserves approved rich-text formatting tags and tables', () => {
    const richText = '<h2>Headline</h2><p>Paragraph with <strong>bold</strong> and <em>italic</em>.</p><blockquote>Quote</blockquote>';
    const cleaned = sanitizeArticleHtml(richText);
    assert.strictEqual(cleaned, richText);
  });
});

describe('P0: JSON-LD Safe Serialization', () => {
  it('escapes closing </script> tags to prevent script breakout XSS', () => {
    const schema = {
      headline: '</script><script>alert("hacked")</script>',
      author: 'Jane Doe',
    };
    const serialized = safeJsonLd(schema);
    assert.ok(!serialized.includes('</script>'), 'must not contain literal </script>');
    assert.ok(serialized.includes('\\u003c/script\\u003e'), 'must have escaped < and > brackets');
  });

  it('escapes HTML special characters in structured data', () => {
    const schema = {
      description: 'News & Analysis <Special Edition>',
    };
    const serialized = safeJsonLd(schema);
    assert.ok(!serialized.includes('<Special Edition>'));
    assert.ok(serialized.includes('\\u003cSpecial Edition\\u003e'));
    assert.ok(serialized.includes('\\u0026'));
  });
});

describe('P1: Pagination Validation & Boundary Bounds', () => {
  it('handles non-numeric or malicious page query parameters safely', () => {
    assert.strictEqual(parsePageParam('abc'), 1);
    assert.strictEqual(parsePageParam('-50'), 1);
    assert.strictEqual(parsePageParam('0'), 1);
    assert.strictEqual(parsePageParam(undefined), 1);
    assert.strictEqual(parsePageParam(null), 1);
    assert.strictEqual(parsePageParam(''), 1);
  });

  it('clamps excessively large page numbers to boundary limit', () => {
    assert.strictEqual(parsePageParam('999999999', 500), 500);
    assert.strictEqual(parsePageParam('501', 500), 500);
  });

  it('correctly parses valid positive page numbers', () => {
    assert.strictEqual(parsePageParam('1'), 1);
    assert.strictEqual(parsePageParam('4'), 4);
    assert.strictEqual(parsePageParam('12'), 12);
  });

  it('computes correct Supabase range offsets', () => {
    const page1 = getPaginationRange(1, 12);
    assert.strictEqual(page1.from, 0);
    assert.strictEqual(page1.to, 11);

    const page2 = getPaginationRange(2, 12);
    assert.strictEqual(page2.from, 12);
    assert.strictEqual(page2.to, 23);
  });
});

describe('P1: Category & District Controlled Taxonomy', () => {
  it('validates legitimate categories and rejects unknown inputs', () => {
    assert.strictEqual(isValidCategory('politics'), true);
    assert.strictEqual(isValidCategory('POLITICS'), true);
    assert.strictEqual(isValidCategory('economy'), true);
    assert.strictEqual(isValidCategory('local'), true);
    assert.strictEqual(isValidCategory('culture'), true);
    assert.strictEqual(isValidCategory('investigation'), true);

    // Invalid / garbage categories
    assert.strictEqual(isValidCategory('garbage123'), false);
    assert.strictEqual(isValidCategory('random'), false);
    assert.strictEqual(isValidCategory(''), false);
  });

  it('validates official Jammu & Kashmir districts', () => {
    // Kashmir
    assert.strictEqual(isValidDistrict('srinagar'), true);
    assert.strictEqual(isValidDistrict('anantnag'), true);
    assert.strictEqual(isValidDistrict('baramulla'), true);
    assert.strictEqual(isValidDistrict('pulwama'), true);

    // Jammu
    assert.strictEqual(isValidDistrict('jammu'), true);
    assert.strictEqual(isValidDistrict('doda'), true);
    assert.strictEqual(isValidDistrict('rajouri'), true);
    assert.strictEqual(isValidDistrict('udhampur'), true);

    // Invalid districts
    assert.strictEqual(isValidDistrict('paris'), false);
    assert.strictEqual(isValidDistrict('delhi'), false);
    assert.strictEqual(isValidDistrict('unknown_district'), false);
  });

  it('provides formatted display names', () => {
    assert.strictEqual(getCategoryDisplayName('politics'), 'Politics');
    assert.strictEqual(getDistrictDisplayName('srinagar'), 'Srinagar');
  });
});

describe('P1: Canonical Domain & Config', () => {
  it('ensures SITE_URL is canonical and has no trailing slash', () => {
    assert.ok(SITE_URL.startsWith('http'), 'SITE_URL must be a valid protocol URL');
    assert.ok(!SITE_URL.endsWith('/'), 'SITE_URL must not have a trailing slash');
    assert.ok(SITE_URL.includes('kjin.in') || SITE_URL.includes('localhost'), 'SITE_URL must point to canonical kjin.in');
  });
});
