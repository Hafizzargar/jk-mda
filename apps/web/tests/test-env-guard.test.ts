import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isLocalTestEnvironment,
  assertSafeTestEnvironment,
  isApprovedStagingEnvironment,
  extractProjectIdentifier,
  PRODUCTION_PROJECT_ID,
} from './support/test-env';

describe('P0: Integration Test Safety Guard & Staging Allowlist', () => {
  it('extracts project reference accurately from standard supabase urls', () => {
    assert.strictEqual(extractProjectIdentifier('https://ptvfidufwlswbjgsjvzl.supabase.co'), 'ptvfidufwlswbjgsjvzl');
    assert.strictEqual(extractProjectIdentifier('https://kjin-staging-test.supabase.co'), 'kjin-staging-test');
    assert.strictEqual(extractProjectIdentifier('http://127.0.0.1:54321'), '127.0.0.1');
  });

  it('permanently blocks production database under all conditions', () => {
    const prodUrl = `https://${PRODUCTION_PROJECT_ID}.supabase.co`;

    // Local environment check must return false
    assert.strictEqual(isLocalTestEnvironment(prodUrl), false);
    assert.strictEqual(isApprovedStagingEnvironment(prodUrl), false);

    // Even if staging opt-in is forced, production must still be blocked
    const originalStaging = process.env.ALLOW_INTEGRATION_TESTS_ON_STAGING;
    try {
      process.env.ALLOW_INTEGRATION_TESTS_ON_STAGING = 'true';
      assert.strictEqual(isLocalTestEnvironment(prodUrl), false);
      assert.strictEqual(isApprovedStagingEnvironment(prodUrl), false);

      assert.throws(
        () => assertSafeTestEnvironment(prodUrl, 'Guard Test Suite'),
        /CRITICAL SECURITY ALERT.*PRODUCTION database/
      );
    } finally {
      if (originalStaging === undefined) {
        delete process.env.ALLOW_INTEGRATION_TESTS_ON_STAGING;
      } else {
        process.env.ALLOW_INTEGRATION_TESTS_ON_STAGING = originalStaging;
      }
    }
  });

  it('permits local environments unconditionally', () => {
    assert.strictEqual(isLocalTestEnvironment('http://localhost:54321'), true);
    assert.strictEqual(isLocalTestEnvironment('http://127.0.0.1:54321'), true);
    assert.strictEqual(isLocalTestEnvironment('http://0.0.0.0:54321'), true);
    assert.strictEqual(isLocalTestEnvironment('http://kong:8000'), true);
    assert.strictEqual(isLocalTestEnvironment('http://supabase_kong:8000'), true);

    // assertSafeTestEnvironment must not throw for local urls
    assert.doesNotThrow(() => assertSafeTestEnvironment('http://127.0.0.1:54321', 'Local Suite'));
    assert.doesNotThrow(() => assertSafeTestEnvironment('http://localhost:54321', 'Local Suite'));
  });

  it('rejects remote databases without explicit staging opt-in and allowlist', () => {
    const arbitraryRemote = 'https://unknown-project-12345.supabase.co';
    const originalStaging = process.env.ALLOW_INTEGRATION_TESTS_ON_STAGING;
    delete process.env.ALLOW_INTEGRATION_TESTS_ON_STAGING;

    try {
      assert.strictEqual(isLocalTestEnvironment(arbitraryRemote), false);
      assert.throws(
        () => assertSafeTestEnvironment(arbitraryRemote, 'Arbitrary Remote Suite'),
        /refused to run against non-local database/
      );
    } finally {
      if (originalStaging !== undefined) {
        process.env.ALLOW_INTEGRATION_TESTS_ON_STAGING = originalStaging;
      }
    }
  });

  it('rejects unverified remote project even when staging opt-in is enabled', () => {
    const unverifiedRemote = 'https://unverified-remote-id.supabase.co';
    const originalStaging = process.env.ALLOW_INTEGRATION_TESTS_ON_STAGING;
    process.env.ALLOW_INTEGRATION_TESTS_ON_STAGING = 'true';

    try {
      assert.strictEqual(isLocalTestEnvironment(unverifiedRemote), false);
      assert.throws(
        () => assertSafeTestEnvironment(unverifiedRemote, 'Unverified Staging Suite'),
        /refused to run against unverified remote project: "unverified-remote-id"/
      );
    } finally {
      if (originalStaging === undefined) {
        delete process.env.ALLOW_INTEGRATION_TESTS_ON_STAGING;
      } else {
        process.env.ALLOW_INTEGRATION_TESTS_ON_STAGING = originalStaging;
      }
    }
  });

  it('permits approved staging project when staging opt-in is enabled', () => {
    const approvedRemote = 'https://kjin-staging-test.supabase.co';
    const originalStaging = process.env.ALLOW_INTEGRATION_TESTS_ON_STAGING;
    process.env.ALLOW_INTEGRATION_TESTS_ON_STAGING = 'true';

    try {
      assert.strictEqual(isLocalTestEnvironment(approvedRemote), true);
      assert.strictEqual(isApprovedStagingEnvironment(approvedRemote), true);
      assert.doesNotThrow(() => assertSafeTestEnvironment(approvedRemote, 'Approved Staging Suite'));
    } finally {
      if (originalStaging === undefined) {
        delete process.env.ALLOW_INTEGRATION_TESTS_ON_STAGING;
      } else {
        process.env.ALLOW_INTEGRATION_TESTS_ON_STAGING = originalStaging;
      }
    }
  });
});
