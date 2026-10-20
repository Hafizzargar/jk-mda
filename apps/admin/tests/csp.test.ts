import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import {
  buildAdminCspHeader,
  PRODUCTION_SUPABASE_PROJECT_ID,
  AUTHORIZED_SUPABASE_HOST,
} from '../lib/csp.ts';
import { middleware } from '../middleware.ts';
import { Harness, setHarness } from './support/harness.ts';

const harness = new Harness();
setHarness(harness);

describe('Admin CSP & Nonce Hardening', () => {
  it('enforces strict project-isolated Supabase endpoints and blocks wildcards in production', () => {
    const csp = buildAdminCspHeader({
      nonce: 'admin-test-nonce-12345',
      env: { NODE_ENV: 'production' },
    });

    // Check img-src
    assert.ok(
      csp.includes(`img-src 'self' data: blob: https://${AUTHORIZED_SUPABASE_HOST}/storage/v1/object/public/ https://images.unsplash.com`),
      'img-src must contain authorized Supabase project storage'
    );
    assert.ok(!csp.includes('https://*.supabase.co'), 'img-src must NOT contain wildcard *.supabase.co');

    // Check connect-src
    assert.ok(
      csp.includes(`connect-src 'self' https://${AUTHORIZED_SUPABASE_HOST} wss://${AUTHORIZED_SUPABASE_HOST}`),
      'connect-src must contain authorized Supabase HTTPS and WSS origins'
    );
    assert.ok(!csp.includes('wss://*.supabase.co'), 'connect-src must NOT contain wildcard');

    // Loopback must be absent in production
    assert.ok(!csp.includes('localhost'), 'Production CSP must not contain localhost');
    assert.ok(!csp.includes('127.0.0.1'), 'Production CSP must not contain 127.0.0.1');

    // Script-src in production MUST include nonce and strict-dynamic, and MUST NOT contain unsafe-inline or unsafe-eval
    const scriptSrcDirective = csp.split(';').find((d) => d.trim().startsWith('script-src')) ?? '';
    assert.ok(
      scriptSrcDirective.includes("'nonce-admin-test-nonce-12345'") && scriptSrcDirective.includes("'strict-dynamic'"),
      "Production script-src must use 'nonce-...' and 'strict-dynamic'"
    );
    assert.ok(!scriptSrcDirective.includes("'unsafe-inline'"), "Production script-src must NOT contain 'unsafe-inline'");
    assert.ok(!scriptSrcDirective.includes("'unsafe-eval'"), "Production script-src must NOT contain 'unsafe-eval'");

    // Essential security directives
    assert.ok(csp.includes("object-src 'none'"), "CSP must include object-src 'none'");
    assert.ok(csp.includes("frame-ancestors 'none'"), "CSP must include frame-ancestors 'none'");
    assert.ok(csp.includes("base-uri 'self'"), "CSP must include base-uri 'self'");
    assert.ok(csp.includes("form-action 'self'"), "CSP must include form-action 'self'");
  });

  it('permits loopback and unsafe-eval only in development', () => {
    const csp = buildAdminCspHeader({
      nonce: 'dev-nonce-54321',
      env: {
        NODE_ENV: 'development',
        NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
      },
    });

    assert.ok(
      csp.includes("'unsafe-eval'"),
      "Dev script-src must contain 'unsafe-eval' for Fast Refresh"
    );
    assert.ok(csp.includes('http://localhost:*'), 'Dev CSP must permit http://localhost:*');
    assert.ok(csp.includes('ws://localhost:*'), 'Dev CSP must permit ws://localhost:*');
  });

  it('middleware attaches unique nonce and CSP to both request and response headers', async () => {
    harness.reset();
    harness.actor.role_key = 'admin';
    harness.customAal = 'aal2';
    harness.syncActor();

    const req = new NextRequest('http://localhost/dashboard');
    const res = await middleware(req);

    assert.equal(res.status, 200);

    const cspHeader = res.headers.get('Content-Security-Policy');
    assert.ok(cspHeader, 'Response must have Content-Security-Policy header');
    assert.ok(cspHeader.includes("'strict-dynamic'"), 'Response CSP must include strict-dynamic');
    assert.ok(cspHeader.includes("'nonce-"), 'Response CSP must include a nonce');
    const resScriptSrc = cspHeader.split(';').find((d) => d.trim().startsWith('script-src')) ?? '';
    assert.ok(!resScriptSrc.includes("'unsafe-inline'"), "Response CSP script-src must NOT include 'unsafe-inline'");

    // Standard security headers
    assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(res.headers.get('X-Frame-Options'), 'DENY');
    assert.equal(res.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
    assert.ok(res.headers.get('Strict-Transport-Security')?.includes('max-age=31536000'));
  });
});
