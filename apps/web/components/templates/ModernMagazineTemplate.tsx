import Link from 'next/link';
import Image from 'next/image';
import { NewsletterForm } from '@/components/NewsletterForm';
import { SITE_SHORT_NAME } from '@/lib/config';
import { TemplateProps } from './types';
import { RegionalCoverageWidget } from './RegionalCoverageWidget';

export function ModernMagazineTemplate({
  langPrefix,
  heroArticle,
  recentArticles,
  trendingArticles,
}: TemplateProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-24 selection:bg-blue-600 selection:text-white">
      {/* Modern High-Tech Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 py-4 px-4 md:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
          <Link
            href="/"
            className="text-2xl md:text-3xl font-black tracking-tighter bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent hover:opacity-90 transition"
          >
            {SITE_SHORT_NAME}
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-400">
            <Link href={`${langPrefix}/category/politics`} className="hover:text-blue-400 transition">Politics</Link>
            <Link href={`${langPrefix}/category/local`} className="hover:text-blue-400 transition">Local</Link>
            <Link href={`${langPrefix}/category/economy`} className="hover:text-blue-400 transition">Economy</Link>
            <Link href={`${langPrefix}/category/culture`} className="hover:text-blue-400 transition">Culture</Link>
            <Link href={`${langPrefix}/category/investigation`} className="hover:text-blue-400 transition">Investigation</Link>
            <Link href={`${langPrefix}/district/srinagar`} className="hover:text-cyan-400 transition">Srinagar</Link>
            <Link href={`${langPrefix}/district/jammu`} className="hover:text-cyan-400 transition">Jammu</Link>
          </nav>

          <div className="flex items-center gap-3 text-xs">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            <span className="text-slate-400 font-mono hidden sm:inline">LIVE J&K FEED</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-8 space-y-12">
        {/* Full-Bleed Modern Magazine Hero */}
        {heroArticle && (
          <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 group">
            <Link href={`${langPrefix}/${heroArticle.category.toLowerCase()}/${heroArticle.slug}`} className="block">
              <div className="relative h-[420px] md:h-[540px] w-full">
                {heroArticle.featured_image_url ? (
                  <Image
                    src={heroArticle.featured_image_url}
                    alt={heroArticle.title}
                    fill
                    priority
                    sizes="100vw"
                    className="object-cover opacity-60 transition duration-700 group-hover:scale-105 group-hover:opacity-75"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-tr from-blue-950 via-slate-900 to-indigo-950" />
                )}

                {/* Dark Gradient Overlay for optimal readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />

                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12 max-w-4xl">
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <span className="rounded-full bg-blue-500/20 border border-blue-400/30 px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-300 backdrop-blur-md">
                      {heroArticle.category}
                    </span>
                    {heroArticle.district && (
                      <span className="rounded-full bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-300">
                        {heroArticle.district}
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      {new Date(heroArticle.published_at).toLocaleDateString()}
                    </span>
                  </div>

                  <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight text-white group-hover:text-blue-300 transition mb-4">
                    {heroArticle.title}
                  </h1>

                  {heroArticle.excerpt && (
                    <p className="text-base md:text-xl text-slate-300 font-normal line-clamp-2 leading-relaxed">
                      {heroArticle.excerpt}
                    </p>
                  )}

                  <div className="mt-4 flex items-center gap-3 text-xs text-slate-400">
                    <span className="font-semibold text-slate-200">By {heroArticle.author_display_name || 'KJIN Desk'}</span>
                  </div>
                </div>
              </div>
            </Link>
          </section>
        )}

        {/* Section 1: Visual Stories & Special Reports with Sticky Editorial Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Top 4 Featured Visual Cards */}
          <div className="lg:col-span-8 space-y-8">
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  <span className="h-4 w-1 bg-gradient-to-b from-blue-500 to-cyan-400 rounded-full"></span>
                  Visual Stories & Special Reports
                </h2>
                <span className="text-xs font-mono text-slate-400">
                  TOP DISPATCHES
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {recentArticles.slice(0, 4).map((article) => (
                  <article
                    key={article.id}
                    className="group rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm p-4 transition-all duration-300 hover:border-slate-700 hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-1 flex flex-col justify-between"
                  >
                    <Link href={`${langPrefix}/${article.category.toLowerCase()}/${article.slug}`} className="block">
                      {article.featured_image_url && (
                        <div className="relative h-48 w-full overflow-hidden rounded-xl mb-4 bg-slate-800">
                          <Image
                            src={article.featured_image_url}
                            alt={article.title}
                            fill
                            loading="lazy"
                            decoding="async"
                            sizes="(max-width: 768px) 100vw, 33vw"
                            className="object-cover transition duration-500 group-hover:scale-105"
                          />
                          <div className="absolute top-3 left-3">
                            <span className="rounded-full bg-black/60 backdrop-blur-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-300">
                              {article.category}
                            </span>
                          </div>
                        </div>
                      )}

                      <h3 className="text-lg font-bold leading-snug text-white group-hover:text-blue-300 transition mb-2">
                        {article.title}
                      </h3>

                      <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed mb-4">
                        {article.excerpt}
                      </p>
                    </Link>

                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
                      <span>{article.district ? `District: ${article.district}` : 'Jammu & Kashmir'}</span>
                      <span>{new Date(article.published_at).toLocaleDateString()}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Sticky Editorial Sidebar */}
          <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
            {/* Trending Conversations */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></span>
                  Trending Conversations
                </h3>
                <span className="text-[10px] uppercase font-mono tracking-widest text-slate-500">
                  TOP 5
                </span>
              </div>

              <div className="space-y-3.5">
                {trendingArticles.map((article, idx) => (
                  <Link
                    key={article.id}
                    href={`${langPrefix}/${article.category.toLowerCase()}/${article.slug}`}
                    className="group flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-800/50 transition border border-transparent hover:border-slate-800"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 font-mono font-bold text-xs group-hover:bg-blue-500 group-hover:text-white transition">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        {article.category}
                      </div>
                      <h4 className="text-xs font-semibold leading-snug text-slate-200 group-hover:text-blue-300 transition truncate">
                        {article.title}
                      </h4>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Newsletter Subscription */}
            <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-950/40 via-slate-900 to-indigo-950/40 p-6 backdrop-blur-md shadow-lg shadow-blue-950/30">
              <div className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-2">KJIN Dispatch</div>
              <h4 className="text-lg font-bold text-white mb-1.5">Independent Reporting, Delivered</h4>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Join thousands receiving weekly investigative briefs and policy analyses directly.
              </p>
              <NewsletterForm />
            </div>

            {/* Regional Pulse / 5-Region Coverage Directory */}
            <RegionalCoverageWidget langPrefix={langPrefix} />
          </aside>
        </div>

        {/* Section 2: Full-Width 3-Column Extended Dispatches (Eliminating Blank Space) */}
        {recentArticles.length > 4 && (
          <div className="pt-8 border-t border-slate-800/80 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-mono uppercase tracking-widest text-blue-400 mb-1">
                  GROUND INVESTIGATIONS &amp; REGIONAL ARCHIVE
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  <span className="h-5 w-1.5 bg-gradient-to-b from-blue-500 via-indigo-500 to-cyan-400 rounded-full"></span>
                  More In-Depth Dispatches
                </h2>
              </div>
              <span className="text-xs text-slate-400 hidden sm:inline">
                Displaying {recentArticles.slice(4).length} verified reports
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recentArticles.slice(4).map((article) => (
                <article
                  key={article.id}
                  className="group rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm p-4 transition-all duration-300 hover:border-slate-700 hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-1 flex flex-col justify-between"
                >
                  <Link href={`${langPrefix}/${article.category.toLowerCase()}/${article.slug}`} className="block">
                    {article.featured_image_url && (
                      <div className="relative h-44 w-full overflow-hidden rounded-xl mb-4 bg-slate-800">
                        <Image
                          src={article.featured_image_url}
                          alt={article.title}
                          fill
                          loading="lazy"
                          decoding="async"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          className="object-cover transition duration-500 group-hover:scale-105"
                        />
                        <div className="absolute top-3 left-3">
                          <span className="rounded-full bg-black/60 backdrop-blur-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-300">
                            {article.category}
                          </span>
                        </div>
                      </div>
                    )}

                    <h3 className="text-base font-bold leading-snug text-white group-hover:text-blue-300 transition mb-2">
                      {article.title}
                    </h3>

                    <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed mb-4">
                      {article.excerpt}
                    </p>
                  </Link>

                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
                    <span>{article.district ? `District: ${article.district}` : 'Jammu & Kashmir'}</span>
                    <span>{new Date(article.published_at).toLocaleDateString()}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
