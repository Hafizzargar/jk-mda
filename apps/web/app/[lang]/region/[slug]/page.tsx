import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { createServerAnonClient } from '@/lib/supabase-server';
import { isValidRegion, getRegion, JK_DISTRICTS } from '@/lib/taxonomy';
import { parsePageParam, parseLimitParam, getPaginationRange, calculatePaginationMeta } from '@/lib/pagination';
import { applyTranslations } from '@/lib/i18n';
import { SITE_URL } from '@/lib/config';
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
  const supabase = createServerAnonClient();
  const brandSettings = await getBrandSettings(supabase);

  if (!isValidRegion(regionSlug)) {
    return {
      title: `Region Not Found | ${brandSettings.name}`,
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
    title: `${region?.name || 'Regional'} News & Dispatches${pageSuffix} | ${brandSettings.name}`,
    description: `Verified grassroots journalism and news coverage across the ${region?.name} (${region?.districts.map((d) => JK_DISTRICTS[d]?.name).join(', ')}).`,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: `${region?.name} Dispatches | ${brandSettings.name}`,
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
  const limit = parseLimitParam(resolvedSearchParams.limit, 12);
  const { from, to } = getPaginationRange(page, limit);

  const supabase = createServerAnonClient();

  // 1. Fetch Shared Navbar, Telemetry, Curation, Ads, Weather & Brand Settings
  const [brandSettings, contactSettings, navbarSettings, telemetry, curation, weather, adsSettings] = await Promise.all([
    getBrandSettings(supabase),
    getFooterContactSettings(supabase),
    getNavbarSettings(supabase),
    getTelemetrySettings(supabase),
    getCurationSettings(supabase),
    getRegionalWeather(),
    getCustomAdsSettings(supabase),
  ]);

  // 2. Query articles matching any district within this territorial region
  const { data: articlesRaw, count } = await supabase
    .from('articles')
    .select(
      'id, slug, title, excerpt, category, district, author_display_name, published_at, featured_image_url, view_count, article_translations(title, excerpt, language_code)',
      { count: 'exact' }
    )
    .eq('status', 'published')
    .in('district', region.districts)
    .order('published_at', { ascending: false, nullsFirst: false })
    .range(from, to);

  const articles = (applyTranslations(articlesRaw || [], lang) as unknown) as ArticleItem[];
  const totalArticles = count ?? 0;
  const paginationMeta = calculatePaginationMeta(totalArticles, page, limit);

  // 3. Trending articles within this region
  const { data: trendingRaw } = await supabase
    .from('articles')
    .select('id, slug, title, category, district, published_at, view_count, article_translations(title, language_code)')
    .eq('status', 'published')
    .in('district', region.districts)
    .order('view_count', { ascending: false })
    .limit(5);

  const trendingArticles = (applyTranslations(trendingRaw || [], lang) as unknown) as ArticleItem[];

  // 4. Partition articles for 3-column broadsheet layout
  const heroArticle = articles[0] || null;
  const remainingArticles = articles.filter((a) => a.id !== heroArticle?.id);
  const subArticles = remainingArticles.slice(0, 2);
  const wireArticles = remainingArticles.slice(2, 7);
  const dossierArticles = articles
    .filter((a) => {
      const c = a.category?.toLowerCase() || '';
      return c === 'investigation' || c === 'culture' || c === 'environment' || c === 'economy';
    })
    .slice(0, 3);
  const editorialArticle = articles.find((a) => a.category?.toLowerCase() === 'opinion') || null;

  // 5. Active Template Theme
  const { data: settingRow } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'active_template')
    .maybeSingle();

  const dbTemplateId = (settingRow?.value as { template_id?: string } | null)?.template_id as TemplateId | undefined;
  const theme = getTemplateTheme(dbTemplateId);

  // 6. Regional Broadsheet Scope
  const scope: TemplateScope = {
    type: 'region',
    title: region.name,
    eyebrow: `${brandSettings.name} Regional Bureau`,
    tagline: `${region.tagline}. Verified field reporting, investigative analyses, and grassroots coverage from our local correspondents.`,
    regionSlug,
    districts: region.districts,
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
