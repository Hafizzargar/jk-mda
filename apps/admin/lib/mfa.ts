/**
 * Universal Zero-Trust MFA Policy:
 * Enforced unconditionally across ALL environments (local development, test, staging, and production).
 * Every authenticated staff role (owner, superadmin, admin, editor, author) strictly requires
 * TOTP Two-Factor Authentication (AAL2). No bypasses or security downgrades are permitted.
 */
export function requiresMfa(role?: string | null): boolean {
  if (!role) return true;
  // All newsroom staff and employees (owner, superadmin, admin, editor, author) strictly require MFA
  return ['owner', 'superadmin', 'admin', 'editor', 'author'].includes(role.toLowerCase());
}
