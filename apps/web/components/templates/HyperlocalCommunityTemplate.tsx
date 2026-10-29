import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatArticleDate } from '@/lib/date';
import { TemplateProps } from './types';

export function HyperlocalCommunityTemplate({
  langPrefix,
  heroArticle,
  recentArticles,
  trendingArticles,
  navbarSettings,
}: TemplateProps) {
  const brandName = navbarSettings?.brand?.name || 'KCPJLN';
  const districts = [
    'Srinagar', 'Jammu', 'Baramulla', 'Anantnag', 'Pulwama',
    'Budgam', 'Kupwara', 'Ganderbal', 'Shopian', 'Doda'
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 font-sans selection:bg-emerald-500 selection:text-white">
      {/* Community Transit & Weather Banner */}
      <div className="bg-emerald-800 text-white py-2 px-4 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-600 text-white font-bold px-2 py-0.5 rounded text-[10px] uppercase">
              Civic Advisory
            </span>
            <span>NH-44 All-Weather Transit Normal &bull; Zojila Pass Clear &bull; Mughal Road Light Traffic</span>
          </div>
          <span className="font-semibold text-emerald-200">20 Districts Reporting Active</span>
        </div>
      </div>

      {/* Main Header */}
      <header className="bg-white border-b border-slate-200 py-6 px-4 md:px-8 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <Link
              href={`${langPrefix}/`}
              className="text-3xl md:text-4xl font-extrabold tracking-tight text-emerald-900 flex items-center gap-2 uppercase"
            >
              <span>{brandName}</span>
              <span className="text-emerald-600 text-sm font-semibold tracking-normal lowercase bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                community hub
              </span>
            </Link>
            <p className="text-xs text-slate-500 mt-1">
              Grassroots Civic Reporting &bull; Community Dispatches from Jammu &amp; Kashmir
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`${langPrefix}/latest`}
              className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold uppercase rounded-lg hover:bg-emerald-700 transition shadow-sm"
            >
              Latest Updates &rarr;
            </Link>
          </div>
        </div>

        {/* District Switcher Ribbon */}
        <div className="max-w-7xl mx-auto mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
          <span className="text-xs font-bold uppercase text-slate-400 shrink-0 mr-1">
            Districts:
          </span>
          {districts.map((d) => (
            <Link
              key={d}
              href={`${langPrefix}/district/${d.toLowerCase()}`}
              className="text-xs font-medium px-3 py-1 bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-700 rounded-full transition shrink-0"
            >
              {d}
            </Link>
          ))}
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 mt-8">
        {/* Community Lead Story */}
        {heroArticle && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm mb-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {heroArticle.featured_image_url && (
              <div className="lg:col-span-5 relative h-64 md:h-80 w-full rounded-xl overflow-hidden bg-slate-100">
                <Image
                  src={heroArticle.featured_image_url}
                  alt={heroArticle.title}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 42vw"
                  className="object-cover"
                />
                <div className="absolute top-3 left-3 bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                  {heroArticle.district || 'Spotlight'}
                </div>
              </div>
            )}

            <div className={heroArticle.featured_image_url ? 'lg:col-span-7' : 'lg:col-span-12'}>
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">
                <span>{heroArticle.category}</span>
                <span>&bull;</span>
                <span className="text-slate-400" suppressHydrationWarning>{formatArticleDate(heroArticle.published_at)}</span>
              </div>

              <Link href={`${langPrefix}/${heroArticle.category.toLowerCase()}/${heroArticle.slug}`}>
                <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 hover:text-emerald-700 transition leading-tight mb-4">
                  {heroArticle.title}
                </h1>
              </Link>

              {heroArticle.excerpt && (
                <p className="text-slate-600 leading-relaxed mb-6 text-base">
                  {heroArticle.excerpt}
                </p>
              )}

              <div className="flex items-center justify-between text-xs text-slate-500 pt-4 border-t border-slate-100">
                <span>Reported by: <strong className="text-slate-800">{heroArticle.author_display_name || 'Community Desk'}</strong></span>
                <Link
                  href={`${langPrefix}/${heroArticle.category.toLowerCase()}/${heroArticle.slug}`}
                  className="text-emerald-700 font-bold hover:underline"
                >
                  Full Coverage &rarr;
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* 2-Column: Community Cards & Regional Voices */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3 mb-6 flex items-center justify-between">
              <span>District Grassroots Reports</span>
              <span className="text-xs text-slate-400 font-normal">{recentArticles.length} articles active</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {recentArticles.slice(0, 6).map((article) => (
                <div
                  key={article.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition flex flex-col"
                >
                  {article.featured_image_url && (
                    <div className="relative h-44 w-full rounded-lg overflow-hidden mb-3 bg-slate-100">
                      <Image
                        src={article.featured_image_url}
                        alt={article.title}
                        fill
                        loading="lazy"
                        decoding="async"
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-700 uppercase mb-1">
                    <span>{article.category}</span>
                    <span>&bull;</span>
                    <span className="text-slate-400">{article.district || 'Statewide'}</span>
                  </div>

                  <Link href={`${langPrefix}/${article.category.toLowerCase()}/${article.slug}`}>
                    <h3 className="text-base font-bold text-slate-900 hover:text-emerald-700 transition leading-snug mb-2">
                      {article.title}
                    </h3>
                  </Link>

                  {article.excerpt && (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-4 flex-grow">
                      {article.excerpt}
                    </p>
                  )}

                  <div className="text-[11px] text-slate-400 pt-3 border-t border-slate-100 flex justify-between items-center mt-auto">
                    <span>{article.author_display_name || `${brandName} Bureau`}</span>
                    <span className="text-slate-400" suppressHydrationWarning>{formatArticleDate(article.published_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Regional Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2 mb-4 flex items-center gap-2">
                <span>🔥</span>
                <span>Most Discussed in J&amp;K</span>
              </h3>

              <div className="space-y-4">
                {trendingArticles.slice(0, 5).map((article, idx) => (
                  <Link
                    key={article.id}
                    href={`${langPrefix}/${article.category.toLowerCase()}/${article.slug}`}
                    className="block group"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-sm font-bold text-emerald-600 shrink-0">
                        0{idx + 1}.
                      </span>
                      <div>
                        <h4 className="text-xs font-semibold text-slate-800 group-hover:text-emerald-700 transition leading-snug">
                          {article.title}
                        </h4>
                        <span className="text-[10px] text-slate-400 uppercase mt-0.5 block">
                          {article.district || article.category}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Voices From The Valley Quote Callout */}
            <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-xl">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2">
                💬 Voices From The Valley
              </div>
              <blockquote className="text-xs text-emerald-950 italic leading-relaxed mb-3">
                &ldquo;Clean civic water corridors and verified reporting give citizens a stake in their districts.&rdquo;
              </blockquote>
              <div className="text-[11px] font-semibold text-emerald-800">
                &mdash; {brandName} Reader Roundtable, Srinagar
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
