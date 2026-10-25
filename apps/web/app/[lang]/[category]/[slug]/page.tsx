import { notFound, redirect } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { createServerAnonClient } from '@/lib/supabase-server';
import { ViewTracker } from '@/components/ViewTracker';
import { sanitizeArticleHtml, safeJsonLd } from '@/lib/sanitize';
import { SITE_URL, SITE_NAME, SITE_SHORT_NAME, DEFAULT_LOCALE } from '@/lib/config';
import { getTemplateTheme, type TemplateId } from '@/lib/templates';
import { SiteNavbar } from '@/components/navigation/SiteNavbar';
import { SiteFooter } from '@/components/navigation/SiteFooter';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { getFooterContactSettings } from '@/lib/contact';
import { getCustomAdsSettings } from '@/lib/ads';
import { InArticleAd } from '@/components/ads/InArticleAd';
import { LeaderboardAd } from '@/components/ads/LeaderboardAd';
import { SidebarAd } from '@/components/ads/SidebarAd';
import { NewsletterForm } from '@/components/NewsletterForm';
import { applyTranslations } from '@/lib/i18n';
import { getDistrictDisplayName } from '@/lib/taxonomy';

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
  const { data: article } = await supabase
    .from('articles')
    .select('title, excerpt, featured_image_url, category, published_at, updated_at, author_display_name, article_translations(title, excerpt, language_code)')
    .eq('slug', resolvedParams.slug)
    .single();

  if (!article) {
    return {
      title: 'Article Not Found | KJIN',
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
    title: `${title} | ${SITE_SHORT_NAME}`,
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
      siteName: SITE_NAME,
      locale: DEFAULT_LOCALE,
      type: 'article',
      publishedTime: article.published_at || undefined,
      modifiedTime: article.updated_at || undefined,
      authors: [article.author_display_name || 'KJIN Desk'],
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

function splitContentForMidArticleAd(html: string): { before: string; after: string | null } {
  if (!html) return { before: '', after: null };
  const closingTag = '</p>';
  const rawParts = html.split(closingTag);
  const trimmedParts = rawParts.map((p) => p.trim()).filter(Boolean);

  if (trimmedParts.length >= 3) {
    const splitIdx = Math.min(2, Math.floor(trimmedParts.length / 2));
    const before = trimmedParts.slice(0, splitIdx).map((p) => p + closingTag).join('\n\n');
    const after = trimmedParts.slice(splitIdx).map((p) => p + closingTag).join('\n\n');
    return { before, after };
  }

  if (trimmedParts.length === 2) {
    const before = trimmedParts[0] + closingTag;
    const after = trimmedParts[1] + closingTag;
    return { before, after };
  }

  return { before: html, after: null };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const resolvedParams = await params;
  const supabase = createServerAnonClient();

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
        name: article.author_display_name || 'KJIN Desk',
      },
    ],
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/logo.png`,
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
  const contactSettings = await getFooterContactSettings(supabase);
  const adsSettings = await getCustomAdsSettings(supabase);
  const nativeAd = adsSettings.monetization_enabled ? adsSettings.placements.find(p => p.id === 'in_article_native' && p.enabled) : null;
  const bottomAd = adsSettings.monetization_enabled ? adsSettings.placements.find(p => p.id === 'leaderboard_top' && p.enabled) : null;
  const sidebarAd = adsSettings.monetization_enabled ? adsSettings.placements.find(p => p.id === 'sidebar_banner' && p.enabled) : null;

  // Fetch Trending / Most Read Articles for Sidebar
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  let { data: trendingArticlesRaw } = await supabase
    .from('articles')
    .select('id, slug, title, category, published_at, view_count, article_translations(title, language_code)')
    .eq('status', 'published')
    .gte('published_at', thirtyDaysAgo)
    .order('view_count', { ascending: false })
    .limit(5);

  if (!trendingArticlesRaw || trendingArticlesRaw.length === 0) {
    const { data: fallbackTrending } = await supabase
      .from('articles')
      .select('id, slug, title, category, published_at, view_count, article_translations(title, language_code)')
      .eq('status', 'published')
      .order('view_count', { ascending: false })
      .limit(5);
    trendingArticlesRaw = fallbackTrending || [];
  }
  const trendingArticles = applyTranslations(trendingArticlesRaw || [], resolvedParams.lang);

  // Convert markdown blocks and sanitize article HTML using strict allowlist before rendering to prevent stored XSS
  const rawHtml = markdownToHtml(displayArticle.content || '');
  const sanitizedContent = sanitizeArticleHtml(rawHtml);

  const langPrefix = resolvedParams.lang === 'en' ? '' : `/${resolvedParams.lang}`;
  const breadcrumbs = [
    { label: displayArticle.category, href: `${langPrefix}/category/${displayArticle.category.toLowerCase()}` },
    ...(displayArticle.district
      ? [{ label: getDistrictDisplayName(displayArticle.district), href: `${langPrefix}/district/${displayArticle.district.toLowerCase()}` }]
      : []),
    { label: displayArticle.title, current: true },
  ];

  return (
    <>
      {/* Safely serialized JSON-LD preventing script injection escaping */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      <ViewTracker articleId={article.id} />
      
      <main className={`min-h-screen ${theme.pageBgClass} ${theme.textPrimaryClass} ${theme.fontFamilyClass} ${theme.selectionClass} flex flex-col justify-between`}>
        <div>
          <SiteNavbar
            lang={resolvedParams.lang}
            theme={theme}
            activeCategory={displayArticle.category.toLowerCase()}
          />

          <div className="max-w-7xl mx-auto px-4 md:px-8 pt-4 pb-2">
            <Breadcrumbs items={breadcrumbs} lang={resolvedParams.lang} theme={theme} />
          </div>

          <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
            <article className={`lg:col-span-8 ${theme.cardBgClass} rounded-2xl ${theme.cardBorderClass} shadow-sm p-6 sm:p-8 h-fit`}>
        <header className="mb-8">
          <div className={`flex items-center text-sm ${theme.textMutedClass} mb-4 gap-4 flex-wrap`}>
            <Link
              href={`/${resolvedParams.lang === 'en' ? '' : `${resolvedParams.lang}/`}category/${displayArticle.category.toLowerCase()}`}
              className={`uppercase tracking-wider font-semibold ${theme.accentTextClass} hover:opacity-80 transition`}
            >
              {displayArticle.category}
            </Link>
            {displayArticle.district && (
              <>
                <span>&bull;</span>
                <Link
                  href={`/${resolvedParams.lang === 'en' ? '' : `${resolvedParams.lang}/`}district/${displayArticle.district.toLowerCase()}`}
                  className={`uppercase tracking-wider font-semibold ${theme.accentTextClass} hover:opacity-80 transition`}
                >
                  {getDistrictDisplayName(displayArticle.district).toUpperCase()}
                </Link>
              </>
            )}
            <span>&bull;</span>
            <time dateTime={displayArticle.published_at || displayArticle.updated_at}>
              {new Date(displayArticle.published_at || displayArticle.updated_at).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          </div>

          <h1 className={`text-4xl md:text-5xl font-extrabold ${theme.textPrimaryClass} leading-tight mb-6`}>
            {displayArticle.title}
          </h1>

          {displayArticle.excerpt && (
            <p className={`text-xl ${theme.textSecondaryClass} mb-6 leading-relaxed font-light`}>
              {displayArticle.excerpt}
            </p>
          )}

          <div className={`flex items-center justify-between border-b ${theme.borderClass} pb-6`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${theme.subtleBgClass} rounded-full flex items-center justify-center ${theme.textSecondaryClass} font-bold text-sm border ${theme.borderMutedClass}`}>
                {displayArticle.author_display_name ? displayArticle.author_display_name[0]?.toUpperCase() : 'K'}
              </div>
              <div>
                <div className={`font-medium ${theme.textPrimaryClass}`}>
                  {displayArticle.author_display_name || 'KJIN Desk'}
                </div>
                {displayArticle.source_name && (
                  <div className={`text-sm ${theme.textMutedClass}`}>
                    Source:{' '}
                    {displayArticle.source_url ? (
                      <a
                        href={displayArticle.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`underline ${theme.accentTextClass}`}
                      >
                        {displayArticle.source_name}
                      </a>
                    ) : (
                      displayArticle.source_name
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <a
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(articleCanonicalUrl)}&text=${encodeURIComponent(displayArticle.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`${theme.textMutedClass} hover:${theme.accentTextClass} transition`}
                aria-label="Share on Twitter"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                </svg>
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleCanonicalUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`${theme.textMutedClass} hover:${theme.accentTextClass} transition`}
                aria-label="Share on Facebook"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                </svg>
              </a>
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(displayArticle.title + ' ' + articleCanonicalUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`${theme.textMutedClass} hover:text-green-500 transition`}
                aria-label="Share on WhatsApp"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </a>
            </div>
          </div>
        </header>

        {displayArticle.featured_image_url && (
          <figure className={`mb-10 relative w-full h-[320px] md:h-[500px] overflow-hidden rounded-xl shadow-sm ${theme.subtleBgClass}`}>
            <Image
              src={displayArticle.featured_image_url}
              alt={displayArticle.title}
              fill
              priority
              sizes="(max-width: 896px) 100vw, 896px"
              className="object-cover"
            />
          </figure>
        )}

        {(() => {
          const { before, after } = splitContentForMidArticleAd(sanitizedContent);
          return (
            <div className={`${theme.proseClass} ${theme.isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              {/* First Part of Article Content */}
              <div dangerouslySetInnerHTML={{ __html: before }} />

              {/* In-Article Mid-Reading Native Sponsored Dispatch */}
              {nativeAd && (
                <div className="my-8 not-prose">
                  <InArticleAd ad={nativeAd} />
                </div>
              )}

              {/* Second Part of Article Content */}
              {after && <div dangerouslySetInnerHTML={{ __html: after }} />}
            </div>
          );
        })()}

        {relatedArticles && relatedArticles.length > 0 && (
          <aside className={`mt-20 pt-10 border-t ${theme.borderClass}`}>
            <h2 className={`text-2xl font-bold border-b-2 ${theme.borderClass} pb-2 mb-8 inline-block ${theme.textPrimaryClass}`}>
              Related Stories
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {relatedArticles.map((related) => (
                <Link
                  key={related.id}
                  href={`/${resolvedParams.lang === 'en' ? '' : `${resolvedParams.lang}/`}${related.category.toLowerCase()}/${related.slug}`}
                  className={`group block p-3.5 rounded-xl ${theme.cardBgClass} ${theme.cardBorderClass} ${theme.cardHoverClass} transition`}
                >
                  {related.featured_image_url ? (
                    <div className={`relative w-full h-40 mb-3 overflow-hidden rounded-lg ${theme.subtleBgClass}`}>
                      <Image
                        src={related.featured_image_url}
                        alt={related.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                  ) : (
                    <div className={`w-full h-2 ${theme.accentBgClass} mb-3 rounded-full opacity-60 group-hover:opacity-100 transition`} />
                  )}
                  <div className={`text-[10px] font-bold uppercase tracking-widest ${theme.accentTextClass} mb-1`}>
                    {related.category} &bull; {new Date(related.published_at).toLocaleDateString()}
                  </div>
                  <h3 className={`font-bold leading-tight ${theme.textPrimaryClass} group-hover:opacity-80 transition line-clamp-2`}>
                    {related.title}
                  </h3>
                </Link>
              ))}
            </div>
          </aside>
        )}
      </article>

      {/* Right 4-column Rail: The Ledger (Most Read) + Custom Ads + Newsletter */}
      <aside className="lg:col-span-4 space-y-8">
        {/* The Ledger / Trending */}
        <div className={`p-6 rounded-2xl ${theme.cardBgClass} ${theme.cardBorderClass} shadow-sm`}>
          <h3 className="text-sm font-sans font-bold uppercase tracking-widest text-slate-900 dark:text-white border-b-2 border-slate-900 dark:border-white pb-2 mb-6 flex items-center justify-between">
            <span>The Ledger</span>
            <span className={`text-xs font-normal ${theme.textMutedClass}`}>Most Read</span>
          </h3>

          <ol className={`divide-y ${theme.borderClass}`}>
            {trendingArticles.map((tArticle: { id: string; slug: string; category: string; title: string; view_count?: number }, idx: number) => (
              <li key={tArticle.id} className="py-4 first:pt-0">
                <Link
                  href={`/${resolvedParams.lang === 'en' ? '' : `${resolvedParams.lang}/`}${tArticle.category.toLowerCase()}/${tArticle.slug}`}
                  className="group flex gap-4 items-baseline"
                >
                  <span className="text-2xl font-sans font-bold text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition">
                    {idx + 1}.
                  </span>
                  <div>
                    <span className={`text-[10px] font-sans font-bold uppercase tracking-widest ${theme.textMutedClass}`}>
                      {tArticle.category}
                    </span>
                    <h4 className={`text-base font-bold leading-snug ${theme.textPrimaryClass} group-hover:opacity-80 transition line-clamp-2`}>
                      {tArticle.title}
                    </h4>
                    {tArticle.view_count ? (
                      <p className="text-[11px] font-sans text-slate-400 mt-1">
                        {tArticle.view_count.toLocaleString()} readers
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </div>

        {/* Morning Intelligence Brief */}
        <div className={`p-6 rounded-2xl ${theme.subtleBgClass} ${theme.borderClass} border`}>
          <div className={`text-xs font-bold uppercase tracking-widest ${theme.accentTextClass} mb-1`}>
            KJIN Broadsheet Edition
          </div>
          <h4 className={`text-lg font-bold font-serif ${theme.textPrimaryClass} mb-2`}>
            Morning Intelligence Brief
          </h4>
          <p className={`text-xs ${theme.textMutedClass} mb-4 leading-relaxed`}>
            Delivered daily to public servants, civil engineers, and citizens across Jammu and Kashmir.
          </p>
          <NewsletterForm />
        </div>

        {/* Sticky Right Rail Custom Sponsor Ad - Pinned last so nothing scrolls behind it */}
        {(sidebarAd || bottomAd) && (
          <div className="sticky top-28 z-10 self-start">
            <SidebarAd ad={sidebarAd || bottomAd!} />
          </div>
        )}
      </aside>
    </div>
  </div>

  <SiteFooter lang={resolvedParams.lang} theme={theme} contactSettings={contactSettings} />
</main>
    </>
  );
}
