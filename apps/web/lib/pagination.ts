/**
 * Safe pagination helper to sanitize and bound query parameter page numbers.
 */
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

export function getPaginationRange(page: number, limit: number = 12) {
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * limit;
  const to = from + limit - 1;
  return { from, to, limit };
}
