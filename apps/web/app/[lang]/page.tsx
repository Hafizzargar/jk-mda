import { Metadata } from 'next';
import Link from 'next/link';
import { createServerAnonClient } from '@/lib/supabase-server';
import { SITE_URL, SITE_NAME, SITE_SHORT_NAME, DEFAULT_LOCALE } from '@/lib/config';
import { applyTranslations } from '@/lib/i18n';
import { type TemplateId, getTemplateDefinition, getTemplateTheme } from '@/lib/templates';
import { parsePageParam, parseLimitParam, getPaginationRange, calculatePaginationMeta } from '@/lib/pagination';
import { getFooterContactSettings } from '@/lib/contact';
import { getCustomAdsSettings } from '@/lib/ads';
import { getNavbarSettings } from '@/lib/navbar';
import { getTelemetrySettings } from '@/lib/telemetry';
import { ClassicEditorialTemplate } from '@/components/templates/ClassicEditorialTemplate';
import { ModernMagazineTemplate } from '@/components/templates/ModernMagazineTemplate';
import { MinimalFocusTemplate } from '@/components/templates/MinimalFocusTemplate';
import { BreakingWireTemplate } from '@/components/templates/BreakingWireTemplate';
import { BentoGridTemplate } from '@/components/templates/BentoGridTemplate';
import { GenZNeoBrutalistTemplate } from '@/components/templates/GenZNeoBrutalistTemplate';
import { CleanNordicWhiteTemplate } from '@/components/templates/CleanNordicWhiteTemplate';
import { VisualStoriesTemplate } from '@/components/templates/VisualStoriesTemplate';
import { TechTerminalTemplate } from '@/components/templates/TechTerminalTemplate';
import { HyperlocalCommunityTemplate } from '@/components/templates/HyperlocalCommunityTemplate';
import { ArticleItem } from '@/components/templates/types';
import { REGIONAL_DIVISIONS, getDistrictDisplayName, type KJINRegionKey } from '@/lib/taxonomy';
import { getCurationSettings } from '@/lib/curation';
import { getRegionalWeather } from '@/lib/weather';

export const revalidate = 60; // Revalidate every 60 seconds

import { getBrandSettings } from '@/lib/brand';

export async function generateMetadata(): Promise<Metadata> {
  const supabase = createServerAnonClient();
  const brand = await getBrandSettings(supabase);
  const brandName = brand.name || SITE_SHORT_NAME;
  const brandFullName = brand.full_name || SITE_NAME;
  const tagline = brand.tagline || 'Verified Journalism from Jammu & Kashmir';

  return {
    metadataBase: new URL(SITE_URL),
    title: `${brandFullName} (${brandName}) | ${tagline}`,
    description: `Independent, verified reporting, investigations, and ground dispatches from ${brandFullName}.`,
    alternates: {
      canonical: SITE_URL,
    },
    openGraph: {
      title: `${brandFullName} | ${brandName}`,
      description: tagline,
      url: SITE_URL,
      siteName: `${brandFullName} (${brandName})`,
      locale: DEFAULT_LOCALE,
      type: 'website',
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

interface HomePageProps {
  params: Promise<{ lang: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function HomePage({ params, searchParams }: HomePageProps) {
  const { lang } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const supabase = createServerAnonClient();
  const langPrefix = lang === 'en' ? '' : `/${lang}`;

  // 1. Fetch Active Presentation Template from database
  const { data: settingRow } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'active_template')
    .maybeSingle();

  const dbTemplateId = (settingRow?.value as { template_id?: string } | null)?.template_id as TemplateId | undefined;

  // Allow query parameter preview (e.g. ?preview=modern-magazine or ?template=bento-grid)
  const previewParam = (resolvedSearchParams.preview || resolvedSearchParams.template) as string | undefined;
  const activeTemplateId: TemplateId = (previewParam as TemplateId) || dbTemplateId || 'classic-editorial';
  const isPreviewMode = Boolean(previewParam && previewParam !== dbTemplateId);
  const theme = getTemplateTheme(activeTemplateId);

  // 2. Real Backend Pagination: Parse page & limit (6, 9, 12, 18)
  const page = parsePageParam(resolvedSearchParams.page);
  const limit = parseLimitParam(resolvedSearchParams.limit, 6);
  const { from, to } = getPaginationRange(page, limit);

  // 3. Fetch Paginated Latest Articles with exact database count
  // Strictly scoped to Jammu & Kashmir reporting (excludes International and National news)
  const EXCLUDED_CATEGORIES_FILTER =
    '(International,international,INTERNATIONAL,National,national,NATIONAL,"International","international","INTERNATIONAL","National","national","NATIONAL")';

  const { data: latestArticlesRaw, count } = await supabase
    .from('articles')
    .select(
      'id, slug, title, excerpt, category, district, author_display_name, published_at, featured_image_url, view_count, article_translations(title, excerpt, language_code)',
      { count: 'exact' }
    )
    .eq('status', 'published')
    .not('category', 'in', EXCLUDED_CATEGORIES_FILTER)
    .order('published_at', { ascending: false, nullsFirst: false })
    .range(from, to);

  const totalCount = count ?? 0;
  const paginationMeta = calculatePaginationMeta(totalCount, page, limit);

  // 4. Fetch Footer & Bureau Contact Settings, Telemetry, Curation Layout & Live Regional Weather
  const [contactSettings, adsSettings, navbarSettings, telemetry, curation, weather] = await Promise.all([
    getFooterContactSettings(supabase),
    getCustomAdsSettings(supabase),
    getNavbarSettings(supabase),
    getTelemetrySettings(supabase),
    getCurationSettings(supabase),
    getRegionalWeather(),
  ]);

  // 5. Fetch Trending Articles (bounded to recent 30-day window, J&K news only)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  let { data: trendingArticlesRaw } = await supabase
    .from('articles')
    .select('id, slug, title, category, published_at, view_count, article_translations(title, language_code)')
    .eq('status', 'published')
    .not('category', 'in', EXCLUDED_CATEGORIES_FILTER)
    .gte('published_at', thirtyDaysAgo)
    .order('view_count', { ascending: false })
    .limit(5);

  if (!trendingArticlesRaw || trendingArticlesRaw.length === 0) {
    const { data: fallbackTrending } = await supabase
      .from('articles')
      .select('id, slug, title, category, published_at, view_count, article_translations(title, language_code)')
      .eq('status', 'published')
      .not('category', 'in', EXCLUDED_CATEGORIES_FILTER)
      .order('view_count', { ascending: false })
      .limit(5);
    trendingArticlesRaw = fallbackTrending || [];
  }

  // Defensive isolation: logically, international and national news belong strictly in their dedicated desks
  const isExcludedFromHome = (cat?: string | null) => {
    if (!cat) return false;
    const lower = cat.toLowerCase().trim();
    return lower === 'international' || lower === 'national';
  };

  const rawLatestFiltered = (latestArticlesRaw || []).filter((a) => !isExcludedFromHome(a.category));
  const rawTrendingFiltered = (trendingArticlesRaw || []).filter((a) => !isExcludedFromHome(a.category));

  const latestArticles = (applyTranslations(rawLatestFiltered, lang) as unknown) as ArticleItem[];
  const trendingArticles = (applyTranslations(rawTrendingFiltered, lang) as unknown) as ArticleItem[];

  // 6. Fetch specifically curated article IDs if set in curation desk
  const allCuratedIds = Array.from(
    new Set([
      curation.lead_hero_id,
      ...(curation.sub_lead_ids || []),
      ...(curation.wire_ids || []),
      ...(curation.dossier_ids || []),
      curation.editorial_id,
      curation.developing_article_id,
      ...Object.values(curation.corridor_assignments || {}),
    ].filter(Boolean) as string[])
  );

  const curatedArticlesMap = new Map<string, ArticleItem>();
  if (allCuratedIds.length > 0) {
    const { data: curatedDbArticles } = await supabase
      .from('articles')
      .select(
        'id, slug, title, excerpt, category, district, author_display_name, published_at, featured_image_url, view_count, article_translations(title, excerpt, language_code)'
      )
      .in('id', allCuratedIds);

    const translatedCurated = (applyTranslations(curatedDbArticles || [], lang) as unknown) as ArticleItem[];
    for (const art of translatedCurated) {
      curatedArticlesMap.set(art.id, art);
    }
  }

  // 7. Resolve Curated vs Algorithmic Slots
  const heroArticle =
    (curation.lead_hero_id ? curatedArticlesMap.get(curation.lead_hero_id) : null) ||
    (latestArticles && latestArticles.length > 0 ? latestArticles[0] : null);

  const remainingArticles = latestArticles.filter((a) => a.id !== heroArticle?.id);

  const subArticles: ArticleItem[] =
    curation.sub_lead_ids && curation.sub_lead_ids.length > 0
      ? (curation.sub_lead_ids.map((id) => curatedArticlesMap.get(id)).filter(Boolean) as ArticleItem[])
      : remainingArticles.slice(0, 2);

  const wireArticles: ArticleItem[] =
    curation.wire_ids && curation.wire_ids.length > 0
      ? (curation.wire_ids.map((id) => curatedArticlesMap.get(id)).filter(Boolean) as ArticleItem[])
      : remainingArticles.slice(2, 7);

  const dossierArticles: ArticleItem[] =
    curation.dossier_ids && curation.dossier_ids.length > 0
      ? (curation.dossier_ids.map((id) => curatedArticlesMap.get(id)).filter(Boolean) as ArticleItem[])
      : latestArticles.filter((a) => {
          const c = a.category.toLowerCase();
          return c === 'investigation' || c === 'culture' || c === 'environment' || c === 'economy';
        }).slice(0, 3);

  const editorialArticle: ArticleItem | null =
    (curation.editorial_id ? curatedArticlesMap.get(curation.editorial_id) : null) ||
    latestArticles.find((a) => a.category.toLowerCase() === 'opinion') ||
    null;

  // 8. Fetch Territorial Corridor Trending News (dynamic real-time stories for all 5 corridors)
  const { data: corridorArticlesRaw } = await supabase
    .from('articles')
    .select('id, slug, title, category, district, published_at, view_count, reading_time_minutes, article_translations(title, language_code)')
    .eq('status', 'published')
    .not('district', 'is', null)
    .order('view_count', { ascending: false, nullsFirst: false });

  // Map each of the 5 canonical corridors to its top trending regional news or curated override
  const CORRIDOR_REGIONS: Record<string, { regionKey: KJINRegionKey; name: string }> = {
    kashmir: { regionKey: 'kashmir', name: 'Kashmir Valley' },
    jammu: { regionKey: 'jammu', name: 'Jammu Plains' },
    chenab: { regionKey: 'chenab-valley', name: 'Chenab Valley' },
    panjal: { regionKey: 'pir-panjal', name: 'Pir Panjal' },
    ladakh: { regionKey: 'leh', name: 'Leh & Ladakh' },
  };

  const dynamicCorridors = (telemetry.corridors_at_a_glance || []).map((corridor) => {
    const config = CORRIDOR_REGIONS[corridor.id] || {
      regionKey: (corridor.id === 'chenab' ? 'chenab-valley' : corridor.id === 'panjal' ? 'pir-panjal' : corridor.id === 'ladakh' ? 'leh' : corridor.id) as KJINRegionKey,
      name: corridor.name,
    };

    const regionDef = REGIONAL_DIVISIONS[config.regionKey];
    const allowedDistricts = regionDef?.districts || [];

    // Check if specifically curated for this corridor
    const pinnedArticleId = curation.corridor_assignments?.[corridor.id];
    const matchedArticle =
      (pinnedArticleId ? curatedArticlesMap.get(pinnedArticleId) : null) ||
      (corridorArticlesRaw || []).find((art) =>
        art.district && allowedDistricts.includes(art.district.toLowerCase().trim())
      );

    if (matchedArticle) {
      interface CorridorArticleShape {
        title: string;
        district?: string | null;
        view_count?: number | null;
        reading_time_minutes?: number | null;
        article_translations?: Array<{ language_code: string; title?: string }> | null;
      }
      const artObj = matchedArticle as unknown as CorridorArticleShape;
      const translation = artObj.article_translations?.find(
        (t) => t.language_code === lang
      );
      const headline = translation?.title || matchedArticle.title;
      const districtName = matchedArticle.district
        ? getDistrictDisplayName(matchedArticle.district)
        : regionDef?.shortName || corridor.name;
      const stats = `${districtName} • Verified Field Dispatch • ${artObj.reading_time_minutes || 3}m read`;

      return {
        ...corridor,
        headline,
        stats,
        link_path: `/${matchedArticle.category.toLowerCase()}/${matchedArticle.slug}`,
        region_slug: config.regionKey,
        article_id: matchedArticle.id,
        is_dynamic: true,
      };
    }

    const safeLink = corridor.link_path && !corridor.link_path.startsWith('/category/') && corridor.link_path !== '/transit'
      ? corridor.link_path
      : `/region/${config.regionKey}`;

    return {
      ...corridor,
      link_path: safeLink,
      region_slug: config.regionKey,
    };
  });

  const enhancedTelemetry = {
    ...telemetry,
    live_wire: curation.developing_is_active && curation.developing_headline
      ? {
          headline: curation.developing_headline,
          is_active: true,
          synced_time: 'LIVE DESK',
          verified: true,
        }
      : telemetry.live_wire,
    corridors_at_a_glance: dynamicCorridors,
  };

  const templateProps = {
    lang,
    langPrefix,
    heroArticle,
    recentArticles: remainingArticles,
    trendingArticles,
    allArticles: latestArticles,
    theme,
    contactSettings,
    paginationMeta,
    adsSettings,
    navbarSettings,
    telemetry: enhancedTelemetry,
    curation,
    weather,
    dossierArticles,
    editorialArticle,
    subArticles,
    wireArticles,
  };

  const currentTemplateDef = getTemplateDefinition(activeTemplateId);


  return (
    <>
      {isPreviewMode && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between sticky top-0 z-50 shadow-md">
          <div className="flex items-center gap-2">
            <span className="bg-slate-950 text-amber-400 px-2 py-0.5 rounded text-[10px] uppercase font-mono">
              PREVIEW MODE
            </span>
            <span>
              Previewing: <strong>{currentTemplateDef.name}</strong> ({currentTemplateDef.badge}). This is not yet active for all visitors.
            </span>
          </div>
          <Link href="/" className="underline hover:text-black font-semibold">
            Exit Preview
          </Link>
        </div>
      )}

      {/* Render Selected Dynamic Template */}
      {activeTemplateId === 'modern-magazine' ? (
        <ModernMagazineTemplate {...templateProps} />
      ) : activeTemplateId === 'minimal-focus' ? (
        <MinimalFocusTemplate {...templateProps} />
      ) : activeTemplateId === 'breaking-wire' ? (
        <BreakingWireTemplate {...templateProps} />
      ) : activeTemplateId === 'bento-grid' ? (
        <BentoGridTemplate {...templateProps} />
      ) : activeTemplateId === 'genz-neo-brutalist' ? (
        <GenZNeoBrutalistTemplate {...templateProps} />
      ) : activeTemplateId === 'clean-nordic-white' ? (
        <CleanNordicWhiteTemplate {...templateProps} />
      ) : activeTemplateId === 'visual-stories-deck' ? (
        <VisualStoriesTemplate {...templateProps} />
      ) : activeTemplateId === 'tech-terminal-wire' ? (
        <TechTerminalTemplate {...templateProps} />
      ) : activeTemplateId === 'hyperlocal-community' ? (
        <HyperlocalCommunityTemplate {...templateProps} />
      ) : (
        <ClassicEditorialTemplate {...templateProps} />
      )}
    </>
  );
}
 