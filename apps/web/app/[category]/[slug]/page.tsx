import { notFound, redirect } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import { createServerAnonClient } from '@/lib/supabase-server';
import { ViewTracker } from '@/components/ViewTracker';

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
    .select('title, excerpt, featured_image_url')
    .eq('slug', resolvedParams.slug)
    .single();

  if (!article) {
    return { title: 'Not Found' };
  }

  return {
    title: `${article.title} | KJIN`,
    description: article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt || undefined,
      images: article.featured_image_url ? [{ url: article.featured_image_url }] : [],
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

  // Canonical URL redirect
  if (article.category.toLowerCase() !== resolvedParams.category.toLowerCase()) {
    redirect(`/${article.category.toLowerCase()}/${article.slug}`);
  }

  // Fetch Related Stories (same category, excluding current)
  const { data: relatedArticles } = await supabase
    .from('articles')
    .select('id, slug, title, category, published_at, featured_image_url')
    .eq('category', article.category)
    .neq('id', article.id)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(3);

  // Generate JSON-LD
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    image: article.featured_image_url ? [article.featured_image_url] : [],
    datePublished: new Date(article.published_at || article.updated_at).toISOString(),
    dateModified: new Date(article.updated_at).toISOString(),
    author: [{
      '@type': 'Person',
      name: article.author_display_name || 'KJIN Desk',
    }],
    publisher: {
      '@type': 'Organization',
      name: 'KJIN',
      logo: {
        '@type': 'ImageObject',
        url: 'https://kjin.news/logo.png'
      }
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ViewTracker articleId={article.id} />
      <article className="max-w-4xl mx-auto px-4 py-8">
      <header className="mb-8">
        <div className="flex items-center text-sm text-gray-500 mb-4 gap-4">
          <span className="uppercase tracking-wider font-semibold text-blue-600">
            {article.category}
          </span>
          {article.district && (
            <>
              <span>&bull;</span>
              <span>{article.district}</span>
            </>
          )}
          <span>&bull;</span>
          <time dateTime={article.published_at || article.updated_at}>
            {new Date(article.published_at || article.updated_at).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </time>
        </div>
        
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
          {article.title}
        </h1>
        
        {article.excerpt && (
          <p className="text-xl text-gray-600 mb-6 leading-relaxed font-light">
            {article.excerpt}
          </p>
        )}

        <div className="flex items-center gap-3 border-b pb-6">
          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 font-bold">
            {article.author_display_name ? article.author_display_name[0] : '?'}
          </div>
          <div>
            <div className="font-medium text-gray-900">{article.author_display_name || 'Anonymous'}</div>
            {article.source_name && (
              <div className="text-sm text-gray-500">Source: {article.source_name}</div>
            )}
          </div>
        </div>
      </header>

      {article.featured_image_url && (
        <figure className="mb-10">
          <img 
            src={article.featured_image_url} 
            alt={article.title}
            className="w-full h-auto rounded-xl object-cover shadow-sm max-h-[600px]"
          />
        </figure>
      )}

      <div className="prose prose-lg prose-blue max-w-none text-gray-800">
        {/* Placeholder for safe HTML rendering; assume content is trusted or pre-sanitized text */}
        <div dangerouslySetInnerHTML={{ __html: article.content || '' }} />
      </div>
      
      {relatedArticles && relatedArticles.length > 0 && (
        <aside className="mt-20 pt-10 border-t border-slate-200">
          <h2 className="text-2xl font-bold border-b-2 border-slate-900 pb-2 mb-8 inline-block">
            Related Stories
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {relatedArticles.map((related) => (
              <Link key={related.id} href={`/${related.category.toLowerCase()}/${related.slug}`} className="group block">
                {related.featured_image_url ? (
                  <div className="w-full h-40 mb-3 overflow-hidden rounded-lg bg-slate-200">
                    <img 
                      src={related.featured_image_url} 
                      alt={related.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
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
