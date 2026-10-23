import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Metadata } from 'next';
import { createServerAnonClient } from '@/lib/supabase-server';
import { isValidRegion, getRegion, JK_DISTRICTS } from '@/lib/taxonomy';
import { parsePageParam, getPaginationRange } from '@/lib/pagination';
import { applyTranslations } from '@/lib/i18n';
import { SITE_URL, SITE_SHORT_NAME } from '@/lib/config';
import { getTemplateTheme, type TemplateId } from '@/lib/templates';

interface RegionPageProps {
  params: Promise<{
    lang: string;
    slug: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params, searchParams }: RegionPageProps): Promise<Metadata> {
  const { lang, slug } = await params;
  const resolvedSearchParams = await searchParams;
  const regionSlug = slug.toLowerCase().trim();

  if (!isValidRegion(regionSlug)) {
    return {
      title: 'Region Not Found | KJIN',
      robots: { index: false, follow: false },
    };
  }

  const region = getRegion(regionSlug);
  const page = parsePageParam(resolvedSearchParams.page);
  const pageSuffix = page > 1 ? ` - Page ${page}` : '';
  const langPrefix = lang === 'en' ? '' : `/${lang}`;
  const canonicalUrl = `${SITE_URL}${langPrefix}/region/${regionSlug}${page > 1 ? `?page=${page}` : ''}`;

  return {
    metadataBase: new URL(SITE_URL),
    title: `${region?.name || 'Regional'} News & Dispatches${pageSuffix} | ${SITE_SHORT_NAME}`,
    description: `Verified grassroots journalism and news coverage across the ${region?.name} (${region?.districts.map((d) => JK_DISTRICTS[d]?.name).join(', ')}).`,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: `${region?.name} Dispatches | ${SITE_SHORT_NAME}`,
      description: `Comprehensive regional reporting from ${region?.name}.`,
      url: canonicalUrl,
      type: 'website',
    },
  };
}

export default async function RegionPage({ params, searchParams }: RegionPageProps) {
  const { lang, slug } = await params;
  const resolvedSearchParams = await searchParams;
  const regionSlug = slug.toLowerCase().trim();
  const langPrefix = lang === 'en' ? '' : `/${lang}`;

  if (!isValidRegion(regionSlug)) {
    notFound();
  }

  const region = getRegion(regionSlug)!;

  const page = parsePageParam(resolvedSearchParams.page);
  const { from, to, limit } = getPaginationRange(page, 12);

  const supabase = createServerAnonClient();

  // Query articles matching any district within this region
  const { data: articlesRaw, count } = await supabase
    .from('articles')
    .select('id, slug, title, excerpt, category, district, author_display_name, published_at, featured_image_url, article_translations(title, excerpt, language_code)', { count: 'exact' })
    .eq('status', 'published')
    .in('district', region.districts)
    .order('published_at', { ascending: false, nullsFirst: false })
    .range(from, to);

  const articles = applyTranslations(articlesRaw || [], lang);
  const totalArticles = count ?? 0;
  const totalPages = Math.ceil(totalArticles / limit);
  // Fetch Active Template Setting to align theme & background colors
  const { data: settingRow } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'active_template')
    .maybeSingle();

  const dbTemplateId = (settingRow?.value as { template_id?: string } | null)?.template_id as TemplateId | undefined;
  const theme = getTemplateTheme(dbTemplateId);

  return (
    <main className={`min-h-screen ${theme.pageBgClass} ${theme.textPrimaryClass} ${theme.fontFamilyClass} ${theme.selectionClass} pb-20`}>
      {/* Top Header */}
      <header className={`${theme.headerBgClass} ${theme.headerBorderClass} py-4 px-4 md:px-8`}>
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link
            href={`${langPrefix}/`}
            className={`text-2xl md:text-3xl font-black tracking-tighter uppercase transition ${
              theme.isDark ? 'text-white hover:text-cyan-400' : 'text-blue-900 hover:text-blue-700'
            }`}
          >
            {SITE_SHORT_NAME}
          </Link>
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-mono font-bold border ${theme.subtleBgClass} ${theme.borderClass} ${theme.accentTextClass}`}>
              {region.districts.length} Districts Covered
            </span>
            <Link
              href={`${langPrefix}/`}
              className={`text-xs font-semibold ${theme.textMutedClass} hover:${theme.textPrimaryClass} transition`}
            >
              &larr; Back to Home
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Banner for Region */}
      <div className={`border-b ${theme.borderClass} ${theme.subtleBgClass} py-10 px-4 md:px-8`}>
        <div className="max-w-7xl mx-auto">
          <div className={`inline-flex items-center gap-2 rounded-full border ${theme.borderClass} ${theme.cardBgClass} px-3 py-1 text-xs font-semibold ${theme.accentTextClass} mb-4`}>
            <span>KJIN Regional Bureau</span>
            <span>&bull;</span>
            <span className="capitalize">{region.shortName}</span>
          </div>

          <h1 className={`text-3xl md:text-5xl font-extrabold tracking-tight ${theme.textPrimaryClass} mb-3`}>
            {region.name}
          </h1>
          <p className={`text-base md:text-lg ${theme.textSecondaryClass} max-w-3xl mb-6`}>
            {region.tagline}. Verified field reporting, investigative analyses, and grassroots coverage from our local correspondents.
          </p>

          {/* Constituent District Pills */}
          <div>
            <div className={`text-xs font-bold uppercase tracking-wider ${theme.textMutedClass} mb-2`}>
              Districts in this Region:
            </div>
            <div className="flex flex-wrap gap-2">
              {region.districts.map((d) => (
                <Link
                  key={d}
                  href={`${langPrefix}/district/${d}`}
                  className={`rounded-lg border ${theme.borderClass} ${theme.cardBgClass} px-3 py-1.5 text-xs font-medium ${theme.textSecondaryClass} hover:${theme.accentTextClass} hover:${theme.borderMutedClass} transition`}
                >
                  {JK_DISTRICTS[d]?.name || d}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Articles Grid */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-10">
        <div className={`flex items-center justify-between border-b ${theme.borderClass} pb-4 mb-8`}>
          <h2 className={`text-xl font-bold ${theme.textPrimaryClass} flex items-center gap-2`}>
            <span className={`h-4 w-1 ${theme.accentBgClass} rounded-full`}></span>
            Dispatches from {region.name}
          </h2>
          <span className={`text-xs ${theme.textMutedClass} font-mono`}>
            {totalArticles} verified {totalArticles === 1 ? 'report' : 'reports'}
          </span>
        </div>

        {articles && articles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article) => (
              <Link
                key={article.id}
                href={`${langPrefix}/${article.category.toLowerCase()}/${article.slug}`}
                className={`group flex flex-col h-full rounded-2xl border ${theme.cardBorderClass} ${theme.cardBgClass} ${theme.cardHoverClass} p-5 transition shadow-sm`}
              >
                {article.featured_image_url ? (
                  <div className={`relative w-full h-48 mb-4 overflow-hidden rounded-xl ${theme.subtleBgClass}`}>
                    <Image
                      src={article.featured_image_url}
                      alt={article.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {article.district && (
                      <span className={`absolute bottom-2 left-2 rounded-md ${theme.cardBgClass} backdrop-blur-md px-2 py-0.5 text-[10px] font-bold ${theme.accentTextClass} uppercase tracking-wider border ${theme.borderMutedClass}`}>
                        {JK_DISTRICTS[article.district.toLowerCase()]?.name || article.district}
                      </span>
                    )}
                  </div>
                ) : null}

                <div className="flex items-center justify-between text-xs mb-2">
                  <span className={`font-bold uppercase tracking-wider ${theme.accentTextClass}`}>
                    {article.category}
                  </span>
                  <span className={theme.textMutedClass}>
                    {new Date(article.published_at).toLocaleDateString()}
                  </span>
                </div>

                <h3 className={`text-lg font-bold ${theme.textPrimaryClass} group-hover:opacity-80 transition line-clamp-2 mb-2`}>
                  {article.title}
                </h3>

                <p className={`text-xs ${theme.textSecondaryClass} line-clamp-3 leading-relaxed flex-1`}>
                  {article.excerpt}
                </p>

                <div className={`mt-4 pt-3 border-t ${theme.borderMutedClass} flex items-center justify-between text-xs ${theme.textMutedClass}`}>
                  <span>By {article.author_display_name || 'Correspondent'}</span>
                  <span className={`${theme.accentTextClass} font-semibold group-hover:translate-x-0.5 transition`}>
                    Read &rarr;
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className={`text-center py-20 rounded-2xl border border-dashed ${theme.borderClass}`}>
            <p className={`${theme.textMutedClass} text-sm`}>No published dispatches found in this region yet.</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-12 flex justify-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={`${langPrefix}/region/${regionSlug}?page=${p}`}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                  p === page
                    ? `${theme.accentBgClass}`
                    : `${theme.cardBgClass} ${theme.textSecondaryClass} border ${theme.borderClass} hover:opacity-80`
                }`}
              >
                {p}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
