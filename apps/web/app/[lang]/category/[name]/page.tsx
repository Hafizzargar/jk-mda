import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Metadata } from 'next';
import { createServerAnonClient } from '@/lib/supabase-server';
import { isValidCategory, getCategoryDisplayName, NEWS_CATEGORIES } from '@/lib/taxonomy';
import { parsePageParam, parseLimitParam, getPaginationRange, calculatePaginationMeta } from '@/lib/pagination';
import { applyTranslations } from '@/lib/i18n';
import { SITE_URL, SITE_SHORT_NAME } from '@/lib/config';
import { getTemplateTheme, type TemplateId } from '@/lib/templates';
import { getBrandSettings } from '@/lib/brand';
import { SiteNavbar } from '@/components/navigation/SiteNavbar';
import { SiteFooter } from '@/components/navigation/SiteFooter';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { PaginationControls } from '@/components/navigation/PaginationControls';
import { getFooterContactSettings } from '@/lib/contact';

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
  const langPrefix = lang === 'en' ? '' : `/${lang}`;
  const canonicalUrl = `${SITE_URL}${langPrefix}/category/${categorySlug}${page > 1 ? `?page=${page}` : ''}`;

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
      notFound();
    }
  }

  // 2. Pagination computation
  const page = parsePageParam(resolvedSearchParams.page);
  const limit = parseLimitParam(resolvedSearchParams.limit, 6);
  const { from, to } = getPaginationRange(page, limit);

  // 3. Query articles with exact count
  const { data: articlesRaw, count } = await supabase
    .from('articles')
    .select('id, slug, title, excerpt, category, author_display_name, published_at, featured_image_url, article_translations(title, excerpt, language_code)', { count: 'exact' })
    .eq('status', 'published')
    .ilike('category', categorySlug)
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
  const brandSettings = await getBrandSettings(supabase);
  const contactSettings = await getFooterContactSettings(supabase);

  const breadcrumbs = [
    { label: 'Categories', href: `${langPrefix}/` },
    { label: categoryName, current: true },
  ];

  return (
    <main className={`min-h-screen ${theme.pageBgClass} ${theme.textPrimaryClass} ${theme.fontFamilyClass} ${theme.selectionClass} flex flex-col justify-between`}>
      <div>
        <SiteNavbar
          lang={lang}
          theme={theme}
          activeCategory={categorySlug}
        />

        <div className="max-w-7xl mx-auto px-4 md:px-8 pt-4 pb-2">
          <Breadcrumbs items={breadcrumbs} lang={lang} theme={theme} />
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        <div className={`mb-8 border-b-4 ${theme.accentBorderClass} inline-block pb-2`}>
          <h1 className={`text-4xl md:text-5xl font-extrabold tracking-tight ${theme.textPrimaryClass}`}>
            {categoryName}
          </h1>
        </div>
        {categoryInfo && (
          <p className={`${theme.textSecondaryClass} mb-10 max-w-2xl text-lg`}>
            {categoryInfo.description}
          </p>
        )}

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
                  <div className={`text-xs font-bold uppercase tracking-widest ${theme.accentTextClass} mb-2`}>
                    {new Date(article.published_at).toLocaleDateString()}
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
            No published articles found in {categoryName}.
          </div>
        )}
      </div>
    </div>

    <SiteFooter lang={lang} theme={theme} contactSettings={contactSettings} brandSettings={brandSettings} />
  </main>
);
}
