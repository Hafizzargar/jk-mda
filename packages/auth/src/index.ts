export const authRoles = ['owner', 'superadmin', 'admin', 'editor', 'author'] as const;

export type AuthRole = (typeof authRoles)[number];

const rolePriority: Record<AuthRole, number> = {
  owner: 5,
  superadmin: 4,
  admin: 3,
  editor: 2,
  author: 1,
};

export function normalizeRole(rawRole: string | null | undefined): AuthRole | null {
  const normalizedRole = rawRole?.trim().toLowerCase();

  if (!normalizedRole) {
    return null;
  }

  if (authRoles.includes(normalizedRole as AuthRole)) {
    return normalizedRole as AuthRole;
  }

  return null;
}

export function canAccessRole(userRole: string | null | undefined, requiredRole: string | null | undefined) {
  const normalizedUserRole = normalizeRole(userRole);
  const normalizedRequiredRole = normalizeRole(requiredRole);

  if (!normalizedUserRole || !normalizedRequiredRole) {
    return false;
  }

  return rolePriority[normalizedUserRole] >= rolePriority[normalizedRequiredRole];
}

