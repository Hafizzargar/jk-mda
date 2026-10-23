import Link from 'next/link';
import Image from 'next/image';
import { NewsletterForm } from '@/components/NewsletterForm';
import { SITE_SHORT_NAME } from '@/lib/config';
import { TemplateProps } from './types';

export function MinimalFocusTemplate({
  langPrefix,
  heroArticle,
  recentArticles,
}: TemplateProps) {
  return (
    <div className="min-h-screen bg-[#fafaf9] text-stone-900 font-sans pb-28 antialiased">
      {/* Clean Minimalist Header */}
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-30 py-5 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="text-2xl font-serif font-black tracking-tight text-stone-900 hover:text-stone-700 transition"
          >
            {SITE_SHORT_NAME}
          </Link>

          <nav className="flex items-center gap-6 text-sm font-medium text-stone-600">
            <Link href={`${langPrefix}/category/politics`} className="hover:text-stone-900 transition">Politics</Link>
            <Link href={`${langPrefix}/category/local`} className="hover:text-stone-900 transition">Local</Link>
            <Link href={`${langPrefix}/category/economy`} className="hover:text-stone-900 transition">Economy</Link>
            <Link href={`${langPrefix}/category/culture`} className="hover:text-stone-900 transition">Culture</Link>
            <Link href={`${langPrefix}/category/investigation`} className="hover:text-stone-900 transition">Investigation</Link>
          </nav>
        </div>
      </header>

      {/* Main Single-Column Reader Experience */}
      <main className="max-w-3xl mx-auto px-6 mt-12 space-y-16">
        {/* Featured Long-Form Essay */}
        {heroArticle && (
          <article className="border-b border-stone-200 pb-16">
            <Link href={`${langPrefix}/${heroArticle.category.toLowerCase()}/${heroArticle.slug}`} className="group block space-y-4">
              <div className="flex items-center gap-2 text-xs font-medium text-stone-500 uppercase tracking-widest">
                <span className="font-semibold text-stone-800">{heroArticle.category}</span>
                <span>/</span>
                <span>{heroArticle.district || 'Jammu & Kashmir'}</span>
                <span>/</span>
                <span>4 min read</span>
              </div>

              <h1 className="text-3xl md:text-5xl font-serif font-extrabold text-stone-900 group-hover:text-stone-600 transition leading-tight tracking-tight">
                {heroArticle.title}
              </h1>

              {heroArticle.excerpt && (
                <p className="text-lg md:text-xl text-stone-600 font-serif leading-relaxed">
                  {heroArticle.excerpt}
                </p>
              )}

              {heroArticle.featured_image_url && (
                <div className="relative w-full h-80 md:h-[400px] my-6 rounded-lg overflow-hidden bg-stone-100">
                  <Image
                    src={heroArticle.featured_image_url}
                    alt={heroArticle.title}
                    fill
                    priority
                    sizes="(max-width: 768px) 100vw, 800px"
                    className="object-cover group-hover:scale-[1.02] transition duration-500"
                  />
                </div>
              )}

              <div className="pt-2 flex items-center justify-between text-xs text-stone-400">
                <span>By {heroArticle.author_display_name || 'Staff Writer'}</span>
                <span>{new Date(heroArticle.published_at).toLocaleDateString()}</span>
              </div>
            </Link>
          </article>
        )}

        {/* Chronological Stream */}
        <section className="space-y-12">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400 border-b border-stone-200 pb-3">
            Recent Ground Reports
          </h2>

          <div className="space-y-10">
            {recentArticles.map((article) => (
              <article key={article.id} className="group border-b border-stone-100 pb-10">
                <Link href={`${langPrefix}/${article.category.toLowerCase()}/${article.slug}`} className="block space-y-3">
                  <div className="flex items-center gap-2 text-xs text-stone-400">
                    <span className="font-semibold text-stone-700 uppercase tracking-wider">{article.category}</span>
                    <span>&bull;</span>
                    <span>{article.district ? `District ${article.district}` : 'Jammu & Kashmir'}</span>
                  </div>

                  <h3 className="text-2xl font-serif font-bold text-stone-900 group-hover:text-stone-600 transition leading-snug">
                    {article.title}
                  </h3>

                  <p className="text-base text-stone-600 font-serif leading-relaxed line-clamp-2">
                    {article.excerpt}
                  </p>

                  <div className="text-xs text-stone-400 flex items-center justify-between pt-1">
                    <span>{article.author_display_name || 'KJIN Bureau'}</span>
                    <span>{new Date(article.published_at).toLocaleDateString()}</span>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        </section>

        {/* Minimal Newsletter Callout */}
        <section className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
          <h3 className="text-xl font-serif font-bold text-stone-900 mb-2">Read with depth.</h3>
          <p className="text-sm text-stone-600 font-serif mb-6 leading-relaxed">
            Direct, uninterrupted weekly reporting on regional governance, environment, and culture.
          </p>
          <NewsletterForm />
        </section>
      </main>
    </div>
  );
}
