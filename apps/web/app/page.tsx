import Link from 'next/link';
import { createServerAnonClient } from '@/lib/supabase-server';

// Server-side fetching for the homepage
export const revalidate = 60; // Revalidate every 60 seconds

export default async function HomePage() {
  const supabase = createServerAnonClient();

  // Fetch Latest Articles
  const { data: latestArticles, error: latestError } = await supabase
    .from('articles')
    .select('id, slug, title, excerpt, category, author_display_name, published_at, featured_image_url')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(7);

  // Fetch Trending Articles
  const { data: trendingArticles, error: trendingError } = await supabase
    .from('articles')
    .select('id, slug, title, category, published_at, view_count')
    .order('view_count', { ascending: false })
    .limit(5);

  const heroArticle = latestArticles && latestArticles.length > 0 ? latestArticles[0] : null;
  const recentArticles = latestArticles && latestArticles.length > 1 ? latestArticles.slice(1) : [];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Premium Header / Navigation area placeholder */}
      <header className="bg-white border-b border-slate-200 py-6 px-4 md:px-8 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="text-3xl font-black tracking-tighter text-blue-900 uppercase">
            KJIN News
          </div>
          <nav className="hidden md:flex gap-6 font-semibold text-sm tracking-wide text-slate-600">
            <Link href="/category/politics" className="hover:text-blue-600 transition">Politics</Link>
            <Link href="/category/local" className="hover:text-blue-600 transition">Local</Link>
            <Link href="/category/economy" className="hover:text-blue-600 transition">Economy</Link>
            <Link href="/category/culture" className="hover:text-blue-600 transition">Culture</Link>
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
                  <div className="w-full h-[400px] mb-6 overflow-hidden rounded-xl bg-slate-200">
                    <img 
                      src={heroArticle.featured_image_url} 
                      alt={heroArticle.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                    />
                  </div>
                ) : (
                  <div className="w-full h-2 bg-blue-600 mb-6 rounded-full" />
                )}
                <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-blue-600 mb-3">
                  <span>{heroArticle.category}</span>
                  <span className="text-slate-300">&bull;</span>
                  <span className="text-slate-500">{new Date(heroArticle.published_at).toLocaleDateString()}</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight group-hover:text-blue-700 transition">
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
            <h2 className="text-2xl font-bold border-b-2 border-slate-900 pb-2 mb-6">Latest News</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {recentArticles.map(article => (
                <Link key={article.id} href={`/${article.category.toLowerCase()}/${article.slug}`} className="group block flex flex-col h-full">
                  {article.featured_image_url && (
                    <div className="w-full h-48 mb-4 overflow-hidden rounded-lg bg-slate-200">
                      <img 
                        src={article.featured_image_url} 
                        alt={article.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                      />
                    </div>
                  )}
                  <div className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">
                    {article.category}
                  </div>
                  <h3 className="text-xl font-bold leading-snug group-hover:text-blue-700 transition mb-2">
                    {article.title}
                  </h3>
                  {article.excerpt && (
                    <p className="text-sm text-slate-600 line-clamp-3 mb-4 flex-grow">
                      {article.excerpt}
                    </p>
                  )}
                  <div className="mt-auto text-xs font-medium text-slate-400">
                    By {article.author_display_name || 'KJIN Desk'}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: Trending & Quick Feeds */}
        <aside className="lg:col-span-4 space-y-12">
          <section>
            <h2 className="text-xl font-bold border-b border-slate-300 pb-2 mb-6 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              Trending Now
            </h2>
            <ul className="space-y-6">
              {trendingArticles?.map((article, idx) => (
                <li key={article.id} className="flex gap-4 items-start group">
                  <span className="text-3xl font-black text-slate-200 group-hover:text-blue-200 transition">
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
            <div className="text-cyan-400 text-xs font-bold uppercase tracking-widest mb-2">Newsletter</div>
            <h3 className="text-2xl font-bold mb-4">Stay informed with daily dispatches.</h3>
            <p className="text-slate-400 text-sm mb-6">
              Get verified reporting and analysis from Jammu and Kashmir delivered directly to your inbox.
            </p>
            <form className="flex flex-col gap-3">
              <input 
                type="email" 
                placeholder="Email address" 
                className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-cyan-400"
              />
              <button 
                type="button"
                className="bg-cyan-500 text-slate-950 font-bold rounded-lg px-4 py-2 text-sm hover:bg-cyan-400 transition"
              >
                Subscribe
              </button>
            </form>
          </section>
        </aside>

      </div>
    </main>
  );
}
