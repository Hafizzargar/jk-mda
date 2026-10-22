import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { TemplateProps } from './types';

export function VisualStoriesTemplate({
  langPrefix,
  heroArticle,
  recentArticles,
  trendingArticles,
}: TemplateProps) {
  const storyBubbles = [
    { label: 'Srinagar', icon: '🏔️', color: 'from-amber-400 to-rose-500' },
    { label: 'Jammu', icon: '🏛️', color: 'from-fuchsia-500 to-indigo-500' },
    { label: 'Politics', icon: '⚖️', color: 'from-emerald-400 to-teal-600' },
    { label: 'Economy', icon: '📊', color: 'from-blue-500 to-cyan-400' },
    { label: 'Culture', icon: '🎨', color: 'from-purple-500 to-pink-500' },
    { label: 'Investigation', icon: '🔦', color: 'from-rose-500 to-red-600' },
  ];

  return (
    <div className="min-h-screen bg-[#0c0a09] text-stone-100 pb-20 font-sans selection:bg-rose-500 selection:text-white">
      {/* Top Stories Navigation */}
      <header className="border-b border-stone-800 bg-[#0c0a09]/90 sticky top-0 z-40 backdrop-blur-md px-4 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`${langPrefix}/`}
              className="text-2xl font-black tracking-tight text-white flex items-center gap-2"
            >
              <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 flex items-center justify-center text-sm shadow-lg shadow-rose-500/20">
                ▶
              </span>
              <span>KJIN<span className="text-rose-500 font-serif">Stories</span></span>
            </Link>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="px-2.5 py-1 bg-stone-900 border border-stone-800 rounded-full text-stone-400">
              ⚡ LIVE STORIES
            </span>
          </div>
        </div>
      </header>

      {/* Story Ring Avatars Carousel */}
      <div className="border-b border-stone-800/80 bg-stone-950/60 py-4 px-4 overflow-x-auto scrollbar-none">
        <div className="max-w-7xl mx-auto flex items-center gap-5">
          {storyBubbles.map((bubble) => (
            <div key={bubble.label} className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group">
              <div className={`p-[2px] rounded-full bg-gradient-to-tr ${bubble.color} group-hover:scale-105 transition shadow-sm`}>
                <div className="w-14 h-14 rounded-full bg-stone-900 flex items-center justify-center text-xl border-2 border-[#0c0a09]">
                  {bubble.icon}
                </div>
              </div>
              <span className="text-[11px] font-medium text-stone-400 group-hover:text-stone-200 transition">
                {bubble.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Vertical Reels & Story Cards Feed */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 mt-8">
        {/* Spotlight Featured Reel */}
        {heroArticle && (
          <div className="relative rounded-3xl overflow-hidden mb-12 border border-stone-800 shadow-2xl bg-stone-900 h-[480px] md:h-[540px] group">
            {heroArticle.featured_image_url && (
              <Image
                src={heroArticle.featured_image_url}
                alt={heroArticle.title}
                fill
                priority
                sizes="100vw"
                className="object-cover group-hover:scale-105 transition duration-700 brightness-[0.7]"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

            <div className="absolute top-6 left-6 flex items-center gap-2">
              <span className="px-3 py-1 bg-rose-600 text-white font-bold text-xs uppercase tracking-wider rounded-full shadow-lg">
                ★ FEATURED STORY
              </span>
              <span className="px-3 py-1 bg-black/60 backdrop-blur-md text-stone-300 text-xs font-mono rounded-full border border-stone-700">
                {heroArticle.district || 'Statewide'}
              </span>
            </div>

            <div className="absolute bottom-8 left-6 right-6 md:max-w-3xl">
              <div className="text-xs font-bold uppercase tracking-widest text-rose-400 mb-2">
                {heroArticle.category} &bull; {new Date(heroArticle.published_at).toLocaleDateString()}
              </div>
              <Link href={`${langPrefix}/${heroArticle.category.toLowerCase()}/${heroArticle.slug}`}>
                <h1 className="text-2xl md:text-4xl font-extrabold text-white leading-tight mb-4 hover:text-rose-300 transition">
                  {heroArticle.title}
                </h1>
              </Link>
              {heroArticle.excerpt && (
                <p className="text-sm md:text-base text-stone-300 line-clamp-2 leading-relaxed mb-6 font-light">
                  {heroArticle.excerpt}
                </p>
              )}
              <div className="flex items-center gap-4">
                <Link
                  href={`${langPrefix}/${heroArticle.category.toLowerCase()}/${heroArticle.slug}`}
                  className="px-6 py-2.5 bg-white text-black font-bold text-xs uppercase tracking-wider rounded-full hover:bg-rose-500 hover:text-white transition shadow-lg"
                >
                  View Story &rarr;
                </Link>
                <span className="text-xs text-stone-400">
                  By {heroArticle.author_display_name || 'Staff Reporter'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Vertical Portrait Story Grid (9:16 Aspect Ratio) */}
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-stone-800 mb-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>📱</span>
              <span>Visual Story Stream</span>
            </h2>
            <span className="text-xs text-stone-500 font-mono">
              {recentArticles.length} STORIES AVAILABLE
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {recentArticles.slice(0, 8).map((article) => (
              <Link
                key={article.id}
                href={`${langPrefix}/${article.category.toLowerCase()}/${article.slug}`}
                className="group relative h-[380px] rounded-2xl overflow-hidden border border-stone-800/80 bg-stone-900 shadow-lg block hover:border-rose-500/50 hover:shadow-rose-500/10 transition duration-300"
              >
                {article.featured_image_url ? (
                  <Image
                    src={article.featured_image_url}
                    alt={article.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 25vw"
                    className="object-cover group-hover:scale-105 transition duration-500 brightness-[0.75]"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-b from-stone-800 to-stone-950" />
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

                <div className="absolute top-3 left-3 right-3 flex justify-between items-center">
                  <span className="px-2 py-0.5 bg-black/60 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider text-rose-400 rounded-md border border-stone-700">
                    {article.category}
                  </span>
                  <span className="text-[10px] font-mono text-stone-400 bg-black/50 px-1.5 py-0.5 rounded">
                    {article.district || 'J&K'}
                  </span>
                </div>

                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="text-sm font-bold text-white leading-snug line-clamp-3 mb-2 group-hover:text-rose-300 transition">
                    {article.title}
                  </h3>
                  <div className="flex items-center justify-between text-[10px] text-stone-400 border-t border-stone-800/60 pt-2">
                    <span>{new Date(article.published_at).toLocaleDateString()}</span>
                    <span className="text-rose-400 font-semibold group-hover:translate-x-1 transition">
                      Read &rarr;
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
