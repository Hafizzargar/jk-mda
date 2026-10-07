import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { Harness, setHarness, TARGET_ID, EXISTING_SUPERADMIN_ID, ACTOR_ID } from './support/harness.ts';

process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

const harness = new Harness();
setHarness(harness);

const inviteRoute = await import('../app/api/employees/invite/route.ts');
const operationsRoute = await import('../app/api/employees/operations/route.ts');
const statusRoute = await import('../app/api/employees/[id]/status/route.ts');
const contactRoute = await import('../app/api/employees/[id]/contact/route.ts');

const VALID_UUID = TARGET_ID;

function configure(options: { role?: string; grants?: string[] } = {}) {
  harness.reset();
  harness.actor.role_key = options.role ?? 'admin';
  harness.grants = options.grants ?? [];
  harness.syncActor();
}

function jsonRequest(url: string, options: { method?: string; body?: unknown; token?: string | null } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const body =
    options.body === undefined
      ? undefined
      : typeof options.body === 'string'
        ? options.body
        : JSON.stringify(options.body);
  return new Request(url, { method: options.method ?? 'POST', headers, body });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

const claimIndex = () =>
  harness.calls.findIndex((call) => call.kind === 'rpc' && call.rpc === 'claim_employee_invitation_attempt');
const rolesIndex = () => harness.calls.findIndex((call) => call.kind === 'from' && call.table === 'roles');

beforeEach(() => {
  harness.reset();
});

// ---------------------------------------------------------------------------
// POST /api/employees/invite
// ---------------------------------------------------------------------------

test('invite: missing token returns 401 without touching any service', async () => {
  const res = await inviteRoute.POST(
    jsonRequest('http://localhost/api/employees/invite', {
      body: { email: 'newhire@example.com', display_name: 'New Hire', role_key: 'author', reason: 'Initial provisioning' },
    })
  );
  assert.equal(res.status, 401);
  assert.equal(harness.calls.length, 0);
});

test('invite: rank-denied request returns 403 without consuming the daily quota', async () => {
  configure({ role: 'admin', grants: ['employee.invite'] });
  const res = await inviteRoute.POST(
    jsonRequest('http://localhost/api/employees/invite', {
      token: 'dummy.eyJzZXNzaW9uX2lkIjogIm1vY2stc2Vzc2lvbiIsICJhYWwiOiAiYWFsMiJ9.dummy',
      body: { email: 'wannabe@example.com', display_name: 'Wannabe', role_key: 'superadmin', reason: 'Rank test' },
    })
  );
  assert.equal(res.status, 403);
  assert.equal(claimIndex(), -1, 'quota must be claimed only after rank validation');
  assert.ok(harness.audits.some((row) => row.action === 'employee.invite_denied'));
});

test('invite: second superadmin is rejected with 409 before any quota claim', async () => {
  configure({ role: 'owner', grants: ['employee.invite'] });
  harness.addProfile({ id: EXISTING_SUPERADMIN_ID, role_key: 'superadmin', status: 'active' });
  const res = await inviteRoute.POST(
    jsonRequest('http://localhost/api/employees/invite', {
      token: 'dummy.eyJzZXNzaW9uX2lkIjogIm1vY2stc2Vzc2lvbiIsICJhYWwiOiAiYWFsMiJ9.dummy',
      body: { email: 'second-super@example.com', display_name: 'Second Super', role_key: 'superadmin', reason: 'Slot test' },
    })
  );
  assert.equal(res.status, 409);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'Only one Second Superadmin is allowed.');
  assert.equal(claimIndex(), -1, 'quota must not be claimed when the superadmin slot is occupied');
  const denial = harness.audits.find((row) => row.action === 'employee.invite_denied');
  assert.ok(denial, 'the denial must be audited');
  assert.equal((denial?.details as Record<string, unknown> | undefined)?.reason_code, 'second_superadmin_exists');
});

test('invite: rate limit returns 429 after rank checks and audits the denial', async () => {
  configure({ role: 'admin', grants: ['employee.invite'] });
  harness.rpcErrors.claim_employee_invitation_attempt = {
    message: 'Daily employee invitation limit reached',
    code: 'P0001',
  };
  const res = await inviteRoute.POST(
    jsonRequest('http://localhost/api/employees/invite', {
      token: 'dummy.eyJzZXNzaW9uX2lkIjogIm1vY2stc2Vzc2lvbiIsICJhYWwiOiAiYWFsMiJ9.dummy',
      body: { email: 'newhire@example.com', display_name: 'New Hire', role_key: 'author', reason: 'Initial provisioning' },
    })
  );
  assert.equal(res.status, 429);
  assert.notEqual(rolesIndex(), -1, 'rank must be checked before the quota claim');
  assert.ok(rolesIndex() < claimIndex(), 'rank lookups must run before the quota claim');
  assert.ok(harness.audits.some((row) => row.action === 'employee.invite_rate_limited'));
});

test('invite: auth send failure does not leak internal error details', async () => {
  configure({ role: 'admin', grants: ['employee.invite'] });
  harness.inviteUserResult = {
    data: { user: null },
    error: { message: 'duplicate relation "auth.users" already exists', code: '23500' },
  };
  const res = await inviteRoute.POST(
    jsonRequest('http://localhost/api/employees/invite', {
      token: 'dummy.eyJzZXNzaW9uX2lkIjogIm1vY2stc2Vzc2lvbiIsICJhYWwiOiAiYWFsMiJ9.dummy',
      body: { email: 'newhire@example.com', display_name: 'New Hire', role_key: 'author', reason: 'Initial provisioning' },
    })
  );
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'Unable to send the invitation email.');
  assert.ok(!body.error?.includes('auth.users'), 'internal error text must not reach the browser');
  const audit = harness.audits.find((row) => row.action === 'employee.invite_failed');
  assert.ok(audit, 'the exact failure must be audited');
  assert.ok(String(audit?.reason).includes('auth.users'), 'audit keeps the internal detail');
});

test('invite: pending-invite conflict maps to a friendly 409', async () => {
  configure({ role: 'admin', grants: ['employee.invite'] });
  harness.inviteInsert = {
    data: null,
    error: { message: 'duplicate key value violates unique constraint "idx_employee_invites_pending_email"', code: '23505' },
  };
  const res = await inviteRoute.POST(
    jsonRequest('http://localhost/api/employees/invite', {
      token: 'dummy.eyJzZXNzaW9uX2lkIjogIm1vY2stc2Vzc2lvbiIsICJhYWwiOiAiYWFsMiJ9.dummy',
      body: { email: 'newhire@example.com', display_name: 'New Hire', role_key: 'author', reason: 'Initial provisioning' },
    })
  );
  assert.equal(res.status, 409);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'An invitation for this email is already pending.');
  assert.ok(harness.audits.some((row) => row.action === 'employee.invite_failed'));
});

// ---------------------------------------------------------------------------
// POST /api/employees/operations
// ---------------------------------------------------------------------------

test('operations: invalid JSON body returns 400', async () => {
  const res = await operationsRoute.POST(
    jsonRequest('http://localhost/api/employees/operations', { body: 'not-json', token: 'dummy.eyJzZXNzaW9uX2lkIjogIm1vY2stc2Vzc2lvbiIsICJhYWwiOiAiYWFsMiJ9.dummy' })
  );
  assert.equal(res.status, 400);
});

test('operations: unsupported operation returns 400', async () => {
  const res = await operationsRoute.POST(
    jsonRequest('http://localhost/api/employees/operations', { body: { operation: 'self-destruct' }, token: 'dummy.eyJzZXNzaW9uX2lkIjogIm1vY2stc2Vzc2lvbiIsICJhYWwiOiAiYWFsMiJ9.dummy' })
  );
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'Unsupported employee operation.');
});

test('operations: missing token returns 401 before any RPC call', async () => {
  const res = await operationsRoute.POST(
    jsonRequest('http://localhost/api/employees/operations', {
      body: { operation: 'change-role', target_id: VALID_UUID, role_key: 'editor', reason: 'Testing' },
    })
  );
  assert.equal(res.status, 401);
  assert.equal(harness.calls.length, 0);
});

test('operations: deliberate database raises pass through to the client', async () => {
  configure({ role: 'admin', grants: ['employee.role.change'] });
  harness.rpcErrors.change_employee_role = { message: 'A reason is required', code: 'P0001' };
  const res = await operationsRoute.POST(
    jsonRequest('http://localhost/api/employees/operations', {
      token: 'dummy.eyJzZXNzaW9uX2lkIjogIm1vY2stc2Vzc2lvbiIsICJhYWwiOiAiYWFsMiJ9.dummy',
      body: { operation: 'change-role', target_id: VALID_UUID, role_key: 'editor', reason: 'Testing' },
    })
  );
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'A reason is required');
  assert.ok(harness.audits.some((row) => row.action === 'employee.change_role_denied'));
});

test('operations: internal database errors are hidden from the client but audited', async () => {
  configure({ role: 'admin', grants: ['employee.role.change'] });
  harness.rpcErrors.change_employee_role = {
    message: 'value too long for type character varying(20)',
    code: '22001',
  };
  const res = await operationsRoute.POST(
    jsonRequest('http://localhost/api/employees/operations', {
      token: 'dummy.eyJzZXNzaW9uX2lkIjogIm1vY2stc2Vzc2lvbiIsICJhYWwiOiAiYWFsMiJ9.dummy',
      body: { operation: 'change-role', target_id: VALID_UUID, role_key: 'editor', reason: 'Testing' },
    })
  );
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'The employee operation could not be completed.');
  assert.ok(!body.error?.includes('character varying'), 'internal error text must not reach the browser');
  const audit = harness.audits.find((row) => row.action === 'employee.change_role_denied');
  assert.ok(String(audit?.reason).includes('character varying'), 'audit keeps the internal detail');
});

// ---------------------------------------------------------------------------
// PATCH /api/employees/[id]/status
// ---------------------------------------------------------------------------

test('status: unauthenticated request with an invalid body still returns 401', async () => {
  const res = await statusRoute.PATCH(
    jsonRequest('http://localhost/api/employees/status', { method: 'PATCH', body: { status: 'bogus' } }),
    params(VALID_UUID)
  );
  assert.equal(res.status, 401);
  assert.equal(harness.calls.length, 0);
});

test('status: authenticated request with an invalid status returns 400', async () => {
  configure({ role: 'admin', grants: ['employee.enable'] });
  const res = await statusRoute.PATCH(
    jsonRequest('http://localhost/api/employees/status', {
      method: 'PATCH',
      token: 'dummy.eyJzZXNzaW9uX2lkIjogIm1vY2stc2Vzc2lvbiIsICJhYWwiOiAiYWFsMiJ9.dummy',
      body: { status: 'bogus', reason: 'Testing' },
    }),
    params(VALID_UUID)
  );
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'Status must be active or disabled.');
});

test('status: non-uuid id returns 400 before any profile lookup', async () => {
  configure({ role: 'admin', grants: ['employee.disable'] });
  const res = await statusRoute.PATCH(
    jsonRequest('http://localhost/api/employees/status', {
      method: 'PATCH',
      token: 'dummy.eyJzZXNzaW9uX2lkIjogIm1vY2stc2Vzc2lvbiIsICJhYWwiOiAiYWFsMiJ9.dummy',
      body: { status: 'disabled', reason: 'Testing' },
    }),
    params('not-a-uuid')
  );
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'A valid employee id is required.');
  assert.equal(harness.audits.length, 0, 'no audit row for a malformed id');
});

test('status: target at or above actor rank returns 403', async () => {
  configure({ role: 'admin', grants: ['employee.disable'] });
  harness.addProfile({ id: VALID_UUID, role_key: 'superadmin', status: 'active' });
  const res = await statusRoute.PATCH(
    jsonRequest('http://localhost/api/employees/status', {
      method: 'PATCH',
      token: 'dummy.eyJzZXNzaW9uX2lkIjogIm1vY2stc2Vzc2lvbiIsICJhYWwiOiAiYWFsMiJ9.dummy',
      body: { status: 'disabled', reason: 'Testing' },
    }),
    params(VALID_UUID)
  );
  assert.equal(res.status, 403);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'You cannot change this employee status.');
});

test('status: deliberate database raises pass through to the client', async () => {
  configure({ role: 'admin', grants: ['employee.disable'] });
  harness.addProfile({ id: VALID_UUID, role_key: 'editor', status: 'active' });
  harness.rpcErrors.set_employee_status = { message: 'Reason is too long', code: 'P0001' };
  const res = await statusRoute.PATCH(
    jsonRequest('http://localhost/api/employees/status', {
      method: 'PATCH',
      token: 'dummy.eyJzZXNzaW9uX2lkIjogIm1vY2stc2Vzc2lvbiIsICJhYWwiOiAiYWFsMiJ9.dummy',
      body: { status: 'disabled', reason: 'x'.repeat(1001) },
    }),
    params(VALID_UUID)
  );
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'Reason is too long');
  assert.ok(harness.audits.some((row) => row.action === 'employee.status_change_denied'));
});

test('status: internal database errors are hidden from the client but audited', async () => {
  configure({ role: 'admin', grants: ['employee.disable'] });
  harness.addProfile({ id: VALID_UUID, role_key: 'editor', status: 'active' });
  harness.rpcErrors.set_employee_status = {
    message: 'insert or update on table "profiles" violates check constraint',
    code: '23514',
  };
  const res = await statusRoute.PATCH(
    jsonRequest('http://localhost/api/employees/status', {
      method: 'PATCH',
      token: 'dummy.eyJzZXNzaW9uX2lkIjogIm1vY2stc2Vzc2lvbiIsICJhYWwiOiAiYWFsMiJ9.dummy',
      body: { status: 'disabled', reason: 'Testing' },
    }),
    params(VALID_UUID)
  );
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'The employee status could not be changed.');
  assert.ok(!body.error?.includes('profiles'), 'internal error text must not reach the browser');
  const audit = harness.audits.find((row) => row.action === 'employee.status_change_denied');
  assert.ok(String(audit?.reason).includes('profiles'), 'audit keeps the internal detail');
});

test('status: Auth ban failure returns 502 without leaking internal details', async () => {
  configure({ role: 'admin', grants: ['employee.disable'] });
  harness.addProfile({ id: VALID_UUID, role_key: 'editor', status: 'active' });
  harness.banResult = { data: null, error: { message: 'failed to reach auth admin api' } };
  const res = await statusRoute.PATCH(
    jsonRequest('http://localhost/api/employees/status', {
      method: 'PATCH',
      token: 'dummy.eyJzZXNzaW9uX2lkIjogIm1vY2stc2Vzc2lvbiIsICJhYWwiOiAiYWFsMiJ9.dummy',
      body: { status: 'disabled', reason: 'Testing' },
    }),
    params(VALID_UUID)
  );
  assert.equal(res.status, 502);
  const body = (await res.json()) as { error?: string };
  assert.ok(!body.error?.includes('auth admin api'), 'internal error text must not reach the browser');
  const audit = harness.audits.find((row) => row.action === 'employee.auth_status_update_failed');
  const details = audit?.details as Record<string, unknown> | undefined;
  assert.ok(String(details?.error).includes('auth admin api'), 'audit keeps the internal detail');
});

test('status: happy path disables the employee and bans the auth user', async () => {
  configure({ role: 'admin', grants: ['employee.disable'] });
  harness.addProfile({ id: VALID_UUID, role_key: 'editor', status: 'active' });
  const res = await statusRoute.PATCH(
    jsonRequest('http://localhost/api/employees/status', {
      method: 'PATCH',
      token: 'dummy.eyJzZXNzaW9uX2lkIjogIm1vY2stc2Vzc2lvbiIsICJhYWwiOiAiYWFsMiJ9.dummy',
      body: { status: 'disabled', reason: 'Policy violation' },
    }),
    params(VALID_UUID)
  );
  assert.equal(res.status, 200);
  const body = (await res.json()) as { status?: string };
  assert.equal(body.status, 'disabled');
  assert.ok(harness.calls.some((call) => call.kind === 'rpc' && call.rpc === 'set_employee_status'));
  assert.ok(harness.calls.some((call) => call.kind === 'auth' && call.op === 'updateUserById'));
});

// ---------------------------------------------------------------------------
// PATCH /api/employees/[id]/contact
// ---------------------------------------------------------------------------

test('contact: missing token returns 401', async () => {
  const res = await contactRoute.PATCH(
    jsonRequest('http://localhost/api/employees/contact', { method: 'PATCH', body: { reason: 'Testing' } }),
    params(VALID_UUID)
  );
  assert.equal(res.status, 401);
  assert.equal(harness.calls.length, 0);
});

test('contact: non-uuid id returns 400 with no audit row', async () => {
  configure({ role: 'owner', grants: ['employee.contact.update'] });
  const res = await contactRoute.PATCH(
    jsonRequest('http://localhost/api/employees/contact', {
      method: 'PATCH',
      token: 'dummy.eyJzZXNzaW9uX2lkIjogIm1vY2stc2Vzc2lvbiIsICJhYWwiOiAiYWFsMiJ9.dummy',
      body: { reason: 'Testing' },
    }),
    params('not-a-uuid')
  );
  assert.equal(res.status, 400);
  assert.equal(harness.audits.length, 0);
});

test('contact: valid request stays deferred with 501 and audited intent', async () => {
  configure({ role: 'owner', grants: ['employee.contact.update'] });
  const res = await contactRoute.PATCH(
    jsonRequest('http://localhost/api/employees/contact', {
      method: 'PATCH',
      token: 'dummy.eyJzZXNzaW9uX2lkIjogIm1vY2stc2Vzc2lvbiIsICJhYWwiOiAiYWFsMiJ9.dummy',
      body: { reason: 'Phone number changed' },
    }),
    params(VALID_UUID)
  );
  assert.equal(res.status, 501);
  const body = (await res.json()) as { error?: string };
  assert.ok(body.error?.includes('temporarily unavailable'));
  const audit = harness.audits.find((row) => row.action === 'employee.contact_update_deferred');
  assert.ok(audit, 'the deferral must remain audited');
  assert.equal(audit?.target_id, VALID_UUID);
});

// ---------------------------------------------------------------------------
// MFA Enforcement
// ---------------------------------------------------------------------------

test('mfa: owner, superadmin, and admin requests without AAL2 are rejected with 403', async () => {
  for (const role of ['owner', 'superadmin', 'admin']) {
    configure({ role, grants: ['employee.invite'] });
    const res = await inviteRoute.POST(
      jsonRequest('http://localhost/api/employees/invite', {
        token: 'dummy.eyJzZXNzaW9uX2lkIjogIm1vY2stc2Vzc2lvbiIsICJhYWwiOiAiYWFsMSJ9.dummy',
        body: { email: 'new@example.com', display_name: 'New', role_key: 'author', reason: 'Test' },
      })
    );
    assert.equal(res.status, 403, `Role ${role} should be rejected`);
    const body = (await res.json()) as { error?: string };
    assert.equal(body.error, 'Multi-factor authentication is required.');
    assert.ok(harness.audits.some((row) => row.action === 'employee.mfa_denied'));
  }
});

test('mfa: editor and author requests without AAL2 are allowed', async () => {
  for (const role of ['editor', 'author']) {
    configure({ role, grants: ['employee.basic.update'] });
    // We mock a deliberate error from the RPC just to verify it reached the RPC phase instead of 403ing
    harness.rpcErrors.update_employee_basic = { message: 'Passed MFA check', code: 'P0001' };
    const res = await operationsRoute.POST(
      jsonRequest('http://localhost/api/employees/operations', {
        token: 'dummy.eyJzZXNzaW9uX2lkIjogIm1vY2stc2Vzc2lvbiIsICJhYWwiOiAiYWFsMSJ9.dummy',
        body: { operation: 'update-basic', target_id: VALID_UUID, display_name: 'Test', reason: 'Test' },
      })
    );
    assert.equal(res.status, 400); // Because of the mocked RPC error, NOT 403
    const body = (await res.json()) as { error?: string };
    assert.equal(body.error, 'Passed MFA check');
  }
});

test('mfa: audit endpoint rejects unauthenticated requests', async () => {
  const { POST } = await import('../app/api/employees/mfa/audit/route.ts');
  const res = await POST(jsonRequest('http://localhost/api/employees/mfa/audit', { body: { action: 'employee.mfa_enrolled' } }));
  assert.equal(res.status, 401);
});

test('mfa: audit endpoint requires valid JSON action', async () => {
  const { POST } = await import('../app/api/employees/mfa/audit/route.ts');
  configure({ role: 'admin' });
  const res = await POST(
    jsonRequest('http://localhost/api/employees/mfa/audit', {
      token: 'dummy.eyJzZXNzaW9uX2lkIjogIm1vY2stc2Vzc2lvbiIsICJhYWwiOiAiYWFsMiJ9.dummy',
      body: { action: 'invalid_action' },
    })
  );
  assert.equal(res.status, 400);
});

test('mfa: audit endpoint logs valid actions successfully', async () => {
  const { POST } = await import('../app/api/employees/mfa/audit/route.ts');
  configure({ role: 'admin' });
  
  const actions = [
    'employee.mfa_enrolled',
    'employee.mfa_challenge_success',
    'employee.mfa_challenge_failed',
  ];

  for (const action of actions) {
    const res = await POST(
      jsonRequest('http://localhost/api/employees/mfa/audit', {
        token: 'dummy.eyJzZXNzaW9uX2lkIjogIm1vY2stc2Vzc2lvbiIsICJhYWwiOiAiYWFsMiJ9.dummy',
        body: { action },
      })
    );
    assert.equal(res.status, 200, `Failed for action ${action}`);
    assert.ok(harness.audits.some((row) => row.action === action));
  }
});

test('mfa: verify proxy enforces rate limiting', async () => {
  const { POST } = await import('../app/api/employees/mfa/verify/route.ts');
  configure({ role: 'admin' });
  
  // Seed 5 failed attempts
  if (!harness.fixtures.audit_logs) harness.fixtures.audit_logs = [];
  for (let i = 0; i < 5; i++) {
    harness.fixtures.audit_logs.push({
      id: crypto.randomUUID(),
      actor_profile_id: ACTOR_ID,
      action: 'employee.mfa_challenge_failed',
      target_type: 'profile',
      target_id: ACTOR_ID,
      result: 'denied',
      reason: 'Invalid TOTP code',
      details: {},
      created_at: new Date().toISOString(),
    });
  }

  const res = await POST(
    jsonRequest('http://localhost/api/employees/mfa/verify', {
      token: 'dummy.eyJzZXNzaW9uX2lkIjogIm1vY2stc2Vzc2lvbiIsICJhYWwiOiAiYWFsMSJ9.dummy',
      body: { factorId: 'fact-123', challengeId: 'chal-123', code: '000000' },
    })
  );
  
  const body = await res.json();
  
  assert.equal(res.status, 429);
  assert.equal(body.error, 'Too many failed verification attempts. Please try again later.');
});

test('mfa: verify proxy rejects unauthenticated requests', async () => {
  const { POST } = await import('../app/api/employees/mfa/verify/route.ts');
  const res = await POST(
    jsonRequest('http://localhost/api/employees/mfa/verify', {
      body: { factorId: 'fact-123', challengeId: 'chal-123', code: '000000' },
    })
  );
  assert.equal(res.status, 401);
});

test('mfa: verify proxy logs success and returns upgraded session on valid code', async () => {
  const { POST } = await import('../app/api/employees/mfa/verify/route.ts');
  configure({ role: 'admin' });
  
  const res = await POST(
    jsonRequest('http://localhost/api/employees/mfa/verify', {
      token: 'dummy.eyJzZXNzaW9uX2lkIjogIm1vY2stc2Vzc2lvbiIsICJhYWwiOiAiYWFsMSJ9.dummy',
      body: { factorId: 'fact-123', challengeId: 'chal-123', code: '000000' },
    })
  );
  
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.session.access_token, 'new-token');
  assert.ok(harness.audits.some((row) => row.action === 'employee.mfa_challenge_success'));
});

test('mfa: verify proxy logs failure and returns 400 on invalid code', async () => {
  const { POST } = await import('../app/api/employees/mfa/verify/route.ts');
  configure({ role: 'admin' });
  
  const res = await POST(
    jsonRequest('http://localhost/api/employees/mfa/verify', {
      token: 'dummy.eyJzZXNzaW9uX2lkIjogIm1vY2stc2Vzc2lvbiIsICJhYWwiOiAiYWFsMSJ9.dummy',
      body: { factorId: 'fact-123', challengeId: 'chal-123', code: '999999' },
    })
  );
  
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, 'Invalid code. Please check your authenticator app and try again.');
  assert.ok(harness.audits.some((row) => row.action === 'employee.mfa_challenge_failed'));
});




