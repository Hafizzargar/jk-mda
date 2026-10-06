export const authRoles = ['owner', 'superadmin', 'admin', 'editor', 'author'] as const;

export type AuthRole = (typeof authRoles)[number];

type SupabaseUserRoleSource = {
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  role?: string | null;
};

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

export function resolveUserRole(user: SupabaseUserRoleSource | null | undefined): AuthRole | null {
  const appMetadataRole = (user?.app_metadata as { role?: string | null } | undefined)?.role;
  const userMetadataRole = (user?.user_metadata as { role?: string | null } | undefined)?.role;

  const candidates = [appMetadataRole, userMetadataRole, user?.role]
    .map((value) => normalizeRole(value))
    .filter((value): value is AuthRole => value !== null);

  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce((best, current) =>
    (rolePriority[current] > rolePriority[best] ? current : best),
    candidates[0]
  );
}

export function canAccessRole(userRole: string | null | undefined, requiredRole: string | null | undefined) {
  if (!userRole || !requiredRole) {
    return false;
  }

  const userPriority = rolePriority[normalizeRole(userRole) ?? 'author'] ?? -1;
  const requiredPriority = rolePriority[normalizeRole(requiredRole) ?? 'author'] ?? -1;

  return userPriority >= requiredPriority;
}

