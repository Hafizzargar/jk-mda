import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Metadata } from 'next';
import { createServerAnonClient } from '@/lib/supabase-server';
import { isValidDistrict, getDistrictDisplayName, JK_DISTRICTS, getCategorySlug } from '@/lib/taxonomy';
import { getCleanSlug } from '@/lib/slug-aliases';
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
import { getDistrictDossier } from '@/lib/district-dossiers';

interface DistrictPageProps {
  params: Promise<{
    lang: string;
    name: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params, searchParams }: DistrictPageProps): Promise<Metadata> {
  const { lang, name } = await params;
  const resolvedSearchParams = await searchParams;
  const districtSlug = name.toLowerCase().trim();
  const supabase = createServerAnonClient();
  const brandSettings = await getBrandSettings(supabase);

  if (!isValidDistrict(districtSlug)) {
    return {
      title: `District Not Found | ${brandSettings.name}`,
      robots: { index: false, follow: false },
    };
  }

  const districtName = getDistrictDisplayName(districtSlug);
  const districtInfo = JK_DISTRICTS[districtSlug];
  const dossier = getDistrictDossier(districtSlug);
  const page = parsePageParam(resolvedSearchParams.page);
  const pageSuffix = page > 1 ? ` - Page ${page}` : '';
  const canonicalUrl = `${SITE_URL}/en/district/${districtSlug}${page > 1 ? `?page=${page}` : ''}`;

  return {
    metadataBase: new URL(SITE_URL),
    title: `${districtName} News: Ground Reporting & Civic Updates${pageSuffix} | ${brandSettings.name}`,
    description: `${dossier.intro.slice(0, 155)} Verified local reporting from ${districtName}, ${districtInfo?.region || 'J&K'}.`,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: `${districtName} News & Ground Dispatches | ${brandSettings.name}`,
      description: dossier.intro,
      url: canonicalUrl,
      type: 'website',
    },
  };
}

export default async function DistrictPage({ params, searchParams }: DistrictPageProps) {
  const { lang, name } = await params;
  const resolvedSearchParams = await searchParams;
  const districtSlug = name.toLowerCase().trim();
  const langPrefix = '/en';

  // 1. Strict district validation against controlled J&K taxonomy
  if (!isValidDistrict(districtSlug)) {
    notFound();
  }

  const districtName = getDistrictDisplayName(districtSlug);
  const districtInfo = JK_DISTRICTS[districtSlug];
  const dossier = getDistrictDossier(districtSlug);

  // 2. Safe pagination parsing
  const page = parsePageParam(resolvedSearchParams.page);
  const limit = parseLimitParam(resolvedSearchParams.limit, 6);
  const { from, to } = getPaginationRange(page, limit);

  const supabase = createServerAnonClient();

  // 3. Query articles for this district or town hub
  let query = supabase
    .from('articles')
    .select('id, slug, title, excerpt, category, district, author_display_name, published_at, featured_image_url, article_translations(title, excerpt, language_code)', { count: 'exact' })
    .eq('status', 'published');

  if (districtSlug === 'bhaderwah') {
    query = query.or('district.ilike.bhaderwah,district.ilike.doda,title.ilike.%bhaderwah%');
  } else if (districtSlug === 'doda') {
    query = query.or('district.ilike.doda,district.ilike.bhaderwah,title.ilike.%doda%');
  } else if (districtSlug === 'kishtwar') {
    query = query.or('district.ilike.kishtwar,title.ilike.%kishtwar%');
  } else {
    query = query.or(`district.ilike.${districtSlug},title.ilike.%${districtSlug}%`);
  }

  const { data: articlesRaw, count } = await query
    .order('published_at', { ascending: false, nullsFirst: false })
    .range(from, to);

  const articles = applyTranslations(articlesRaw || [], lang);
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
    { label: 'Districts', href: `${langPrefix}/` },
    ...(districtInfo?.region
      ? [{ label: districtInfo.region, href: `${langPrefix}/region/${districtInfo.region.toLowerCase()}` }]
      : []),
    { label: districtName, current: true },
  ];

  return (
    <main className={`min-h-screen ${theme.pageBgClass} ${theme.textPrimaryClass} ${theme.fontFamilyClass} ${theme.selectionClass} flex flex-col justify-between`}>
      <div>
        <SiteNavbar
          lang={lang}
          theme={theme}
          activeDistrict={districtSlug}
          navbarSettings={navbarSettings}
        />

        <div className="max-w-7xl mx-auto px-4 md:px-8 pt-4 pb-2">
          <Breadcrumbs items={breadcrumbs} lang={lang} theme={theme} />
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
          {/* District Dossier Header Card */}
          <div className="bg-white border border-stone-200/90 rounded-2xl p-6 md:p-8 shadow-xs mb-8 font-sans">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-600 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-800">
                  {districtInfo?.region} Division • Official Territorial Bureau
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-200">
                {dossier.specialStatus}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-stone-900 tracking-tight font-serif mb-2">
              {districtName} News &amp; Ground Dispatches
            </h1>
            <p className="text-stone-700 text-sm md:text-base leading-relaxed mb-6 max-w-4xl">
              {dossier.intro}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-stone-100 text-xs">
              <div className="border-l-2 border-cyan-600 pl-3">
                <span className="block font-bold text-stone-900 uppercase text-[10px]">Administrative HQ</span>
                <span className="text-stone-600">{dossier.headquarters}</span>
              </div>
              <div className="border-l-2 border-emerald-600 pl-3">
                <span className="block font-bold text-stone-900 uppercase text-[10px]">Key Transport Corridors</span>
                <span className="text-stone-600">{dossier.keyArteries}</span>
              </div>
              <div className="border-l-2 border-amber-600 pl-3">
                <span className="block font-bold text-stone-900 uppercase text-[10px]">Primary Regional Economy</span>
                <span className="text-stone-600">{dossier.primaryEconomy}</span>
              </div>
            </div>
          </div>

        {articles && articles.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  href={`${langPrefix}/${getCategorySlug(article.category)}/${getCleanSlug(article.slug)}`}
                  className={`group flex flex-col h-full ${theme.cardBgClass} rounded-xl ${theme.cardBorderClass} ${theme.cardHoverClass} p-5 transition`}
                >
                  {article.featured_image_url ? (
                    <div className={`relative w-full h-52 mb-4 overflow-hidden rounded-lg ${theme.subtleBgClass} bg-slate-100 dark:bg-slate-800/80`}>
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
                    <div className={`w-full h-2 ${theme.accentBgClass} opacity-60 group-hover:opacity-100 transition mb-4 rounded-full`} />
                  )}
                  <div className="flex justify-between items-center mb-2">
                    <div className={`text-xs font-bold uppercase tracking-widest ${theme.accentTextClass}`}>
                      {article.category}
                    </div>
                    <div className={`text-xs font-medium ${theme.textMutedClass}`} suppressHydrationWarning>
                      {formatArticleDate(article.published_at)}
                    </div>
                  </div>
                  <h3 className={`text-xl font-bold leading-snug ${theme.textPrimaryClass} group-hover:opacity-80 transition mb-3`}>
                    {article.title}
                  </h3>
                  {article.excerpt && (
                    <p className={`${theme.textSecondaryClass} line-clamp-3 mb-4 flex-grow text-sm`}>
                      {article.excerpt}
                    </p>
                  )}
                  <div className={`mt-auto text-xs font-medium ${theme.textMutedClass} pt-2 border-t ${theme.borderMutedClass}`}>
                    By {article.author_display_name || `${brandSettings.name} Desk`}
                  </div>
                </Link>
              ))}
            </div>

            {/* Full Featured Numbered Pagination Controls */}
            <PaginationControls meta={paginationMeta} theme={theme} showPageSizeSelector={true} />
          </>
        ) : (
          <div className={`py-20 text-center ${theme.textMutedClass} text-lg ${theme.cardBgClass} rounded-xl border ${theme.cardBorderClass}`}>
            No published articles found for {districtName} district.
          </div>
        )}
      </div>
    </div>

    <SiteFooter lang={lang} theme={theme} contactSettings={contactSettings} brandSettings={brandSettings} />
  </main>
);
}
