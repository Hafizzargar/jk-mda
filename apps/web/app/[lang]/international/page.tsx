import { Metadata } from 'next';
import { createServerAnonClient } from '@/lib/supabase-server';
import { parsePageParam, parseLimitParam, getPaginationRange, calculatePaginationMeta } from '@/lib/pagination';
import { SITE_URL } from '@/lib/config';
import { applyTranslations } from '@/lib/i18n';
import { getTemplateTheme, type TemplateId } from '@/lib/templates';
import { getBrandSettings } from '@/lib/brand';
import { getFooterContactSettings } from '@/lib/contact';
import { getNavbarSettings } from '@/lib/navbar';
import { getTelemetrySettings } from '@/lib/telemetry';
import { getCurationSettings } from '@/lib/curation';
import { getRegionalWeather } from '@/lib/weather';
import { getCustomAdsSettings } from '@/lib/ads';
import { ClassicEditorialTemplate } from '@/components/templates/ClassicEditorialTemplate';
import type { ArticleItem, TemplateScope } from '@/components/templates/types';

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
    metadataBase: new URL(SITE_URL),
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
  const limit = parseLimitParam(resolvedSearchParams.limit, 12);
  const { from, to } = getPaginationRange(page, limit);

  const supabase = createServerAnonClient();

  // 1. Fetch Shared Settings
  const [brandSettings, contactSettings, navbarSettings, telemetry, curation, weather, adsSettings] = await Promise.all([
    getBrandSettings(supabase),
    getFooterContactSettings(supabase),
    getNavbarSettings(supabase),
    getTelemetrySettings(supabase),
    getCurationSettings(supabase),
    getRegionalWeather(),
    getCustomAdsSettings(supabase),
  ]);

  // 2. Query strictly foreign and international affairs (category = 'International')
  const { data: articlesRaw, count } = await supabase
    .from('articles')
    .select(
      'id, slug, title, excerpt, category, district, author_display_name, published_at, featured_image_url, view_count, article_translations(title, excerpt, language_code)',
      { count: 'exact' }
    )
    .eq('status', 'published')
    .ilike('category', 'International')
    .order('published_at', { ascending: false, nullsFirst: false })
    .range(from, to);

  const articles = (applyTranslations(articlesRaw || [], lang) as unknown) as ArticleItem[];
  const totalArticles = count ?? 0;
  const paginationMeta = calculatePaginationMeta(totalArticles, page, limit);

  // 3. Trending articles within International
  const { data: trendingRaw } = await supabase
    .from('articles')
    .select('id, slug, title, category, district, published_at, view_count, article_translations(title, language_code)')
    .eq('status', 'published')
    .ilike('category', 'International')
    .order('view_count', { ascending: false })
    .limit(5);

  const trendingArticles = (applyTranslations(trendingRaw || [], lang) as unknown) as ArticleItem[];

  // 4. Partition articles for 3-column broadsheet layout
  const heroArticle = articles[0] || null;
  const remainingArticles = articles.filter((a) => a.id !== heroArticle?.id);
  const subArticles = remainingArticles.slice(0, 2);
  const wireArticles = remainingArticles.slice(2, 7);
  const dossierArticles = articles.slice(7, 10);
  const editorialArticle = articles.find((a) => a.category?.toLowerCase() === 'opinion') || null;

  // 5. Active Template Theme
  const { data: settingRow } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'active_template')
    .maybeSingle();

  const dbTemplateId = (settingRow?.value as { template_id?: string } | null)?.template_id as TemplateId | undefined;
  const theme = getTemplateTheme(dbTemplateId);

  // 6. International Broadsheet Scope (tailored for World diplomacy & Multilateral affairs)
  const scope: TemplateScope = {
    type: 'international',
    title: 'International Affairs & Global Diplomacy',
    eyebrow: 'Global Wire • World',
    tagline: 'Independent reporting on foreign countries, global geopolitical developments, multilateral treaties, international courts, and humanitarian affairs.',
    activeCategory: 'international',
    totalCount: totalArticles,
  };

  const templateProps = {
    lang,
    langPrefix,
    heroArticle,
    recentArticles: remainingArticles,
    trendingArticles,
    allArticles: articles,
    theme,
    contactSettings,
    paginationMeta,
    adsSettings,
    navbarSettings,
    telemetry,
    curation,
    weather,
    dossierArticles: dossierArticles.length > 0 ? dossierArticles : remainingArticles.slice(0, 3),
    editorialArticle,
    subArticles,
    wireArticles,
    scope,
  };

  return <ClassicEditorialTemplate {...templateProps} />;
}
