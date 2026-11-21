import test from 'node:test';
import assert from 'node:assert/strict';
import { getCleanSlug, resolveDbSlug } from '../lib/slug-aliases';

test('article URL slugs preserve the exact stored suffix', () => {
  for (const slug of [
    'local-road-update-2026',
    'chenab-valley-report-x8xf',
    'cop31-update-1j47-ca84',
  ]) {
    assert.equal(getCleanSlug(slug), slug);
  }
});

test('legacy clean slugs still resolve to their stored article slug', () => {
  assert.equal(
    resolveDbSlug('mla-mehraj-malik-power-water-crisis'),
    'doda-mla-mehraj-malik-demands-accountability-for-crippling-power-water-crisis-pxid',
  );
});
