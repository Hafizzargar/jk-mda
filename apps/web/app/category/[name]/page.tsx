import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Metadata } from 'next';
import { createServerAnonClient } from '@/lib/supabase-server';

interface CategoryPageProps {
  params: Promise<{
    name: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const categoryName = resolvedParams.name.charAt(0).toUpperCase() + resolvedParams.name.slice(1);
  return {
    title: `${categoryName} News | KJIN`,
    description: `Latest reporting and updates in ${categoryName} from the Kashmir Jammu Information Network.`,
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const supabase = createServerAnonClient();
  
  const categoryName = resolvedParams.name.charAt(0).toUpperCase() + resolvedParams.name.slice(1);
  
  const page = typeof resolvedSearchParams.page === 'string' ? parseInt(resolvedSearchParams.page, 10) : 1;
  const limit = 12;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // Fetch Articles for this category
  const { data: articles, error, count } = await supabase
    .from('articles')
    .select('id, slug, title, excerpt, category, author_display_name, published_at, featured_image_url', { count: 'exact' })
    .ilike('category', resolvedParams.name)
    .order('published_at', { ascending: false, nullsFirst: false })
    .range(from, to);

  const hasNextPage = count ? from + limit < count : false;

  if (error || !articles || articles.length === 0) {
    // We could return notFound() or just render an empty state. 
    // Let's render an empty state for valid categories that just lack articles.
    // However, if we strictly want 404 for unknown categories, we'd need a master list of categories.
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <header className="bg-white border-b border-slate-200 py-6 px-4 md:px-8 shadow-sm mb-10">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="text-3xl font-black tracking-tighter text-blue-900 uppercase hover:text-blue-700 transition">
            KJIN
          </Link>
          <div className="text-sm font-bold uppercase tracking-widest text-slate-500">
            {categoryName} Feed
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="mb-12 border-b-4 border-blue-600 inline-block pb-2">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            {categoryName}
          </h1>
        </div>

        {articles && articles.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {articles.map(article => (
                <Link key={article.id} href={`/${article.category.toLowerCase()}/${article.slug}`} className="group block flex flex-col h-full">
                  {article.featured_image_url ? (
                    <div className="w-full h-56 mb-4 overflow-hidden rounded-lg bg-slate-200">
                      <img 
                        src={article.featured_image_url} 
                        alt={article.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                      />
                    </div>
                  ) : (
                    <div className="w-full h-2 bg-blue-200 group-hover:bg-blue-400 transition mb-4 rounded-full" />
                  )}
                  <div className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">
                    {new Date(article.published_at).toLocaleDateString()}
                  </div>
                  <h3 className="text-2xl font-bold leading-snug group-hover:text-blue-700 transition mb-3">
                    {article.title}
                  </h3>
                  {article.excerpt && (
                    <p className="text-slate-600 line-clamp-3 mb-4 flex-grow">
                      {article.excerpt}
                    </p>
                  )}
                  <div className="mt-auto text-sm font-medium text-slate-400">
                    By {article.author_display_name || 'KJIN Desk'}
                  </div>
                </Link>
              ))}
            </div>
            
            <div className="mt-16 flex justify-between items-center border-t border-slate-200 pt-8">
              {page > 1 ? (
                <Link href={`/category/${resolvedParams.name}?page=${page - 1}`} className="px-6 py-3 rounded-lg border border-slate-300 font-semibold hover:bg-slate-100 transition">
                  &larr; Previous Page
                </Link>
              ) : <div />}
              
              {hasNextPage && (
                <Link href={`/category/${resolvedParams.name}?page=${page + 1}`} className="px-6 py-3 rounded-lg border border-slate-300 font-semibold hover:bg-slate-100 transition">
                  Next Page &rarr;
                </Link>
              )}
            </div>
          </>
        ) : (
          <div className="py-20 text-center text-slate-500 text-lg">
            No published articles found in this category.
          </div>
        )}
      </div>
    </main>
  );
}
