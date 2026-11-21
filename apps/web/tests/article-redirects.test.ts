import test from 'node:test';
import assert from 'node:assert/strict';
import { ARTICLE_REDIRECTS, findArticleRedirect, getArticleRedirectPath } from '../lib/article-redirects';

test('known duplicate ISRO URLs resolve to the selected canonical article', () => {
  for (const redirect of ARTICLE_REDIRECTS) {
    assert.deepEqual(
      findArticleRedirect(redirect.sourceCategory, redirect.sourceSlug),
      redirect,
    );
    assert.equal(
      redirect.targetSlug,
      'isro-validates-cryogenic-upper-stage-gaganyaan-orbital-module-2026',
    );
  }
});

test('article redirects do not match unrelated categories or slugs', () => {
  assert.equal(
    findArticleRedirect('national', 'another-isro-story'),
    undefined,
  );
  assert.equal(
    findArticleRedirect('science', ARTICLE_REDIRECTS[0].sourceSlug),
    undefined,
  );
});

test('known duplicate routes redirect directly to the surviving URL', () => {
  for (const redirect of ARTICLE_REDIRECTS) {
    assert.equal(
      getArticleRedirectPath(`/en/${redirect.sourceCategory}/${redirect.sourceSlug}`),
      `/en/${redirect.targetCategory}/${redirect.targetSlug}`,
    );
  }
  assert.equal(getArticleRedirectPath('/en/national/not-a-duplicate'), undefined);
});
