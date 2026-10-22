import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { Harness, setHarness, TARGET_ID, EXISTING_SUPERADMIN_ID, ACTOR_ID } from './support/harness.ts';

process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

const harness = new Harness();
setHarness(harness);

const inviteRoute = await import('../app/api/employees/invite/route.ts');
const operationsRoute = await import('../app/api/employees/operations/route.ts');
const statusRoute = await import('../app/api/employees/[id]/status/route.ts');
const contactRoute = await import('../app/api/employees/[id]/contact/route.ts');
const publishRoute = await import('../app/api/articles/[id]/publish/route.ts');
const articlesRoute = await import('../app/api/articles/route.ts');
const articleIdRoute = await import('../app/api/articles/[id]/route.ts');
const archiveRoute = await import('../app/api/articles/[id]/archive/route.ts');
const returnRoute = await import('../app/api/articles/[id]/return/route.ts');
const submitRoute = await import('../app/api/articles/[id]/submit/route.ts');
const resendInviteRoute = await import('../app/api/employees/resend-invite/route.ts');
const templateRoute = await import('../app/api/settings/template/route.ts');

const VALID_UUID = TARGET_ID;

function configure(options: { role?: string; grants?: string[] } = {}) {
  harness.reset();
  harness.actor.role_key = options.role ?? 'admin';
  harness.grants = options.grants ?? [];
  harness.syncActor();
}

function jsonRequest(url: string, options: { method?: string; body?: unknown; token?: string | null; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers ?? {}) };
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
      token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMiIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
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
      token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMiIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
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
      token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMiIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
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
      token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMiIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
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
      token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMiIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
      body: { email: 'newhire@example.com', display_name: 'New Hire', role_key: 'author', reason: 'Initial provisioning' },
    })
  );
  assert.equal(res.status, 409);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'An invitation for this email is already pending.');
  assert.ok(harness.audits.some((row) => row.action === 'employee.invite_failed'));
});

test('invite: happy path provisions user with temporary password and returns it', async () => {
  configure({ role: 'admin', grants: ['employee.invite'] });
  const res = await inviteRoute.POST(
    jsonRequest('http://localhost/api/employees/invite', {
      token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMiIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
      body: { email: 'successful-invite@example.com', display_name: 'Success Hire', role_key: 'author', reason: 'Onboarding test' },
    })
  );
  assert.equal(res.status, 201);
  const body = (await res.json()) as { id: string; status: string; temporary_password?: string; email_sent?: boolean };
  assert.equal(body.status, 'invited');
  assert.ok(body.temporary_password, 'temporary password must be returned');
  assert.equal(body.temporary_password.length, 16);
  assert.ok(harness.audits.some((row) => row.action === 'employee.invited'));
});

// ---------------------------------------------------------------------------
// POST /api/employees/resend-invite
// ---------------------------------------------------------------------------

test('resend-invite: missing token returns 401', async () => {
  const res = await resendInviteRoute.POST(
    jsonRequest('http://localhost/api/employees/resend-invite', {
      body: { employee_id: VALID_UUID, reason: 'Lost credentials' },
    })
  );
  assert.equal(res.status, 401);
});

test('resend-invite: missing employee_id or reason returns 400', async () => {
  configure({ role: 'owner', grants: ['employee.invite'] });
  let res = await resendInviteRoute.POST(
    jsonRequest('http://localhost/api/employees/resend-invite', {
      token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMiIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
      body: { reason: 'Lost credentials' },
    })
  );
  assert.equal(res.status, 400);

  res = await resendInviteRoute.POST(
    jsonRequest('http://localhost/api/employees/resend-invite', {
      token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMiIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
      body: { employee_id: VALID_UUID },
    })
  );
  assert.equal(res.status, 400);
});

test('resend-invite: employee not in invited status returns 400', async () => {
  configure({ role: 'owner', grants: ['employee.invite'] });
  harness.addProfile({ id: VALID_UUID, email: 'active@example.com', role_key: 'author', status: 'active' });
  const res = await resendInviteRoute.POST(
    jsonRequest('http://localhost/api/employees/resend-invite', {
      token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMiIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
      body: { employee_id: VALID_UUID, reason: 'Resending credentials' },
    })
  );
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error?: string };
  assert.ok(body.error?.includes('invited'));
});

test('resend-invite: subordinate without rank or permission is rejected with 403', async () => {
  configure({ role: 'admin', grants: ['employee.invite'] });
  harness.addProfile({ id: VALID_UUID, email: 'super@example.com', role_key: 'superadmin', status: 'invited' });
  const res = await resendInviteRoute.POST(
    jsonRequest('http://localhost/api/employees/resend-invite', {
      token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMiIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
      body: { employee_id: VALID_UUID, reason: 'Trying to resend to superadmin' },
    })
  );
  assert.equal(res.status, 403);
  assert.ok(harness.audits.some((row) => row.action === 'employee.resend_invite_denied'));
});

test('resend-invite: happy path (owner resends to invited author) returns 200 and temporary password', async () => {
  configure({ role: 'owner', grants: ['employee.invite'] });
  harness.addProfile({ id: VALID_UUID, email: 'author-invite@example.com', display_name: 'Invited Author', role_key: 'author', status: 'invited' });
  const res = await resendInviteRoute.POST(
    jsonRequest('http://localhost/api/employees/resend-invite', {
      token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMiIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
      body: { employee_id: VALID_UUID, reason: 'Candidate requested new invitation email' },
    })
  );
  assert.equal(res.status, 200);
  const body = (await res.json()) as { success?: boolean; temporary_password?: string; email_sent?: boolean; email?: string };
  assert.equal(body.success, true);
  assert.equal(body.email, 'author-invite@example.com');
  assert.ok(body.temporary_password, 'temporary password must be returned');
  assert.equal(body.temporary_password.length, 16);
  assert.ok(harness.audits.some((row) => row.action === 'employee.invite_resent'));
});

// ---------------------------------------------------------------------------
// POST /api/employees/operations
// ---------------------------------------------------------------------------

test('operations: invalid JSON body returns 400', async () => {
  const res = await operationsRoute.POST(
    jsonRequest('http://localhost/api/employees/operations', { body: 'not-json', token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMiIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy' })
  );
  assert.equal(res.status, 400);
});

test('operations: unsupported operation returns 400', async () => {
  const res = await operationsRoute.POST(
    jsonRequest('http://localhost/api/employees/operations', { body: { operation: 'self-destruct' }, token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMiIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy' })
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

test('operations: rejects request if authentication is older than 15 minutes (expired TOTP)', async () => {
  configure({ role: 'admin', grants: ['employee.role.change'] });
  const expiredToken = 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMiIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjEwMDAwMDAwMDB9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6MTAwMDAwMDAwMH1dfQ.dummy';
  
  const res = await operationsRoute.POST(
    jsonRequest('http://localhost/api/employees/operations', {
      token: expiredToken,
      body: { operation: 'change-role', target_id: VALID_UUID, role_key: 'editor', reason: 'Testing' },
    })
  );
  
  assert.equal(res.status, 403);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'Recent authentication required.');
});

test('operations: recent password but old TOTP is rejected for MFA-protected roles', async () => {
  configure({ role: 'admin', grants: ['employee.role.change'] });
  const oldTotpToken = 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMiIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6MTAwMDAwMDAwMH1dfQ.dummy';
  
  const res = await operationsRoute.POST(
    jsonRequest('http://localhost/api/employees/operations', {
      token: oldTotpToken,
      body: { operation: 'change-role', target_id: VALID_UUID, role_key: 'editor', reason: 'Testing' },
    })
  );
  
  assert.equal(res.status, 403);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'Recent authentication required.');
});

test('operations: recent password but old TOTP is allowed for non-MFA roles', async () => {
  configure({ role: 'editor', grants: ['employee.role.change'] }); // Assuming editor has the grant for test purposes
  const oldTotpToken = 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMiIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6MTAwMDAwMDAwMH1dfQ.dummy';
  
  const res = await operationsRoute.POST(
    jsonRequest('http://localhost/api/employees/operations', {
      token: oldTotpToken,
      body: { operation: 'change-role', target_id: VALID_UUID, role_key: 'author', reason: 'Testing' },
    })
  );
  
  // It shouldn't return 403 reauth required. It should succeed (200).
  assert.equal(res.status, 200);
});

test('operations: editor password old + token refresh recent is rejected for non-MFA roles', async () => {
  configure({ role: 'editor', grants: ['employee.role.change'] });
  const tokenRefreshOnlyToken = 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoidG9rZW5fcmVmcmVzaCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX0seyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTAwMDAwMDAwMH1dfQ.dummy';
  
  const res = await operationsRoute.POST(
    jsonRequest('http://localhost/api/employees/operations', {
      token: tokenRefreshOnlyToken,
      body: { operation: 'change-role', target_id: VALID_UUID, role_key: 'author', reason: 'Testing' },
    })
  );
  
  assert.equal(res.status, 403);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'Recent authentication required.');
});

test('operations: editor legitimate recent password is allowed for non-MFA roles', async () => {
  configure({ role: 'editor', grants: ['employee.role.change'] });
  const recentPasswordToken = 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoidG9rZW5fcmVmcmVzaCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX0seyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy';
  
  const res = await operationsRoute.POST(
    jsonRequest('http://localhost/api/employees/operations', {
      token: recentPasswordToken,
      body: { operation: 'change-role', target_id: VALID_UUID, role_key: 'author', reason: 'Testing' },
    })
  );
  
  assert.equal(res.status, 200);
});

test('operations: deliberate database raises pass through to the client', async () => {
  configure({ role: 'admin', grants: ['employee.role.change'] });
  harness.rpcErrors.change_employee_role = { message: 'A reason is required', code: 'P0001' };
  const res = await operationsRoute.POST(
    jsonRequest('http://localhost/api/employees/operations', {
      token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMiIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
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
      token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMiIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
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
      token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMiIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
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
      token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMiIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
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
      token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMiIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
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
      token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMiIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
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
      token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMiIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
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
      token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMiIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
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
      token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMiIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
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
      token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMiIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
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
      token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMiIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
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
        token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
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
        token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
        body: { operation: 'update-basic', target_id: VALID_UUID, display_name: 'Test', reason: 'Test' },
      })
    );
    assert.equal(res.status, 400); // Because of the mocked RPC error, NOT 403
    const body = (await res.json()) as { error?: string };
    assert.equal(body.error, 'Passed MFA check');
  }
});


test('mfa: verify proxy enforces rate limiting', async () => {
  const { POST } = await import('../app/api/employees/mfa/verify/route.ts');
  configure({ role: 'admin' });
  
  // Mock the DB rate limit RPC throwing the specific error
  harness.rpcErrors['claim_mfa_challenge_attempt'] = { message: 'Too many failed verification attempts. Please try again later.' };

  const res = await POST(
    jsonRequest('http://localhost/api/employees/mfa/verify', {
      token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
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

test('mfa: verify proxy logs challenge success for verified factor', async () => {
  const { POST } = await import('../app/api/employees/mfa/verify/route.ts');
  configure({ role: 'admin' });
  harness.mfaFactorStatus = 'verified';
  
  const res = await POST(
    jsonRequest('http://localhost/api/employees/mfa/verify', {
      token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
      body: { factorId: 'fact-123', challengeId: 'chal-123', code: '000000' },
    })
  );
  
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.session.access_token, 'new-token');
  assert.ok(harness.audits.some((row) => row.action === 'employee.mfa_challenge_success'));
});

test('mfa: verify proxy logs enrolled for unverified factor', async () => {
  const { POST } = await import('../app/api/employees/mfa/verify/route.ts');
  configure({ role: 'admin' });
  harness.mfaFactorStatus = 'unverified';
  
  const res = await POST(
    jsonRequest('http://localhost/api/employees/mfa/verify', {
      token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
      body: { factorId: 'fact-123', challengeId: 'chal-123', code: '000000' },
    })
  );
  
  assert.equal(res.status, 200);
  assert.ok(harness.audits.some((row) => row.action === 'employee.mfa_enrolled'));
});

test('mfa: verify proxy returns 500 when listFactors fails', async () => {
  const { POST } = await import('../app/api/employees/mfa/verify/route.ts');
  configure({ role: 'admin' });
  harness.mfaFactorStatus = 'error';
  
  const res = await POST(
    jsonRequest('http://localhost/api/employees/mfa/verify', {
      token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
      body: { factorId: 'fact-123', challengeId: 'chal-123', code: '000000' },
    })
  );
  
  assert.equal(res.status, 500);
});

test('mfa: verify proxy rejects unknown factorId with 400', async () => {
  const { POST } = await import('../app/api/employees/mfa/verify/route.ts');
  configure({ role: 'admin' });
  harness.mfaFactorStatus = 'verified'; // but the ID won't match
  
  const res = await POST(
    jsonRequest('http://localhost/api/employees/mfa/verify', {
      token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
      body: { factorId: 'fact-UNKNOWN', challengeId: 'chal-123', code: '000000' },
    })
  );
  
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, 'Invalid MFA factor.');
});

test('mfa: verify proxy logs failure and returns 400 on invalid code', async () => {
  const { POST } = await import('../app/api/employees/mfa/verify/route.ts');
  configure({ role: 'admin' });
  harness.mfaFactorStatus = 'verified';
  
  const res = await POST(
    jsonRequest('http://localhost/api/employees/mfa/verify', {
      token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
      body: { factorId: 'fact-123', challengeId: 'chal-123', code: '999999' },
    })
  );
  
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, 'Invalid code. Please check your authenticator app and try again.');
  assert.ok(harness.audits.some((row) => row.action === 'employee.mfa_challenge_failed'));
});

test('mfa: verify proxy rejects disabled employee with 403', async () => {
  const { POST } = await import('../app/api/employees/mfa/verify/route.ts');
  configure({ role: 'admin' });
  harness.actor.status = 'disabled';
  harness.syncActor();
  
  const res = await POST(
    jsonRequest('http://localhost/api/employees/mfa/verify', {
      token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
      body: { factorId: 'fact-123', challengeId: 'chal-123', code: '000000' },
    })
  );
  
  assert.equal(res.status, 403);
});

// ---------------------------------------------------------------------------
// IP Audit Capture & Article Publish Error Sanitization
// ---------------------------------------------------------------------------

test('audit IP: records valid trusted client IP from x-vercel-forwarded-for', async () => {
  configure({ role: 'admin', grants: [] });
  const res = await inviteRoute.POST(
    jsonRequest('http://localhost/api/employees/invite', {
      token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMiIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
      headers: { 'x-vercel-forwarded-for': '203.0.113.195, 10.0.0.1' },
      body: { email: 'test@example.com', display_name: 'Test', role_key: 'author', reason: 'IP test' },
    })
  );
  assert.equal(res.status, 403);
  const auditRow = harness.audits.find((row) => row.action === 'employee.permission_denied');
  assert.ok(auditRow, 'Denied action must be recorded in audit log');
  assert.equal(auditRow.ip_address, '203.0.113.195', 'Audit context must extract verified client IP');
});

test('audit IP: discards malformed IP header and sets ip_address to null', async () => {
  configure({ role: 'admin', grants: [] });
  const res = await inviteRoute.POST(
    jsonRequest('http://localhost/api/employees/invite', {
      token: 'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMiIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy',
      headers: { 'x-vercel-forwarded-for': 'malformed-injection-attempt' },
      body: { email: 'test@example.com', display_name: 'Test', role_key: 'author', reason: 'IP injection test' },
    })
  );
  assert.equal(res.status, 403);
  const auditRow = harness.audits.find((row) => row.action === 'employee.permission_denied');
  assert.ok(auditRow, 'Denied action must be recorded in audit log');
  assert.equal(auditRow.ip_address, null, 'Malformed IP must not pass to database inet column');
});

const MFA_VALID_TOKEN =
  'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMiIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy';

test('publish: non-uuid id returns 400 validation error before RPC', async () => {
  configure({ role: 'owner', grants: ['article.publish'] });
  const res = await publishRoute.POST(
    jsonRequest('http://localhost/api/articles/not-a-uuid/publish', {
      token: MFA_VALID_TOKEN,
    }),
    params('not-a-uuid')
  );

  assert.equal(res.status, 400);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'Invalid article ID');
});

test('publish: deliberate state conflict raises pass through with 409', async () => {
  configure({ role: 'owner', grants: ['article.publish'] });
  harness.rpcErrors.publish_article = {
    message: 'Article must be in review status before publishing',
    code: 'P0001',
  };

  const res = await publishRoute.POST(
    jsonRequest(`http://localhost/api/articles/${VALID_UUID}/publish`, {
      token: MFA_VALID_TOKEN,
    }),
    params(VALID_UUID)
  );

  assert.equal(res.status, 409);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'Article must be in review status before publishing');
});

test('publish: article not found returns 404', async () => {
  configure({ role: 'owner', grants: ['article.publish'] });
  harness.rpcErrors.publish_article = {
    message: 'Article not found',
    code: 'P0001',
  };

  const res = await publishRoute.POST(
    jsonRequest(`http://localhost/api/articles/${VALID_UUID}/publish`, {
      token: MFA_VALID_TOKEN,
    }),
    params(VALID_UUID)
  );

  assert.equal(res.status, 404);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'Article not found');
});

test('publish: unapproved P0001 database details are hidden and return 500', async () => {
  configure({ role: 'owner', grants: ['article.publish'] });
  harness.rpcErrors.publish_article = {
    message: 'internal trigger failure: public.articles_integrity_trigger violates check',
    code: 'P0001',
  };

  const res = await publishRoute.POST(
    jsonRequest(`http://localhost/api/articles/${VALID_UUID}/publish`, {
      token: MFA_VALID_TOKEN,
    }),
    params(VALID_UUID)
  );

  assert.equal(res.status, 500);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'Unable to publish article');
  assert.ok(!JSON.stringify(body).includes('integrity_trigger'), 'Internal trigger details must not leak');
});

test('publish: internal database errors are hidden from the client and return 500', async () => {
  configure({ role: 'owner', grants: ['article.publish'] });
  harness.rpcErrors.publish_article = {
    message: 'syntax error at or near "SELECT" in relation "articles"',
    code: '42601',
  };

  const res = await publishRoute.POST(
    jsonRequest(`http://localhost/api/articles/${VALID_UUID}/publish`, {
      token: MFA_VALID_TOKEN,
    }),
    params(VALID_UUID)
  );

  assert.equal(res.status, 500);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'Unable to publish article');
  assert.ok(!JSON.stringify(body).includes('syntax error'), 'Internal error details must not leak');
});

// ---------------------------------------------------------------------------
// Article Input Limits (POST /api/articles & PATCH /api/articles/[id])
// ---------------------------------------------------------------------------

test('articles create: rejects missing or empty title with 400', async () => {
  configure({ role: 'author', grants: ['article.create'] });
  const res = await articlesRoute.POST(
    jsonRequest('http://localhost/api/articles', {
      token: MFA_VALID_TOKEN,
      body: { title: '   ', slug: 'valid-slug', content: 'Some content' },
    })
  );
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error?: string };
  assert.ok(body.error?.includes('Title must be between'));
});

test('articles create: rejects oversized title (>255) with 400', async () => {
  configure({ role: 'author', grants: ['article.create'] });
  const res = await articlesRoute.POST(
    jsonRequest('http://localhost/api/articles', {
      token: MFA_VALID_TOKEN,
      body: { title: 'a'.repeat(256), slug: 'valid-slug', content: 'Some content' },
    })
  );
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error?: string };
  assert.ok(body.error?.includes('Title must be between 1 and 255'));
});

test('articles create: rejects invalid slug format and oversized slug (>255) with 400', async () => {
  configure({ role: 'author', grants: ['article.create'] });
  // Invalid characters
  let res = await articlesRoute.POST(
    jsonRequest('http://localhost/api/articles', {
      token: MFA_VALID_TOKEN,
      body: { title: 'Valid Title', slug: 'Invalid Slug!', content: 'Some content' },
    })
  );
  assert.equal(res.status, 400);
  let body = (await res.json()) as { error?: string };
  assert.ok(body.error?.includes('Slug must contain only'));

  // Oversized slug
  res = await articlesRoute.POST(
    jsonRequest('http://localhost/api/articles', {
      token: MFA_VALID_TOKEN,
      body: { title: 'Valid Title', slug: 'a'.repeat(256), content: 'Some content' },
    })
  );
  assert.equal(res.status, 400);
  body = (await res.json()) as { error?: string };
  assert.ok(body.error?.includes('Slug must be between 1 and 255'));
});

test('articles create: rejects oversized excerpt (>1000) with 400', async () => {
  configure({ role: 'author', grants: ['article.create'] });
  const res = await articlesRoute.POST(
    jsonRequest('http://localhost/api/articles', {
      token: MFA_VALID_TOKEN,
      body: { title: 'Valid Title', slug: 'valid-slug', content: 'Some content', excerpt: 'x'.repeat(1001) },
    })
  );
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error?: string };
  assert.ok(body.error?.includes('Excerpt must not exceed 1000'));
});

test('articles create: rejects empty content and oversized content (>200,000) with 400', async () => {
  configure({ role: 'author', grants: ['article.create'] });
  // Empty content
  let res = await articlesRoute.POST(
    jsonRequest('http://localhost/api/articles', {
      token: MFA_VALID_TOKEN,
      body: { title: 'Valid Title', slug: 'valid-slug', content: '   ' },
    })
  );
  assert.equal(res.status, 400);
  let body = (await res.json()) as { error?: string };
  assert.ok(body.error?.includes('content cannot be empty'));

  // Oversized content
  res = await articlesRoute.POST(
    jsonRequest('http://localhost/api/articles', {
      token: MFA_VALID_TOKEN,
      body: { title: 'Valid Title', slug: 'valid-slug', content: 'x'.repeat(200_001) },
    })
  );
  assert.equal(res.status, 400);
  body = (await res.json()) as { error?: string };
  assert.ok(body.error?.includes('content exceeds maximum allowed length'));
});

test('articles create: rejects invalid URLs or URLs exceeding 2048 chars', async () => {
  configure({ role: 'author', grants: ['article.create'] });
  // javascript: scheme URL
  let res = await articlesRoute.POST(
    jsonRequest('http://localhost/api/articles', {
      token: MFA_VALID_TOKEN,
      body: { title: 'Valid Title', slug: 'valid-slug', content: 'Content', source_url: 'javascript:alert(1)' },
    })
  );
  assert.equal(res.status, 400);
  let body = (await res.json()) as { error?: string };
  assert.ok(body.error?.includes('Source URL must be an HTTP or HTTPS URL'));

  // Oversized URL
  res = await articlesRoute.POST(
    jsonRequest('http://localhost/api/articles', {
      token: MFA_VALID_TOKEN,
      body: { title: 'Valid Title', slug: 'valid-slug', content: 'Content', featured_image_url: `https://example.com/${'x'.repeat(2048)}` },
    })
  );
  assert.equal(res.status, 400);
  body = (await res.json()) as { error?: string };
  assert.ok(body.error?.includes('Featured image URL must not exceed 2048'));
});

test('articles create: accepts valid input and calls create_article RPC', async () => {
  configure({ role: 'author', grants: ['article.create'] });
  const res = await articlesRoute.POST(
    jsonRequest('http://localhost/api/articles', {
      token: MFA_VALID_TOKEN,
      body: {
        title: 'Fresh News from Srinagar',
        slug: 'fresh-news-from-srinagar',
        content: 'Report body text here',
        excerpt: 'Brief overview',
        category: 'local',
        district: 'srinagar',
        source_name: 'KJIN Bureau',
        source_url: 'https://kjin.in/sources/1',
        featured_image_url: 'https://images.unsplash.com/photo-1234',
      },
    })
  );
  assert.equal(res.status, 201);
  const rpcCall = harness.calls.find((c) => c.kind === 'rpc' && c.rpc === 'create_article');
  assert.ok(rpcCall, 'create_article RPC must be invoked');
});

test('articles update: rejects non-uuid id with 400', async () => {
  configure({ role: 'author', grants: ['article.create'] });
  const res = await articleIdRoute.PATCH(
    jsonRequest('http://localhost/api/articles/invalid-uuid', {
      token: MFA_VALID_TOKEN,
      body: { title: 'Updated Title', slug: 'updated-slug', content: 'Updated content' },
    }),
    params('invalid-uuid')
  );
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'Invalid article ID');
});

test('articles update: rejects oversized fields with 400', async () => {
  configure({ role: 'author', grants: ['article.create'] });
  const res = await articleIdRoute.PATCH(
    jsonRequest(`http://localhost/api/articles/${VALID_UUID}`, {
      token: MFA_VALID_TOKEN,
      body: { title: 'x'.repeat(256), slug: 'valid-slug', content: 'Valid content' },
    }),
    params(VALID_UUID)
  );
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error?: string };
  assert.ok(body.error?.includes('Title must be between 1 and 255'));
});

// ---------------------------------------------------------------------------
// Article Lifecycle Permission Verification
// ---------------------------------------------------------------------------

test('permissions: ordinary author without article.publish cannot publish (403)', async () => {
  configure({ role: 'author', grants: ['article.create', 'article.submit_review'] });
  const res = await publishRoute.POST(
    jsonRequest(`http://localhost/api/articles/${VALID_UUID}/publish`, {
      token: MFA_VALID_TOKEN,
    }),
    params(VALID_UUID)
  );
  assert.equal(res.status, 403);
});

test('permissions: ordinary author without article.archive cannot archive (403)', async () => {
  configure({ role: 'author', grants: ['article.create'] });
  const res = await archiveRoute.POST(
    jsonRequest(`http://localhost/api/articles/${VALID_UUID}/archive`, {
      token: MFA_VALID_TOKEN,
    }),
    params(VALID_UUID)
  );
  assert.equal(res.status, 403);
});

test('permissions: ordinary author without article.review cannot return article to draft (403)', async () => {
  configure({ role: 'author', grants: ['article.create'] });
  const res = await returnRoute.POST(
    jsonRequest(`http://localhost/api/articles/${VALID_UUID}/return`, {
      token: MFA_VALID_TOKEN,
    }),
    params(VALID_UUID)
  );
  assert.equal(res.status, 403);
});

test('permissions: editor without article.publish cannot publish (403)', async () => {
  configure({ role: 'editor', grants: ['article.review', 'article.archive'] });
  const res = await publishRoute.POST(
    jsonRequest(`http://localhost/api/articles/${VALID_UUID}/publish`, {
      token: MFA_VALID_TOKEN,
    }),
    params(VALID_UUID)
  );
  assert.equal(res.status, 403);
});

// ---------------------------------------------------------------------------
// Request Body Size Limit Tests
// ---------------------------------------------------------------------------

test('articles create: rejects oversized payload with 413 Payload Too Large', async () => {
  configure({ role: 'author', grants: ['article.create'] });
  const largeContent = 'a'.repeat(520 * 1024);
  const res = await articlesRoute.POST(
    jsonRequest('http://localhost/api/articles', {
      token: MFA_VALID_TOKEN,
      body: { title: 'Valid Title', slug: 'valid-slug', content: largeContent },
    })
  );
  assert.equal(res.status, 413);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'Payload too large');
});

test('articles update: rejects oversized payload with 413 Payload Too Large', async () => {
  configure({ role: 'author', grants: ['article.create'] });
  const largeContent = 'a'.repeat(520 * 1024);
  const res = await articleIdRoute.PATCH(
    jsonRequest(`http://localhost/api/articles/${VALID_UUID}`, {
      token: MFA_VALID_TOKEN,
      body: { title: 'Valid Title', slug: 'valid-slug', content: largeContent },
    }),
    params(VALID_UUID)
  );
  assert.equal(res.status, 413);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'Payload too large');
});

// ---------------------------------------------------------------------------
// URL Strict Validation Tests
// ---------------------------------------------------------------------------

test('articles create: rejects protocol-relative URLs with 400', async () => {
  configure({ role: 'author', grants: ['article.create'] });
  const res = await articlesRoute.POST(
    jsonRequest('http://localhost/api/articles', {
      token: MFA_VALID_TOKEN,
      body: {
        title: 'Valid Title',
        slug: 'valid-slug',
        content: 'Content',
        source_url: '//evil.com/phish',
      },
    })
  );
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error?: string };
  assert.ok(body.error?.includes('must not be a protocol-relative URL'));
});

test('articles create: rejects URLs containing embedded user credentials with 400', async () => {
  configure({ role: 'author', grants: ['article.create'] });
  const res = await articlesRoute.POST(
    jsonRequest('http://localhost/api/articles', {
      token: MFA_VALID_TOKEN,
      body: {
        title: 'Valid Title',
        slug: 'valid-slug',
        content: 'Content',
        source_url: 'https://admin:secret@kjin.in/news',
      },
    })
  );
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error?: string };
  assert.ok(body.error?.includes('must not contain user credentials'));
});

// ---------------------------------------------------------------------------
// Database Error Status Codes & Client Separation Tests
// ---------------------------------------------------------------------------

test('articles create: duplicate slug (23505) returns 409 Conflict', async () => {
  configure({ role: 'author', grants: ['article.create'] });
  harness.rpcErrors.create_article = {
    message: 'duplicate key value violates unique constraint "articles_slug_key"',
    code: '23505',
  };
  const res = await articlesRoute.POST(
    jsonRequest('http://localhost/api/articles', {
      token: MFA_VALID_TOKEN,
      body: { title: 'Duplicate Slug Story', slug: 'duplicate-slug', content: 'Content' },
    })
  );
  assert.equal(res.status, 409);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'An article with this slug already exists');
});

test('articles create: unexpected database error returns 500 without leaking internals', async () => {
  configure({ role: 'author', grants: ['article.create'] });
  harness.rpcErrors.create_article = {
    message: 'syntax error at or near "SELECT" in relation "articles"',
    code: '42601',
  };
  const res = await articlesRoute.POST(
    jsonRequest('http://localhost/api/articles', {
      token: MFA_VALID_TOKEN,
      body: { title: 'Error Story', slug: 'error-slug', content: 'Content' },
    })
  );
  assert.equal(res.status, 500);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'Unable to create article');
  assert.ok(!JSON.stringify(body).includes('42601'));
});

test('articles update: duplicate slug (23505) returns 409 Conflict', async () => {
  configure({ role: 'author', grants: ['article.create'] });
  harness.rpcErrors.update_article = {
    message: 'duplicate key value violates unique constraint "articles_slug_key"',
    code: '23505',
  };
  const res = await articleIdRoute.PATCH(
    jsonRequest(`http://localhost/api/articles/${VALID_UUID}`, {
      token: MFA_VALID_TOKEN,
      body: { title: 'Updated Title', slug: 'conflict-slug', content: 'Updated content' },
    }),
    params(VALID_UUID)
  );
  assert.equal(res.status, 409);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'An article with this slug already exists');
});

test('articles update: unexpected database error returns 500 without leaking internals', async () => {
  configure({ role: 'author', grants: ['article.create'] });
  harness.rpcErrors.update_article = {
    message: 'connection reset by peer',
    code: '08006',
  };
  const res = await articleIdRoute.PATCH(
    jsonRequest(`http://localhost/api/articles/${VALID_UUID}`, {
      token: MFA_VALID_TOKEN,
      body: { title: 'Updated Title', slug: 'valid-slug', content: 'Updated content' },
    }),
    params(VALID_UUID)
  );
  assert.equal(res.status, 500);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'Unable to update article');
  assert.ok(!JSON.stringify(body).includes('08006'));
});

test('articles update: article not found returns 404', async () => {
  configure({ role: 'author', grants: ['article.create'] });
  harness.rpcErrors.update_article = {
    message: 'Article not found',
    code: 'P0001',
  };
  const res = await articleIdRoute.PATCH(
    jsonRequest(`http://localhost/api/articles/${VALID_UUID}`, {
      token: MFA_VALID_TOKEN,
      body: { title: 'Updated Title', slug: 'valid-slug', content: 'Updated content' },
    }),
    params(VALID_UUID)
  );
  assert.equal(res.status, 404);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'Article not found');
});

test('articles update: unauthorized state edit returns 403', async () => {
  configure({ role: 'author', grants: ['article.create'] });
  harness.rpcErrors.update_article = {
    message: 'Unauthorized to edit this article in its current state',
    code: 'P0001',
  };
  const res = await articleIdRoute.PATCH(
    jsonRequest(`http://localhost/api/articles/${VALID_UUID}`, {
      token: MFA_VALID_TOKEN,
      body: { title: 'Updated Title', slug: 'valid-slug', content: 'Updated content' },
    }),
    params(VALID_UUID)
  );
  assert.equal(res.status, 403);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'Unauthorized to edit this article in its current state');
});

test('articles submit: draft conflict returns 409', async () => {
  configure({ role: 'author', grants: ['article.submit_review'] });
  harness.rpcErrors.submit_article_for_review = {
    message: 'Only drafts can be submitted for review',
    code: 'P0001',
  };
  const res = await submitRoute.POST(
    jsonRequest(`http://localhost/api/articles/${VALID_UUID}/submit`, {
      token: MFA_VALID_TOKEN,
    }),
    params(VALID_UUID)
  );
  assert.equal(res.status, 409);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'Only drafts can be submitted for review');
});

test('articles submit: unexpected database error returns 500', async () => {
  configure({ role: 'author', grants: ['article.submit_review'] });
  harness.rpcErrors.submit_article_for_review = {
    message: 'disk full',
    code: '53100',
  };
  const res = await submitRoute.POST(
    jsonRequest(`http://localhost/api/articles/${VALID_UUID}/submit`, {
      token: MFA_VALID_TOKEN,
    }),
    params(VALID_UUID)
  );
  assert.equal(res.status, 500);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'Unable to submit article for review');
});

test('articles return: state conflict returns 409', async () => {
  configure({ role: 'editor', grants: ['article.review'] });
  harness.rpcErrors.return_article_to_draft = {
    message: 'Only articles in review can be returned to draft',
    code: 'P0001',
  };
  const res = await returnRoute.POST(
    jsonRequest(`http://localhost/api/articles/${VALID_UUID}/return`, {
      token: MFA_VALID_TOKEN,
    }),
    params(VALID_UUID)
  );
  assert.equal(res.status, 409);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'Only articles in review can be returned to draft');
});

test('articles return: unexpected database error returns 500', async () => {
  configure({ role: 'editor', grants: ['article.review'] });
  harness.rpcErrors.return_article_to_draft = {
    message: 'syntax error',
    code: '42601',
  };
  const res = await returnRoute.POST(
    jsonRequest(`http://localhost/api/articles/${VALID_UUID}/return`, {
      token: MFA_VALID_TOKEN,
    }),
    params(VALID_UUID)
  );
  assert.equal(res.status, 500);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'Unable to return article to draft');
});

test('articles archive: state conflict returns 409', async () => {
  configure({ role: 'editor', grants: ['article.archive'] });
  harness.rpcErrors.archive_article = {
    message: 'Only published or in-review articles can be archived',
    code: 'P0001',
  };
  const res = await archiveRoute.POST(
    jsonRequest(`http://localhost/api/articles/${VALID_UUID}/archive`, {
      token: MFA_VALID_TOKEN,
    }),
    params(VALID_UUID)
  );
  assert.equal(res.status, 409);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'Only published or in-review articles can be archived');
});

test('articles archive: unexpected database error returns 500', async () => {
  configure({ role: 'editor', grants: ['article.archive'] });
  harness.rpcErrors.archive_article = {
    message: 'lock timeout',
    code: '55P03',
  };
  const res = await archiveRoute.POST(
    jsonRequest(`http://localhost/api/articles/${VALID_UUID}/archive`, {
      token: MFA_VALID_TOKEN,
    }),
    params(VALID_UUID)
  );
  assert.equal(res.status, 500);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'Unable to archive article');
});

// ---------------------------------------------------------------------------
// Granular Permission End-to-End Tests
// ---------------------------------------------------------------------------

test('permissions: author cannot create article without article.create (403)', async () => {
  configure({ role: 'author', grants: [] });
  const res = await articlesRoute.POST(
    jsonRequest('http://localhost/api/articles', {
      token: MFA_VALID_TOKEN,
      body: { title: 'Unauthorized Story', slug: 'unauthorized-story', content: 'Content' },
    })
  );
  assert.equal(res.status, 403);
});

test('permissions: author cannot submit another author draft for review (403)', async () => {
  configure({ role: 'author', grants: ['article.submit_review'] });
  harness.rpcErrors.submit_article_for_review = {
    message: 'Only the author can submit their draft for review',
    code: 'P0001',
  };
  const res = await submitRoute.POST(
    jsonRequest(`http://localhost/api/articles/${VALID_UUID}/submit`, {
      token: MFA_VALID_TOKEN,
    }),
    params(VALID_UUID)
  );
  assert.equal(res.status, 403);
  const body = (await res.json()) as { error?: string };
  assert.equal(body.error, 'Only the author can submit their draft for review');
});

test('permissions: editor with article.review can return article to draft (200)', async () => {
  configure({ role: 'editor', grants: ['article.review'] });
  const res = await returnRoute.POST(
    jsonRequest(`http://localhost/api/articles/${VALID_UUID}/return`, {
      token: MFA_VALID_TOKEN,
    }),
    params(VALID_UUID)
  );
  assert.equal(res.status, 200);
  const call = harness.calls.find((c) => c.kind === 'rpc' && c.rpc === 'return_article_to_draft');
  assert.ok(call);
});

test('permissions: admin with article.publish and AAL2 can publish article (200)', async () => {
  configure({ role: 'admin', grants: ['article.publish'] });
  const res = await publishRoute.POST(
    jsonRequest(`http://localhost/api/articles/${VALID_UUID}/publish`, {
      token: MFA_VALID_TOKEN,
    }),
    params(VALID_UUID)
  );
  assert.equal(res.status, 200);
  const call = harness.calls.find((c) => c.kind === 'rpc' && c.rpc === 'publish_article');
  assert.ok(call);
});

// ---------------------------------------------------------------------------
// GET & POST /api/settings/template
// ---------------------------------------------------------------------------

test('template: GET unauthenticated request returns 401', async () => {
  const res = await templateRoute.GET(
    new Request('http://localhost/api/settings/template', { method: 'GET' })
  );
  assert.equal(res.status, 401);
});

test('template: GET returns active template and available templates list', async () => {
  configure({ role: 'admin' });
  const res = await templateRoute.GET(
    new Request('http://localhost/api/settings/template', {
      method: 'GET',
      headers: { Authorization: `Bearer ${MFA_VALID_TOKEN}` },
    })
  );
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    active_template: { template_id: string; name: string };
    available_templates: Array<{ id: string; name: string }>;
    can_manage: boolean;
  };
  assert.equal(body.active_template.template_id, 'classic-editorial');
  assert.equal(body.available_templates.length, 10);
  assert.equal(body.can_manage, true);
});

test('template: GET indicates can_manage=false for editor and author roles', async () => {
  configure({ role: 'editor' });
  const res = await templateRoute.GET(
    new Request('http://localhost/api/settings/template', {
      method: 'GET',
      headers: { Authorization: `Bearer ${MFA_VALID_TOKEN}` },
    })
  );
  assert.equal(res.status, 200);
  const body = (await res.json()) as { can_manage: boolean };
  assert.equal(body.can_manage, false);
});

test('template: POST unauthenticated request returns 401', async () => {
  const res = await templateRoute.POST(
    jsonRequest('http://localhost/api/settings/template', {
      body: { template_id: 'modern-magazine' },
    })
  );
  assert.equal(res.status, 401);
});

test('template: POST author or editor returns 403 forbidden', async () => {
  configure({ role: 'editor' });
  const res = await templateRoute.POST(
    jsonRequest('http://localhost/api/settings/template', {
      token: MFA_VALID_TOKEN,
      body: { template_id: 'modern-magazine' },
    })
  );
  assert.equal(res.status, 403);
  const body = (await res.json()) as { error?: string };
  assert.match(body.error ?? '', /Only Owner, Superadmin, and Admin/);
});

test('template: POST invalid template_id returns 400', async () => {
  configure({ role: 'admin' });
  const res = await templateRoute.POST(
    jsonRequest('http://localhost/api/settings/template', {
      token: MFA_VALID_TOKEN,
      body: { template_id: 'invalid-nonexistent-template' },
    })
  );
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error?: string };
  assert.match(body.error ?? '', /Invalid template_id/);
});

test('template: POST admin successfully updates template and records audit log (200)', async () => {
  configure({ role: 'admin' });
  const res = await templateRoute.POST(
    jsonRequest('http://localhost/api/settings/template', {
      token: MFA_VALID_TOKEN,
      body: { template_id: 'bento-grid', reason: 'Switching to Bento Grid layout for launch' },
    })
  );
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    success: boolean;
    active_template: { template_id: string; name: string };
  };
  assert.equal(body.success, true);
  assert.equal(body.active_template.template_id, 'bento-grid');

  // Verify site_settings was updated
  const setting = harness.fixtures.site_settings?.find(
    (s: any) => s.key === 'active_template'
  );
  assert.ok(setting);
  assert.equal((setting.value as any).template_id, 'bento-grid');

  // Verify audit log
  const audit = harness.audits.find(
    (a) => a.action === 'site_settings.template_changed'
  );
  assert.ok(audit, 'Audit log entry must be created on template change');
  assert.equal(audit.target_type, 'site_settings');
  assert.equal((audit.details as any)?.template_id, 'bento-grid');
});

test('template: POST superadmin and owner can activate templates (200)', async () => {
  configure({ role: 'superadmin' });
  const resSuper = await templateRoute.POST(
    jsonRequest('http://localhost/api/settings/template', {
      token: MFA_VALID_TOKEN,
      body: { template_id: 'breaking-wire' },
    })
  );
  assert.equal(resSuper.status, 200);

  configure({ role: 'owner' });
  const resOwner = await templateRoute.POST(
    jsonRequest('http://localhost/api/settings/template', {
      token: MFA_VALID_TOKEN,
      body: { template_id: 'minimal-focus' },
    })
  );
  assert.equal(resOwner.status, 200);
  const bodyOwner = (await resOwner.json()) as { active_template: { template_id: string } };
  assert.equal(bodyOwner.active_template.template_id, 'minimal-focus');
});


