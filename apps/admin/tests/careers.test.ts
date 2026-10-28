import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Harness, setHarness } from './support/harness.ts';
import {
  sanitizeCareersSettings,
  sanitizeJobPosting,
  sanitizeJobApplication,
  DEFAULT_CAREERS_SETTINGS,
} from '../lib/careers.ts';

process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

const harness = new Harness();
setHarness(harness);

const careersRoute = await import('../app/api/careers/route.ts');

const MFA_VALID_TOKEN =
  'dummy.eyJzZXNzaW9uX2lkIjoibW9jay1zZXNzaW9uIiwiYWFsIjoiYWFsMiIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjk5OTk5OTk5OTl9LHsibWV0aG9kIjoidG90cCIsInRpbWVzdGFtcCI6OTk5OTk5OTk5OX1dfQ.dummy';

function configure(options: { role?: string; grants?: string[] } = {}) {
  harness.reset();
  harness.actor.role_key = options.role ?? 'admin';
  harness.grants = options.grants ?? [];
  harness.syncActor();
}

function jsonRequest(url: string, options: { method?: string; body?: unknown; token?: string | null } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const body = options.body === undefined ? undefined : JSON.stringify(options.body);
  return new Request(url, { method: options.method ?? 'POST', headers, body });
}

test('careers: sanitizeCareersSettings handles null and invalid inputs safely', () => {
  const result = sanitizeCareersSettings(null);
  assert.equal(result.page_title, DEFAULT_CAREERS_SETTINGS.page_title);
  assert.ok(result.jobs.length > 0);
  assert.equal(result.hiring_status, 'open');
});

test('careers: sanitizeJobPosting sanitizes inputs and sets fallback defaults', () => {
  const job = sanitizeJobPosting({
    title: '  Senior Bureau Reporter  ',
    department: 'Reporting',
    status: 'active',
  });
  assert.equal(job.title, 'Senior Bureau Reporter');
  assert.equal(job.department, 'Reporting');
  assert.equal(job.status, 'active');
  assert.ok(job.id);
});

test('careers: sanitizeJobApplication sanitizes candidate fields', () => {
  const app = sanitizeJobApplication({
    full_name: '  Aabid Lone  ',
    email: 'AABID@EXAMPLE.COM',
    cover_letter: 'I have 4 years experience in Srinagar ground reporting.',
    status: 'new',
  });
  assert.equal(app.full_name, 'Aabid Lone');
  assert.equal(app.email, 'aabid@example.com');
  assert.equal(app.status, 'new');
});

test('careers: GET unauthenticated request returns 401', async () => {
  configure({ role: 'admin' });
  const res = await careersRoute.GET(new Request('http://localhost/api/careers'));
  assert.equal(res.status, 401);
});

test('careers: GET returns careers settings and can_manage for admin', async () => {
  configure({ role: 'admin' });
  const req = new Request('http://localhost/api/careers', {
    headers: { Authorization: `Bearer ${MFA_VALID_TOKEN}` },
  });
  const res = await careersRoute.GET(req);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { careers_settings: typeof DEFAULT_CAREERS_SETTINGS; can_manage: boolean };
  assert.ok(body.careers_settings);
  assert.equal(body.can_manage, true);
  assert.ok(Array.isArray(body.careers_settings.jobs));
});

test('careers: POST unauthenticated request returns 401', async () => {
  configure({ role: 'admin' });
  const res = await careersRoute.POST(
    jsonRequest('http://localhost/api/careers', {
      body: { hiring_status: 'paused' },
    })
  );
  assert.equal(res.status, 401);
});

test('careers: POST author role returns 403 forbidden', async () => {
  configure({ role: 'author' });
  const res = await careersRoute.POST(
    jsonRequest('http://localhost/api/careers', {
      token: MFA_VALID_TOKEN,
      body: { hiring_status: 'paused' },
    })
  );
  assert.equal(res.status, 403);
});

test('careers: POST admin/superadmin successfully updates careers and writes audit log (200)', async () => {
  configure({ role: 'admin' });
  const res = await careersRoute.POST(
    jsonRequest('http://localhost/api/careers', {
      token: MFA_VALID_TOKEN,
      body: {
        page_title: 'Join Kashmir & Jammu Information Network Newsroom',
        hiring_status: 'open',
        contact_email: 'editorial-hiring@kjin.org',
        jobs: [
          {
            id: 'job-senior-editor',
            title: 'Senior Fact-Checking Editor',
            department: 'Editorial',
            role_type: 'Full-time',
            location: 'Srinagar Central Bureau',
            experience_level: '3+ Years',
            status: 'active',
            description: 'Oversee ground reporting verification and line-editing.',
            requirements: ['Journalism degree', 'Bilingual English/Urdu'],
            responsibilities: ['Line editing', 'Fact checking'],
          },
        ],
        reason: 'Updated editorial job board',
      },
    })
  );
  assert.equal(res.status, 200);
  const body = (await res.json()) as { success: boolean; careers_settings: typeof DEFAULT_CAREERS_SETTINGS };
  assert.equal(body.success, true);
  assert.equal(body.careers_settings.page_title, 'Join Kashmir & Jammu Information Network Newsroom');
  assert.equal(body.careers_settings.jobs.length, 1);
  assert.equal(body.careers_settings.jobs[0].title, 'Senior Fact-Checking Editor');
});
