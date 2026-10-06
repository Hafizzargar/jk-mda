import test from 'node:test';
import assert from 'node:assert/strict';

import { authRoles, canAccessRole, normalizeRole } from './index.ts';

test('authRoles includes the expected role hierarchy', () => {
  assert.deepEqual(authRoles, ['owner', 'superadmin', 'admin', 'editor', 'author']);
});

test('canAccessRole enforces the role hierarchy', () => {
  assert.equal(canAccessRole('admin', 'editor'), true);
  assert.equal(canAccessRole('editor', 'admin'), false);
  assert.equal(canAccessRole('owner', 'author'), true);
  assert.equal(canAccessRole('author', 'owner'), false);
  assert.equal(canAccessRole('something-invalid', 'author'), false);
  assert.equal(canAccessRole('editor', 'unknown-role'), false);
});

test('normalizeRole rejects unknown role values', () => {
  assert.equal(normalizeRole('  EDITOR  '), 'editor');
  assert.equal(normalizeRole('something-invalid'), null);
  assert.equal(normalizeRole(null), null);
});
