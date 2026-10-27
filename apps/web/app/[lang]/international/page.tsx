import Link from 'next/link';
import Image from 'next/image';
import { Metadata } from 'next';
import { createServerAnonClient } from '@/lib/supabase-server';
import { parsePageParam, parseLimitParam, getPaginationRange, calculatePaginationMeta } from '@/lib/pagination';
import { SITE_URL, SITE_SHORT_NAME } from '@/lib/config';
import { applyTranslations } from '@/lib/i18n';
import { getTemplateTheme, type TemplateId } from '@/lib/templates';
import { getBrandSettings } from '@/lib/brand';
import { SiteNavbar } from '@/components/navigation/SiteNavbar';
import { SiteFooter } from '@/components/navigation/SiteFooter';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { PaginationControls } from '@/components/navigation/PaginationControls';
import { getFooterContactSettings } from '@/lib/contact';
import { getCustomAdsSettings } from '@/lib/ads';
import { LeaderboardAd } from '@/components/ads/LeaderboardAd';

interface InternationalPageProps {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params, searchParams }: InternationalPageProps): Promise<Metadata> {
  const { lang } = await params;
  const resolvedSearchParams = await searchParams;
  const page = parsePageParam(resolvedSearchParams.page);
  const pageSuffix = page > 1 ? ` - Page ${page}` : '';
  const langPrefix = lang === 'en' ? '' : `/${lang}`;
  const canonicalUrl = `${SITE_URL}${langPrefix}/international${page > 1 ? `?page=${page}` : ''}`;
  const supabase = createServerAnonClient();
  const brandSettings = await getBrandSettings(supabase);

  return {
    title: `International News${pageSuffix} | ${brandSettings.name}`,
    description: `Global news, multilateral diplomacy, international law, humanitarian affairs, and foreign dispatches from ${brandSettings.name}.`,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: `International News | ${brandSettings.name}`,
      description: 'Verified reporting and dispatches on global affairs, foreign diplomacy, and international organizations.',
      url: canonicalUrl,
      type: 'website',
    },
  };
}

export default async function InternationalDeskPage({ params, searchParams }: InternationalPageProps) {
  const { lang } = await params;
  const resolvedSearchParams = await searchParams;
  const langPrefix = lang === 'en' ? '' : `/${lang}`;
  const page = parsePageParam(resolvedSearchParams.page);
  const limit = parseLimitParam(resolvedSearchParams.limit, 6);
  const { from, to } = getPaginationRange(page, limit);

  const supabase = createServerAnonClient();

  // Query strictly foreign and international affairs (category = 'International')
  const { data: articlesRaw, count } = await supabase
    .from('articles')
    .select(
      'id, slug, title, excerpt, category, author_display_name, published_at, featured_image_url, article_translations(title, excerpt, language_code)',
      { count: 'exact' }
    )
    .eq('status', 'published')
    .ilike('category', 'International')
    .order('published_at', { ascending: false, nullsFirst: false })
    .range(from, to);

  const articles = applyTranslations(articlesRaw || [], lang);
  const totalArticles = count ?? 0;
  const paginationMeta = calculatePaginationMeta(totalArticles, page, limit);

  // Active Template Theme & Contact Settings
  const { data: settingRow } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'active_template')
    .maybeSingle();

  const dbTemplateId = (settingRow?.value as { template_id?: string } | null)?.template_id as TemplateId | undefined;
  const theme = getTemplateTheme(dbTemplateId);
  const brandSettings = await getBrandSettings(supabase);
  const contactSettings = await getFooterContactSettings(supabase);
  const adsSettings = await getCustomAdsSettings(supabase);

  const leaderboardAd = adsSettings.placements.find(
    (p) => p.id === 'leaderboard_top' && p.enabled
  );

  const breadcrumbs = [
    { label: 'Home', href: `${langPrefix}/` },
    { label: 'International', current: true },
  ];

  return (
    <main className={`min-h-screen ${theme.pageBgClass} ${theme.textPrimaryClass} ${theme.fontFamilyClass} ${theme.selectionClass} flex flex-col justify-between`}>
      <div>
        <SiteNavbar
          lang={lang}
          theme={theme}
          activeCategory="international"
        />

        <div className="max-w-7xl mx-auto px-4 md:px-8 pt-4 pb-2">
          <Breadcrumbs items={breadcrumbs} lang={lang} theme={theme} />
        </div>

        {/* Optional Leaderboard Ad Header */}
        {leaderboardAd && (
          <div className="max-w-7xl mx-auto px-4 md:px-8 pt-2 pb-4">
            <LeaderboardAd ad={leaderboardAd} />
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
          {/* Section Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase ${theme.accentBgClass}`}>
                Global Wire &bull; World
              </span>
              <span className="text-xs font-mono text-slate-400">Foreign &amp; Multilateral Affairs</span>
            </div>
            <div className={`border-b-4 ${theme.accentBorderClass} inline-block pb-2`}>
              <h1 className={`text-4xl md:text-5xl font-extrabold tracking-tight ${theme.textPrimaryClass}`}>
                International
              </h1>
            </div>
            <p className={`${theme.textSecondaryClass} mt-3 text-lg max-w-3xl leading-relaxed`}>
              Independent reporting on foreign countries, global geopolitical developments, multilateral treaties, international courts, and humanitarian affairs.
            </p>
          </div>

          {articles && articles.length > 0 ? (
            <>
              {/* Lead Story on First Page */}
              {page === 1 && articles.length > 0 && (
                <div className="mb-10">
                  <Link
                    href={`${langPrefix}/international/${articles[0].slug}`}
                    className={`group grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 rounded-2xl ${theme.cardBgClass} ${theme.cardBorderClass} ${theme.cardHoverClass} border transition-all duration-300 shadow-sm`}
                  >
                    <div className="lg:col-span-7 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-700 text-white">
                            Lead Global Dispatch
                          </span>
                          <span className={`text-xs font-medium ${theme.textMutedClass}`}>
                            {new Date(articles[0].published_at).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        <h2 className={`text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight ${theme.textPrimaryClass} group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors mb-4`}>
                          {articles[0].title}
                        </h2>
                        {articles[0].excerpt && (
                          <p className={`${theme.textSecondaryClass} text-base sm:text-lg leading-relaxed line-clamp-3 mb-6`}>
                            {articles[0].excerpt}
                          </p>
                        )}
                      </div>
                      <div className={`pt-4 border-t ${theme.borderMutedClass} flex items-center justify-between text-xs font-medium ${theme.textMutedClass}`}>
                        <span>By {articles[0].author_display_name || `${brandSettings.name} Global Desk`}</span>
                        <span className="font-semibold text-blue-600 dark:text-cyan-400 group-hover:underline flex items-center gap-1">
                          Read Full Report &rarr;
                        </span>
                      </div>
                    </div>

                    <div className="lg:col-span-5 relative min-h-[260px] rounded-xl overflow-hidden bg-slate-900">
                      {articles[0].featured_image_url ? (
                        <Image
                          src={articles[0].featured_image_url}
                          alt={articles[0].title}
                          fill
                          priority
                          sizes="(max-width: 1024px) 100vw, 45vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-slate-800 to-slate-950">
                          <span className="text-4xl mb-2">🌐</span>
                          <span className="text-xs font-mono uppercase tracking-widest text-slate-400 font-bold">
                            {brandSettings.name} International Desk
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>
                </div>
              )}

              {/* Grid of Remaining or All Stories */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {(page === 1 ? articles.slice(1) : articles).map((article) => (
                  <Link
                    key={article.id}
                    href={`${langPrefix}/international/${article.slug}`}
                    className={`group flex flex-col h-full ${theme.cardBgClass} rounded-xl ${theme.cardBorderClass} ${theme.cardHoverClass} border p-5 transition`}
                  >
                    {article.featured_image_url ? (
                      <div className={`relative w-full h-48 mb-4 overflow-hidden rounded-lg ${theme.subtleBgClass} bg-slate-100 dark:bg-slate-800/80`}>
                        <Image
                          src={article.featured_image_url}
                          alt={article.title}
                          fill
                          loading="lazy"
                          decoding="async"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                    ) : (
                      <div className={`w-full h-1.5 ${theme.accentBgClass} opacity-60 group-hover:opacity-100 transition mb-4 rounded-full`} />
                    )}

                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${theme.accentTextClass}`}>
                        International
                      </span>
                      <span className={`text-[11px] font-medium ${theme.textMutedClass}`}>
                        {new Date(article.published_at).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className={`text-lg font-bold leading-snug ${theme.textPrimaryClass} group-hover:opacity-80 transition mb-3`}>
                      {article.title}
                    </h3>

                    {article.excerpt && (
                      <p className={`${theme.textSecondaryClass} line-clamp-3 mb-4 flex-grow text-sm leading-relaxed`}>
                        {article.excerpt}
                      </p>
                    )}

                    <div className={`mt-auto text-xs font-medium ${theme.textMutedClass} pt-3 border-t ${theme.borderMutedClass} flex items-center justify-between`}>
                      <span>By {article.author_display_name || `${brandSettings.name} Global Desk`}</span>
                      <span className="text-[11px] font-semibold text-blue-600 dark:text-cyan-400 group-hover:underline">
                        Read &rarr;
                      </span>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Full Featured Numbered Pagination Controls */}
              <PaginationControls meta={paginationMeta} theme={theme} showPageSizeSelector={true} />
            </>
          ) : (
            <div className={`py-20 text-center ${theme.textMutedClass} text-lg ${theme.cardBgClass} rounded-xl border ${theme.cardBorderClass}`}>
              No international articles published yet.
            </div>
          )}
        </div>
      </div>

      <SiteFooter lang={lang} theme={theme} contactSettings={contactSettings} brandSettings={brandSettings} />
    </main>
  );
}
