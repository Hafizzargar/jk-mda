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

          <div className="flex items-center justify-between border-b border-slate-200 pb-6">
            <div className="flex items-center gap-3">
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

            <div className="flex items-center gap-3">
              <a
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(articleCanonicalUrl)}&text=${encodeURIComponent(article.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-blue-500 transition"
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
                className="text-slate-400 hover:text-blue-700 transition"
                aria-label="Share on Facebook"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                </svg>
              </a>
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(article.title + ' ' + articleCanonicalUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-green-500 transition"
                aria-label="Share on WhatsApp"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </a>
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
