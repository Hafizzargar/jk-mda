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

let customDraftGenerator: DraftGenerator | null = null;
let customSummarizeGenerator: SummarizeGenerator | null = null;

export function getCustomDraftGenerator(): DraftGenerator | null {
  return customDraftGenerator;
}

export function setCustomDraftGenerator(generator: DraftGenerator | null): void {
  customDraftGenerator = generator;
}

export function getCustomSummarizeGenerator(): SummarizeGenerator | null {
  return customSummarizeGenerator;
}

export function setCustomSummarizeGenerator(generator: SummarizeGenerator | null): void {
  customSummarizeGenerator = generator;
}
