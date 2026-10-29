const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Deterministically formats dates for article headers and lists.
 * Produces consistent "Oct 24, 2026" regardless of server locale vs user browser locale,
 * completely preventing SSR/client React hydration mismatch errors.
 */
export function formatArticleDate(input: string | Date | null | undefined): string {
  if (!input) return '';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(d.getTime())) return '';
  const month = MONTHS_SHORT[d.getUTCMonth()];
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();
  return `${month} ${day}, ${year}`;
}

/**
 * Deterministically formats short dates e.g. "Oct 24, 2026"
 */
export function formatShortDate(input: string | Date | null | undefined): string {
  return formatArticleDate(input);
}
