import test from 'node:test';
import assert from 'node:assert/strict';

import { articleStatusOptions, normalizeArticleInsert } from './index.ts';

test('article status options reflect the supported editorial states', () => {
  assert.deepEqual(articleStatusOptions, ['draft', 'review', 'published', 'archived']);
});

test('normalizeArticleInsert trims content and preserves valid role data', () => {
  const record = normalizeArticleInsert({
    title: '  A strong headline  ',
    summary: '  A useful summary  ',
    body: '  Full text here  ',
    category: '  Health  ',
    author: '  Staff reporter  ',
    language: 'ur',
    status: 'review',
  });

  assert.deepEqual(record, {
    title: 'A strong headline',
    summary: 'A useful summary',
    body: 'Full text here',
    category: 'Health',
    author: 'Staff reporter',
    language: 'ur',
    status: 'review',
  });
});
