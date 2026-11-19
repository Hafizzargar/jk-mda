import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Metadata } from 'next';
import { createServerAnonClient } from '@/lib/supabase-server';
import { getJournalistBySlug, KJIN_JOURNALISTS } from '@/lib/journalists';
import { getCategorySlug } from '@/lib/taxonomy';
import { parsePageParam, parseLimitParam, getPaginationRange, calculatePaginationMeta } from '@/lib/pagination';
import { applyTranslations } from '@/lib/i18n';
import { SITE_URL, SITE_NAME, SITE_SHORT_NAME } from '@/lib/config';
import { getTemplateTheme, type TemplateId } from '@/lib/templates';
import { getBrandSettings } from '@/lib/brand';
import { getNavbarSettings } from '@/lib/navbar';
import { SiteNavbar } from '@/components/navigation/SiteNavbar';
import { SiteFooter } from '@/components/navigation/SiteFooter';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { PaginationControls } from '@/components/navigation/PaginationControls';
import { getFooterContactSettings } from '@/lib/contact';
import { formatArticleDate } from '@/lib/date';
import { safeJsonLd } from '@/lib/sanitize';

interface AuthorPageProps {
  params: Promise<{
    lang: string;
    slug: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params, searchParams }: AuthorPageProps): Promise<Metadata> {
  const { lang, slug } = await params;
  const resolvedSearchParams = await searchParams;
  const journalist = getJournalistBySlug(slug);

  if (!journalist) {
    return {
      title: 'Author Not Found | KJCPL',
      robots: { index: false, follow: false },
    };
  }

  const page = parsePageParam(resolvedSearchParams.page);
  const pageSuffix = page > 1 ? ` - Page ${page}` : '';
  const canonicalUrl = `${SITE_URL}/en/author/${journalist.slug}${page > 1 ? `?page=${page}` : ''}`;

  return {
    metadataBase: new URL(SITE_URL),
    title: `${journalist.name} — ${journalist.designation}${pageSuffix} | KJCPL`,
    description: journalist.bio,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: `${journalist.name} (${journalist.designation}) | KJCPL`,
      description: journalist.bio,
      url: canonicalUrl,
      type: 'profile',
    },
  };
}

export default async function AuthorProfilePage({ params, searchParams }: AuthorPageProps) {
  const { lang, slug } = await params;
  const resolvedSearchParams = await searchParams;
  const journalist = getJournalistBySlug(slug);

  if (!journalist) {
    notFound();
  }

  const page = parsePageParam(resolvedSearchParams.page);
  const limit = parseLimitParam(resolvedSearchParams.limit, 9);
  const { from, to } = getPaginationRange(page, limit);

  const supabase = createServerAnonClient();

  // Query articles credited to this journalist (or matching their district/name)
  const { data: articlesRaw, count } = await supabase
    .from('articles')
    .select(
      'id, slug, title, excerpt, category, district, author_display_name, published_at, featured_image_url, article_translations(title, excerpt, language_code)',
      { count: 'exact' }
    )
    .eq('status', 'published')
    .or(`author_display_name.ilike.%${journalist.name}%,district.ilike.%${journalist.district}%`)
    .order('published_at', { ascending: false, nullsFirst: false })
    .range(from, to);

  const articles = applyTranslations(articlesRaw || [], lang);
  const totalArticles = count ?? 0;
  const paginationMeta = calculatePaginationMeta(totalArticles, page, limit);

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
    { label: 'Home', href: '/en' },
    { label: 'Editorial Desk', href: '/en/about' },
    { label: journalist.name, current: true },
  ];

  const authorJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: journalist.name,
    jobTitle: journalist.designation,
    worksFor: {
      '@type': 'NewsMediaOrganization',
      name: SITE_NAME,
      url: `${SITE_URL}/en`,
    },
    knowsAbout: [journalist.beat, `${journalist.district} District`, 'Jammu & Kashmir'],
    description: journalist.bio,
    url: `${SITE_URL}/en/author/${journalist.slug}`,
  };

  return (
    <main className={`min-h-screen ${theme.pageBgClass} ${theme.textPrimaryClass} ${theme.fontFamilyClass} ${theme.selectionClass} flex flex-col justify-between`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(authorJsonLd) }}
      />
      <div>
        <SiteNavbar
          lang={lang}
          theme={theme}
          navbarSettings={navbarSettings}
        />

        <div className="max-w-7xl mx-auto px-4 md:px-8 pt-4 pb-2">
          <Breadcrumbs items={breadcrumbs} lang={lang} theme={theme} />
        </div>

        {/* Author Authority Dossier Card */}
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
          <div className="bg-white border border-stone-200/90 rounded-2xl p-6 md:p-8 shadow-xs mb-10">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6 pb-6 border-b border-stone-100">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-cyan-950 text-cyan-200 flex items-center justify-center font-serif text-3xl font-bold border-2 border-cyan-700/50 shrink-0 shadow-inner">
                {journalist.name.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <h1 className="text-2xl md:text-3xl font-extrabold text-stone-900 tracking-tight">
                    {journalist.name}
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    {journalist.verifiedBadge}
                  </span>
                </div>
                <div className="text-sm font-semibold text-cyan-800 mb-2">
                  {journalist.designation} • Base: {journalist.location}
                </div>
                <p className="text-stone-600 text-sm leading-relaxed max-w-3xl">
                  {journalist.bio}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 text-xs text-stone-600">
              <div className="border-l-2 border-cyan-600 pl-3">
                <span className="block font-bold text-stone-900 uppercase tracking-wider text-[10px]">Primary Beat</span>
                <span>{journalist.beat}</span>
              </div>
              <div className="border-l-2 border-emerald-600 pl-3">
                <span className="block font-bold text-stone-900 uppercase tracking-wider text-[10px]">Field Coverage</span>
                <span>{journalist.district} & Surrounding Hubs</span>
              </div>
              <div className="border-l-2 border-stone-400 pl-3">
                <span className="block font-bold text-stone-900 uppercase tracking-wider text-[10px]">Total Published</span>
                <span>{totalArticles} Verified Dispatches</span>
              </div>
              <div className="border-l-2 border-amber-600 pl-3">
                <span className="block font-bold text-stone-900 uppercase tracking-wider text-[10px]">Standards Protocol</span>
                <span>KJCPL E-E-A-T Verified</span>
              </div>
            </div>
          </div>

          {/* Published Dispatches Section */}
          <div className="mb-6 flex items-center justify-between border-b border-stone-200 pb-3">
            <h2 className="text-xl font-bold text-stone-900 font-serif">
              Dispatches by {journalist.name}
            </h2>
            <span className="text-xs text-stone-500 font-medium">
              Showing {articles.length} of {totalArticles} stories
            </span>
          </div>

          {articles && articles.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {articles.map((article) => (
                  <Link
                    key={article.id}
                    href={`/en/${getCategorySlug(article.category)}/${article.slug}`}
                    className="group flex flex-col h-full bg-white rounded-xl border border-stone-200/90 hover:border-cyan-600/50 p-5 shadow-xs hover:shadow-md transition"
                  >
                    {article.featured_image_url ? (
                      <div className="relative w-full h-48 mb-4 overflow-hidden rounded-lg bg-stone-100">
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
                      <div className="w-full h-2 bg-cyan-700/60 group-hover:bg-cyan-700 transition mb-4 rounded-full" />
                    )}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-100">
                        {article.category}
                      </span>
                      <span className="text-xs text-stone-400 font-medium" suppressHydrationWarning>
                        {formatArticleDate(article.published_at)}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold leading-snug text-stone-900 group-hover:text-cyan-900 transition mb-2 font-serif">
                      {article.title}
                    </h3>
                    {article.excerpt && (
                      <p className="text-stone-600 line-clamp-3 mb-4 flex-grow text-xs leading-relaxed">
                        {article.excerpt}
                      </p>
                    )}
                    <div className="mt-auto text-[11px] font-semibold text-stone-500 pt-2 border-t border-stone-100 flex items-center justify-between">
                      <span>📍 {article.district ? `${article.district} District` : 'J&K Bureau'}</span>
                      <span className="text-cyan-700 group-hover:underline">Read Story →</span>
                    </div>
                  </Link>
                ))}
              </div>

              <PaginationControls meta={paginationMeta} theme={theme} showPageSizeSelector={true} />
            </>
          ) : (
            <div className="py-20 text-center text-stone-500 text-base bg-white rounded-xl border border-stone-200">
              No field dispatches filed under this beat yet.
            </div>
          )}
        </div>
      </div>

      <SiteFooter lang={lang} theme={theme} contactSettings={contactSettings} brandSettings={brandSettings} />
    </main>
  );
}
