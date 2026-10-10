import Link from 'next/link';
import Image from 'next/image';
import { Metadata } from 'next';
import { createServerAnonClient } from '@/lib/supabase-server';
import { NewsletterForm } from '@/components/NewsletterForm';
import { SITE_URL, SITE_NAME, SITE_SHORT_NAME, DEFAULT_LOCALE } from '@/lib/config';

export const revalidate = 60; // Revalidate every 60 seconds

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${SITE_NAME} | Verified Journalism from Jammu & Kashmir`,
  description: 'Independent, verified reporting, investigations, and ground dispatches from Jammu and Kashmir.',
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: `${SITE_NAME} | Ground Reporting from J&K`,
    description: 'Independent, verified reporting, investigations, and ground dispatches from Jammu and Kashmir.',
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: DEFAULT_LOCALE,
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function HomePage() {
  const supabase = createServerAnonClient();

  // 1. Fetch Latest Articles
  const { data: latestArticles } = await supabase
    .from('articles')
    .select('id, slug, title, excerpt, category, district, author_display_name, published_at, featured_image_url')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(7);

  // 2. Fetch Trending Articles (bounded to recent 30-day window to prevent lifetime view manipulation)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  let { data: trendingArticles } = await supabase
    .from('articles')
    .select('id, slug, title, category, published_at, view_count')
    .gte('published_at', thirtyDaysAgo)
    .order('view_count', { ascending: false })
    .limit(5);

  // Fallback to top views overall if no recent articles in 30 days yet
  if (!trendingArticles || trendingArticles.length === 0) {
    const { data: fallbackTrending } = await supabase
      .from('articles')
      .select('id, slug, title, category, published_at, view_count')
      .order('view_count', { ascending: false })
      .limit(5);
    trendingArticles = fallbackTrending || [];
  }

  const heroArticle = latestArticles && latestArticles.length > 0 ? latestArticles[0] : null;
  const recentArticles = latestArticles && latestArticles.length > 1 ? latestArticles.slice(1) : [];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Header / Navigation */}
      <header className="bg-white border-b border-slate-200 py-6 px-4 md:px-8 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <Link
            href="/"
            className="text-3xl font-black tracking-tighter text-blue-900 uppercase hover:text-blue-700 transition"
          >
            {SITE_SHORT_NAME}
          </Link>
          <nav className="flex flex-wrap justify-center gap-6 font-semibold text-sm tracking-wide text-slate-600">
            <Link href="/category/politics" className="hover:text-blue-600 transition">Politics</Link>
            <Link href="/category/local" className="hover:text-blue-600 transition">Local</Link>
            <Link href="/category/economy" className="hover:text-blue-600 transition">Economy</Link>
            <Link href="/category/culture" className="hover:text-blue-600 transition">Culture</Link>
            <Link href="/category/investigation" className="hover:text-blue-600 transition">Investigation</Link>
            <Link href="/district/srinagar" className="hover:text-emerald-600 transition">Srinagar</Link>
            <Link href="/district/jammu" className="hover:text-emerald-600 transition">Jammu</Link>
          </nav>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column: Hero & Latest News */}
        <div className="lg:col-span-8">
          {heroArticle && (
            <section className="mb-14">
              <Link href={`/${heroArticle.category.toLowerCase()}/${heroArticle.slug}`} className="group block">
                {heroArticle.featured_image_url ? (
                  <div className="relative w-full h-[320px] md:h-[440px] mb-6 overflow-hidden rounded-xl bg-slate-200 shadow-sm">
                    <Image
                      src={heroArticle.featured_image_url}
                      alt={heroArticle.title}
                      fill
                      priority
                      sizes="(max-width: 1024px) 100vw, 66vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                ) : (
                  <div className="w-full h-2 bg-blue-600 mb-6 rounded-full" />
                )}
                <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">
                  <span>{heroArticle.category}</span>
                  {heroArticle.district && (
                    <>
                      <span className="text-slate-300">&bull;</span>
                      <span className="text-slate-700">{heroArticle.district}</span>
                    </>
                  )}
                  <span className="text-slate-300">&bull;</span>
                  <span className="text-slate-500">
                    {new Date(heroArticle.published_at).toLocaleDateString()}
                  </span>
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight group-hover:text-blue-700 transition text-slate-900">
                  {heroArticle.title}
                </h1>
                {heroArticle.excerpt && (
                  <p className="mt-4 text-lg text-slate-600 leading-relaxed font-light">
                    {heroArticle.excerpt}
                  </p>
                )}
              </Link>
            </section>
          )}

          <section>
            <h2 className="text-2xl font-bold border-b-2 border-slate-900 pb-2 mb-6">
              Latest News
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {recentArticles.map((article) => (
                <Link
                  key={article.id}
                  href={`/${article.category.toLowerCase()}/${article.slug}`}
                  className="group flex flex-col h-full bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition"
                >
                  {article.featured_image_url && (
                    <div className="relative w-full h-48 mb-4 overflow-hidden rounded-lg bg-slate-100">
                      <Image
                        src={article.featured_image_url}
                        alt={article.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">
                    <span>{article.category}</span>
                    {article.district && (
                      <>
                        <span className="text-slate-300">&bull;</span>
                        <span className="text-slate-500">{article.district}</span>
                      </>
                    )}
                  </div>
                  <h3 className="text-xl font-bold leading-snug group-hover:text-blue-700 transition mb-2">
                    {article.title}
                  </h3>
                  {article.excerpt && (
                    <p className="text-sm text-slate-600 line-clamp-3 mb-4 flex-grow">
                      {article.excerpt}
                    </p>
                  )}
                  <div className="mt-auto text-xs font-medium text-slate-400 pt-2 border-t border-slate-100">
                    By {article.author_display_name || 'KJIN Desk'}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: Trending & Newsletter */}
        <aside className="lg:col-span-4 space-y-12">
          <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold border-b border-slate-200 pb-3 mb-6 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
              Trending Now
            </h2>
            <ul className="space-y-6">
              {trendingArticles?.map((article, idx) => (
                <li key={article.id} className="flex gap-4 items-start group">
                  <span className="text-3xl font-black text-slate-200 group-hover:text-blue-300 transition select-none">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                      {article.category}
                    </div>
                    <Link href={`/${article.category.toLowerCase()}/${article.slug}`}>
                      <h4 className="font-bold leading-tight group-hover:text-blue-600 transition">
                        {article.title}
                      </h4>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl">
            <div className="text-cyan-400 text-xs font-bold uppercase tracking-widest mb-2">
              Newsletter
            </div>
            <h3 className="text-2xl font-bold mb-4">
              Stay informed with daily dispatches.
            </h3>
            <p className="text-slate-400 text-sm mb-6">
              Get verified reporting and analysis from Jammu and Kashmir delivered directly to your inbox every morning.
            </p>
            <NewsletterForm />
          </section>
        </aside>
      </div>
    </main>
  );
}
