export function requiresMfa(role: string): boolean {
  if (
    process.env.NODE_ENV !== 'production' &&
    (process.env.NEXT_PUBLIC_DEV_BYPASS_MFA === 'true' || process.env.DEV_BYPASS_MFA === 'true')
  ) {
    return false;
  }
  return ['owner', 'superadmin', 'admin'].includes(role);
}
