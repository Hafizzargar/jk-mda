/**
 * Strict Environment Guard for Supabase Integration Tests.
 * Ensures tests NEVER run against or mutate a production database.
 */

const PRODUCTION_PROJECT_ID = 'ptvfidufwlswbjgsjvzl';

export function isLocalTestEnvironment(supabaseUrl: string): boolean {
  if (!supabaseUrl) return false;
  const url = supabaseUrl.toLowerCase();
  
  // NEVER allow the production project under any circumstances
  if (url.includes(PRODUCTION_PROJECT_ID)) {
    return false;
  }

  // Local Supabase instances
  const isLocal =
    url.includes('localhost') ||
    url.includes('127.0.0.1') ||
    url.includes('0.0.0.0') ||
    url.includes('kong:8000') ||
    url.includes('supabase_kong');

  if (isLocal) {
    return true;
  }

  // Explicit staging opt-in for isolated test projects
  const isStagingOptIn = process.env.ALLOW_INTEGRATION_TESTS_ON_STAGING === 'true';
  return isStagingOptIn;
}

export function assertSafeTestEnvironment(supabaseUrl: string, suiteName: string): void {
  if (!supabaseUrl) {
    throw new Error(`[ENVIRONMENT ERROR] ${suiteName}: SUPABASE_URL is not configured.`);
  }

  const url = supabaseUrl.toLowerCase();

  // 1. Hard check: Never allow production database project
  if (url.includes(PRODUCTION_PROJECT_ID)) {
    throw new Error(
      `[CRITICAL SECURITY ALERT] ${suiteName} attempted to run against PRODUCTION database (${PRODUCTION_PROJECT_ID})! ` +
      `Integration tests perform writes/deletions and are strictly forbidden from connecting to production. ` +
      `Aborting immediately to protect live data.`
    );
  }

  // 2. Allow local test environments
  if (isLocalTestEnvironment(supabaseUrl)) {
    return;
  }

  // 3. For any remote URL, require explicit staging opt-in
  throw new Error(
    `[SAFETY GUARD] ${suiteName} refused to run against non-local database: "${supabaseUrl}". ` +
    `Integration tests are restricted to local Supabase instances (localhost:54321 / 127.0.0.1). ` +
    `To run against an isolated staging project, set ALLOW_INTEGRATION_TESTS_ON_STAGING=true. ` +
    `Production project (${PRODUCTION_PROJECT_ID}) remains permanently blocked.`
  );
}
