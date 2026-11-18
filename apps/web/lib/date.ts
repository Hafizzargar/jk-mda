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

/**
 * Deterministically formats article published time in IST e.g. "11:28 IST"
 */
export function formatArticleTime(input: string | Date | null | undefined): string {
  if (!input) return '11:30 IST';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(d.getTime())) return '11:30 IST';
  // Compute UTC+5:30 (IST)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(d.getTime() + istOffset);
  const hours = String(istDate.getUTCHours()).padStart(2, '0');
  const minutes = String(istDate.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes} IST`;
}

/**
 * Deterministically formats relative time ago e.g. "2h ago", "45m ago", "Yesterday"
 */
export function formatTimeAgo(input: string | Date | null | undefined): string {
  if (!input) return 'Live';
  const d = typeof input === 'string' ? new Date(input) : input;
  const time = d.getTime();
  if (isNaN(time)) return 'Live';
  const diffMs = Date.now() - time;
  if (diffMs < 0 || diffMs < 60 * 1000) return 'Just now';
  const diffMins = Math.floor(diffMs / (60 * 1000));
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatShortDate(d);
}
