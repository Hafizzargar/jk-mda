export function requiresMfa(role: string): boolean {
  return ['owner', 'superadmin', 'admin'].includes(role);
}
