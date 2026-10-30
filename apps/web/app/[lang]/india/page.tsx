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
import { getCachedSiteSetting } from '@/lib/site-settings-cache';
import { ClassicEditorialTemplate } from '@/components/templates/ClassicEditorialTemplate';
import type { ArticleItem, TemplateScope } from '@/components/templates/types';

export const revalidate = 60; // Revalidate every 60 seconds

interface IndiaPageProps {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params, searchParams }: IndiaPageProps): Promise<Metadata> {
  const { lang } = await params;
  const resolvedSearchParams = await searchParams;
  const page = parsePageParam(resolvedSearchParams.page);
  const pageSuffix = page > 1 ? ` - Page ${page}` : '';
  const langPrefix = lang === 'en' ? '' : `/${lang}`;
  const canonicalUrl = `${SITE_URL}${langPrefix}/india${page > 1 ? `?page=${page}` : ''}`;
  const supabase = createServerAnonClient();
  const brandSettings = await getBrandSettings(supabase);

  return {
    metadataBase: new URL(SITE_URL),
    title: `National News${pageSuffix} | ${brandSettings.name}`,
    description: 'Indian national news, union governance, Supreme Court rulings, national economy, and pan-India developments.',
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: `National News | ${brandSettings.name}`,
      description: 'Verified Indian national reporting, policy dispatches, and country-wide affairs.',
      url: canonicalUrl,
      type: 'website',
    },
  };
}

export default async function IndiaNationalPage({ params, searchParams }: IndiaPageProps) {
  const { lang } = await params;
  const resolvedSearchParams = await searchParams;
  const langPrefix = lang === 'en' ? '' : `/${lang}`;
  const page = parsePageParam(resolvedSearchParams.page);
  const limit = parseLimitParam(resolvedSearchParams.limit, 12);
  const { from, to } = getPaginationRange(page, limit);

  const supabase = createServerAnonClient();

  // 1. Fetch Shared Settings, Articles, Trending, and Template concurrently in ONE parallel roundtrip
  const [
    brandSettings,
    contactSettings,
    navbarSettings,
    telemetry,
    curation,
    weather,
    adsSettings,
    articlesResult,
    trendingResult,
    settingRow,
  ] = await Promise.all([
    getBrandSettings(supabase),
    getFooterContactSettings(supabase),
    getNavbarSettings(supabase),
    getTelemetrySettings(supabase),
    getCurationSettings(supabase),
    getRegionalWeather(),
    getCustomAdsSettings(supabase),
    supabase
      .from('articles')
      .select(
        'id, slug, title, excerpt, category, district, author_display_name, published_at, featured_image_url, view_count, article_translations(title, excerpt, language_code)',
        { count: 'exact' }
      )
      .eq('status', 'published')
      .ilike('category', 'National')
      .order('published_at', { ascending: false, nullsFirst: false })
      .range(from, to),
    supabase
      .from('articles')
      .select('id, slug, title, category, district, published_at, view_count, article_translations(title, language_code)')
      .eq('status', 'published')
      .ilike('category', 'National')
      .order('view_count', { ascending: false })
      .limit(5),
    getCachedSiteSetting<{ template_id?: string }>(supabase, 'active_template'),
  ]);

  const articles = (applyTranslations(articlesResult.data || [], lang) as unknown) as ArticleItem[];
  const totalArticles = articlesResult.count ?? 0;
  const paginationMeta = calculatePaginationMeta(totalArticles, page, limit);

  const trendingArticles = (applyTranslations(trendingResult.data || [], lang) as unknown) as ArticleItem[];

  // 2. Partition articles for 3-column broadsheet layout
  const heroArticle = articles[0] || null;
  const remainingArticles = articles.filter((a) => a.id !== heroArticle?.id);
  const subArticles = remainingArticles.slice(0, 2);
  const wireArticles = remainingArticles.slice(2, 7);
  const dossierArticles = articles.slice(7, 10);
  const editorialArticle = articles.find((a) => a.category?.toLowerCase() === 'opinion') || null;

  const dbTemplateId = settingRow?.template_id as TemplateId | undefined;
  const theme = getTemplateTheme(dbTemplateId);

  // 6. National Broadsheet Scope (tailored for Union affairs & National governance)
  const scope: TemplateScope = {
    type: 'national',
    title: 'National News & Union Governance',
    eyebrow: 'Country Wire • India',
    tagline: 'Comprehensive reporting on Indian national governance, Union policy, Supreme Court jurisprudence, the national economy, and major inter-state developments.',
    activeCategory: 'national',
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
