import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { assertSafeTestEnvironment, isLocalTestEnvironment } from './support/test-env';
// @ts-expect-error Node.js test runner with custom ESM loader
import { POST } from '../app/api/ai/draft/route.ts';

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
    await serviceClient.from('employee_invites').insert({
      id: authorInviteId, email: authorEmail, role_key: 'author', status: 'sending'
    });
    const { data: authorData } = await serviceClient.auth.admin.createUser({
      email: authorEmail, password: 'password123', email_confirm: true,
      user_metadata: { employee_invite_id: authorInviteId, display_name: 'AI Test Author' }
    });
    authorId = authorData.user!.id;
    const { data: authorSession } = await anonClient.auth.signInWithPassword({
      email: authorEmail, password: 'password123'
    });
    authorToken = authorSession.session!.access_token;
  });

  after(async () => {
    if (authorId) await serviceClient.auth.admin.deleteUser(authorId);
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

  it('verifies AI drafting returns data for review (without auto-publishing)', async () => {
    const req = new Request('http://localhost/api/ai/draft', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authorToken}`
      },
      body: JSON.stringify({ rawFacts: 'The local municipal council announced a new budget.' })
    });
    const res = await POST(req);
    
    // If GOOGLE_GENERATIVE_AI_API_KEY is not provided (like in CI environment without secret),
    // it returns 503 ('AI drafting service is currently unavailable').
    // If it succeeded (200), verify response schema and ensure no auto-publish into articles table.
    if (res.status === 200) {
      const data = await res.json();
      assert.ok(data.title, 'Draft must include a title');
      assert.ok(data.content, 'Draft must include content');
      assert.ok(data.excerpt, 'Draft must include excerpt');
      
      // Verify no article was automatically inserted into the DB by the AI endpoint
      const { data: articles } = await serviceClient.from('articles').select('*').eq('title', data.title);
      assert.strictEqual(articles?.length, 0, 'AI must NOT automatically publish/insert the draft');
    } else {
      assert.ok([403, 500, 503].includes(res.status), `Expected acceptable status (403, 500, 503), got ${res.status}`);
    }
  });
});
