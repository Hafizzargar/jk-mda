'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { ArticleItem } from './types';
import { getDistrictDisplayName } from '@/lib/taxonomy';
import { formatArticleDate } from '@/lib/date';
import { getOptimizedMediaUrl } from '@/lib/media';

interface TodayCenterDispatchesProps {
  articles: ArticleItem[];
  langPrefix: string;
  brandName?: string;
  initialCount?: number;
}

export function TodayCenterDispatches({
  articles,
  langPrefix,
  brandName = 'KJCPL',
  initialCount = 4,
}: TodayCenterDispatchesProps) {
  const [visibleCount, setVisibleCount] = useState<number>(initialCount);

  if (!articles || articles.length === 0) {
    return null;
  }

  const cleanAuthor = (author?: string | null): string => {
    if (!author || author === 'KCPJLN' || author.startsWith('KCPJLN') || author === 'KJIN' || author.startsWith('KJIN')) {
      return brandName;
    }
    return author;
  };

  const getCatSlug = (cat?: string | null) => (cat || 'news').toLowerCase().replace(/\s+/g, '-');
  const getArtHref = (art?: { category?: string | null; slug?: string | null } | null) => {
    if (!art?.slug) return langPrefix || '/';
    return `${langPrefix}/${getCatSlug(art.category)}/${art.slug}`;
  };

  const visibleArticles = articles.slice(0, visibleCount);
  const remainingCount = Math.max(0, articles.length - visibleCount);
  const hasMore = remainingCount > 0;

  const handleShowMore = () => {
    setVisibleCount((prev) => Math.min(prev + 4, articles.length));
  };

  return (
    <section className="space-y-5 font-sans" data-purpose="today-center-dispatches">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-3 border-b-2 border-slate-900">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600" />
          </span>
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
            Today&apos;s News Desk • Continuous Dispatches
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-slate-100 text-slate-700 font-mono">
            {articles.length} Stories Today
          </span>
        </div>
      </div>

      {/* 2-Column Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {visibleArticles.map((art) => {
          return (
            <article
              key={art.id}
              className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition flex flex-col justify-between group"
            >
              <div>
                {art.featured_image_url && (
                  <div className="relative w-full h-36 sm:h-40 rounded-xl overflow-hidden bg-slate-100 mb-3.5">
                    <Image
                      src={getOptimizedMediaUrl(art.featured_image_url, 480)}
                      alt={art.title}
                      fill
                      sizes="(max-width: 1024px) 50vw, 360px"
                      className="object-cover group-hover:scale-[1.02] transition duration-300"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider rounded bg-amber-100 text-amber-900 inline-block">
                    {art.category}
                  </span>
                  {art.district && (
                    <span className="text-[10px] font-semibold text-[#0891B2]">
                      • {getDistrictDisplayName(art.district)}
                    </span>
                  )}
                </div>

                <h3 className="font-serif text-base sm:text-lg font-bold text-[#0F172A] leading-snug mb-2 group-hover:text-[#0891B2] transition">
                  <Link href={getArtHref(art)}>
                    {art.title}
                  </Link>
                </h3>

                {art.excerpt && (
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-3">
                    {art.excerpt}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span className="truncate max-w-[130px]">By {cleanAuthor(art.author_display_name)}</span>
                <span suppressHydrationWarning>{formatArticleDate(art.published_at)}</span>
              </div>
            </article>
          );
        })}
      </div>

      {/* Show More Actions Footer */}
      <div className="pt-1">
        {hasMore ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#fbf9f4] p-4 rounded-xl border border-amber-200/80">
            <div className="text-xs text-slate-700 font-medium">
              Showing <strong className="text-slate-900 font-bold">{visibleArticles.length}</strong> of{' '}
              <strong className="text-slate-900 font-bold">{articles.length}</strong> field dispatches from today
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleShowMore}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#0F172A] hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer active:scale-95"
              >
                <span>Show More Today&apos;s News</span>
                <span className="px-1.5 py-0.2 bg-white/20 rounded text-[10px] font-mono">
                  +{Math.min(4, remainingCount)}
                </span>
                <svg
                  className="w-3.5 h-3.5 ml-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <Link
                href={`${langPrefix}/latest`}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-semibold transition"
              >
                <span>View All</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 bg-[#f5f3f0] px-4 py-3 rounded-xl border border-slate-200 text-xs text-slate-600">
            <span>✓ All {visibleArticles.length} continuous field dispatches for today are loaded.</span>
            <Link
              href={`${langPrefix}/latest`}
              className="font-bold text-[#0891B2] hover:underline inline-flex items-center gap-1"
            >
              <span>Browse Full Daily Newsroom Archives</span>
              <span>→</span>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
