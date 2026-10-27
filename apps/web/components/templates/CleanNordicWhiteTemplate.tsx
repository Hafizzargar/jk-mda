import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { TemplateProps } from './types';

export function CleanNordicWhiteTemplate({
  langPrefix,
  heroArticle,
  recentArticles,
  trendingArticles,
  navbarSettings,
}: TemplateProps) {
  const brandName = navbarSettings?.brand?.name || 'KCPJLN';
  const brandTagline = navbarSettings?.brand?.tagline || 'Verified Independent Journalism';

  return (
    <div className="min-h-screen bg-white text-neutral-900 pb-24 font-sans selection:bg-neutral-900 selection:text-white">
      {/* Refined Minimalist Top Announcement */}
      <div className="border-b border-neutral-100 py-2.5 px-4 text-center text-xs tracking-widest uppercase font-medium text-neutral-500">
        <span>{brandName} &bull; {brandTagline}</span>
      </div>

      {/* Main Header */}
      <header className="border-b border-neutral-200 bg-white py-8 px-4 md:px-12 sticky top-0 z-40 backdrop-blur-md bg-white/95">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <Link
              href={`${langPrefix}/`}
              className="text-4xl md:text-5xl font-light tracking-tighter uppercase text-neutral-950 hover:opacity-80 transition inline-block tracking-wider"
            >
              {brandName.split('').join(' ')}
            </Link>
            <div className="text-[11px] tracking-widest uppercase text-neutral-400 mt-1">
              Nordic Paper Edition &bull; High Readability
            </div>
          </div>

          <nav className="flex items-center gap-6 text-xs uppercase tracking-widest font-semibold text-neutral-600">
            <Link href={`${langPrefix}/category/politics`} className="hover:text-black transition">Politics</Link>
            <Link href={`${langPrefix}/category/local`} className="hover:text-black transition">Local</Link>
            <Link href={`${langPrefix}/category/economy`} className="hover:text-black transition">Economy</Link>
            <Link href={`${langPrefix}/category/culture`} className="hover:text-black transition">Culture</Link>
            <Link href={`${langPrefix}/category/investigation`} className="hover:text-black transition">Investigation</Link>
          </nav>
        </div>
      </header>

      {/* Hero Showcase */}
      <main className="max-w-7xl mx-auto px-4 md:px-12 mt-12">
        {heroArticle && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 pb-14 border-b border-neutral-200">
            <div className="lg:col-span-7 flex flex-col justify-center">
              <div className="flex items-center gap-3 text-xs tracking-widest uppercase font-semibold text-neutral-500 mb-4">
                <span className="text-neutral-950 font-bold">{heroArticle.category}</span>
                <span>/</span>
                <span>{heroArticle.district || 'Regional'}</span>
                <span>/</span>
                <time>{new Date(heroArticle.published_at).toLocaleDateString()}</time>
              </div>

              <Link href={`${langPrefix}/${heroArticle.category.toLowerCase()}/${heroArticle.slug}`}>
                <h1 className="text-3xl md:text-5xl font-normal tracking-tight text-neutral-950 leading-[1.15] mb-6 hover:text-neutral-600 transition">
                  {heroArticle.title}
                </h1>
              </Link>

              {heroArticle.excerpt && (
                <p className="text-lg text-neutral-600 font-light leading-relaxed mb-8 max-w-2xl">
                  {heroArticle.excerpt}
                </p>
              )}

              <div className="flex items-center justify-between text-xs tracking-wider uppercase text-neutral-500 pt-4 border-t border-neutral-100">
                <span>Reporting: {heroArticle.author_display_name || `${brandName} Staff`}</span>
                <Link
                  href={`${langPrefix}/${heroArticle.category.toLowerCase()}/${heroArticle.slug}`}
                  className="font-semibold text-neutral-950 hover:underline"
                >
                  Read Dispatch &rarr;
                </Link>
              </div>
            </div>

            {heroArticle.featured_image_url && (
              <div className="lg:col-span-5 relative h-80 md:h-[450px] w-full rounded-none overflow-hidden bg-neutral-100">
                <Image
                  src={heroArticle.featured_image_url}
                  alt={heroArticle.title}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 42vw"
                  className="object-cover grayscale hover:grayscale-0 transition duration-700"
                />
              </div>
            )}
          </div>
        )}

        {/* Two-Column Grid: Latest Articles & Trending Digest */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mt-14">
          {/* Main Story Column */}
          <div className="lg:col-span-8">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200 mb-8">
              <h2 className="text-xs uppercase tracking-widest font-bold text-neutral-400">
                Chronological Dispatches
              </h2>
              <Link href={`${langPrefix}/latest`} className="text-xs tracking-wider uppercase font-semibold text-neutral-950 hover:underline">
                View Archive &rarr;
              </Link>
            </div>

            <div className="divide-y divide-neutral-100">
              {recentArticles.slice(0, 6).map((article) => (
                <article key={article.id} className="py-8 group">
                  <div className="flex items-center gap-3 text-[11px] tracking-widest uppercase font-medium text-neutral-400 mb-2">
                    <span className="text-neutral-900 font-semibold">{article.category}</span>
                    <span>&bull;</span>
                    <span>{article.district || 'J&K'}</span>
                    <span>&bull;</span>
                    <span>{new Date(article.published_at).toLocaleDateString()}</span>
                  </div>

                  <Link href={`${langPrefix}/${article.category.toLowerCase()}/${article.slug}`}>
                    <h3 className="text-xl md:text-2xl font-normal leading-snug text-neutral-950 group-hover:text-neutral-600 transition mb-3">
                      {article.title}
                    </h3>
                  </Link>

                  {article.excerpt && (
                    <p className="text-sm text-neutral-600 font-light line-clamp-2 leading-relaxed mb-4">
                      {article.excerpt}
                    </p>
                  )}

                  <div className="text-[11px] tracking-widest uppercase text-neutral-400">
                    By {article.author_display_name || 'Staff Reporter'}
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Sidebar: Nordic Index & Reading Digest */}
          <div className="lg:col-span-4 space-y-12">
            <div>
              <div className="pb-4 border-b border-neutral-200 mb-6">
                <h2 className="text-xs uppercase tracking-widest font-bold text-neutral-400">
                  Essential Reading
                </h2>
              </div>

              <div className="space-y-6">
                {trendingArticles.slice(0, 5).map((article, idx) => (
                  <Link
                    key={article.id}
                    href={`${langPrefix}/${article.category.toLowerCase()}/${article.slug}`}
                    className="block group"
                  >
                    <div className="flex items-start gap-4">
                      <span className="text-lg font-light text-neutral-300 font-serif">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <span className="text-[10px] uppercase tracking-widest font-semibold text-neutral-400 mb-1 block">
                          {article.category}
                        </span>
                        <h4 className="text-sm font-normal text-neutral-900 group-hover:text-neutral-500 transition leading-snug">
                          {article.title}
                        </h4>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Quiet Newsletter Box */}
            <div className="p-8 border border-neutral-200 bg-neutral-50/50">
              <h3 className="text-sm font-normal tracking-tight uppercase text-neutral-900 mb-2">
                Morning Journal
              </h3>
              <p className="text-xs text-neutral-500 font-light leading-relaxed mb-4">
                Curated morning reporting delivered without banners, advertisements, or tracking.
              </p>
              <div className="space-y-2">
                <input
                  type="email"
                  placeholder="Email address"
                  className="w-full bg-white border border-neutral-300 px-3 py-2 text-xs tracking-wider text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-neutral-900"
                />
                <button
                  type="button"
                  className="w-full bg-neutral-950 text-white text-xs uppercase tracking-widest py-2.5 hover:bg-neutral-800 transition"
                >
                  Join Reading List
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
