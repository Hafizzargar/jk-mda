export function requiresMfa(role?: string | null): boolean {
  if (
    process.env.NODE_ENV !== 'production' &&
    (process.env.NEXT_PUBLIC_DEV_BYPASS_MFA === 'true' || process.env.DEV_BYPASS_MFA === 'true')
  ) {
    return false;
  }
  if (!role) return true;
  // All newsroom staff and employees (owner, superadmin, admin, editor, author) require MFA
  return ['owner', 'superadmin', 'admin', 'editor', 'author'].includes(role.toLowerCase());
}

