
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import {
  assertSafeTestEnvironment,
  isLocalTestEnvironment,
} from './support/test-env';

// @ts-expect-error Node.js test runner with custom ESM loader
import { POST } from '../app/api/ai/summarize/route.ts';
// @ts-expect-error Node.js test runner with custom ESM loader
import { setCustomSummarizeGenerator } from './support/ai-mock.ts';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const isSafeLocal = isLocalTestEnvironment(SUPABASE_URL);

if (!SERVICE_KEY || !ANON_KEY) {
  console.warn(
    '⚠️  [SKIPPED] AI Summarization Integration — Integration test skipped because SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set.',
  );
} else if (!isSafeLocal) {
  console.warn(
    `⚠️  [SKIPPED] AI Summarization Integration — Integration test refused to run against non-local database (${SUPABASE_URL}) to protect production.`,
  );
}

const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY || 'missing', {
  auth: { persistSession: false, autoRefreshToken: false },
});

const anonClient = createClient(SUPABASE_URL, ANON_KEY || 'missing', {
  auth: { persistSession: false, autoRefreshToken: false },
});

describe(
  'AI summarization integration',
  { skip: !SERVICE_KEY || !ANON_KEY || !isSafeLocal },
  () => {
    let authorId = '';
    let authorToken = '';
    let authorInviteId = '';
    let authorEmail = '';

    before(async () => {
      assertSafeTestEnvironment(
        SUPABASE_URL,
        'AI summarization integration',
      );

      authorInviteId = crypto.randomUUID();
      authorEmail = `test-summary-${Date.now()}@kjin.local`;

      // 1. Create Author Invite
      const { error: inviteError } =
        await serviceClient
          .from('employee_invites')
          .insert({
            id: authorInviteId,
            email: authorEmail,
            role_key: 'author',
            status: 'sending',
          });

      if (inviteError) throw inviteError;

      // 2. Create Auth User linked to invite (initially unconfirmed)
      const { data: userData, error: userError } =
        await serviceClient.auth.admin.createUser({
          email: authorEmail,
          password: 'test-password-123!',
          email_confirm: false,
          user_metadata: {
            employee_invite_id: authorInviteId,
            display_name: 'Summary Test Author',
          },
        });

      if (userError) throw userError;
      authorId = userData.user.id;

      // 3. Confirm email to trigger activation workflow
      const { error: confirmErr } = await serviceClient.auth.admin.updateUserById(authorId, {
        email_confirm: true,
      });
      if (confirmErr) throw confirmErr;

      // Ensure profile is marked active and invite accepted
      const { error: profileErr } = await serviceClient.from('profiles').update({ status: 'active' }).eq('id', authorId);
      if (profileErr) throw profileErr;

      const { error: inviteUpdateErr } = await serviceClient.from('employee_invites').update({ status: 'accepted' }).eq('id', authorInviteId);
      if (inviteUpdateErr) throw inviteUpdateErr;

      // 4. Authenticate as Author
      const { data: sessionData, error: signInError } =
        await anonClient.auth.signInWithPassword({
          email: authorEmail,
          password: 'test-password-123!',
        });

      if (signInError) throw signInError;
      authorToken = sessionData.session!.access_token;

      // 5. Assert fixture has active article.create permission before running route tests
      const authorClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${authorToken}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: hasPerm, error: permErr } = await authorClient.rpc('has_permission', {
        p_permission_key: 'article.create',
      });
      assert.ifError(permErr);
      assert.strictEqual(hasPerm, true, 'Author fixture must have active article.create permission');
    });

    after(async () => {
      setCustomSummarizeGenerator(null);

      if (authorId) {
        const { error: logErr } = await serviceClient
          .from('ai_usage_logs')
          .delete()
          .eq('user_id', authorId);

        if (logErr) {
          console.error('Failed to clean test usage logs:', logErr.message);
        }

        const { error: deleteError } =
          await serviceClient.auth.admin.deleteUser(authorId);

        if (deleteError) {
          console.error('Failed to clean test user:', deleteError.message);
        }
      }

      if (authorInviteId) {
        const { error: invErr } = await serviceClient.from('employee_invites').delete().eq('id', authorInviteId);
        if (invErr) console.error('Failed to clean test invite:', invErr.message);
      }
      if (authorEmail) {
        const { error: emailErr } = await serviceClient.from('employee_invites').delete().eq('email', authorEmail);
        if (emailErr) console.error('Failed to clean test invite by email:', emailErr.message);
      }
    });

    function makeRequest(content: string) {
      return new Request(
        'http://localhost/api/ai/summarize',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authorToken}`,
          },
          body: JSON.stringify({ content }),
        },
      );
    }

    it('rejects unauthenticated requests', async () => {
      const response = await POST(
        new Request('http://localhost/api/ai/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'A sufficiently long article for testing.',
          }),
        }),
      );

      assert.equal(response.status, 401);
    });

    it('rejects invalid content before invoking AI', async () => {
      let generatorCalled = false;

      setCustomSummarizeGenerator(async () => {
        generatorCalled = true;
        return { excerpt: 'This should not be returned.' };
      });

      try {
        const response = await POST(makeRequest('short'));

        assert.equal(response.status, 400);
        assert.equal(generatorCalled, false);
      } finally {
        setCustomSummarizeGenerator(null);
      }
    });

    it('returns 503 when the provider is unavailable', async () => {
      const originalKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      setCustomSummarizeGenerator(null);

      try {
        const response = await POST(
          makeRequest(
            'The local council announced a new public transport plan today.',
          ),
        );

        assert.equal(response.status, 503);
      } finally {
        if (originalKey === undefined) {
          delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        } else {
          process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalKey;
        }
      }
    });

    it('returns a validated summary and records usage', async () => {
      const expectedExcerpt =
        'The council announced a new transport plan for local residents.';

      setCustomSummarizeGenerator(async ({ content }) => {
        assert.ok(content.includes('public transport'));

        return { excerpt: expectedExcerpt };
      });

      try {
        const response = await POST(
          makeRequest(
            'The local council announced a new public transport plan today.',
          ),
        );

        assert.equal(response.status, 200);

        const result = await response.json();
        assert.deepEqual(result, { excerpt: expectedExcerpt });

        const { data: logs, error } = await serviceClient
          .from('ai_usage_logs')
          .select('id')
          .eq('user_id', authorId)
          .eq('endpoint', 'summarize');

        assert.ifError(error);
        assert.ok(logs && logs.length > 0);
      } finally {
        setCustomSummarizeGenerator(null);
      }
    });

    it('returns 502 when model or mock produces invalid summary output', async () => {
      setCustomSummarizeGenerator(async () => {
        return { excerpt: '' }; // violates min(1)
      });

      try {
        const response = await POST(
          makeRequest(
            'The local council announced a new public transport plan today.',
          ),
        );

        assert.equal(response.status, 502);
        const data = await response.json();
        assert.equal(data.error, 'AI generated an invalid summary. Please try again.');
      } finally {
        setCustomSummarizeGenerator(null);
      }
    });

    it('strips HTML tags from the model-generated excerpt as defense-in-depth', async () => {
      const excerptWithHtml =
        'Council approves plan. <script>alert("xss")</script><b>Important</b> update.';

      setCustomSummarizeGenerator(async () => ({
        excerpt: excerptWithHtml,
      }));

      try {
        const response = await POST(
          makeRequest(
            'The local council announced a new public transport plan today.',
          ),
        );

        assert.equal(response.status, 200);
        const result = await response.json();
        assert.ok(
          !result.excerpt.includes('<script>'),
          'Script tags must be stripped from excerpt',
        );
        assert.ok(
          !result.excerpt.includes('<b>'),
          'HTML tags must be stripped from excerpt',
        );
        assert.ok(
          result.excerpt.includes('Council approves plan.'),
          'Plain text content must be preserved',
        );
        assert.ok(
          result.excerpt.includes('Important'),
          'Text within stripped tags must be preserved',
        );
      } finally {
        setCustomSummarizeGenerator(null);
      }
    });

    it('returns 429 when the summarization quota is exhausted', async () => {
      setCustomSummarizeGenerator(async () => ({
        excerpt: 'The generator must not run.',
      }));

      const { error: clearError } = await serviceClient
        .from('ai_usage_logs')
        .delete()
        .eq('user_id', authorId)
        .eq('endpoint', 'summarize');

      assert.ifError(clearError);

      const quotaRows = Array.from({ length: 50 }, () => ({
        user_id: authorId,
        endpoint: 'summarize',
      }));

      const { error: insertError } = await serviceClient
        .from('ai_usage_logs')
        .insert(quotaRows);

      assert.ifError(insertError);

      try {
        const response = await POST(
          makeRequest(
            'The local council announced a new public transport plan today.',
          ),
        );

        assert.equal(response.status, 429);
      } finally {
        setCustomSummarizeGenerator(null);
      }
    });
  },
);
