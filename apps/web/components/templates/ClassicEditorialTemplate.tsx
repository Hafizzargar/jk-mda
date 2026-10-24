import Link from 'next/link';
import Image from 'next/image';
import { NewsletterForm } from '@/components/NewsletterForm';
import { SiteNavbar } from '@/components/navigation/SiteNavbar';
import { SiteFooter } from '@/components/navigation/SiteFooter';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { PaginationControls } from '@/components/navigation/PaginationControls';
import { LeaderboardAd } from '@/components/ads/LeaderboardAd';
import { SidebarAd } from '@/components/ads/SidebarAd';
import { TemplateProps } from './types';

export function ClassicEditorialTemplate({
  langPrefix,
  heroArticle,
  recentArticles,
  trendingArticles,
  theme,
  contactSettings,
  paginationMeta,
  adsSettings,
  navbarSettings,
}: TemplateProps) {
  const lang = langPrefix ? langPrefix.replace('/', '') : 'en';
  const leaderboardAd = adsSettings?.monetization_enabled
    ? adsSettings.placements.find((p) => p.id === 'leaderboard_top' && p.enabled)
    : null;
  const sidebarAd = adsSettings?.monetization_enabled
    ? adsSettings.placements.find((p) => p.id === 'sidebar_banner' && p.enabled)
    : null;

  return (
    <div className="min-h-screen bg-[#faf8f5] text-slate-900 font-serif flex flex-col justify-between">
      <div>
        {/* Sleek, Compact Modern Broadsheet Navbar */}
        <SiteNavbar lang={lang} theme={theme} navbarSettings={navbarSettings} />

        {/* Unified Breadcrumbs on All Pages */}
        <div className="max-w-7xl mx-auto px-4 md:px-8 pt-4 pb-2">
          <Breadcrumbs items={[{ label: 'Verified News Wire', current: true }]} lang={lang} theme={theme} />
        </div>

      {/* Main 3-Column Broadsheet Grid */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left / Center Column: Lead Editorial Story + Grid */}
        <div className="lg:col-span-8 space-y-10">
          {heroArticle && (
            <section className="border-b-2 border-slate-300 pb-8">
              <Link href={`${langPrefix}/${heroArticle.category.toLowerCase()}/${heroArticle.slug}`} className="group block">
                <div className="flex items-center gap-2 text-xs font-sans font-bold uppercase tracking-widest text-slate-600 mb-2">
                  <span className="text-red-700 font-extrabold">{heroArticle.category}</span>
                  {heroArticle.district && (
                    <>
                      <span>&bull;</span>
                      <span className="text-slate-800 font-medium">{heroArticle.district}</span>
                    </>
                  )}
                  <span>&bull;</span>
                  <span>{new Date(heroArticle.published_at).toLocaleDateString()}</span>
                </div>

                <h1 className="text-3xl md:text-5xl font-black leading-tight tracking-tight text-slate-950 group-hover:text-blue-900 transition mb-4">
                  {heroArticle.title}
                </h1>

                {heroArticle.featured_image_url && (
                  <div className="relative w-full h-[320px] md:h-[420px] mb-4 overflow-hidden border border-slate-300 bg-slate-200">
                    <Image
                      src={heroArticle.featured_image_url}
                      alt={heroArticle.title}
                      fill
                      priority
                      sizes="(max-width: 1024px) 100vw, 66vw"
                      className="object-cover"
                    />
                  </div>
                )}

                {heroArticle.excerpt && (
                  <p className="text-lg text-slate-700 leading-relaxed font-serif first-letter:text-5xl first-letter:font-bold first-letter:mr-2 first-letter:float-left first-letter:text-slate-950">
                    {heroArticle.excerpt}
                  </p>
                )}

                <div className="mt-4 pt-2 border-t border-slate-200 text-xs font-sans text-slate-500 uppercase tracking-wider">
                  Dispatch by {heroArticle.author_display_name || 'Staff Correspondent'}
                </div>
              </Link>
            </section>
          )}

          {/* Secondary Stories Grid */}
          <section>
            <h2 className="text-sm font-sans font-bold uppercase tracking-widest text-slate-900 border-b border-slate-900 pb-1 mb-6">
              Regional Dispatches & Analysis
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {recentArticles.map((article) => (
                <article key={article.id} className="border-b border-slate-200 pb-6 flex flex-col justify-between">
                  <Link href={`${langPrefix}/${article.category.toLowerCase()}/${article.slug}`} className="group block">
                    {article.featured_image_url && (
                      <div className="relative w-full h-44 mb-3 border border-slate-200 overflow-hidden bg-slate-100">
                        <Image
                          src={article.featured_image_url}
                          alt={article.title}
                          fill
                          sizes="(max-width: 768px) 100vw, 33vw"
                          className="object-cover group-hover:opacity-95 transition"
                        />
                      </div>
                    )}
                    <div className="text-[11px] font-sans font-bold uppercase tracking-wider text-slate-500 mb-1">
                      <span className="text-blue-900 font-bold">{article.category}</span>
                      {article.district ? ` · ${article.district}` : ''}
                    </div>
                    <h3 className="text-xl font-bold leading-snug text-slate-950 group-hover:text-blue-900 transition mb-2">
                      {article.title}
                    </h3>
                    <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed mb-3">
                      {article.excerpt}
                    </p>
                    <div className="text-xs font-sans text-slate-400">
                      By {article.author_display_name || 'KJIN Bureau'}
                    </div>
                  </Link>
                </article>
              ))}
            </div>

            {/* Real Database Pagination Controls */}
            {paginationMeta && (
              <div className="mt-8">
                <PaginationControls meta={paginationMeta} theme={theme} />
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Trending Broadsheet Ledger + Newsletter */}
        <aside className="lg:col-span-4 space-y-10 border-t lg:border-t-0 lg:border-l border-slate-300 lg:pl-8">
          <section>
            <h2 className="text-sm font-sans font-bold uppercase tracking-widest text-slate-900 border-b-2 border-slate-900 pb-2 mb-6 flex items-center justify-between">
              <span>The Ledger</span>
              <span className="text-xs font-normal text-slate-500">Most Read</span>
            </h2>

            <ol className="divide-y divide-slate-200">
              {trendingArticles.map((article, idx) => (
                <li key={article.id} className="py-4 first:pt-0">
                  <Link href={`${langPrefix}/${article.category.toLowerCase()}/${article.slug}`} className="group flex gap-4 items-baseline">
                    <span className="text-2xl font-sans font-bold text-slate-400 group-hover:text-slate-900 transition">
                      {idx + 1}.
                    </span>
                    <div>
                      <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-slate-500">
                        {article.category}
                      </span>
                      <h4 className="text-base font-bold leading-snug text-slate-950 group-hover:text-blue-900 transition">
                        {article.title}
                      </h4>
                      {article.view_count ? (
                        <p className="text-[11px] font-sans text-slate-400 mt-1">
                          {article.view_count.toLocaleString()} readers
                        </p>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          {/* Right Rail Sticky Custom Sponsor Ad */}
          {sidebarAd ? (
            <section className="sticky top-20 z-10">
              <SidebarAd ad={sidebarAd} />
            </section>
          ) : leaderboardAd ? (
            <section className="sticky top-20 z-10">
              <SidebarAd ad={leaderboardAd} />
            </section>
          ) : null}

          <section className="bg-[#f2efe9] border border-slate-300 p-6 rounded-none font-sans">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-700 mb-1">KJIN Broadsheet Edition</div>
            <h3 className="text-xl font-bold font-serif text-slate-900 mb-2">Morning Intelligence Brief</h3>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed font-serif">
              Delivered daily to public servants, civil engineers, and citizens across Jammu and Kashmir.
            </p>
            <NewsletterForm />
          </section>
        </aside>
      </div>
      </div>

      {/* Public Footer Controlled via Admin Portal */}
      <SiteFooter lang={lang} theme={theme} contactSettings={contactSettings} />
    </div>
  );
}

