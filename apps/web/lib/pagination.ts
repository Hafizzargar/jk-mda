/**
 * Safe pagination helpers to sanitize and bound query parameter page numbers and limits.
 * Guarantees real database range queries (0 to 10, 15, 20) with exact count metadata.
 */

export const ALLOWED_PAGE_SIZES = [6, 9, 12, 18] as const;
export const ALL_VALID_LIMITS = [6, 9, 10, 12, 15, 18, 20] as const;
export type PageSize = (typeof ALLOWED_PAGE_SIZES)[number];

export function parsePageParam(pageParam: unknown, maxPage: number = 500): number {
  if (typeof pageParam !== 'string') {
    return 1;
  }

  const parsed = parseInt(pageParam, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return 1;
  }

  if (parsed > maxPage) {
    return maxPage;
  }

  return parsed;
}

export function parseLimitParam(
  limitParam: unknown,
  defaultLimit: number = 6,
  allowedLimits: readonly number[] = ALL_VALID_LIMITS
): number {
  if (typeof limitParam !== 'string') {
    return defaultLimit;
  }

  const parsed = parseInt(limitParam, 10);
  if (allowedLimits.includes(parsed)) {
    return parsed;
  }

  return defaultLimit;
}

export function getPaginationRange(page: number, limit: number = 10) {
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * limit;
  const to = from + limit - 1;
  return { from, to, limit };
}

export interface PaginationMeta {
  totalCount: number;
  currentPage: number;
  totalPages: number;
  from: number;
  to: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  startItem: number;
  endItem: number;
}

export function calculatePaginationMeta(
  totalCount: number,
  page: number,
  limit: number = 10
): PaginationMeta {
  const safeTotal = Math.max(0, totalCount);
  const totalPages = Math.max(1, Math.ceil(safeTotal / limit));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const { from, to } = getPaginationRange(currentPage, limit);

  const startItem = safeTotal === 0 ? 0 : from + 1;
  const endItem = Math.min(safeTotal, to + 1);

  return {
    totalCount: safeTotal,
    currentPage,
    totalPages,
    from,
    to,
    limit,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
    startItem,
    endItem,
  };
}
