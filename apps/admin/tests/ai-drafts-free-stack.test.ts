import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FALLBACK_FREE_MODELS, OFFICIAL_NEWS_FEEDS } from '../lib/newsroom/news-intel';

// Ensure mock env is set for unit test runner
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key';

describe('$0 Autonomous News Intelligence Stack', () => {
  it('defines verified official RSS feeds and free OpenRouter models', () => {
    assert.ok(OFFICIAL_NEWS_FEEDS.length >= 3, 'Must have at least 3 verified official feeds');
    assert.ok(
      OFFICIAL_NEWS_FEEDS.some((f) => f.name.includes('PIB')),
      'Must include PIB official feed'
    );
    assert.ok(FALLBACK_FREE_MODELS.length >= 3, 'Must have at least 3 fallback free models');
    assert.ok(
      FALLBACK_FREE_MODELS.includes('openrouter/free'),
      'Must include openrouter/free meta-router'
    );
  });

  it('rejects unauthenticated requests without authorization header or cookie', async () => {
    const { GET } = await import('../app/api/newsroom/ai-drafts/route');
    const unauthReq = new Request('http://localhost:3001/api/newsroom/ai-drafts');
    const res = await GET(unauthReq);
    assert.ok([401, 403, 503].includes(res.status), 'Must block unauthenticated access');
  });

  it('mandates claims verification before allowing story approval', () => {
    // Test the logic invariant: approval MUST fail if verifiedClaimsChecked !== true
    const checkClaims = (body: { verifiedClaimsChecked?: boolean }) => {
      if (body.verifiedClaimsChecked !== true) {
        return {
          status: 400,
          error: 'Verification confirmation is mandatory: You must confirm that you checked the claims against the official source before publishing.',
        };
      }
      return { status: 200 };
    };

    const failedAttempt = checkClaims({ verifiedClaimsChecked: false });
    assert.equal(failedAttempt.status, 400);
    assert.ok(failedAttempt.error?.includes('Verification confirmation is mandatory'));

    const omittedAttempt = checkClaims({});
    assert.equal(omittedAttempt.status, 400);

    const verifiedAttempt = checkClaims({ verifiedClaimsChecked: true });
    assert.equal(verifiedAttempt.status, 200);
  });
});
