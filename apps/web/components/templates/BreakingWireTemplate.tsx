import Link from 'next/link';
import Image from 'next/image';
import { NewsletterForm } from '@/components/NewsletterForm';
import { SITE_SHORT_NAME } from '@/lib/config';
import { TemplateProps } from './types';

export function BreakingWireTemplate({
  langPrefix,
  heroArticle,
  recentArticles,
  trendingArticles,
  allArticles,
}: TemplateProps) {
  const latestStory = heroArticle || allArticles[0];

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 font-sans pb-20">
      {/* Red Wire Alert Ticker */}
      <div className="bg-red-600 text-white py-2 px-4 text-xs font-bold uppercase tracking-wider flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <span className="flex items-center gap-1.5 shrink-0 bg-red-800 px-2 py-0.5 rounded text-[10px] animate-pulse">
            <span className="h-2 w-2 rounded-full bg-white"></span>
            FAST WIRE
          </span>
          {latestStory && (
            <Link
              href={`${langPrefix}/${latestStory.category.toLowerCase()}/${latestStory.slug}`}
              className="truncate hover:underline text-white font-medium"
            >
              {latestStory.title}
            </Link>
          )}
        </div>
        <span className="shrink-0 font-mono text-[11px] hidden sm:inline">NEWSROOM SYNC ACTIVE</span>
      </div>

      {/* Wire Header */}
      <header className="border-b border-neutral-800 bg-neutral-950 py-4 px-4 md:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-2xl md:text-3xl font-black tracking-tight text-white uppercase flex items-center gap-2"
            >
              <span className="bg-red-600 text-white px-2 py-0.5 rounded text-lg font-mono">LIVE</span>
              {SITE_SHORT_NAME}
            </Link>
            <span className="text-xs text-neutral-400 border-l border-neutral-700 pl-4 hidden md:inline">
              Verified 24/7 Regional News Wire
            </span>
          </div>

          <nav className="flex flex-wrap gap-4 text-xs font-mono font-semibold uppercase text-neutral-300">
            <Link href={`${langPrefix}/category/politics`} className="hover:text-red-400 transition">/Politics</Link>
            <Link href={`${langPrefix}/category/local`} className="hover:text-red-400 transition">/Local</Link>
            <Link href={`${langPrefix}/category/economy`} className="hover:text-red-400 transition">/Economy</Link>
            <Link href={`${langPrefix}/category/investigation`} className="hover:text-red-400 transition">/Investigation</Link>
            <Link href={`${langPrefix}/district/srinagar`} className="hover:text-red-400 transition">/Srinagar</Link>
            <Link href={`${langPrefix}/district/jammu`} className="hover:text-red-400 transition">/Jammu</Link>
          </nav>
        </div>
      </header>

      {/* High-Velocity Wire Grid */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Urgent Live Lead Box */}
        <div className="lg:col-span-8 space-y-6">
          {heroArticle && (
            <div className="border border-neutral-700 bg-neutral-950 p-6 rounded-xl">
              <div className="flex items-center justify-between text-xs font-mono text-neutral-400 mb-3 border-b border-neutral-800 pb-2">
                <span className="text-red-500 font-bold uppercase tracking-wider">TOP STORY // BULLETIN</span>
                <span>{new Date(heroArticle.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} GMT+5:30</span>
              </div>

              <div className="grid md:grid-cols-12 gap-6 items-center">
                {heroArticle.featured_image_url && (
                  <div className="md:col-span-5 relative h-48 md:h-64 w-full rounded-lg overflow-hidden bg-neutral-800">
                    <Image
                      src={heroArticle.featured_image_url}
                      alt={heroArticle.title}
                      fill
                      priority
                      sizes="(max-width: 768px) 100vw, 40vw"
                      className="object-cover"
                    />
                  </div>
                )}
                <div className={heroArticle.featured_image_url ? 'md:col-span-7' : 'md:col-span-12'}>
                  <div className="flex gap-2 text-[11px] font-mono uppercase text-neutral-400 mb-2">
                    <span className="text-neutral-200 font-bold">{heroArticle.category}</span>
                    <span>&bull;</span>
                    <span>{heroArticle.district || 'J&K Desk'}</span>
                  </div>
                  <Link href={`${langPrefix}/${heroArticle.category.toLowerCase()}/${heroArticle.slug}`}>
                    <h1 className="text-2xl md:text-3xl font-black text-white hover:text-red-400 transition leading-tight mb-3">
                      {heroArticle.title}
                    </h1>
                  </Link>
                  <p className="text-sm text-neutral-300 line-clamp-3 leading-relaxed">
                    {heroArticle.excerpt}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Chronological Wire Dispatches Feed */}
          <div className="border border-neutral-800 bg-neutral-950 rounded-xl overflow-hidden">
            <div className="bg-neutral-900/80 px-4 py-3 border-b border-neutral-800 flex items-center justify-between text-xs font-mono font-bold text-neutral-300 uppercase">
              <span>Chronological Wire Feed</span>
              <span className="text-neutral-500">{recentArticles.length} recent dispatches</span>
            </div>

            <div className="divide-y divide-neutral-800">
              {recentArticles.map((article) => (
                <div key={article.id} className="p-4 hover:bg-neutral-900 transition flex flex-col sm:flex-row gap-4 items-start">
                  <div className="font-mono text-xs text-red-400 font-bold shrink-0 pt-0.5">
                    {new Date(article.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="flex-grow">
                    <div className="flex items-center gap-2 text-[10px] font-mono uppercase text-neutral-400 mb-1">
                      <span className="text-neutral-300 font-bold">{article.category}</span>
                      <span>/</span>
                      <span>{article.district || 'Statewide'}</span>
                    </div>
                    <Link
                      href={`${langPrefix}/${article.category.toLowerCase()}/${article.slug}`}
                      className="text-base font-bold text-neutral-100 hover:text-red-400 transition block"
                    >
                      {article.title}
                    </Link>
                    <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
                      {article.excerpt}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Trending Ticker + Wire Alerts */}
        <div className="lg:col-span-4 space-y-6">
          <div className="border border-neutral-800 bg-neutral-950 p-5 rounded-xl">
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-red-500 mb-4 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-ping"></span>
              High-Traffic Wire
            </h3>

            <div className="space-y-4">
              {trendingArticles.map((article, i) => (
                <div key={article.id} className="border-b border-neutral-800/80 pb-3 last:border-0 last:pb-0">
                  <span className="text-[10px] font-mono text-neutral-500 uppercase">#WIRE_RANK_{i + 1}</span>
                  <Link
                    href={`${langPrefix}/${article.category.toLowerCase()}/${article.slug}`}
                    className="text-sm font-bold text-neutral-200 hover:text-red-400 transition block leading-snug mt-1"
                  >
                    {article.title}
                  </Link>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-neutral-800 bg-neutral-950 p-5 rounded-xl">
            <div className="text-xs font-mono font-bold uppercase text-red-400 mb-2">Instant Dispatch</div>
            <h4 className="text-base font-bold text-white mb-2">Subscribe to J&K Wire Alert</h4>
            <p className="text-xs text-neutral-400 mb-4">
              Direct email delivery for urgent regulatory, infrastructure, and political updates.
            </p>
            <NewsletterForm />
          </div>
        </div>
      </div>
    </div>
  );
}
