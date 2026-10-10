import { notFound, redirect } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { createServerAnonClient } from '@/lib/supabase-server';
import { ViewTracker } from '@/components/ViewTracker';
import { sanitizeArticleHtml, safeJsonLd } from '@/lib/sanitize';
import { SITE_URL, SITE_NAME, SITE_SHORT_NAME, DEFAULT_LOCALE } from '@/lib/config';

interface ArticlePageProps {
  params: Promise<{
    category: string;
    slug: string;
  }>;
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const supabase = createServerAnonClient();
  const { data: article } = await supabase
    .from('articles')
    .select('title, excerpt, featured_image_url, category, published_at, updated_at, author_display_name')
    .eq('slug', resolvedParams.slug)
    .single();

  if (!article) {
    return {
      title: 'Article Not Found | KJIN',
      robots: { index: false, follow: false },
    };
  }

  const canonicalUrl = `${SITE_URL}/${article.category.toLowerCase()}/${resolvedParams.slug}`;

  return {
    metadataBase: new URL(SITE_URL),
    title: `${article.title} | ${SITE_SHORT_NAME}`,
    description: article.excerpt || undefined,
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
      title: article.title,
      description: article.excerpt || undefined,
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
      title: article.title,
      description: article.excerpt || undefined,
      images: article.featured_image_url ? [article.featured_image_url] : [],
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const resolvedParams = await params;
  const supabase = createServerAnonClient();

  // Note: RLS ensures we only get rows where status = 'published'
  const { data: article, error } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', resolvedParams.slug)
    .single();

  if (error || !article) {
    notFound();
  }

  // Canonical URL redirect if category in path does not match database
  if (article.category.toLowerCase() !== resolvedParams.category.toLowerCase()) {
    redirect(`/${article.category.toLowerCase()}/${article.slug}`);
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
  const articleCanonicalUrl = `${SITE_URL}/${article.category.toLowerCase()}/${article.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': articleCanonicalUrl,
    },
    headline: article.title,
    description: article.excerpt || undefined,
    image: article.featured_image_url ? [article.featured_image_url] : [],
    datePublished: new Date(article.published_at || article.updated_at).toISOString(),
    dateModified: new Date(article.updated_at).toISOString(),
    articleSection: article.category,
    inLanguage: 'en',
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

  // Sanitize article HTML using strict allowlist before rendering to prevent stored XSS
  const sanitizedContent = sanitizeArticleHtml(article.content || '');

  return (
    <>
      {/* Safely serialized JSON-LD preventing script injection escaping */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      <ViewTracker articleId={article.id} />
      
      <article className="max-w-4xl mx-auto px-4 py-8">
        <header className="mb-8">
          <div className="flex items-center text-sm text-slate-500 mb-4 gap-4 flex-wrap">
            <Link
              href={`/category/${article.category.toLowerCase()}`}
              className="uppercase tracking-wider font-semibold text-blue-600 hover:text-blue-800 transition"
            >
              {article.category}
            </Link>
            {article.district && (
              <>
                <span>&bull;</span>
                <Link
                  href={`/district/${article.district.toLowerCase()}`}
                  className="font-medium hover:text-slate-800 transition"
                >
                  {article.district}
                </Link>
              </>
            )}
            <span>&bull;</span>
            <time dateTime={article.published_at || article.updated_at}>
              {new Date(article.published_at || article.updated_at).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 leading-tight mb-6">
            {article.title}
          </h1>

          {article.excerpt && (
            <p className="text-xl text-slate-600 mb-6 leading-relaxed font-light">
              {article.excerpt}
            </p>
          )}

          <div className="flex items-center gap-3 border-b border-slate-200 pb-6">
            <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-bold text-sm">
              {article.author_display_name ? article.author_display_name[0]?.toUpperCase() : 'K'}
            </div>
            <div>
              <div className="font-medium text-slate-900">
                {article.author_display_name || 'KJIN Desk'}
              </div>
              {article.source_name && (
                <div className="text-sm text-slate-500">
                  Source:{' '}
                  {article.source_url ? (
                    <a
                      href={article.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-blue-600"
                    >
                      {article.source_name}
                    </a>
                  ) : (
                    article.source_name
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {article.featured_image_url && (
          <figure className="mb-10 relative w-full h-[320px] md:h-[500px] overflow-hidden rounded-xl shadow-sm bg-slate-100">
            <Image
              src={article.featured_image_url}
              alt={article.title}
              fill
              priority
              sizes="(max-width: 896px) 100vw, 896px"
              className="object-cover"
            />
          </figure>
        )}

        <div className="prose prose-lg prose-blue max-w-none text-slate-800">
          {/* Strictly sanitized HTML rendering */}
          <div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
        </div>

        {relatedArticles && relatedArticles.length > 0 && (
          <aside className="mt-20 pt-10 border-t border-slate-200">
            <h2 className="text-2xl font-bold border-b-2 border-slate-900 pb-2 mb-8 inline-block">
              Related Stories
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {relatedArticles.map((related) => (
                <Link
                  key={related.id}
                  href={`/${related.category.toLowerCase()}/${related.slug}`}
                  className="group block"
                >
                  {related.featured_image_url ? (
                    <div className="relative w-full h-40 mb-3 overflow-hidden rounded-lg bg-slate-200">
                      <Image
                        src={related.featured_image_url}
                        alt={related.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-2 bg-blue-200 group-hover:bg-blue-400 transition mb-3 rounded-full" />
                  )}
                  <div className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-1">
                    {related.category} &bull; {new Date(related.published_at).toLocaleDateString()}
                  </div>
                  <h3 className="font-bold leading-tight group-hover:text-blue-700 transition">
                    {related.title}
                  </h3>
                </Link>
              ))}
            </div>
          </aside>
        )}
      </article>
    </>
  );
}
