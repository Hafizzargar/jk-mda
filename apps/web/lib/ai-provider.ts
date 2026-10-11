/**
 * AI Provider & Generation Hooks for KJIN AI Routes.
 * Supports production Gemini execution while allowing deterministic mock providers for automated test suites.
 */

export type DraftResult = {
  title: string;
  excerpt: string;
  content: string;
  slug: string;
  category: string;
  district: string | null;
};

export type DraftGenerator = (options: {
  rawFacts: string;
}) => Promise<DraftResult>;

export type SummarizeResult = {
  excerpt: string;
};

export type SummarizeGenerator = (options: {
  content: string;
}) => Promise<SummarizeResult>;

/**
 * Retrieves a test mock generator if registered during automated tests.
 * In production (NODE_ENV === 'production'), always returns null to ensure live AI provider is used.
 */
export function getTestDraftGenerator(): DraftGenerator | null {
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  const globalStore = globalThis as { __KJIN_TEST_DRAFT_GENERATOR__?: DraftGenerator | null };
  return globalStore.__KJIN_TEST_DRAFT_GENERATOR__ ?? null;
}

/**
 * Retrieves a test mock generator if registered during automated tests.
 * In production (NODE_ENV === 'production'), always returns null to ensure live AI provider is used.
 */
export function getTestSummarizeGenerator(): SummarizeGenerator | null {
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  const globalStore = globalThis as { __KJIN_TEST_SUMMARIZE_GENERATOR__?: SummarizeGenerator | null };
  return globalStore.__KJIN_TEST_SUMMARIZE_GENERATOR__ ?? null;
}
