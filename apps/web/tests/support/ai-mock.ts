/**
 * Test Mock Provider Registry for KJIN Automated Tests.
 * Strictly isolated to test files and disallowed in production environments.
 */
import type { DraftGenerator, SummarizeGenerator } from '../../lib/ai-provider';

export function setCustomDraftGenerator(generator: DraftGenerator | null): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Custom AI test mock generators are strictly forbidden in production');
  }
  const globalStore = globalThis as { __KJIN_TEST_DRAFT_GENERATOR__?: DraftGenerator | null };
  globalStore.__KJIN_TEST_DRAFT_GENERATOR__ = generator;
}

export function setCustomSummarizeGenerator(generator: SummarizeGenerator | null): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Custom AI test mock generators are strictly forbidden in production');
  }
  const globalStore = globalThis as { __KJIN_TEST_SUMMARIZE_GENERATOR__?: SummarizeGenerator | null };
  globalStore.__KJIN_TEST_SUMMARIZE_GENERATOR__ = generator;
}
