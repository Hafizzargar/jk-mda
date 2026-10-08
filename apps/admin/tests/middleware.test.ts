import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Harness, setHarness } from './support/harness.ts';
import { NextRequest } from 'next/server';

process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

const harness = new Harness();
setHarness(harness);

const { middleware } = await import('../middleware.ts');

function configure(options: { role?: string; aal?: string; loggedIn?: boolean; factors?: any; sessionError?: boolean; profileError?: boolean; aalError?: boolean; factorsError?: boolean } = {}) {
  harness.reset();
  
  if (options.loggedIn !== false) {
    harness.actor.role_key = options.role ?? 'admin';
    harness.syncActor();
    
    // Customize what getSession / getAuthenticatorAssuranceLevel / listFactors returns
    harness.customAal = options.aal ?? 'aal2';
    harness.customFactors = options.factors ?? { all: [], totp: [{ status: 'verified' }] };
    harness.sessionError = options.sessionError ?? false;
    harness.profileError = options.profileError ?? false;
    harness.aalError = options.aalError ?? false;
    harness.factorsError = options.factorsError ?? false;
  } else {
    harness.isLoggedOut = true;
  }
}

test('middleware: unauthenticated user -> /login', async () => {
  configure({ loggedIn: false });
  const req = new NextRequest('http://localhost/dashboard');
  const res = await middleware(req);
  assert.equal(res.status, 302);
  assert.ok(res.headers.get('Location')?.endsWith('/login?next=%2Fdashboard'));
});

test('middleware: authenticated editor -> allowed (no redirect)', async () => {
  configure({ role: 'editor' });
  const req = new NextRequest('http://localhost/dashboard');
  const res = await middleware(req);
  assert.equal(res.status, 200);
});

test('middleware: authenticated admin with AAL1 -> /mfa/challenge (if verified factor exists)', async () => {
  configure({ role: 'admin', aal: 'aal1', factors: { totp: [{ status: 'verified' }] } });
  const req = new NextRequest('http://localhost/dashboard');
  const res = await middleware(req);
  assert.equal(res.status, 302);
  assert.ok(res.headers.get('Location')?.endsWith('/mfa/challenge?next=%2Fdashboard'));
});

test('middleware: admin without verified factor -> /mfa/enroll', async () => {
  configure({ role: 'admin', aal: 'aal1', factors: { totp: [] } });
  const req = new NextRequest('http://localhost/dashboard');
  const res = await middleware(req);
  assert.equal(res.status, 302);
  assert.ok(res.headers.get('Location')?.endsWith('/mfa/enroll?next=%2Fdashboard'));
});

test('middleware: admin with AAL2 -> allowed', async () => {
  configure({ role: 'admin', aal: 'aal2' });
  const req = new NextRequest('http://localhost/dashboard');
  const res = await middleware(req);
  assert.equal(res.status, 200); // 200 means NextResponse.next()
});

test('middleware: /api/* -> middleware does not redirect', async () => {
  configure({ loggedIn: false }); // even if logged out!
  const req = new NextRequest('http://localhost/api/employees/operations');
  const res = await middleware(req);
  assert.equal(res.status, 200); 
});

test('middleware: /login while authenticated -> /', async () => {
  configure({ role: 'admin', aal: 'aal2' });
  const req = new NextRequest('http://localhost/login');
  const res = await middleware(req);
  assert.equal(res.status, 302);
  assert.ok(res.headers.get('Location')?.endsWith('/'));
});

test('middleware: missing profile -> fail closed (/login)', async () => {
  configure({ role: 'admin', profileError: true });
  const req = new NextRequest('http://localhost/dashboard');
  const res = await middleware(req);
  assert.equal(res.status, 302);
  assert.ok(res.headers.get('Location')?.endsWith('/login'));
});


test('middleware: listFactors() failure -> fail closed (/login)', async () => {
  configure({ role: 'admin', aal: 'aal1', factorsError: true });
  const req = new NextRequest('http://localhost/dashboard');
  const res = await middleware(req);
  assert.equal(res.status, 302);
  assert.ok(res.headers.get('Location')?.endsWith('/login'));
});

test('middleware: disabled admin + AAL2 -> fail closed (/login)', async () => {
  configure({ role: 'admin', aal: 'aal2' });
  harness.actor.status = 'disabled';
  harness.syncActor();
  const req = new NextRequest('http://localhost/dashboard');
  const res = await middleware(req);
  assert.equal(res.status, 302);
  assert.ok(res.headers.get('Location')?.endsWith('/login'));
});

test('middleware: disabled editor -> fail closed (/login)', async () => {
  configure({ role: 'editor' });
  harness.actor.status = 'disabled';
  harness.syncActor();
  const req = new NextRequest('http://localhost/dashboard');
  const res = await middleware(req);
  assert.equal(res.status, 302);
  assert.ok(res.headers.get('Location')?.endsWith('/login'));
});

test('middleware: malformed session / getUser error -> fail closed (/login)', async () => {
  configure({ loggedIn: false });
  // loggedIn: false causes getUser to return an error, simulating invalid/missing auth
  const req = new NextRequest('http://localhost/dashboard');
  const res = await middleware(req);
  assert.equal(res.status, 302);
  assert.ok(res.headers.get('Location')?.endsWith('/login?next=%2Fdashboard'));
});

test('middleware: aal lookup failure -> fail closed (/login)', async () => {
  configure({ role: 'admin', aalError: true });
  const req = new NextRequest('http://localhost/dashboard');
  const res = await middleware(req);
  assert.equal(res.status, 302);
  assert.ok(res.headers.get('Location')?.endsWith('/login'));
});
