import test from 'node:test';
import assert from 'node:assert/strict';

import { authRoles, canAccessRole, resolveUserRole } from './index.ts';

test('authRoles includes the expected role hierarchy', () => {
  assert.deepEqual(authRoles, ['owner', 'superadmin', 'admin', 'editor', 'author']);
});

test('canAccessRole enforces the role hierarchy', () => {
  assert.equal(canAccessRole('admin', 'editor'), true);
  assert.equal(canAccessRole('editor', 'admin'), false);
  assert.equal(canAccessRole('owner', 'author'), true);
  assert.equal(canAccessRole('author', 'owner'), false);
});

test('resolveUserRole reads the strongest role from Supabase auth metadata', () => {
  assert.equal(
    resolveUserRole({
      app_metadata: { role: 'editor' },
      user_metadata: { role: 'admin' },
    }),
    'admin'
  );

  assert.equal(
    resolveUserRole({
      app_metadata: { role: 'SUPERADMIN' },
      user_metadata: { role: 'author' },
    }),
    'superadmin'
  );

  assert.equal(resolveUserRole({ user_metadata: { role: '  editor  ' } }), 'editor');
  assert.equal(resolveUserRole({}), null);
});
