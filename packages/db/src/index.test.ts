import test from 'node:test';
import assert from 'node:assert/strict';

import { articleStatusOptions, normalizeArticleInsert, summarizeArticleQueue } from './index.ts';

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

test('summarizeArticleQueue returns live dashboard metrics and queue items', () => {
  const result = summarizeArticleQueue([
    { title: 'Draft one', summary: 'Draft summary', body: 'Body', category: 'Local', author: 'A', language: 'en', status: 'draft' },
    { title: 'Review one', summary: 'Review summary', body: 'Body', category: 'Local', author: 'B', language: 'ur', status: 'review' },
    { title: 'Review two', summary: 'Review summary', body: 'Body', category: 'Local', author: 'C', language: 'hi', status: 'review' },
    { title: 'Published one', summary: 'Published summary', body: 'Body', category: 'Local', author: 'D', language: 'en', status: 'published' },
  ]);

  assert.deepEqual(result.stats, [
    { label: 'Drafts', value: 1 },
    { label: 'Pending review', value: 2 },
    { label: 'Published today', value: 1 },
    { label: 'Alerts', value: 0 },
  ]);

  assert.equal(result.queue.length, 4);
  assert.equal(result.queue[0].title, 'Review one');
  assert.equal(result.queue[1].title, 'Review two');
  assert.equal(result.queue[2].title, 'Draft one');
  assert.equal(result.queue[3].title, 'Published one');
});
