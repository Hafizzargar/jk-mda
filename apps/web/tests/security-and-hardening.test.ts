import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeArticleHtml, safeJsonLd, isAllowedImageSrc } from '@/lib/sanitize';
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

  it('enforces approved image hosts with no-referrer and lazy loading', () => {
    const supabaseImg = '<img src="https://ptvfidufwlswbjgsjvzl.supabase.co/storage/v1/object/public/articles/photo.jpg" alt="Photo" />';
    const localImg = '<img src="/uploads/local-banner.png" alt="Banner" />';
    const unsplashImg = '<img src="https://images.unsplash.com/photo-1234.jpg" alt="Stock" />';

    const supabaseCleaned = sanitizeArticleHtml(supabaseImg);
    assert.ok(supabaseCleaned.includes('referrerpolicy="no-referrer"'), 'must include referrerpolicy="no-referrer"');
    assert.ok(supabaseCleaned.includes('loading="lazy"'), 'must include loading="lazy"');
    assert.ok(supabaseCleaned.includes('https://ptvfidufwlswbjgsjvzl.supabase.co/storage/v1/object/public/articles/photo.jpg'), 'must preserve approved project supabase image src');

    const localCleaned = sanitizeArticleHtml(localImg);
    assert.ok(localCleaned.includes('referrerpolicy="no-referrer"'), 'must include referrerpolicy="no-referrer"');
    assert.ok(localCleaned.includes('/uploads/local-banner.png'), 'must preserve local relative path');

    const unsplashCleaned = sanitizeArticleHtml(unsplashImg);
    assert.ok(unsplashCleaned.includes('https://images.unsplash.com/photo-1234.jpg'), 'must preserve unsplash image src');
  });

  it('rejects unrelated Supabase tenants and naked supabase.co domain', () => {
    const otherTenantImg = '<img src="https://unrelated-project.supabase.co/storage/v1/object/public/tracker.png" alt="Other Tenant" />';
    const attackerTenantImg = '<img src="https://attacker.supabase.co/pixel.gif" alt="Attacker Tenant" />';
    const nakedSupabaseImg = '<img src="https://supabase.co/logo.png" alt="Naked Supabase" />';

    const otherCleaned = sanitizeArticleHtml(otherTenantImg);
    assert.ok(!otherCleaned.includes('unrelated-project.supabase.co'), 'must reject unrelated tenant');
    assert.ok(!otherCleaned.includes('<img'), 'must not render img tag for unrelated tenant');

    const attackerCleaned = sanitizeArticleHtml(attackerTenantImg);
    assert.ok(!attackerCleaned.includes('attacker.supabase.co'), 'must reject attacker tenant');
    assert.ok(!attackerCleaned.includes('<img'), 'must not render img tag for attacker tenant');

    const nakedCleaned = sanitizeArticleHtml(nakedSupabaseImg);
    assert.ok(!nakedCleaned.includes('https://supabase.co/logo.png'), 'must reject naked supabase.co');
    assert.ok(!nakedCleaned.includes('<img'), 'must not render img tag for naked supabase.co');
  });

  it('rejects loopback hosts (localhost, 127.0.0.1, ::1) in production environment', () => {
    const localhostImg = '<img src="https://localhost:8443/tracker.png" alt="Localhost" />';
    const ipImg = '<img src="https://127.0.0.1:8443/beacon.png" alt="IP" />';

    const cleanedLocalhost = sanitizeArticleHtml(localhostImg, { isProduction: true });
    assert.ok(!cleanedLocalhost.includes('localhost'), 'must reject localhost in production');
    assert.ok(!cleanedLocalhost.includes('<img'), 'must not render img for localhost in production');

    const cleanedIp = sanitizeArticleHtml(ipImg, { isProduction: true });
    assert.ok(!cleanedIp.includes('127.0.0.1'), 'must reject 127.0.0.1 in production');
    assert.ok(!cleanedIp.includes('<img'), 'must not render img for 127.0.0.1 in production');

    assert.strictEqual(isAllowedImageSrc('https://localhost/test.png', { isProduction: true }), false);
    assert.strictEqual(isAllowedImageSrc('https://127.0.0.1/test.png', { isProduction: true }), false);
    assert.strictEqual(isAllowedImageSrc('https://[::1]/test.png', { isProduction: true }), false);
  });

  it('rejects loopback hosts in development and test environments by default without explicit opt-in', () => {
    const originalEnv = process.env.ALLOW_LOOPBACK_IMAGES;
    delete process.env.ALLOW_LOOPBACK_IMAGES;

    try {
      // Must be rejected by default even when isProduction is false
      assert.strictEqual(isAllowedImageSrc('https://localhost:3000/test.png', { isProduction: false }), false);
      assert.strictEqual(isAllowedImageSrc('https://127.0.0.1:3000/test.png', { isProduction: false }), false);
      assert.strictEqual(isAllowedImageSrc('https://localhost:3000/test.png', { isProduction: false, allowLoopback: false }), false);

      const html = sanitizeArticleHtml('<img src="https://localhost:3000/test.png" alt="Local" />', { isProduction: false });
      assert.ok(!html.includes('localhost'), 'must discard localhost by default in dev/test');
      assert.ok(!html.includes('<img'), 'must not render img for default loopback in dev/test');
    } finally {
      if (originalEnv !== undefined) {
        process.env.ALLOW_LOOPBACK_IMAGES = originalEnv;
      }
    }
  });

  it('allows loopback hosts in non-production environments only when explicitly opted in via option or env', () => {
    assert.strictEqual(isAllowedImageSrc('https://localhost:3000/test.png', { isProduction: false, allowLoopback: true }), true);
    assert.strictEqual(isAllowedImageSrc('https://127.0.0.1:3000/test.png', { isProduction: false, allowLoopback: true }), true);

    const originalEnv = process.env.ALLOW_LOOPBACK_IMAGES;
    try {
      process.env.ALLOW_LOOPBACK_IMAGES = 'true';
      assert.strictEqual(isAllowedImageSrc('https://localhost:3000/test.png', { isProduction: false }), true);
      assert.strictEqual(isAllowedImageSrc('https://127.0.0.1:3000/test.png', { isProduction: false }), true);

      // Even with ALLOW_LOOPBACK_IMAGES=true or allowLoopback: true, production must strictly reject
      assert.strictEqual(isAllowedImageSrc('https://localhost:3000/test.png', { isProduction: true }), false);
      assert.strictEqual(isAllowedImageSrc('https://localhost:3000/test.png', { isProduction: true, allowLoopback: true }), false);
    } finally {
      if (originalEnv !== undefined) {
        process.env.ALLOW_LOOPBACK_IMAGES = originalEnv;
      } else {
        delete process.env.ALLOW_LOOPBACK_IMAGES;
      }
    }
  });

  it('rejects arbitrary or unapproved subdomains of kjin.in and kjin.org', () => {
    const unapprovedSubdomainImg1 = '<img src="https://attacker.kjin.in/beacon.png" alt="Attacker" />';
    const unapprovedSubdomainImg2 = '<img src="https://user-content.kjin.org/tracker.jpg" alt="User Content" />';
    const unapprovedSubdomainImg3 = '<img src="https://evil.sub.kjin.in/pixel.gif" alt="Evil" />';

    const cleaned1 = sanitizeArticleHtml(unapprovedSubdomainImg1);
    assert.ok(!cleaned1.includes('attacker.kjin.in'), 'must reject arbitrary kjin.in subdomain');
    assert.ok(!cleaned1.includes('<img'), 'must not render img tag for unapproved subdomain');

    const cleaned2 = sanitizeArticleHtml(unapprovedSubdomainImg2);
    assert.ok(!cleaned2.includes('user-content.kjin.org'), 'must reject arbitrary kjin.org subdomain');
    assert.ok(!cleaned2.includes('<img'), 'must not render img tag for unapproved subdomain');

    const cleaned3 = sanitizeArticleHtml(unapprovedSubdomainImg3);
    assert.ok(!cleaned3.includes('evil.sub.kjin.in'), 'must reject nested kjin.in subdomain');
    assert.ok(!cleaned3.includes('<img'), 'must not render img tag for nested subdomain');

    assert.strictEqual(isAllowedImageSrc('https://attacker.kjin.in/test.png'), false);
    assert.strictEqual(isAllowedImageSrc('https://user.kjin.org/test.png'), false);
    assert.strictEqual(isAllowedImageSrc('https://phishing.kjin.in/test.png'), false);
  });

  it('drops unapproved external HTTPS image hosts to protect reader privacy', () => {
    const unapprovedImg = '<img src="https://unapproved-tracker.com/pixel.png" alt="Tracker" />';
    const arbitraryImg = '<img src="https://arbitrary-site.com/image.jpg" alt="Arbitrary" />';

    const cleanedTracker = sanitizeArticleHtml(unapprovedImg);
    assert.ok(!cleanedTracker.includes('unapproved-tracker.com'), 'must drop unapproved host');
    assert.ok(!cleanedTracker.includes('<img'), 'must not render img tag for unapproved host');

    const cleanedArbitrary = sanitizeArticleHtml(arbitraryImg);
    assert.ok(!cleanedArbitrary.includes('arbitrary-site.com'), 'must drop arbitrary remote host');
    assert.ok(!cleanedArbitrary.includes('<img'), 'must not render img tag for arbitrary remote host');
  });

  it('drops insecure HTTP and protocol-relative image URLs', () => {
    const insecureImg = '<img src="http://insecure.example.com/tracker.png" alt="Tracker" />';
    const protoRelativeImg = '<img src="//evil.com/tracker.png" alt="Protocol Relative" />';

    const insecureCleaned = sanitizeArticleHtml(insecureImg);
    assert.ok(!insecureCleaned.includes('http://insecure.example.com'), 'must drop insecure http image src');
    assert.ok(!insecureCleaned.includes('<img'), 'must not render img tag for insecure http');

    const protoCleaned = sanitizeArticleHtml(protoRelativeImg);
    assert.ok(!protoCleaned.includes('//evil.com'), 'must drop protocol-relative image src');
    assert.ok(!protoCleaned.includes('<img'), 'must not render img tag for protocol-relative');
  });

  it('accurately verifies allowed and disallowed image sources with isAllowedImageSrc', () => {
    // Approved sources (exact match)
    assert.strictEqual(isAllowedImageSrc('/images/news.png'), true);
    assert.strictEqual(isAllowedImageSrc('https://ptvfidufwlswbjgsjvzl.supabase.co/storage/v1/object/public/test.jpg'), true);
    assert.strictEqual(isAllowedImageSrc('https://kjin.in/hero.jpg'), true);
    assert.strictEqual(isAllowedImageSrc('https://media.kjin.in/banner.webp'), true);
    assert.strictEqual(isAllowedImageSrc('https://kjin.org/logo.png'), true);
    assert.strictEqual(isAllowedImageSrc('https://cdn.kjin.org/news-media/photo.webp'), true);
    assert.strictEqual(isAllowedImageSrc('https://media.kjin.org/cover.webp'), true);
    assert.strictEqual(isAllowedImageSrc('https://images.unsplash.com/photo-1234'), true);

    // Disallowed sources
    assert.strictEqual(isAllowedImageSrc('https://unrelated-project.supabase.co/storage/v1/test.png'), false); // other tenant
    assert.strictEqual(isAllowedImageSrc('https://supabase.co/logo.png'), false); // naked supabase
    assert.strictEqual(isAllowedImageSrc('https://attacker.kjin.in/test.png'), false); // unapproved subdomain
    assert.strictEqual(isAllowedImageSrc('https://user.kjin.org/test.png'), false); // unapproved subdomain
    assert.strictEqual(isAllowedImageSrc('https://localhost:3000/test.png'), false); // loopback by default without opt-in
    assert.strictEqual(isAllowedImageSrc('https://localhost:3000/test.png', { isProduction: true }), false); // loopback in prod
    assert.strictEqual(isAllowedImageSrc('//evil.com/tracker.png'), false);
    assert.strictEqual(isAllowedImageSrc('http://kjin.in/hero.jpg'), false); // insecure http
    assert.strictEqual(isAllowedImageSrc('https://malicious-tracking.com/beacon.gif'), false); // unapproved host
    assert.strictEqual(isAllowedImageSrc('https://evil-supabase.co.attacker.com/image.jpg'), false); // deceptive subdomain
    assert.strictEqual(isAllowedImageSrc('javascript:alert(1)'), false);
    assert.strictEqual(isAllowedImageSrc('data:image/png;base64,abc'), false);
    assert.strictEqual(isAllowedImageSrc(''), false);
    assert.strictEqual(isAllowedImageSrc(null), false);
    assert.strictEqual(isAllowedImageSrc(undefined), false);
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
