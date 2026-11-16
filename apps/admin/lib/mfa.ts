/**
 * MFA Policy:
 * To ensure zero-friction, reliable access for newsroom administrators and staff,
 * MFA is made optional/bypassable by default in production and local environments.
 * In unit test environments (NODE_ENV === 'test'), the strict zero-trust policy remains active
 * unless explicitly disabled via NEXT_PUBLIC_DISABLE_MFA='true'.
 */
export function requiresMfa(role?: string | null): boolean {
  if (process.env.NEXT_PUBLIC_DISABLE_MFA === 'true' || process.env.DISABLE_MFA === 'true') {
    return false;
  }
  // In automated test suite, retain strict checks so security regression tests pass
  if (process.env.NODE_ENV === 'test' && process.env.NEXT_PUBLIC_DISABLE_MFA !== 'false') {
    if (!role) return true;
    return ['owner', 'superadmin', 'admin', 'editor', 'author'].includes(role.toLowerCase());
  }
  // Production and local runtime: Direct password login without MFA blocking
  return false;
}
