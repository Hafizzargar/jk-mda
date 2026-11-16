import { notFound, redirect } from 'next/navigation';
import { Metadata } from 'next';
import { createServerAnonClient } from '@/lib/supabase-server';
import { ViewTracker } from '@/components/ViewTracker';
import { sanitizeArticleHtml, safeJsonLd, markdownToHtml, sanitizeDatelineByScope, extractCleanArticleText } from '@/lib/sanitize';
import { SITE_URL, SITE_NAME, SITE_SHORT_NAME, DEFAULT_LOCALE } from '@/lib/config';
import { getTemplateTheme, type TemplateId } from '@/lib/templates';
import { SiteNavbar } from '@/components/navigation/SiteNavbar';
import { SiteFooter } from '@/components/navigation/SiteFooter';
import { getFooterContactSettings } from '@/lib/contact';
import { getDistrictDisplayName, getCategorySlug } from '@/lib/taxonomy';
import { getBrandSettings } from '@/lib/brand';
import { getNavbarSettings } from '@/lib/navbar';
import { getTelemetrySettings } from '@/lib/telemetry';
import { ArticleReadingDesk } from '@/components/article/ArticleReadingDesk';

interface ArticlePageProps {
  params: Promise<{
    lang: string;
    category: string;
    slug: string;
  }>;
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const supabase = createServerAnonClient();
  const brandSettings = await getBrandSettings(supabase);

  const { data: article } = await supabase
    .from('articles')
    .select('title, excerpt, featured_image_url, category, district, published_at, updated_at, author_display_name, article_translations(title, excerpt, language_code)')
    .eq('slug', resolvedParams.slug)
    .maybeSingle();

  if (!article) {
    return {
      title: `Article Not Found | ${brandSettings.name || 'KJCPL'}`,
      description: 'The requested article could not be found or has not been published yet.',
    };
  }

  let title = article.title;
  let excerpt = article.excerpt || undefined;

  if (resolvedParams.lang && resolvedParams.lang !== 'en') {
    const translation = article.article_translations?.find((t: { language_code: string, title: string, excerpt: string | null }) => t.language_code === resolvedParams.lang);
    if (translation) {
      title = translation.title;
      excerpt = translation.excerpt || undefined;
    }
  }

  const categorySlug = getCategorySlug(article.category);
  const canonicalRoutePrefix = resolvedParams.lang ? `/${resolvedParams.lang}` : '/en';
  const canonicalUrl = `${SITE_URL}${canonicalRoutePrefix}/${categorySlug}/${resolvedParams.slug}`;
  const authorCleanName = (article.author_display_name || `${brandSettings.name} Bureau`).replace(/\bKJIN\b/gi, 'KJCPL');

  const keywords = [
    article.category,
    article.district ? getDistrictDisplayName(article.district) : null,
    'Jammu and Kashmir',
    'Kashmir News',
    'Breaking News',
    'KJCPL',
    'KJCPL News Network',
    'Chenab Valley',
    'Pir Panjal',
    'India News',
  ].filter(Boolean) as string[];

  return {
    metadataBase: new URL(SITE_URL),
    title: `${title} | ${brandSettings.name}`,
    description: excerpt,
    keywords,
    authors: [{ name: authorCleanName, url: `${SITE_URL}/en` }],
    creator: `${brandSettings.name} Newsroom`,
    publisher: brandSettings.full_name,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    openGraph: {
      title: title,
      description: excerpt,
      url: canonicalUrl,
      siteName: brandSettings.full_name,
      locale: DEFAULT_LOCALE,
      type: 'article',
      publishedTime: article.published_at || undefined,
      modifiedTime: article.updated_at || undefined,
      authors: [authorCleanName],
      section: article.category,
      tags: keywords,
      images: article.featured_image_url
        ? [
            {
              url: article.featured_image_url,
              alt: article.title,
              width: 1200,
              height: 630,
            },
          ]
        : [
            {
              url: `${SITE_URL}/kcpjln-wide-banner.webp`,
              alt: brandSettings.full_name,
              width: 1200,
              height: 630,
            },
          ],
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: excerpt,
      images: article.featured_image_url ? [article.featured_image_url] : [`${SITE_URL}/kcpjln-wide-banner.webp`],
      creator: '@kjcpl_news',
      site: '@kjcpl_news',
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const resolvedParams = await params;
  const supabase = createServerAnonClient();

  // Note: RLS ensures we only get rows where status = 'published'
  const { data: article, error } = await supabase
    .from('articles')
    .select('*, article_translations(title, excerpt, content, language_code)')
    .eq('slug', resolvedParams.slug)
    .maybeSingle();

  if (error || !article) {
    notFound();
  }

  // Canonical URL redirect if category in path does not match database canonical slug
  const articleCategorySlug = getCategorySlug(article.category);
  const rawParamCategory = decodeURIComponent(resolvedParams.category || '').trim();
  const canonicalRoutePrefix = resolvedParams.lang ? `/${resolvedParams.lang}` : '/en';

  if (rawParamCategory !== articleCategorySlug) {
    redirect(`${canonicalRoutePrefix}/${articleCategorySlug}/${article.slug}`);
  }

  const [brandSettings, navbarSettings, contactSettings, telemetry] = await Promise.all([
    getBrandSettings(supabase),
    getNavbarSettings(supabase),
    getFooterContactSettings(supabase),
    getTelemetrySettings(supabase),
  ]);

  const langPrefix = resolvedParams.lang && resolvedParams.lang !== 'en' ? `/${resolvedParams.lang}` : '';

  const displayArticle = { ...article };
  if (resolvedParams.lang && resolvedParams.lang !== 'en') {
    const translation = article.article_translations?.find((t: { language_code: string, title: string, excerpt: string | null, content: string }) => t.language_code === resolvedParams.lang);
    if (translation) {
      displayArticle.title = translation.title;
      displayArticle.excerpt = translation.excerpt;
      displayArticle.content = translation.content;
    }
  }

  // Fetch Related Stories (same category) and Trending Stories (across corridors)
  const [relatedResult, trendingResult] = await Promise.all([
    Promise.resolve(
      supabase
        .from('articles')
        .select('id, slug, title, category, published_at, featured_image_url')
        .eq('status', 'published')
        .eq('category', article.category)
        .neq('id', article.id)
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(3)
    ).catch(() => ({ data: [] })),
    Promise.resolve(
      supabase
        .from('articles')
        .select('id, slug, title, category, district, published_at')
        .eq('status', 'published')
        .neq('id', article.id)
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(5)
    ).catch(() => ({ data: [] })),
  ]);
  const relatedArticles = relatedResult.data || [];
  const trendingArticles = trendingResult.data || [];

  // Generate robust, structured JSON-LD for news article schema
  const articleCanonicalUrl = `${SITE_URL}${canonicalRoutePrefix}/${articleCategorySlug}/${displayArticle.slug}`;

  const rawPublished = displayArticle.published_at || displayArticle.updated_at;
  const parsedPublished = rawPublished ? new Date(rawPublished) : new Date();
  const datePublished = !isNaN(parsedPublished.getTime()) ? parsedPublished.toISOString() : new Date().toISOString();

  const rawModified = displayArticle.updated_at || displayArticle.published_at;
  const parsedModified = rawModified ? new Date(rawModified) : parsedPublished;
  const dateModified = !isNaN(parsedModified.getTime()) ? parsedModified.toISOString() : datePublished;

  const authorCleanName = (article.author_display_name || `${brandSettings.name} Bureau`).replace(/\bKJIN\b/gi, 'KJCPL');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': articleCanonicalUrl,
    },
    headline: displayArticle.title,
    description: displayArticle.excerpt || undefined,
    image: displayArticle.featured_image_url
      ? [displayArticle.featured_image_url]
      : [`${SITE_URL}/kcpjln-wide-banner.webp`],
    datePublished,
    dateModified,
    articleSection: displayArticle.category,
    inLanguage: resolvedParams.lang || 'en',
    isAccessibleForFree: true,
    copyrightYear: new Date(datePublished).getFullYear(),
    copyrightHolder: {
      '@type': 'NewsMediaOrganization',
      name: brandSettings.full_name,
      url: SITE_URL,
    },
    author: [
      {
        '@type': 'Person',
        name: authorCleanName,
        url: `${SITE_URL}/en`,
        jobTitle: 'Senior Bureau Correspondent',
      },
    ],
    publisher: {
      '@type': 'NewsMediaOrganization',
      name: brandSettings.full_name,
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: brandSettings.logo_url || `${SITE_URL}/kcpjln-symbol.webp`,
        width: 512,
        height: 512,
      },
      publishingPrinciples: `${SITE_URL}/en`,
    },
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `${SITE_URL}/en`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: displayArticle.category || 'News',
        item: `${SITE_URL}/en/category/${articleCategorySlug}`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: displayArticle.title,
        item: articleCanonicalUrl,
      },
    ],
  };

  // Fetch Active Template Setting to align theme & background colors
  const { data: settingRow } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'active_template')
    .maybeSingle();

  const dbTemplateId = (settingRow?.value as { template_id?: string } | null)?.template_id as TemplateId | undefined;
  const theme = getTemplateTheme(dbTemplateId);

  // Extract clean text, enforce accurate geographic dateline by category, and sanitize article HTML using strict allowlist before rendering
  const cleanedRawText = extractCleanArticleText(displayArticle.content || '');
  const datelineCorrectedContent = sanitizeDatelineByScope(cleanedRawText, displayArticle.category);
  const rawHtml = markdownToHtml(datelineCorrectedContent);
  const sanitizedContent = sanitizeArticleHtml(rawHtml);
  const sanitizedExcerpt = sanitizeDatelineByScope(extractCleanArticleText(displayArticle.excerpt || ''), displayArticle.category);

  return (
    <>
      {/* Safely serialized JSON-LD preventing script injection escaping */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }}
      />
      <ViewTracker articleId={article.id} />
      
      <div className={`min-h-screen ${theme.pageBgClass} flex flex-col justify-between`}>
        <SiteNavbar
          lang={resolvedParams.lang}
          theme={theme}
          activeCategory={displayArticle.category.toLowerCase()}
          navbarSettings={navbarSettings}
        />

        <main className="flex-1">
          <ArticleReadingDesk
            article={{
              ...displayArticle,
              excerpt: sanitizedExcerpt,
              content: sanitizedContent,
            }}
            brandName={brandSettings.name || SITE_SHORT_NAME}
            brandFullName={brandSettings.full_name || SITE_NAME}
            langPrefix={langPrefix}
            districtName={displayArticle.district ? getDistrictDisplayName(displayArticle.district) : undefined}
            relatedArticles={relatedArticles || []}
            trendingArticles={trendingArticles || []}
            telemetry={telemetry}
          />
        </main>

        <SiteFooter
          lang={resolvedParams.lang}
          theme={theme}
          contactSettings={contactSettings}
          brandSettings={brandSettings}
        />
      </div>
    </>
  );
}
