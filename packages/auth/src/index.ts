export const authRoles = ['owner', 'superadmin', 'admin', 'editor', 'author'] as const;

export type AuthRole = (typeof authRoles)[number];

const rolePriority: Record<AuthRole, number> = {
  owner: 5,
  superadmin: 4,
  admin: 3,
  editor: 2,
  author: 1,
};

export function canAccessRole(userRole: string | null | undefined, requiredRole: string | null | undefined) {
  if (!userRole || !requiredRole) {
    return false;
  }

  const userPriority = rolePriority[userRole as AuthRole] ?? -1;
  const requiredPriority = rolePriority[requiredRole as AuthRole] ?? -1;

  return userPriority >= requiredPriority;
}

