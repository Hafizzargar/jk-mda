import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { assertSafeTestEnvironment, isLocalTestEnvironment } from './support/test-env';
// @ts-expect-error Node.js test runner with custom ESM loader
import { POST } from '../app/api/ai/draft/route.ts';
// @ts-expect-error Node.js test runner with custom ESM loader
import { setCustomDraftGenerator } from '../lib/ai-provider.ts';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const isSafeLocal = isLocalTestEnvironment(SUPABASE_URL);

if (!SERVICE_KEY || !ANON_KEY) {
  console.warn('⚠️  [SKIPPED] P0: AI Drafting & Mandatory Review — Integration test skipped because SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set.');
} else if (!isSafeLocal) {
  console.warn(`⚠️  [SKIPPED] P0: AI Drafting & Mandatory Review — Integration test refused to run against non-local database (${SUPABASE_URL}) to protect production.`);
}

describe('P0: AI Drafting & Mandatory Review', { skip: !SERVICE_KEY || !ANON_KEY || !isSafeLocal }, () => {
  const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY);
  const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  let authorToken: string;
  let authorId: string;

  before(async () => {
    assertSafeTestEnvironment(SUPABASE_URL, 'P0: AI Drafting & Mandatory Review');
    // 1. Create Author
    const authorInviteId = crypto.randomUUID();
    const authorEmail = `test-author-ai-${Date.now()}@kjin.local`;
    const { error: inviteErr } = await serviceClient.from('employee_invites').insert({
      id: authorInviteId, email: authorEmail, role_key: 'author', status: 'sending'
    });
    if (inviteErr) throw inviteErr;

    const { data: authorData, error: userErr } = await serviceClient.auth.admin.createUser({
      email: authorEmail, password: 'password123', email_confirm: true,
      user_metadata: { employee_invite_id: authorInviteId, display_name: 'AI Test Author' }
    });
    if (userErr) throw userErr;
    authorId = authorData.user!.id;

    const { data: authorSession, error: signInErr } = await anonClient.auth.signInWithPassword({
      email: authorEmail, password: 'password123'
    });
    if (signInErr) throw signInErr;
    authorToken = authorSession.session!.access_token;
  });

  after(async () => {
    setCustomDraftGenerator(null);
    if (authorId) {
      await serviceClient.from('ai_usage_logs').delete().eq('user_id', authorId);
      await serviceClient.auth.admin.deleteUser(authorId);
    }
  });

  it('rejects unauthenticated requests to AI draft route', async () => {
    const req = new Request('http://localhost/api/ai/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawFacts: 'test facts with minimum length' })
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 401, 'Unauthenticated requests must be rejected');
  });

  it('rejects undersized input before AI invocation', async () => {
    const req = new Request('http://localhost/api/ai/draft', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authorToken}`
      },
      body: JSON.stringify({ rawFacts: 'short' })
    });
    const res = await POST(req);
    assert.strictEqual(res.status, 400, 'Undersized raw facts must be rejected with 400');
  });

  it('returns 503 when live AI provider is unconfigured and no mock generator is registered', async () => {
    const originalApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    setCustomDraftGenerator(null);

    try {
      const req = new Request('http://localhost/api/ai/draft', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authorToken}`
        },
        body: JSON.stringify({ rawFacts: 'The municipal council held an emergency meeting today regarding budget.' })
      });
      const res = await POST(req);
      assert.strictEqual(res.status, 503, 'Missing API key must return 503 Service Unavailable');
    } finally {
      if (originalApiKey) process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalApiKey;
    }
  });

  it('deterministically generates draft with mocked AI provider, sanitizes HTML, and never auto-publishes', async () => {
    const mockTitle = 'Municipal Council Announces Annual Budget 2026';
    const mockExcerpt = 'Srinagar municipal council has approved its comprehensive development plan.';
    const mockContentWithXss = '<p>The municipal council has formally approved its annual fiscal budget.</p><script>alert("xss")</script><img src="invalid" onerror="alert(1)">';
    const mockSlug = 'municipal-council-announces-annual-budget-2026';

    setCustomDraftGenerator(async ({ rawFacts }) => {
      assert.ok(rawFacts.includes('annual budget'), 'Generator must receive verified rawFacts input');
      return {
        title: mockTitle,
        excerpt: mockExcerpt,
        content: mockContentWithXss,
        slug: mockSlug,
        category: 'Politics',
        district: 'srinagar',
      };
    });

    try {
      const req = new Request('http://localhost/api/ai/draft', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authorToken}`
        },
        body: JSON.stringify({ rawFacts: 'The local municipal council announced a new annual budget in Srinagar.' })
      });
      const res = await POST(req);
      assert.strictEqual(res.status, 200, 'Mocked generation must return 200 OK');

      const data = await res.json();
      assert.strictEqual(data.title, mockTitle, 'Draft must return generated title');
      assert.strictEqual(data.excerpt, mockExcerpt, 'Draft must return generated excerpt');
      assert.strictEqual(data.slug, mockSlug, 'Draft must return generated slug');
      assert.strictEqual(data.category, 'Politics', 'Draft must return generated category');
      assert.strictEqual(data.district, 'srinagar', 'Draft must return generated district');

      // 1. Verify HTML sanitization stripped executable XSS payloads from model output
      assert.ok(!data.content.includes('<script>'), 'Sanitized content must strip <script> tag');
      assert.ok(!data.content.includes('onerror'), 'Sanitized content must strip inline event handlers');
      assert.ok(data.content.includes('<p>The municipal council has formally approved its annual fiscal budget.</p>'), 'Sanitized content must retain safe HTML tags');

      // 2. Verify that AI drafting NEVER inserts or publishes an article directly into the database
      const { data: articles, error: artErr } = await serviceClient.from('articles').select('id, title').eq('title', mockTitle);
      assert.ifError(artErr);
      assert.strictEqual(articles?.length, 0, 'AI must NOT automatically insert or publish the draft into public.articles');

      // 3. Verify rate limiter usage was recorded
      const { data: logs, error: logErr } = await serviceClient.from('ai_usage_logs').select('id').eq('user_id', authorId).eq('endpoint', 'draft');
      assert.ifError(logErr);
      assert.ok(logs && logs.length > 0, 'Successful generation must consume quota and record an ai_usage_logs entry');
    } finally {
      setCustomDraftGenerator(null);
    }
  });
});
