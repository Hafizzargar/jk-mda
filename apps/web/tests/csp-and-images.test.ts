import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildImageRemotePatterns, PRODUCTION_SUPABASE_PROJECT_ID } from '../next.config.mjs';
import { buildCspHeader } from '@/lib/csp';

describe('P0: Next.js Image Optimization Host Restrictions', () => {
  it('strictly locks Supabase images to authorized project in production and disallows wildcards', () => {
    const patterns = buildImageRemotePatterns({ NODE_ENV: 'production' });

    // Must include the exact authorized production Supabase project
    const hasAuthorizedSupabase = patterns.some(
      (p) =>
        p.protocol === 'https' &&
        p.hostname === `${PRODUCTION_SUPABASE_PROJECT_ID}.supabase.co`
    );
    assert.strictEqual(hasAuthorizedSupabase, true, 'Must include authorized Supabase host');

    // Must NOT contain wildcard *.supabase.co
    const hasWildcard = patterns.some((p) => p.hostname.includes('*'));
    assert.strictEqual(hasWildcard, false, 'Must NOT contain any wildcard hostnames');

    // Must NOT contain unapproved Supabase projects
    const hasUnapprovedProject = patterns.some(
      (p) =>
        p.hostname.endsWith('.supabase.co') &&
        p.hostname !== `${PRODUCTION_SUPABASE_PROJECT_ID}.supabase.co`
    );
    assert.strictEqual(
      hasUnapprovedProject,
      false,
      'Must NOT contain any unapproved Supabase projects in production'
    );
  });

  it('strictly blocks loopback / localhost addresses in production to prevent SSRF', () => {
    const patterns = buildImageRemotePatterns({ NODE_ENV: 'production' });

    const hasLocalhost = patterns.some(
      (p) =>
        p.hostname === 'localhost' ||
        p.hostname === '127.0.0.1' ||
        p.hostname === '0.0.0.0' ||
        p.hostname === '::1'
    );
    assert.strictEqual(
      hasLocalhost,
      false,
      'Production image remotePatterns must not permit localhost or loopback'
    );
  });

  it('rejects loopback injected through ALLOWED_IMAGE_HOSTS in production', () => {
    const patterns = buildImageRemotePatterns({
      NODE_ENV: 'production',
      ALLOWED_IMAGE_HOSTS: 'localhost, 127.0.0.1, cdn.partner.com',
    });

    const hostnames = patterns.map((p) => p.hostname);
    assert.ok(!hostnames.includes('localhost'), 'Must reject localhost even if passed in ALLOWED_IMAGE_HOSTS');
    assert.ok(!hostnames.includes('127.0.0.1'), 'Must reject 127.0.0.1 even if passed in ALLOWED_IMAGE_HOSTS');
    assert.ok(hostnames.includes('cdn.partner.com'), 'Must allow valid third-party partner');
  });

  it('permits localhost and staging Supabase projects in development', () => {
    const patterns = buildImageRemotePatterns({
      NODE_ENV: 'development',
      ALLOWED_STAGING_PROJECT_IDS: 'custom-staging-app',
    });

    const hostnames = patterns.map((p) => p.hostname);
    assert.ok(hostnames.includes('localhost'), 'Dev must allow localhost');
    assert.ok(hostnames.includes('127.0.0.1'), 'Dev must allow 127.0.0.1');
    assert.ok(
      hostnames.includes('kjin-staging-test.supabase.co'),
      'Dev must allow staging test Supabase'
    );
    assert.ok(
      hostnames.includes('custom-staging-app.supabase.co'),
      'Dev must allow custom staging project ID'
    );
  });

  it('includes official trusted editorial CDNs in both production and development', () => {
    const prodPatterns = buildImageRemotePatterns({ NODE_ENV: 'production' });
    const devPatterns = buildImageRemotePatterns({ NODE_ENV: 'development' });

    const expectedTrusted = [
      'media.kjin.in',
      'cdn.kjin.org',
      'media.kjin.org',
      'images.unsplash.com',
    ];

    for (const host of expectedTrusted) {
      assert.ok(
        prodPatterns.some((p) => p.hostname === host && p.protocol === 'https'),
        `Production must include ${host}`
      );
      assert.ok(
        devPatterns.some((p) => p.hostname === host && p.protocol === 'https'),
        `Dev must include ${host}`
      );
    }
  });
});

describe('P0: Content Security Policy (CSP) Directives', () => {
  it('enforces strict project-isolated Supabase endpoints and blocks wildcards in production', () => {
    const csp = buildCspHeader({
      nonce: 'test-nonce-12345',
      env: { NODE_ENV: 'production' },
    });

    // Check img-src
    assert.ok(
      csp.includes(`img-src 'self' data: blob: https://${PRODUCTION_SUPABASE_PROJECT_ID}.supabase.co`),
      'img-src must contain authorized Supabase project'
    );
    assert.ok(
      !csp.includes('https://*.supabase.co'),
      'img-src must NOT contain wildcard https://*.supabase.co'
    );

    // Check connect-src
    assert.ok(
      csp.includes(`https://${PRODUCTION_SUPABASE_PROJECT_ID}.supabase.co`),
      'connect-src must contain authorized Supabase HTTPS origin'
    );
    assert.ok(
      csp.includes(`wss://${PRODUCTION_SUPABASE_PROJECT_ID}.supabase.co`),
      'connect-src must contain authorized Supabase WSS origin'
    );
    assert.ok(
      !csp.includes('wss://*.supabase.co'),
      'connect-src must NOT contain wildcard wss://*.supabase.co'
    );

    // Loopback must be absent in production
    assert.ok(!csp.includes('localhost'), 'Production CSP must not contain localhost');
    assert.ok(!csp.includes('127.0.0.1'), 'Production CSP must not contain 127.0.0.1');

    // 'unsafe-eval' must be absent in production
    assert.ok(!csp.includes("'unsafe-eval'"), "Production script-src must NOT contain 'unsafe-eval'");

    // Clickjacking protection: frame-ancestors 'none'
    assert.ok(csp.includes("frame-ancestors 'none'"), "CSP must include frame-ancestors 'none'");
  });

  it('permits loopback and unsafe-eval only in development', () => {
    const csp = buildCspHeader({
      nonce: 'dev-nonce-98765',
      env: {
        NODE_ENV: 'development',
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      },
    });

    assert.ok(
      csp.includes("'unsafe-eval'"),
      "Dev script-src must contain 'unsafe-eval' for Fast Refresh"
    );
    assert.ok(csp.includes('http://localhost:*'), 'Dev CSP must permit http://localhost:*');
    assert.ok(csp.includes('http://127.0.0.1:*'), 'Dev CSP must permit http://127.0.0.1:*');
    assert.ok(csp.includes('ws://localhost:*'), 'Dev CSP must permit ws://localhost:*');
    assert.ok(csp.includes('ws://127.0.0.1:*'), 'Dev CSP must permit ws://127.0.0.1:*');
  });

  it('sanitizes ALLOWED_IMAGE_HOSTS in CSP and blocks loopback injection in production', () => {
    const csp = buildCspHeader({
      nonce: 'nonce-abc',
      env: {
        NODE_ENV: 'production',
        ALLOWED_IMAGE_HOSTS: 'localhost, 127.0.0.1, https://cdn.external-cdn.org, *.wildcard.com',
      },
    });

    assert.ok(!csp.includes('localhost'), 'Must not allow localhost in production CSP');
    assert.ok(!csp.includes('127.0.0.1'), 'Must not allow 127.0.0.1 in production CSP');
    assert.ok(!csp.includes('wildcard.com'), 'Must ignore wildcards');
    assert.ok(csp.includes('https://cdn.external-cdn.org'), 'Must allow valid https origin');
  });
});
