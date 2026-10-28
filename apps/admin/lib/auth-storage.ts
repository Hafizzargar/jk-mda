/**
 * Auth storage management utility.
 * 
 * Safely removes application-specific authentication keys and tokens from
 * localStorage, sessionStorage, and client cookies while preserving non-auth user
 * preferences such as theme, sidebar collapse state, and cached brand configs.
 */

// Keys that should NEVER be cleared during logout (user UI preferences & non-auth cache)
export const PRESERVED_STORAGE_KEYS = new Set([
  'kjin_admin_theme',
  'kjin_admin_sidebar_collapsed',
  'kjin_brand_config',
]);

/**
 * Matches authentication tokens, Supabase session data, and OAuth PKCE verifiers.
 */
const AUTH_KEY_PATTERNS = [
  /^sb-.*-auth-token/i,
  /^sb-.*-auth-token\.\d+$/i,
  /^supabase\.auth\./i,
  /^sb-/i,
  /auth_token/i,
  /access_token/i,
  /refresh_token/i,
  /code-verifier/i,
  /csrf/i,
];

/**
 * Checks whether a given storage key is related to authentication.
 */
export function isAuthStorageKey(key: string): boolean {
  if (PRESERVED_STORAGE_KEYS.has(key)) {
    return false;
  }
  return AUTH_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Clears only authentication-related keys from localStorage and sessionStorage.
 * Preserves user preferences (theme, sidebar state, brand configuration).
 */
export function clearAuthStorage(): { clearedLocal: string[]; clearedSession: string[] } {
  const clearedLocal: string[] = [];
  const clearedSession: string[] = [];

  if (typeof window === 'undefined') {
    return { clearedLocal, clearedSession };
  }

  // 1. Purge auth keys from localStorage
  try {
    const localKeysToDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && isAuthStorageKey(key)) {
        localKeysToDelete.push(key);
      }
    }
    localKeysToDelete.forEach((key) => {
      localStorage.removeItem(key);
      clearedLocal.push(key);
    });
  } catch (err) {
    console.warn('[Auth Storage] Failed to inspect localStorage:', err);
  }

  // 2. Purge auth keys from sessionStorage
  try {
    const sessionKeysToDelete: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (isAuthStorageKey(key) || !PRESERVED_STORAGE_KEYS.has(key))) {
        sessionKeysToDelete.push(key);
      }
    }
    sessionKeysToDelete.forEach((key) => {
      sessionStorage.removeItem(key);
      clearedSession.push(key);
    });
  } catch (err) {
    console.warn('[Auth Storage] Failed to inspect sessionStorage:', err);
  }

  // 3. Purge non-HttpOnly auth cookies that client JavaScript can reach
  try {
    if (typeof document !== 'undefined' && document.cookie) {
      document.cookie.split(';').forEach((cookieStr) => {
        const trimmed = cookieStr.trim();
        const eqPos = trimmed.indexOf('=');
        const name = eqPos > -1 ? trimmed.substring(0, eqPos) : trimmed;
        if (isAuthStorageKey(name)) {
          // Expire cookie across paths
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax`;
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax;secure`;
        }
      });
    }
  } catch (err) {
    console.warn('[Auth Storage] Failed to inspect document.cookie:', err);
  }

  return { clearedLocal, clearedSession };
}
