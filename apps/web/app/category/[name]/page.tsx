import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Metadata } from 'next';
import { createServerAnonClient } from '@/lib/supabase-server';
import { isValidCategory, getCategoryDisplayName, NEWS_CATEGORIES } from '@/lib/taxonomy';
import { parsePageParam, getPaginationRange } from '@/lib/pagination';
import { SITE_URL, SITE_SHORT_NAME } from '@/lib/config';

interface CategoryPageProps {
  params: Promise<{
    name: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params, searchParams }: CategoryPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const categorySlug = resolvedParams.name.toLowerCase().trim();

  if (!isValidCategory(categorySlug)) {
    return {
      title: 'Category Not Found | KJIN',
      robots: { index: false, follow: false },
    };
  }

  const categoryName = getCategoryDisplayName(categorySlug);
  const categoryInfo = NEWS_CATEGORIES[categorySlug];
  const page = parsePageParam(resolvedSearchParams.page);
  const pageSuffix = page > 1 ? ` - Page ${page}` : '';
  const canonicalUrl = `${SITE_URL}/category/${categorySlug}${page > 1 ? `?page=${page}` : ''}`;

  return {
    metadataBase: new URL(SITE_URL),
    title: `${categoryName} News${pageSuffix} | ${SITE_SHORT_NAME}`,
    description: categoryInfo?.description || `Latest reporting and updates in ${categoryName} from KJIN.`,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: `${categoryName} News | ${SITE_SHORT_NAME}`,
      description: categoryInfo?.description,
      url: canonicalUrl,
      type: 'website',
    },
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const categorySlug = resolvedParams.name.toLowerCase().trim();

  // 1. Strict category validation against controlled taxonomy
  if (!isValidCategory(categorySlug)) {
    notFound();
  }

  const categoryName = getCategoryDisplayName(categorySlug);
  const categoryInfo = NEWS_CATEGORIES[categorySlug];
  
  // 2. Safe pagination parsing
  const page = parsePageParam(resolvedSearchParams.page);
  const { from, to, limit } = getPaginationRange(page, 12);

  const supabase = createServerAnonClient();

  // 3. Query articles with exact count
  const { data: articles, count } = await supabase
    .from('articles')
    .select('id, slug, title, excerpt, category, author_display_name, published_at, featured_image_url', { count: 'exact' })
    .ilike('category', categorySlug)
    .order('published_at', { ascending: false, nullsFirst: false })
    .range(from, to);

  const totalArticles = count ?? 0;
  const hasNextPage = from + limit < totalArticles;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <header className="bg-white border-b border-slate-200 py-6 px-4 md:px-8 shadow-sm mb-10">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link
            href="/"
            className="text-3xl font-black tracking-tighter text-blue-900 uppercase hover:text-blue-700 transition"
          >
            KJIN
          </Link>
          <div className="text-sm font-bold uppercase tracking-widest text-slate-500">
            {categoryName} Feed
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="mb-8 border-b-4 border-blue-600 inline-block pb-2">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            {categoryName}
          </h1>
        </div>
        {categoryInfo && (
          <p className="text-slate-600 mb-10 max-w-2xl text-lg">
            {categoryInfo.description}
          </p>
        )}

        {articles && articles.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  href={`/${article.category.toLowerCase()}/${article.slug}`}
                  className="group flex flex-col h-full bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition"
                >
                  {article.featured_image_url ? (
                    <div className="relative w-full h-52 mb-4 overflow-hidden rounded-lg bg-slate-100">
                      <Image
                        src={article.featured_image_url}
                        alt={article.title}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-2 bg-blue-200 group-hover:bg-blue-400 transition mb-4 rounded-full" />
                  )}
                  <div className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">
                    {new Date(article.published_at).toLocaleDateString()}
                  </div>
                  <h3 className="text-xl font-bold leading-snug group-hover:text-blue-700 transition mb-3">
                    {article.title}
                  </h3>
                  {article.excerpt && (
                    <p className="text-slate-600 line-clamp-3 mb-4 flex-grow text-sm">
                      {article.excerpt}
                    </p>
                  )}
                  <div className="mt-auto text-xs font-medium text-slate-400 pt-2 border-t border-slate-100">
                    By {article.author_display_name || 'KJIN Desk'}
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-16 flex justify-between items-center border-t border-slate-200 pt-8">
              {page > 1 ? (
                <Link
                  href={`/category/${categorySlug}${page - 1 > 1 ? `?page=${page - 1}` : ''}`}
                  className="px-6 py-3 rounded-lg border border-slate-300 font-semibold hover:bg-slate-100 transition text-sm"
                >
                  &larr; Previous Page
                </Link>
              ) : (
                <div />
              )}

              <span className="text-sm font-medium text-slate-500">
                Page {page} {totalArticles > 0 ? `of ${Math.ceil(totalArticles / limit)}` : ''}
              </span>

              {hasNextPage ? (
                <Link
                  href={`/category/${categorySlug}?page=${page + 1}`}
                  className="px-6 py-3 rounded-lg border border-slate-300 font-semibold hover:bg-slate-100 transition text-sm"
                >
                  Next Page &rarr;
                </Link>
              ) : (
                <div />
              )}
            </div>
          </>
        ) : (
          <div className="py-20 text-center text-slate-500 text-lg bg-white rounded-xl border border-slate-200">
            No published articles found in {categoryName}.
          </div>
        )}
      </div>
    </main>
  );
}
