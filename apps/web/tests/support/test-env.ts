/**
 * Strict Environment Guard for Supabase Integration Tests.
 * Ensures tests NEVER run against or mutate a production database.
 */

export const PRODUCTION_PROJECT_ID = 'ptvfidufwlswbjgsjvzl';

/**
 * Approved staging/isolated test project identifiers.
 * Only remote projects explicitly recognized here or configured via ALLOWED_STAGING_PROJECT_IDS
 * can be accessed when ALLOW_INTEGRATION_TESTS_ON_STAGING=true.
 */
export const APPROVED_STAGING_PROJECT_IDS: readonly string[] = [
  'kjin-staging-test',
  'kjin-isolated-test',
];

export function getApprovedStagingProjectIds(): string[] {
  const envExtra = process.env.ALLOWED_STAGING_PROJECT_IDS
    ? process.env.ALLOWED_STAGING_PROJECT_IDS.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    : [];
  return Array.from(new Set([...APPROVED_STAGING_PROJECT_IDS, ...envExtra]));
}

/**
 * Approved exact local hostnames for loopback / local development.
 */
export const APPROVED_LOCAL_HOSTNAMES: readonly string[] = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
];

/**
 * Approved exact Docker / container network hostnames used in local CI or Supabase CLI containers.
 */
export const APPROVED_DOCKER_HOSTNAMES: readonly string[] = [
  'kong',
  'supabase_kong',
  'host.docker.internal',
];

/**
 * Safely parses the hostname from an input URL or host string.
 * Strips port numbers, square brackets from IPv6, and normalizes to lowercase.
 */
export function extractHostname(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const hasProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed);
    const parsed = new URL(hasProtocol ? trimmed : `http://${trimmed}`);
    let hostname = parsed.hostname.toLowerCase();
    // Normalize IPv6 bracketed hosts, e.g. [::1] -> ::1
    if (hostname.startsWith('[') && hostname.endsWith(']')) {
      hostname = hostname.slice(1, -1);
    }
    return hostname;
  } catch {
    return null;
  }
}

export function extractProjectIdentifier(supabaseUrl: string): string | null {
  if (!supabaseUrl) return null;
  const hostname = extractHostname(supabaseUrl);
  if (!hostname) return null;

  const parts = hostname.split('.');
  if (parts.length >= 3 && hostname.endsWith('.supabase.co')) {
    return parts[0];
  }
  return hostname;
}

export function isLocalHost(supabaseUrl: string): boolean {
  const hostname = extractHostname(supabaseUrl);
  if (!hostname) return false;

  // 1. Check exact approved local loopback hostnames
  if (APPROVED_LOCAL_HOSTNAMES.includes(hostname)) {
    return true;
  }

  // 2. Check exact approved local Docker network hostnames
  if (APPROVED_DOCKER_HOSTNAMES.includes(hostname)) {
    return true;
  }

  return false;
}

export function isApprovedStagingEnvironment(supabaseUrl: string): boolean {
  if (!supabaseUrl) return false;
  const projectId = extractProjectIdentifier(supabaseUrl);
  if (!projectId) return false;

  // Hard guarantee: Production is permanently blocked
  if (projectId === PRODUCTION_PROJECT_ID || supabaseUrl.toLowerCase().includes(PRODUCTION_PROJECT_ID)) {
    return false;
  }

  const approvedList = getApprovedStagingProjectIds();
  return approvedList.includes(projectId);
}

export function isLocalTestEnvironment(supabaseUrl: string): boolean {
  if (!supabaseUrl) return false;
  const url = supabaseUrl.toLowerCase();
  
  // NEVER allow the production project under any circumstances
  if (url.includes(PRODUCTION_PROJECT_ID)) {
    return false;
  }

  // 1. Local Supabase instances are always permitted
  if (isLocalHost(supabaseUrl)) {
    return true;
  }

  // 2. Remote database URLs require BOTH the opt-in flag AND presence in the approved staging allowlist
  const isStagingOptIn = process.env.ALLOW_INTEGRATION_TESTS_ON_STAGING === 'true';
  if (isStagingOptIn && isApprovedStagingEnvironment(supabaseUrl)) {
    return true;
  }

  return false;
}

export function assertSafeTestEnvironment(supabaseUrl: string, suiteName: string): void {
  if (!supabaseUrl) {
    throw new Error(`[ENVIRONMENT ERROR] ${suiteName}: SUPABASE_URL is not configured.`);
  }

  const url = supabaseUrl.toLowerCase();

  // 1. Hard check: Never allow production database project under any circumstances
  if (url.includes(PRODUCTION_PROJECT_ID)) {
    throw new Error(
      `[CRITICAL SECURITY ALERT] ${suiteName} attempted to run against PRODUCTION database (${PRODUCTION_PROJECT_ID})! ` +
      `Integration tests perform writes/deletions and are strictly forbidden from connecting to production. ` +
      `Aborting immediately to protect live data.`
    );
  }

  // 2. Allow local test environments
  if (isLocalHost(supabaseUrl)) {
    return;
  }

  // 3. For remote URLs, require explicit staging opt-in AND verified staging project identity
  const isStagingOptIn = process.env.ALLOW_INTEGRATION_TESTS_ON_STAGING === 'true';
  if (!isStagingOptIn) {
    throw new Error(
      `[SAFETY GUARD] ${suiteName} refused to run against non-local database: "${supabaseUrl}". ` +
      `Integration tests are restricted to local Supabase instances (localhost:54321 / 127.0.0.1). ` +
      `To run against an isolated staging project, set ALLOW_INTEGRATION_TESTS_ON_STAGING=true and configure an approved staging project ID. ` +
      `Production project (${PRODUCTION_PROJECT_ID}) remains permanently blocked.`
    );
  }

  if (!isApprovedStagingEnvironment(supabaseUrl)) {
    const projId = extractProjectIdentifier(supabaseUrl) || url;
    throw new Error(
      `[SAFETY GUARD] ${suiteName} refused to run against unverified remote project: "${projId}". ` +
      `ALLOW_INTEGRATION_TESTS_ON_STAGING is enabled, but "${projId}" is not in the approved staging allowlist: [${getApprovedStagingProjectIds().join(', ')}]. ` +
      `To approve this staging project, add it to ALLOWED_STAGING_PROJECT_IDS. ` +
      `Production project (${PRODUCTION_PROJECT_ID}) remains permanently blocked.`
    );
  }
}
