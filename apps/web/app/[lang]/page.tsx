import { Metadata } from 'next';
import Link from 'next/link';
import { createServerAnonClient } from '@/lib/supabase-server';
import { SITE_URL, SITE_NAME, DEFAULT_LOCALE } from '@/lib/config';
import { applyTranslations } from '@/lib/i18n';
import { type TemplateId, getTemplateDefinition, getTemplateTheme } from '@/lib/templates';
import { parsePageParam, parseLimitParam, getPaginationRange, calculatePaginationMeta } from '@/lib/pagination';
import { getFooterContactSettings } from '@/lib/contact';
import { getCustomAdsSettings } from '@/lib/ads';
import { getNavbarSettings } from '@/lib/navbar';
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

export const revalidate = 60; // Revalidate every 60 seconds

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${SITE_NAME} | Verified Journalism from Jammu & Kashmir`,
  description: 'Independent, verified reporting, investigations, and ground dispatches from Jammu and Kashmir.',
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: `${SITE_NAME} | Ground Reporting from J&K`,
    description: 'Independent, verified reporting, investigations, and ground dispatches from Jammu and Kashmir.',
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: DEFAULT_LOCALE,
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

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

  // 2. Real Backend Pagination: Parse page & limit (10, 15, or 20)
  const page = parsePageParam(resolvedSearchParams.page);
  const limit = parseLimitParam(resolvedSearchParams.limit, 10);
  const { from, to } = getPaginationRange(page, limit);

  // 3. Fetch Paginated Latest Articles with exact database count
  // Strictly scoped to Jammu & Kashmir reporting (excludes International and National news)
  const { data: latestArticlesRaw, count } = await supabase
    .from('articles')
    .select(
      'id, slug, title, excerpt, category, district, author_display_name, published_at, featured_image_url, view_count, article_translations(title, excerpt, language_code)',
      { count: 'exact' }
    )
    .eq('status', 'published')
    .not('category', 'in', '("International","international","National","national")')
    .order('published_at', { ascending: false, nullsFirst: false })
    .range(from, to);

  const totalCount = count ?? 0;
  const paginationMeta = calculatePaginationMeta(totalCount, page, limit);

  // 4. Fetch Footer & Bureau Contact Settings from database
  const contactSettings = await getFooterContactSettings(supabase);
  const adsSettings = await getCustomAdsSettings(supabase);
  const navbarSettings = await getNavbarSettings(supabase);

  // 5. Fetch Trending Articles (bounded to recent 30-day window, J&K news only)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  let { data: trendingArticlesRaw } = await supabase
    .from('articles')
    .select('id, slug, title, category, published_at, view_count, article_translations(title, language_code)')
    .eq('status', 'published')
    .not('category', 'in', '("International","international","National","national")')
    .gte('published_at', thirtyDaysAgo)
    .order('view_count', { ascending: false })
    .limit(5);

  if (!trendingArticlesRaw || trendingArticlesRaw.length === 0) {
    const { data: fallbackTrending } = await supabase
      .from('articles')
      .select('id, slug, title, category, published_at, view_count, article_translations(title, language_code)')
      .eq('status', 'published')
      .not('category', 'in', '("International","international","National","national")')
      .order('view_count', { ascending: false })
      .limit(5);
    trendingArticlesRaw = fallbackTrending || [];
  }

  const latestArticles = (applyTranslations(latestArticlesRaw || [], lang) as unknown) as ArticleItem[];
  const trendingArticles = (applyTranslations(trendingArticlesRaw || [], lang) as unknown) as ArticleItem[];

  const heroArticle = latestArticles && latestArticles.length > 0 ? latestArticles[0] : null;
  const recentArticles = latestArticles && latestArticles.length > 1 ? latestArticles.slice(1) : [];

  const templateProps = {
    lang,
    langPrefix,
    heroArticle,
    recentArticles,
    trendingArticles,
    allArticles: latestArticles,
    theme,
    contactSettings,
    paginationMeta,
    adsSettings,
    navbarSettings,
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
 