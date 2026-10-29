import Link from 'next/link';
import Image from 'next/image';
import { NewsletterForm } from '@/components/NewsletterForm';
import { SITE_SHORT_NAME } from '@/lib/config';
import { formatArticleDate } from '@/lib/date';
import { TemplateProps } from './types';

export function BentoGridTemplate({
  langPrefix,
  heroArticle,
  recentArticles,
  trendingArticles,
  allArticles,
}: TemplateProps) {
  const secondary1 = recentArticles[0] || allArticles[1];
  const secondary2 = recentArticles[1] || allArticles[2];
  const secondary3 = recentArticles[2] || allArticles[3];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-24 selection:bg-cyan-500 selection:text-slate-950">
      {/* Modern Bento Topbar */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md py-4 px-6 md:px-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-2xl font-black tracking-tight text-white flex items-center gap-2"
            >
              <span className="h-6 w-6 rounded-lg bg-cyan-400 text-slate-950 flex items-center justify-center font-mono font-bold text-xs">
                K
              </span>
              {SITE_SHORT_NAME}
            </Link>
            <span className="hidden sm:inline-block rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs text-cyan-300">
              Bento Media Edition
            </span>
          </div>

          <nav className="flex items-center gap-5 text-xs font-semibold text-slate-400">
            <Link href={`${langPrefix}/category/politics`} className="hover:text-cyan-300 transition">Politics</Link>
            <Link href={`${langPrefix}/category/local`} className="hover:text-cyan-300 transition">Local</Link>
            <Link href={`${langPrefix}/category/economy`} className="hover:text-cyan-300 transition">Economy</Link>
            <Link href={`${langPrefix}/category/investigation`} className="hover:text-cyan-300 transition">Investigation</Link>
            <Link href={`${langPrefix}/district/srinagar`} className="hover:text-cyan-300 transition">Srinagar</Link>
            <Link href={`${langPrefix}/district/jammu`} className="hover:text-cyan-300 transition">Jammu</Link>
          </nav>
        </div>
      </header>

      {/* Main Bento Grid Container */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 mt-8 space-y-8">
        {/* Top Bento Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Main Hero Bento Card (Span 8) */}
          {heroArticle && (
            <div className="md:col-span-8 rounded-3xl border border-slate-800 bg-slate-950/90 overflow-hidden group hover:border-slate-700 transition flex flex-col justify-between">
              <Link href={`${langPrefix}/${heroArticle.category.toLowerCase()}/${heroArticle.slug}`} className="block p-6 md:p-8">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-3">
                  <span className="rounded-md bg-cyan-400/10 border border-cyan-400/20 px-2 py-0.5">
                    Featured Bento
                  </span>
                  <span>{heroArticle.category}</span>
                  <span>&bull;</span>
                  <span className="text-slate-400">{heroArticle.district || 'J&K'}</span>
                </div>

                <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-white group-hover:text-cyan-300 transition mb-4 leading-snug">
                  {heroArticle.title}
                </h1>

                {heroArticle.excerpt && (
                  <p className="text-sm md:text-base text-slate-300 font-normal line-clamp-2 leading-relaxed mb-6">
                    {heroArticle.excerpt}
                  </p>
                )}
              </Link>

              {heroArticle.featured_image_url && (
                <div className="relative h-64 md:h-80 w-full overflow-hidden bg-slate-900 border-t border-slate-800">
                  <Image
                    src={heroArticle.featured_image_url}
                    alt={heroArticle.title}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 66vw"
                    className="object-cover group-hover:scale-105 transition duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
                  <div className="absolute bottom-4 left-6 text-xs text-slate-400" suppressHydrationWarning>
                    By {heroArticle.author_display_name || 'Staff Reporter'} · {formatArticleDate(heroArticle.published_at)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Secondary Bento Vertical Stack (Span 4) */}
          <div className="md:col-span-4 flex flex-col gap-6">
            {secondary1 && (
              <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-6 flex flex-col justify-between flex-1 group hover:border-slate-700 transition">
                <Link href={`${langPrefix}/${secondary1.category.toLowerCase()}/${secondary1.slug}`}>
                  <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest">
                    {secondary1.category} / {secondary1.district || 'Regional'}
                  </span>
                  <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition mt-2 mb-2 leading-snug">
                    {secondary1.title}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                    {secondary1.excerpt}
                  </p>
                </Link>
                <div className="text-[11px] text-slate-500 pt-3 border-t border-slate-800/80 mt-4" suppressHydrationWarning>
                  {formatArticleDate(secondary1.published_at)}
                </div>
              </div>
            )}

            {secondary2 && (
              <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-6 flex flex-col justify-between flex-1 group hover:border-slate-700 transition">
                <Link href={`${langPrefix}/${secondary2.category.toLowerCase()}/${secondary2.slug}`}>
                  <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest">
                    {secondary2.category} / {secondary2.district || 'Regional'}
                  </span>
                  <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition mt-2 mb-2 leading-snug">
                    {secondary2.title}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                    {secondary2.excerpt}
                  </p>
                </Link>
                <div className="text-[11px] text-slate-500 pt-3 border-t border-slate-800/80 mt-4" suppressHydrationWarning>
                  {formatArticleDate(secondary2.published_at)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Lower Bento Matrix (3 Columns: Visual Tile, Trending Pulse, Newsletter) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Bento Visual Card */}
          {secondary3 && (
            <div className="md:col-span-4 rounded-3xl border border-slate-800 bg-slate-950 overflow-hidden group hover:border-slate-700 transition flex flex-col">
              {secondary3.featured_image_url && (
                <div className="relative h-44 w-full bg-slate-900">
                  <Image
                    src={secondary3.featured_image_url}
                    alt={secondary3.title}
                    fill
                    loading="lazy"
                    decoding="async"
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover group-hover:scale-105 transition duration-500"
                  />
                </div>
              )}
              <div className="p-6 flex flex-col justify-between flex-1">
                <Link href={`${langPrefix}/${secondary3.category.toLowerCase()}/${secondary3.slug}`}>
                  <div className="text-xs font-bold text-cyan-400 uppercase mb-1">
                    {secondary3.category}
                  </div>
                  <h4 className="text-base font-bold text-white group-hover:text-cyan-300 transition mb-2">
                    {secondary3.title}
                  </h4>
                  <p className="text-xs text-slate-400 line-clamp-2">
                    {secondary3.excerpt}
                  </p>
                </Link>
                <div className="text-[11px] text-slate-500 mt-4 pt-3 border-t border-slate-800" suppressHydrationWarning>
                  {formatArticleDate(secondary3.published_at)}
                </div>
              </div>
            </div>
          )}

          {/* Bento Popularity Pulse */}
          <div className="md:col-span-4 rounded-3xl border border-slate-800 bg-slate-950 p-6 flex flex-col justify-between">
            <div>
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2 mb-4">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></span>
                Reader Popularity Pulse
              </div>
              <div className="space-y-3">
                {trendingArticles.slice(0, 4).map((item, idx) => (
                  <Link
                    key={item.id}
                    href={`${langPrefix}/${item.category.toLowerCase()}/${item.slug}`}
                    className="flex items-center justify-between gap-3 text-xs p-2 rounded-xl hover:bg-slate-900 transition group"
                  >
                    <span className="font-mono text-slate-500 group-hover:text-cyan-300 font-bold">#{idx + 1}</span>
                    <span className="font-medium text-slate-300 group-hover:text-white truncate flex-1">{item.title}</span>
                  </Link>
                ))}
              </div>
            </div>
            <div className="text-[11px] text-slate-500 pt-3 border-t border-slate-800/80 mt-4 font-mono">
              REAL-TIME AUDIT LOGGED
            </div>
          </div>

          {/* Bento Newsletter Card */}
          <div className="md:col-span-4 rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/30 via-slate-950 to-slate-900 p-6 flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-2">Bento Digest</div>
              <h4 className="text-lg font-bold text-white mb-2">Stay Connected to J&K</h4>
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Direct morning intelligence on state legislature, transit corridors, and high-altitude agriculture.
              </p>
              <NewsletterForm />
            </div>
            <div className="text-[10px] text-slate-500 mt-4 font-mono">
              Zero trackers · Strict encryption
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
