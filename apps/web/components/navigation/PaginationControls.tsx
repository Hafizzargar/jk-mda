'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ALLOWED_PAGE_SIZES, type PaginationMeta } from '@/lib/pagination';
import { type TemplateTheme } from '@/lib/templates';

interface PaginationControlsProps {
  meta: PaginationMeta;
  theme?: TemplateTheme;
  showPageSizeSelector?: boolean;
}

export function PaginationControls({
  meta,
  theme,
  showPageSizeSelector = true,
}: PaginationControlsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { totalPages, currentPage, totalCount, startItem, endItem, limit, hasPrevPage, hasNextPage } = meta;

  const createPageUrl = (pageNumber: number, newLimit?: number) => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (pageNumber > 1) {
      params.set('page', pageNumber.toString());
    } else {
      params.delete('page');
    }

    const effectiveLimit = newLimit ?? limit;
    if (newLimit !== undefined) {
      params.set('limit', effectiveLimit.toString());
    }

    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const isDark = theme?.isDark ?? false;
  const accentBorder = theme?.accentBorderClass || (isDark ? 'border-cyan-500' : 'border-blue-600');
  const accentBg = theme?.accentBgClass || (isDark ? 'bg-cyan-600 text-white' : 'bg-blue-600 text-white');
  const cardBg = isDark ? 'bg-slate-900/80' : 'bg-white';
  const cardBorder = isDark ? 'border-slate-800' : 'border-slate-300';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';

  if (totalCount <= 0) {
    return null;
  }

  // Generate page numbers window (e.g. up to 5 numbered buttons)
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <nav
      aria-label="Newspaper Dispatches Pagination"
      className={`mt-12 py-5 px-6 rounded-2xl border ${cardBorder} ${cardBg} shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 font-sans`}
    >
      {/* 1. Item Count & Page Indicator */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className={textMuted}>
          Showing <strong className={textPrimary}>{startItem}&ndash;{endItem}</strong> of{' '}
          <strong className={textPrimary}>{totalCount}</strong> verified stories
        </span>
        <span className="hidden sm:inline text-slate-400">&bull;</span>
        <span className={`font-mono text-[11px] ${textMuted}`}>
          Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
        </span>
      </div>

      {/* 2. Middle: Page Number Controls */}
      <div className="flex items-center gap-1.5">
        {/* Previous Button */}
        {hasPrevPage ? (
          <Link
            href={createPageUrl(currentPage - 1)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${cardBorder} hover:bg-slate-100 dark:hover:bg-slate-800 transition ${textPrimary} flex items-center gap-1`}
            aria-label="Previous Page"
          >
            <span>&larr;</span>
            <span className="hidden sm:inline">Prev</span>
          </Link>
        ) : (
          <span
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${cardBorder} opacity-40 cursor-not-allowed text-slate-400 flex items-center gap-1`}
            aria-disabled="true"
          >
            <span>&larr;</span>
            <span className="hidden sm:inline">Prev</span>
          </span>
        )}

        {/* Numbered Page Buttons */}
        <div className="flex items-center gap-1">
          {getPageNumbers().map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`ellipsis-${idx}`} className={`px-2 py-1 text-xs ${textMuted}`}>
                  &hellip;
                </span>
              );
            }

            const pageNum = Number(p);
            const isCurrent = pageNum === currentPage;

            return (
              <Link
                key={pageNum}
                href={createPageUrl(pageNum)}
                aria-current={isCurrent ? 'page' : undefined}
                className={`min-w-[32px] h-8 flex items-center justify-center rounded-lg text-xs font-bold transition ${
                  isCurrent
                    ? `${accentBg} ${accentBorder} shadow-sm`
                    : `border ${cardBorder} ${textPrimary} hover:bg-slate-100 dark:hover:bg-slate-800`
                }`}
              >
                {pageNum}
              </Link>
            );
          })}
        </div>

        {/* Next Button */}
        {hasNextPage ? (
          <Link
            href={createPageUrl(currentPage + 1)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${cardBorder} hover:bg-slate-100 dark:hover:bg-slate-800 transition ${textPrimary} flex items-center gap-1`}
            aria-label="Next Page"
          >
            <span className="hidden sm:inline">Next</span>
            <span>&rarr;</span>
          </Link>
        ) : (
          <span
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${cardBorder} opacity-40 cursor-not-allowed text-slate-400 flex items-center gap-1`}
            aria-disabled="true"
          >
            <span className="hidden sm:inline">Next</span>
            <span>&rarr;</span>
          </span>
        )}
      </div>

      {/* 3. Per Page Size Switcher (10 | 15 | 20) */}
      {showPageSizeSelector && (
        <div className="flex items-center gap-2 text-xs">
          <span className={`text-[11px] font-medium ${textMuted}`}>Per page:</span>
          <div className="flex items-center gap-1">
            {ALLOWED_PAGE_SIZES.map((size) => (
              <Link
                key={size}
                href={createPageUrl(1, size)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition border ${
                  limit === size
                    ? `${accentBg} border-transparent`
                    : `border ${cardBorder} ${textMuted} hover:${textPrimary} hover:bg-slate-100 dark:hover:bg-slate-800`
                }`}
              >
                {size}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
