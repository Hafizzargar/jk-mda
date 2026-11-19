import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Metadata } from 'next';
import { createServerAnonClient } from '@/lib/supabase-server';
import { isValidCategory, getCategoryDisplayName, NEWS_CATEGORIES, getCategorySlug } from '@/lib/taxonomy';
import { parsePageParam, parseLimitParam, getPaginationRange, calculatePaginationMeta } from '@/lib/pagination';
import { applyTranslations } from '@/lib/i18n';
import { SITE_URL, SITE_SHORT_NAME } from '@/lib/config';
import { getTemplateTheme, type TemplateId } from '@/lib/templates';
import { getBrandSettings } from '@/lib/brand';
import { getNavbarSettings } from '@/lib/navbar';
import { SiteNavbar } from '@/components/navigation/SiteNavbar';
import { SiteFooter } from '@/components/navigation/SiteFooter';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { PaginationControls } from '@/components/navigation/PaginationControls';
import { getFooterContactSettings } from '@/lib/contact';
import { formatArticleDate } from '@/lib/date';

interface CategoryPageProps {
  params: Promise<{
    lang: string;
    name: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params, searchParams }: CategoryPageProps): Promise<Metadata> {
  const { lang, name } = await params;
  const resolvedSearchParams = await searchParams;
  const categorySlug = name.toLowerCase().trim();
  const supabase = createServerAnonClient();
  const brandSettings = await getBrandSettings(supabase);

  let categoryName = getCategoryDisplayName(categorySlug);
  let categoryInfo = NEWS_CATEGORIES[categorySlug];

  if (!categoryInfo) {
    const { data: dbCat } = await supabase
      .from('categories')
      .select('name_en, description, is_active')
      .eq('slug', categorySlug)
      .maybeSingle();

    if (dbCat && dbCat.is_active) {
      categoryName = dbCat.name_en;
      categoryInfo = {
        name: dbCat.name_en,
        description: dbCat.description || `${dbCat.name_en} news and dispatches across Jammu and Kashmir.`,
      };
    } else {
      return {
        title: `Category Not Found | ${brandSettings.name}`,
        robots: { index: false, follow: false },
      };
    }
  }

  const page = parsePageParam(resolvedSearchParams.page);
  const pageSuffix = page > 1 ? ` - Page ${page}` : '';
  const canonicalUrl = `${SITE_URL}/en/category/${categorySlug}${page > 1 ? `?page=${page}` : ''}`;

  return {
    metadataBase: new URL(SITE_URL),
    title: `${categoryName} News${pageSuffix} | ${brandSettings.name}`,
    description: categoryInfo?.description || `Latest reporting and updates in ${categoryName} from ${brandSettings.name}.`,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: `${categoryName} News | ${brandSettings.name}`,
      description: categoryInfo?.description,
      url: canonicalUrl,
      type: 'website',
    },
  };
}

function estimateReadTime(text?: string | null): string {
  if (!text) return '3 min read';
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / 180));
  return `${minutes} min read`;
}

interface ArticleRecord {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  category: string;
  district?: string | null;
  author_display_name?: string | null;
  published_at: string;
  featured_image_url?: string | null;
  view_count?: number;
  article_translations?: Array<{
    title: string;
    excerpt: string | null;
    language_code: string;
  }>;
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { lang, name } = await params;
  const resolvedSearchParams = await searchParams;
  const categorySlug = name.toLowerCase().trim();
  const langPrefix = lang === 'en' ? '' : `/${lang}`;

  // Dedicated section routing for International and National desks
  const pageQuery = resolvedSearchParams.page ? `?page=${resolvedSearchParams.page}` : '';
  if (categorySlug === 'international') {
    redirect(`${langPrefix}/international${pageQuery}`);
  }
  if (categorySlug === 'india' || categorySlug === 'national') {
    redirect(`${langPrefix}/india${pageQuery}`);
  }
  if (categorySlug === 'problem') {
    redirect(`${langPrefix}/category/problems${pageQuery}`);
  }
  if (categorySlug === 'articles') {
    redirect(`${langPrefix}/latest${pageQuery}`);
  }

  const supabase = createServerAnonClient();

  // 1. Category validation against controlled taxonomy or database
  let categoryName = getCategoryDisplayName(categorySlug);
  let categoryInfo = NEWS_CATEGORIES[categorySlug];

  if (!categoryInfo) {
    const { data: dbCat } = await supabase
      .from('categories')
      .select('name_en, description, is_active')
      .eq('slug', categorySlug)
      .maybeSingle();

    if (dbCat && dbCat.is_active) {
      categoryName = dbCat.name_en;
      categoryInfo = {
        name: dbCat.name_en,
        description: dbCat.description || `${dbCat.name_en} news and dispatches across Jammu and Kashmir.`,
      };
    } else {
      redirect(langPrefix || '/');
    }
  }

  // 2. Pagination computation
  const page = parsePageParam(resolvedSearchParams.page);
  const limit = parseLimitParam(resolvedSearchParams.limit, 9);
  const { from, to } = getPaginationRange(page, limit);

  // 3. Query articles with exact count (including district and view_count)
  const isProblemsCategory = categorySlug === 'problems' || categorySlug === 'problem';

  let query = supabase
    .from('articles')
    .select('id, slug, title, excerpt, category, district, author_display_name, published_at, featured_image_url, view_count, article_translations(title, excerpt, language_code)', { count: 'exact' })
    .eq('status', 'published');

  if (isProblemsCategory) {
    query = query.or('category.ilike.%problem%,category.ilike.%grievance%');
  } else if (categorySlug === 'local' || categorySlug === 'local-news') {
    query = query.or('category.ilike.%local%,category.ilike.local');
  } else if (categorySlug === 'national' || categorySlug === 'india') {
    query = query.or('category.ilike.national,category.ilike.%national%');
  } else {
    query = query.or(`category.ilike.${categorySlug},category.ilike.%${categorySlug}%`);
  }

  const { data: articlesRaw, count } = await query
    .order('published_at', { ascending: false, nullsFirst: false })
    .range(from, to);

  const articles = (applyTranslations(articlesRaw || [], lang) as unknown) as ArticleRecord[];
  const totalArticles = count ?? 0;
  const paginationMeta = calculatePaginationMeta(totalArticles, page, limit);

  // Fetch Active Template Setting to align theme & background colors
  const { data: settingRow } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'active_template')
    .maybeSingle();

  const dbTemplateId = (settingRow?.value as { template_id?: string } | null)?.template_id as TemplateId | undefined;
  const theme = getTemplateTheme(dbTemplateId);
  const [brandSettings, navbarSettings, contactSettings] = await Promise.all([
    getBrandSettings(supabase),
    getNavbarSettings(supabase),
    getFooterContactSettings(supabase),
  ]);

  const breadcrumbs = [
    { label: 'Home', href: `${langPrefix}/` },
    { label: 'Categories', href: `${langPrefix}/latest` },
    { label: categoryName, current: true },
  ];

  // Editorial category badge customization
  const getCategoryBadge = () => {
    switch (categorySlug) {
      case 'problems':
      case 'problem':
        return {
          label: 'Civic Grievances & Public Infrastructure Desk',
          status: 'Active Field Audits',
          icon: '🏛️',
          color: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800',
        };
      case 'investigation':
        return {
          label: 'Special Investigative Dossiers & Audits',
          status: 'In-Depth Record',
          icon: '🔍',
          color: 'bg-red-100 text-red-900 border-red-300 dark:bg-red-950/50 dark:text-red-200 dark:border-red-800',
        };
      case 'economy':
        return {
          label: 'Trade, Agriculture & Infrastructure Desk',
          status: 'Economic Intelligence',
          icon: '📈',
          color: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-800',
        };
      case 'environment':
        return {
          label: 'Himalayan Ecology, Glaciers & Climate',
          status: 'Environmental Watch',
          icon: '🏔️',
          color: 'bg-teal-100 text-teal-900 border-teal-300 dark:bg-teal-950/50 dark:text-teal-200 dark:border-teal-800',
        };
      default:
        return {
          label: 'Regional Archive & Ground Dispatches',
          status: 'Verified Wire',
          icon: '📰',
          color: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
        };
    }
  };

  const badgeInfo = getCategoryBadge();

  // On page 1 with articles: 1st article is hero spotlight, remaining are grid
  const hasHeroSpotlight = page === 1 && articles.length > 0;
  const heroArticle = hasHeroSpotlight ? articles[0] : null;
  const gridArticles = hasHeroSpotlight ? articles.slice(1) : articles;

  return (
    <main className={`min-h-screen ${theme.pageBgClass} ${theme.textPrimaryClass} ${theme.fontFamilyClass} ${theme.selectionClass} flex flex-col justify-between`}>
      <div>
        <SiteNavbar
          lang={lang}
          theme={theme}
          activeCategory={categorySlug}
          navbarSettings={navbarSettings}
        />

        {/* Top Breadcrumb Navigation */}
        <div className="max-w-7xl mx-auto px-4 md:px-8 pt-4 pb-2">
          <Breadcrumbs items={breadcrumbs} lang={lang} theme={theme} />
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-6">
          {/* 1. Masthead / Category Header Banner */}
          <div className="bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-900/80 dark:via-slate-900/50 dark:to-slate-950 p-6 sm:p-8 md:p-10 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm mb-10 transition-all">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="max-w-3xl space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase border ${badgeInfo.color}`}>
                    <span>{badgeInfo.icon}</span>
                    <span>{badgeInfo.label}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{badgeInfo.status}</span>
                  </span>
                </div>

                <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight font-serif text-slate-900 dark:text-white leading-[1.15]">
                  {categoryName}
                </h1>

                {categoryInfo && (
                  <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg leading-relaxed pt-1">
                    {categoryInfo.description}
                  </p>
                )}
              </div>

              {/* Quick Metadata Counters & Actions */}
              <div className="flex flex-row md:flex-col items-start md:items-end gap-3 pt-4 md:pt-0 border-t md:border-t-0 border-slate-200 dark:border-slate-800 shrink-0">
                <div className="text-left md:text-right">
                  <span className="block text-2xl font-bold font-mono text-slate-900 dark:text-white">
                    {totalArticles}
                  </span>
                  <span className="text-xs uppercase font-medium tracking-wider text-slate-500 dark:text-slate-400">
                    Documented Dispatches
                  </span>
                </div>

                {isProblemsCategory && (
                  <Link
                    href={`${langPrefix}/contact?subject=civic-grievance`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition"
                  >
                    <span>📢</span>
                    <span>Submit Civic Tip</span>
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* 2. Main Content Stream */}
          {articles && articles.length > 0 ? (
            <div className="space-y-10">
              {/* FEATURED LEAD INVESTIGATION SPOTLIGHT (Page 1 Top Story) */}
              {heroArticle && (
                <div className="border border-slate-200/90 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900/90 overflow-hidden shadow-sm hover:shadow-md transition">
                  <Link
                    href={`${langPrefix}/${getCategorySlug(heroArticle.category)}/${heroArticle.slug}`}
                    className="group grid grid-cols-1 lg:grid-cols-12 gap-0 items-stretch"
                  >
                    {/* Media Container (5 cols) */}
                    <div className="lg:col-span-5 relative min-h-[260px] sm:min-h-[320px] lg:min-h-full bg-slate-900 overflow-hidden">
                      {heroArticle.featured_image_url ? (
                        <Image
                          src={heroArticle.featured_image_url}
                          alt={heroArticle.title}
                          fill
                          priority
                          sizes="(max-width: 1024px) 100vw, 45vw"
                          className="object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full min-h-[260px] flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-800 via-indigo-950 to-slate-900 text-center">
                          <span className="text-4xl mb-3">📰</span>
                          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                            Verified Ground Investigation
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono mt-1">
                            {heroArticle.district || 'J&K Bureau'}
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                      {/* District Pill Badge */}
                      <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-black/75 backdrop-blur-xs text-white border border-white/20 shadow-xs">
                        <span>📍</span>
                        <span>{heroArticle.district ? `${heroArticle.district} District` : 'J&K Bureau'}</span>
                      </div>

                      {/* Lead Badge */}
                      <div className="absolute bottom-4 left-4 z-10 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-slate-950 shadow-xs">
                        Lead Feature
                      </div>
                    </div>

                    {/* Editorial Details (7 cols) */}
                    <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-between space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                          <span className="text-amber-700 dark:text-amber-400 uppercase tracking-wider font-bold">
                            {isProblemsCategory ? '🚨 Civic Emergency' : heroArticle.category}
                          </span>
                          <span>•</span>
                          <time suppressHydrationWarning>{formatArticleDate(heroArticle.published_at)}</time>
                          <span>•</span>
                          <span>{estimateReadTime(heroArticle.excerpt)}</span>
                        </div>

                        <h2 className="text-2xl sm:text-3xl font-bold font-serif text-slate-900 dark:text-white leading-tight group-hover:text-cyan-700 dark:group-hover:text-cyan-400 transition">
                          {heroArticle.title}
                        </h2>

                        {heroArticle.excerpt && (
                          <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base leading-relaxed line-clamp-4">
                            {heroArticle.excerpt}
                          </p>
                        )}
                      </div>

                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          By {heroArticle.author_display_name || `${brandSettings.name} Ground Bureau`}
                        </span>
                        <span className="inline-flex items-center gap-1 font-bold text-cyan-700 dark:text-cyan-400 group-hover:translate-x-1 transition-transform">
                          <span>Read Full Investigation</span>
                          <span>→</span>
                        </span>
                      </div>
                    </div>
                  </Link>
                </div>
              )}

              {/* SUBSEQUENT ARTICLES GRID */}
              {gridArticles.length > 0 && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Additional Dispatches &amp; Field Reports
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      {gridArticles.length} {gridArticles.length === 1 ? 'Report' : 'Reports'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                    {gridArticles.map((article) => (
                      <Link
                        key={article.id}
                        href={`${langPrefix}/${getCategorySlug(article.category)}/${article.slug}`}
                        className="group flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all"
                      >
                        {/* Thumbnail Container */}
                        <div className="relative w-full h-48 sm:h-52 mb-4 overflow-hidden rounded-xl bg-slate-900 shrink-0">
                          {article.featured_image_url ? (
                            <Image
                              src={article.featured_image_url}
                              alt={article.title}
                              fill
                              loading="lazy"
                              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                              className="object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950 text-center">
                              <span className="text-2xl mb-1.5">📑</span>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Ground Report
                              </span>
                              <span className="text-[9px] text-slate-500 font-mono">
                                {article.district || 'J&K'}
                              </span>
                            </div>
                          )}

                          {article.district && (
                            <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-black/75 backdrop-blur-xs text-white border border-white/20">
                              📍 {article.district}
                            </div>
                          )}
                        </div>

                        {/* Meta Line */}
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-2">
                          <time suppressHydrationWarning>{formatArticleDate(article.published_at)}</time>
                          <span>•</span>
                          <span>{estimateReadTime(article.excerpt)}</span>
                        </div>

                        {/* Title */}
                        <h3 className="text-base sm:text-lg font-bold font-serif leading-snug text-slate-900 dark:text-white group-hover:text-cyan-700 dark:group-hover:text-cyan-400 transition mb-2 line-clamp-2">
                          {article.title}
                        </h3>

                        {/* Excerpt */}
                        {article.excerpt && (
                          <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm line-clamp-3 mb-4 flex-grow leading-relaxed">
                            {article.excerpt}
                          </p>
                        )}

                        {/* Footer / Author */}
                        <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                          <span>By {article.author_display_name || `${brandSettings.name} Desk`}</span>
                          <span className="font-bold text-cyan-700 dark:text-cyan-400 group-hover:translate-x-0.5 transition-transform">
                            Read →
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Featured Numbered Pagination Controls */}
              <PaginationControls meta={paginationMeta} theme={theme} showPageSizeSelector={true} />
            </div>
          ) : (
            <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-xs">
              <span className="text-4xl block mb-3">📭</span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                No Dispatches Currently Filed
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto mb-6">
                Our correspondents are currently monitoring field dispatches across Jammu &amp; Kashmir for this beat.
              </p>
              <Link
                href={`${langPrefix}/latest`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#0F172A] text-white hover:bg-slate-800 transition"
              >
                <span>Browse All News Dispatches →</span>
              </Link>
            </div>
          )}

          {/* 3. Community Civic Grievance / Tip-Off Action Box */}
          <div className="mt-16 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100/60 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-slate-900 p-6 sm:p-8 rounded-2xl border border-amber-200 dark:border-amber-800/80 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <span>📢</span>
                  <span>Citizen Journalism &amp; Community Watch</span>
                </span>
                <h4 className="text-xl sm:text-2xl font-bold font-serif text-slate-900 dark:text-white">
                  Witnessed a Civic Crisis or Infrastructure Failure in Your Area?
                </h4>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  Broken bridges, water pipeline cuts, prolonged power blackouts, cellular dead zones, or neglected schools — our investigative desk verifies ground evidence submitted by residents across all 20 districts of J&amp;K.
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap shrink-0">
                <Link
                  href={`${langPrefix}/contact?subject=civic-grievance`}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-700 hover:bg-amber-800 text-white shadow-xs transition"
                >
                  Submit Ground Grievance →
                </Link>
                <Link
                  href={`${langPrefix}/transit`}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 transition"
                >
                  Pass &amp; Transit Radar →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SiteFooter lang={lang} theme={theme} contactSettings={contactSettings} brandSettings={brandSettings} />
    </main>
  );
}
