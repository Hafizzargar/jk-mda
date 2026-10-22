import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Metadata } from 'next';
import { createServerAnonClient } from '@/lib/supabase-server';
import { isValidRegion, getRegion, JK_DISTRICTS } from '@/lib/taxonomy';
import { parsePageParam, getPaginationRange } from '@/lib/pagination';
import { applyTranslations } from '@/lib/i18n';
import { SITE_URL, SITE_SHORT_NAME } from '@/lib/config';

interface RegionPageProps {
  params: Promise<{
    lang: string;
    slug: string;
  }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params, searchParams }: RegionPageProps): Promise<Metadata> {
  const { lang, slug } = await params;
  const resolvedSearchParams = await searchParams;
  const regionSlug = slug.toLowerCase().trim();

  if (!isValidRegion(regionSlug)) {
    return {
      title: 'Region Not Found | KJIN',
      robots: { index: false, follow: false },
    };
  }

  const region = getRegion(regionSlug);
  const page = parsePageParam(resolvedSearchParams.page);
  const pageSuffix = page > 1 ? ` - Page ${page}` : '';
  const langPrefix = lang === 'en' ? '' : `/${lang}`;
  const canonicalUrl = `${SITE_URL}${langPrefix}/region/${regionSlug}${page > 1 ? `?page=${page}` : ''}`;

  return {
    metadataBase: new URL(SITE_URL),
    title: `${region?.name || 'Regional'} News & Dispatches${pageSuffix} | ${SITE_SHORT_NAME}`,
    description: `Verified grassroots journalism and news coverage across the ${region?.name} (${region?.districts.map((d) => JK_DISTRICTS[d]?.name).join(', ')}).`,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: `${region?.name} Dispatches | ${SITE_SHORT_NAME}`,
      description: `Comprehensive regional reporting from ${region?.name}.`,
      url: canonicalUrl,
      type: 'website',
    },
  };
}

export default async function RegionPage({ params, searchParams }: RegionPageProps) {
  const { lang, slug } = await params;
  const resolvedSearchParams = await searchParams;
  const regionSlug = slug.toLowerCase().trim();
  const langPrefix = lang === 'en' ? '' : `/${lang}`;

  if (!isValidRegion(regionSlug)) {
    notFound();
  }

  const region = getRegion(regionSlug)!;

  const page = parsePageParam(resolvedSearchParams.page);
  const { from, to, limit } = getPaginationRange(page, 12);

  const supabase = createServerAnonClient();

  // Query articles matching any district within this region
  const { data: articlesRaw, count } = await supabase
    .from('articles')
    .select('id, slug, title, excerpt, category, district, author_display_name, published_at, featured_image_url, article_translations(title, excerpt, language_code)', { count: 'exact' })
    .eq('status', 'published')
    .in('district', region.districts)
    .order('published_at', { ascending: false, nullsFirst: false })
    .range(from, to);

  const articles = applyTranslations(articlesRaw || [], lang);
  const totalArticles = count ?? 0;
  const totalPages = Math.ceil(totalArticles / limit);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-20 selection:bg-blue-600 selection:text-white">
      {/* Top Header */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 py-4 px-4 md:px-8">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link
            href={`${langPrefix}/`}
            className="text-2xl md:text-3xl font-black tracking-tighter bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent hover:opacity-90 transition"
          >
            {SITE_SHORT_NAME}
          </Link>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-cyan-500/10 border border-cyan-500/30 px-3 py-1 text-xs font-mono font-bold text-cyan-300">
              {region.districts.length} Districts Covered
            </span>
            <Link
              href={`${langPrefix}/`}
              className="text-xs font-semibold text-slate-400 hover:text-white transition"
            >
              &larr; Back to Home
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Banner for Region */}
      <div className="border-b border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 py-10 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300 mb-4">
            <span>KJIN Regional Bureau</span>
            <span>&bull;</span>
            <span className="capitalize">{region.shortName}</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-3">
            {region.name}
          </h1>
          <p className="text-base md:text-lg text-slate-400 max-w-3xl mb-6">
            {region.tagline}. Verified field reporting, investigative analyses, and grassroots coverage from our local correspondents.
          </p>

          {/* Constituent District Pills */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Districts in this Region:
            </div>
            <div className="flex flex-wrap gap-2">
              {region.districts.map((d) => (
                <Link
                  key={d}
                  href={`${langPrefix}/district/${d}`}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-cyan-400 hover:text-cyan-300 hover:bg-slate-850 transition"
                >
                  {JK_DISTRICTS[d]?.name || d}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Articles Grid */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-10">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-8">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="h-4 w-1 bg-cyan-400 rounded-full"></span>
            Dispatches from {region.name}
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            {totalArticles} verified {totalArticles === 1 ? 'report' : 'reports'}
          </span>
        </div>

        {articles && articles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article) => (
              <Link
                key={article.id}
                href={`${langPrefix}/${article.category.toLowerCase()}/${article.slug}`}
                className="group flex flex-col h-full rounded-2xl border border-slate-800 bg-slate-900/50 p-5 hover:border-slate-700 hover:bg-slate-900 transition shadow-sm"
              >
                {article.featured_image_url ? (
                  <div className="relative w-full h-48 mb-4 overflow-hidden rounded-xl bg-slate-800">
                    <Image
                      src={article.featured_image_url}
                      alt={article.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {article.district && (
                      <span className="absolute bottom-2 left-2 rounded-md bg-slate-950/80 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-cyan-300 uppercase tracking-wider border border-slate-700/50">
                        {JK_DISTRICTS[article.district.toLowerCase()]?.name || article.district}
                      </span>
                    )}
                  </div>
                ) : null}

                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold uppercase tracking-wider text-blue-400">
                    {article.category}
                  </span>
                  <span className="text-slate-500">
                    {new Date(article.published_at).toLocaleDateString()}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition line-clamp-2 mb-2">
                  {article.title}
                </h3>

                <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed flex-1">
                  {article.excerpt}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
                  <span>By {article.author_display_name || 'Correspondent'}</span>
                  <span className="text-cyan-400 font-semibold group-hover:translate-x-0.5 transition">
                    Read &rarr;
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 rounded-2xl border border-dashed border-slate-800">
            <p className="text-slate-400 text-sm">No published dispatches found in this region yet.</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-12 flex justify-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={`${langPrefix}/region/${regionSlug}?page=${p}`}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
                  p === page
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {p}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
