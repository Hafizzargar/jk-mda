import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Metadata } from 'next';
import { createServerAnonClient } from '@/lib/supabase-server';
import { isValidDistrict, getDistrictDisplayName, JK_DISTRICTS } from '@/lib/taxonomy';
import { parsePageParam, getPaginationRange } from '@/lib/pagination';
import { applyTranslations } from '@/lib/i18n';
import { SITE_URL, SITE_SHORT_NAME } from '@/lib/config';
import { getTemplateTheme, type TemplateId } from '@/lib/templates';
import { SiteNavbar } from '@/components/navigation/SiteNavbar';
import { SiteFooter } from '@/components/navigation/SiteFooter';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { getFooterContactSettings } from '@/lib/contact';

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

  if (!isValidDistrict(districtSlug)) {
    return {
      title: 'District Not Found | KJIN',
      robots: { index: false, follow: false },
    };
  }

  const districtName = getDistrictDisplayName(districtSlug);
  const districtInfo = JK_DISTRICTS[districtSlug];
  const page = parsePageParam(resolvedSearchParams.page);
  const pageSuffix = page > 1 ? ` - Page ${page}` : '';
  const langPrefix = lang === 'en' ? '' : `/${lang}`;
  const canonicalUrl = `${SITE_URL}${langPrefix}/district/${districtSlug}${page > 1 ? `?page=${page}` : ''}`;

  return {
    metadataBase: new URL(SITE_URL),
    title: `${districtName} District News${pageSuffix} | ${SITE_SHORT_NAME}`,
    description: `Latest ground reporting, public affairs, and verified news from ${districtName} district (${districtInfo?.region || 'J&K'}).`,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: `${districtName} District News | ${SITE_SHORT_NAME}`,
      description: `Reporting from ${districtName} district, ${districtInfo?.region || 'Jammu & Kashmir'}.`,
      url: canonicalUrl,
      type: 'website',
    },
  };
}

export default async function DistrictPage({ params, searchParams }: DistrictPageProps) {
  const { lang, name } = await params;
  const resolvedSearchParams = await searchParams;
  const districtSlug = name.toLowerCase().trim();
  const langPrefix = lang === 'en' ? '' : `/${lang}`;

  // 1. Strict district validation against controlled J&K taxonomy
  if (!isValidDistrict(districtSlug)) {
    notFound();
  }

  const districtName = getDistrictDisplayName(districtSlug);
  const districtInfo = JK_DISTRICTS[districtSlug];

  // 2. Safe pagination parsing
  const page = parsePageParam(resolvedSearchParams.page);
  const { from, to, limit } = getPaginationRange(page, 12);

  const supabase = createServerAnonClient();

  // 3. Query articles for this district
  const { data: articlesRaw, count } = await supabase
    .from('articles')
    .select('id, slug, title, excerpt, category, district, author_display_name, published_at, featured_image_url, article_translations(title, excerpt, language_code)', { count: 'exact' })
    .eq('status', 'published')
    .ilike('district', districtSlug)
    .order('published_at', { ascending: false, nullsFirst: false })
    .range(from, to);

  const articles = applyTranslations(articlesRaw || [], lang);
  const totalArticles = count ?? 0;
  const hasNextPage = from + limit < totalArticles;

  // Fetch Active Template Setting to align theme & background colors
  const { data: settingRow } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'active_template')
    .maybeSingle();

  const dbTemplateId = (settingRow?.value as { template_id?: string } | null)?.template_id as TemplateId | undefined;
  const theme = getTemplateTheme(dbTemplateId);
  const contactSettings = await getFooterContactSettings(supabase);

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
        />

        <div className="max-w-7xl mx-auto px-4 md:px-8 pt-4 pb-2">
          <Breadcrumbs items={breadcrumbs} lang={lang} theme={theme} />
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        <div className={`mb-4 border-b-4 ${theme.accentBorderClass} inline-block pb-2`}>
          <h1 className={`text-4xl md:text-5xl font-extrabold tracking-tight ${theme.textPrimaryClass}`}>
            {districtName}
          </h1>
        </div>
        <p className={`${theme.textSecondaryClass} mb-10 text-lg`}>
          Dispatches and grassroots reporting from {districtName} district, {districtInfo?.region} division.
        </p>

        {articles && articles.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  href={`${langPrefix}/${article.category.toLowerCase()}/${article.slug}`}
                  className={`group flex flex-col h-full ${theme.cardBgClass} rounded-xl ${theme.cardBorderClass} ${theme.cardHoverClass} p-5 transition`}
                >
                  {article.featured_image_url ? (
                    <div className={`relative w-full h-52 mb-4 overflow-hidden rounded-lg ${theme.subtleBgClass}`}>
                      <Image
                        src={article.featured_image_url}
                        alt={article.title}
                        fill
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
                    <div className={`text-xs font-medium ${theme.textMutedClass}`}>
                      {new Date(article.published_at).toLocaleDateString()}
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
                    By {article.author_display_name || 'KJIN Desk'}
                  </div>
                </Link>
              ))}
            </div>

            <div className={`mt-16 flex justify-between items-center border-t ${theme.borderClass} pt-8`}>
              {page > 1 ? (
                <Link
                  href={`${langPrefix}/district/${districtSlug}${page - 1 > 1 ? `?page=${page - 1}` : ''}`}
                  className={`px-6 py-3 rounded-lg border ${theme.borderClass} ${theme.cardBgClass} ${theme.textPrimaryClass} font-semibold hover:opacity-80 transition text-sm`}
                >
                  &larr; Previous Page
                </Link>
              ) : (
                <div />
              )}

              <span className={`text-sm font-medium ${theme.textMutedClass}`}>
                Page {page} {totalArticles > 0 ? `of ${Math.ceil(totalArticles / limit)}` : ''}
              </span>

              {hasNextPage ? (
                <Link
                  href={`${langPrefix}/district/${districtSlug}?page=${page + 1}`}
                  className={`px-6 py-3 rounded-lg border ${theme.borderClass} ${theme.cardBgClass} ${theme.textPrimaryClass} font-semibold hover:opacity-80 transition text-sm`}
                >
                  Next Page &rarr;
                </Link>
              ) : (
                <div />
              )}
            </div>
          </>
        ) : (
          <div className={`py-20 text-center ${theme.textMutedClass} text-lg ${theme.cardBgClass} rounded-xl border ${theme.cardBorderClass}`}>
            No published articles found for {districtName} district.
          </div>
        )}
      </div>
    </div>

    <SiteFooter lang={lang} theme={theme} contactSettings={contactSettings} />
  </main>
);
}
