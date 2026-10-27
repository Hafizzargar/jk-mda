'use client';

import React from 'react';
import { Button } from './Button';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
  headerClassName?: string;
  render?: (item: T, index: number) => React.ReactNode;
}

export interface PaginationConfig {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange?: (newSize: number) => void;
  pageSizeOptions?: number[]; // Defaults to [5, 10, 15, 20]
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string | number;
  isLoading?: boolean;
  emptyMessage?: React.ReactNode;
  pagination?: PaginationConfig;
  className?: string;
  mobileCardRender?: (item: T, index: number) => React.ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyMessage = 'No records found.',
  pagination,
  className = '',
  mobileCardRender,
}: DataTableProps<T>) {
  const pageSizeOptions = pagination?.pageSizeOptions || [5, 10, 15, 20];
  const currentPage = pagination?.page || 1;
  const pageSize = pagination?.pageSize || 5;
  const totalCount = pagination?.totalCount || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const startRecord = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalCount);

  // Generate page numbers for smart pagination
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden dark:border-slate-800 dark:bg-slate-900/60 ${className}`}
    >
      {/* Mobile Card View (on < md screens when mobileCardRender is provided) */}
      {mobileCardRender && (
        <div className="block md:hidden">
          {isLoading ? (
            <div className="p-3 space-y-2.5">
              {Array.from({ length: Math.min(pageSize || 5, 4) }).map((_, rIdx) => (
                <div
                  key={`skeleton-card-${rIdx}`}
                  className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 space-y-2.5 animate-pulse dark:border-slate-800 dark:bg-slate-900/40"
                >
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700/60 rounded-full" />
                    <div className="h-3.5 w-16 bg-slate-200 dark:bg-slate-700/60 rounded-md" />
                  </div>
                  <div className="h-5 w-4/5 bg-slate-200 dark:bg-slate-700/60 rounded-md" />
                  <div className="h-3 w-1/2 bg-slate-200 dark:bg-slate-700/60 rounded-md" />
                  <div className="pt-2 flex gap-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="h-7 flex-1 bg-slate-200 dark:bg-slate-700/60 rounded-md" />
                    <div className="h-7 flex-1 bg-slate-200 dark:bg-slate-700/60 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          ) : data.length === 0 ? (
            <div className="px-4 py-12 text-center text-slate-500 dark:text-slate-400 font-medium">
              <div className="flex flex-col items-center justify-center gap-2">
                <span className="text-2xl" aria-hidden="true">
                  📭
                </span>
                <div>{emptyMessage}</div>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.map((item, rowIdx) => (
                <div key={keyExtractor(item, rowIdx)} className="p-3 sm:p-3.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                  {mobileCardRender(item, rowIdx)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Desktop Table View (hidden on mobile if mobileCardRender is provided) */}
      <div className={`overflow-x-auto ${mobileCardRender ? 'hidden md:block' : ''}`}>
        <table className="w-full min-w-[750px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300">
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={`px-4 py-3 select-none ${
                    col.align === 'center'
                      ? 'text-center'
                      : col.align === 'right'
                      ? 'text-right'
                      : 'text-left'
                  } ${col.headerClassName || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {isLoading ? (
              // Loading Skeleton Rows
              Array.from({ length: pageSize || 5 }).map((_, rIdx) => (
                <tr key={`skeleton-${rIdx}`} className="animate-pulse">
                  {columns.map((col, cIdx) => (
                    <td key={`skeleton-cell-${cIdx}`} className="px-4 py-4">
                      <div
                        className={`h-4 rounded-[6px] bg-slate-200 dark:bg-slate-700/60 ${
                          cIdx === 0 ? 'w-3/4' : 'w-1/2'
                        }`}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              // Empty State
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-12 text-center text-slate-500 dark:text-slate-400 font-medium"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <span className="text-2xl" aria-hidden="true">
                      📭
                    </span>
                    <div>{emptyMessage}</div>
                  </div>
                </td>
              </tr>
            ) : (
              // Data Rows
              data.map((item, rowIdx) => (
                <tr
                  key={keyExtractor(item, rowIdx)}
                  className="align-top hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3.5 ${
                        col.align === 'center'
                          ? 'text-center'
                          : col.align === 'right'
                          ? 'text-right'
                          : 'text-left'
                      } ${col.className || ''}`}
                    >
                      {col.render
                        ? col.render(item, rowIdx)
                        : (item as Record<string, unknown>)[col.key] !== undefined
                        ? String((item as Record<string, unknown>)[col.key])
                        : null}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pagination && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
          {/* Left: Summary */}
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Showing <span className="font-bold text-slate-900 dark:text-slate-200">{startRecord}</span> to{' '}
            <span className="font-bold text-slate-900 dark:text-slate-200">{endRecord}</span> of{' '}
            <span className="font-bold text-slate-900 dark:text-slate-200">{totalCount}</span> items
          </p>

          {/* Center: Per Page Selector (5, 10, 15, 20) */}
          {pagination.onPageSizeChange && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-500">Show:</span>
              <div className="inline-flex rounded-[8px] border border-slate-200 bg-white p-0.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                {pageSizeOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      if (opt !== pageSize) {
                        pagination.onPageSizeChange?.(opt);
                      }
                    }}
                    className={`rounded-[6px] px-2.5 py-1 text-xs font-bold transition-all ${
                      opt === pageSize
                        ? 'bg-cyan-600 text-white shadow-xs dark:bg-cyan-500 dark:text-slate-950'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              <span className="hidden sm:inline">per page</span>
            </div>
          )}

          {/* Right: Page Navigation */}
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => pagination.onPageChange(currentPage - 1)}
            >
              Previous
            </Button>

            {totalPages > 1 && (
              <div className="hidden sm:flex items-center gap-1">
                {getPageNumbers().map((p, idx) =>
                  p === 'ellipsis' ? (
                    <span key={`ellipsis-${idx}`} className="px-1.5 text-xs text-slate-400">
                      …
                    </span>
                  ) : (
                    <button
                      key={`page-${p}`}
                      type="button"
                      disabled={isLoading}
                      onClick={() => pagination.onPageChange(p)}
                      className={`h-7 w-7 rounded-[8px] text-xs font-bold transition-all ${
                        p === currentPage
                          ? 'bg-slate-900 text-white dark:bg-cyan-500 dark:text-slate-950 shadow-xs'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
              </div>
            )}

            <Button
              size="sm"
              variant="secondary"
              disabled={currentPage >= totalPages || isLoading}
              onClick={() => pagination.onPageChange(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
