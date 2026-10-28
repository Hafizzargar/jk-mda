import { notFound, redirect } from 'next/navigation';
import { Metadata } from 'next';
import { createServerAnonClient } from '@/lib/supabase-server';
import { ViewTracker } from '@/components/ViewTracker';
import { sanitizeArticleHtml, safeJsonLd } from '@/lib/sanitize';
import { SITE_URL, SITE_NAME, SITE_SHORT_NAME, DEFAULT_LOCALE } from '@/lib/config';
import { getTemplateTheme, type TemplateId } from '@/lib/templates';
import { SiteNavbar } from '@/components/navigation/SiteNavbar';
import { SiteFooter } from '@/components/navigation/SiteFooter';
import { getFooterContactSettings } from '@/lib/contact';
import { getDistrictDisplayName } from '@/lib/taxonomy';
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
    .select('title, excerpt, featured_image_url, category, published_at, updated_at, author_display_name, article_translations(title, excerpt, language_code)')
    .eq('slug', resolvedParams.slug)
    .single();

  if (!article) {
    return {
      title: `Article Not Found | ${brandSettings.name}`,
      robots: { index: false, follow: false },
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

  const canonicalUrl = `${SITE_URL}/${resolvedParams.lang === 'en' ? '' : `${resolvedParams.lang}/`}${article.category.toLowerCase()}/${resolvedParams.slug}`;

  return {
    metadataBase: new URL(SITE_URL),
    title: `${title} | ${brandSettings.name}`,
    description: excerpt,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
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
      authors: [article.author_display_name || `${brandSettings.name} Desk`],
      section: article.category,
      images: article.featured_image_url
        ? [
            {
              url: article.featured_image_url,
              alt: article.title,
              width: 1200,
              height: 630,
            },
          ]
        : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: title,
      description: excerpt,
      images: article.featured_image_url ? [article.featured_image_url] : [],
    },
  };
}

function markdownToHtml(raw: string): string {
  if (!raw) return '';
  if (/<(p|h[1-6]|div|article|section)/i.test(raw)) {
    return raw;
  }
  const blocks = raw.split(/\n\s*\n/);
  const htmlBlocks = blocks.map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('### ')) {
      return `<h3>${trimmed.slice(4).trim()}</h3>`;
    }
    if (trimmed.startsWith('## ')) {
      return `<h2>${trimmed.slice(3).trim()}</h2>`;
    }
    if (trimmed.startsWith('# ')) {
      return `<h1>${trimmed.slice(2).trim()}</h1>`;
    }
    if (trimmed.startsWith('> ')) {
      return `<blockquote>${trimmed.slice(2).trim()}</blockquote>`;
    }
    return `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`;
  });
  return htmlBlocks.filter(Boolean).join('\n\n');
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const resolvedParams = await params;
  const supabase = createServerAnonClient();
  const [brandSettings, navbarSettings, contactSettings, telemetry] = await Promise.all([
    getBrandSettings(supabase),
    getNavbarSettings(supabase),
    getFooterContactSettings(supabase),
    getTelemetrySettings(supabase),
  ]);

  // Note: RLS ensures we only get rows where status = 'published'
  const { data: article, error } = await supabase
    .from('articles')
    .select('*, article_translations(title, excerpt, content, language_code)')
    .eq('slug', resolvedParams.slug)
    .single();

  if (error || !article) {
    notFound();
  }

  // Canonical URL redirect if category in path does not match database
  if (article.category.toLowerCase() !== resolvedParams.category.toLowerCase()) {
    redirect(`/${resolvedParams.lang === 'en' ? '' : `${resolvedParams.lang}/`}${article.category.toLowerCase()}/${article.slug}`);
  }

  const displayArticle = { ...article };
  if (resolvedParams.lang && resolvedParams.lang !== 'en') {
    const translation = article.article_translations?.find((t: { language_code: string, title: string, excerpt: string | null, content: string }) => t.language_code === resolvedParams.lang);
    if (translation) {
      displayArticle.title = translation.title;
      displayArticle.excerpt = translation.excerpt;
      displayArticle.content = translation.content;
    }
  }

  // Fetch Related Stories (prioritize same category, excluding current article)
  const { data: relatedArticles } = await supabase
    .from('articles')
    .select('id, slug, title, category, published_at, featured_image_url')
    .eq('status', 'published')
    .eq('category', article.category)
    .neq('id', article.id)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(3);

  // Generate robust, structured JSON-LD for news article schema
  const articleCanonicalUrl = `${SITE_URL}/${resolvedParams.lang === 'en' ? '' : `${resolvedParams.lang}/`}${displayArticle.category.toLowerCase()}/${displayArticle.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': articleCanonicalUrl,
    },
    headline: displayArticle.title,
    description: displayArticle.excerpt || undefined,
    image: displayArticle.featured_image_url ? [displayArticle.featured_image_url] : [],
    datePublished: new Date(displayArticle.published_at || displayArticle.updated_at).toISOString(),
    dateModified: new Date(displayArticle.updated_at).toISOString(),
    articleSection: displayArticle.category,
    inLanguage: resolvedParams.lang,
    author: [
      {
        '@type': 'Person',
        name: article.author_display_name || `${brandSettings.name} Desk`,
      },
    ],
    publisher: {
      '@type': 'Organization',
      name: brandSettings.full_name,
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: brandSettings.logo_url || `${SITE_URL}/logo.png`,
      },
    },
  };

  // Fetch Active Template Setting to align theme & background colors
  const { data: settingRow } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'active_template')
    .maybeSingle();

  const dbTemplateId = (settingRow?.value as { template_id?: string } | null)?.template_id as TemplateId | undefined;
  const theme = getTemplateTheme(dbTemplateId);

  // Convert markdown blocks and sanitize article HTML using strict allowlist before rendering to prevent stored XSS
  const rawHtml = markdownToHtml(displayArticle.content || '');
  const sanitizedContent = sanitizeArticleHtml(rawHtml);

  const langPrefix = resolvedParams.lang === 'en' ? '' : `/${resolvedParams.lang}`;

  return (
    <>
      {/* Safely serialized JSON-LD preventing script injection escaping */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
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
              content: sanitizedContent,
            }}
            brandName={brandSettings.name || SITE_SHORT_NAME}
            brandFullName={brandSettings.full_name || SITE_NAME}
            langPrefix={langPrefix}
            districtName={displayArticle.district ? getDistrictDisplayName(displayArticle.district) : undefined}
            relatedArticles={relatedArticles || []}
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
