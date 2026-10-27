import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { TemplateProps } from './types';

export function GenZNeoBrutalistTemplate({
  langPrefix,
  heroArticle,
  recentArticles,
  trendingArticles,
  navbarSettings,
}: TemplateProps) {
  const brandName = navbarSettings?.brand?.name || 'KCPJLN';
  const brandFullName = navbarSettings?.brand?.full_name || 'Kashmir Chenab Panjal Jammu Ladakh Network';
  const categories = [
    { name: 'Politics', color: 'bg-yellow-300', emoji: '🏛️' },
    { name: 'Local', color: 'bg-lime-300', emoji: '📍' },
    { name: 'Economy', color: 'bg-cyan-300', emoji: '📈' },
    { name: 'Culture', color: 'bg-pink-300', emoji: '🎨' },
    { name: 'Investigation', color: 'bg-orange-300', emoji: '🔍' },
  ];

  return (
    <div className="min-h-screen bg-[#fafaf9] text-neutral-900 pb-20 font-sans selection:bg-lime-300 selection:text-black">
      {/* Neo-Brutalist Animated / Running Marquee Bar */}
      <div className="bg-black text-lime-400 py-2.5 px-4 font-mono font-bold text-xs uppercase tracking-wider overflow-hidden border-b-2 border-black flex justify-between items-center">
        <div className="flex items-center gap-6 animate-pulse">
          <span>⚡ {brandName} WIRE: ZERO CLICKBAIT • 100% VERIFIED REGIONAL DISPATCHES</span>
          <span className="hidden md:inline">• REAL STORIES FROM 20 DISTRICTS OF J&K</span>
          <span className="hidden lg:inline">• NEXT-GEN INVESTIGATIVE DESK</span>
        </div>
        <span className="bg-lime-400 text-black px-2 py-0.5 rounded font-black text-[10px] uppercase">
          LIVE FEED
        </span>
      </div>

      {/* Main Header */}
      <header className="border-b-4 border-black bg-white py-6 px-4 md:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={`${langPrefix}/`}
              className="text-4xl md:text-5xl font-black tracking-tight uppercase bg-yellow-300 px-3 py-1 border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition inline-block -rotate-1"
            >
              {brandName} ⚡
            </Link>
            <div className="text-xs font-mono font-bold leading-tight uppercase ml-2 text-neutral-700">
              <span className="bg-lime-300 px-1 border border-black inline-block font-black">GEN-Z EDITION</span>
              <div className="text-neutral-500 mt-0.5">{brandFullName}</div>
            </div>
          </div>

          {/* Sticker Category Navigation */}
          <div className="flex flex-wrap gap-2 pt-2 md:pt-0">
            {categories.map((c) => (
              <Link
                key={c.name}
                href={`${langPrefix}/category/${c.name.toLowerCase()}`}
                className={`text-xs font-black uppercase px-3 py-1.5 border-2 border-black ${c.color} shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition flex items-center gap-1`}
              >
                <span>{c.emoji}</span>
                <span>{c.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </header>

      {/* Hero & Top Story Section */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Hero Card */}
          <div className="lg:col-span-8">
            {heroArticle && (
              <div className="bg-white border-3 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-2xl overflow-hidden group hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition duration-200">
                {heroArticle.featured_image_url && (
                  <div className="relative h-72 md:h-96 w-full border-b-3 border-black overflow-hidden bg-neutral-100">
                    <Image
                      src={heroArticle.featured_image_url}
                      alt={heroArticle.title}
                      fill
                      priority
                      sizes="(max-width: 1024px) 100vw, 66vw"
                      className="object-cover group-hover:scale-105 transition duration-500"
                    />
                    <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                      <span className="bg-lime-300 text-black font-black text-xs uppercase px-3 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        ⚡ MAIN EVENT
                      </span>
                      <span className="bg-white text-black font-mono font-bold text-xs uppercase px-2.5 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        {heroArticle.district || 'Statewide'}
                      </span>
                    </div>
                  </div>
                )}

                <div className="p-6 md:p-8">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-pink-300 text-black text-xs font-black uppercase px-2.5 py-0.5 border-2 border-black rounded-full">
                      {heroArticle.category}
                    </span>
                    <span className="text-xs font-mono font-bold text-neutral-500">
                      • {new Date(heroArticle.published_at).toLocaleDateString()}
                    </span>
                  </div>

                  <Link href={`${langPrefix}/${heroArticle.category.toLowerCase()}/${heroArticle.slug}`}>
                    <h1 className="text-2xl md:text-4xl font-black leading-tight mb-4 hover:text-blue-600 transition">
                      {heroArticle.title}
                    </h1>
                  </Link>

                  {heroArticle.excerpt && (
                    <div className="bg-[#f5f5f4] p-4 border-2 border-black rounded-xl mb-6 font-mono text-sm leading-relaxed">
                      <span className="font-bold text-black uppercase bg-yellow-300 px-1 border border-black mr-2 text-xs">
                        TL;DR
                      </span>
                      {heroArticle.excerpt}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t-2 border-black">
                    <div className="text-xs font-mono font-bold uppercase text-neutral-600">
                      By {heroArticle.author_display_name || `${brandName} Desk`}
                    </div>
                    <Link
                      href={`${langPrefix}/${heroArticle.category.toLowerCase()}/${heroArticle.slug}`}
                      className="bg-black text-white font-black text-xs uppercase px-5 py-2.5 border-2 border-black shadow-[3px_3px_0px_0px_rgba(250,204,21,1)] hover:bg-yellow-300 hover:text-black transition"
                    >
                      READ THE FULL TEA &rarr;
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar: WHAT'S VIRAL */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-yellow-300 border-3 border-black p-5 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] rounded-2xl">
              <div className="flex items-center justify-between pb-3 border-b-2 border-black mb-4">
                <div className="text-base font-black uppercase tracking-tight flex items-center gap-1.5">
                  <span>🔥</span>
                  <span>WHAT&apos;S VIRAL</span>
                </div>
                <span className="bg-black text-yellow-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase">
                  RANKED
                </span>
              </div>

              <div className="space-y-4">
                {trendingArticles.slice(0, 5).map((article, idx) => (
                  <Link
                    key={article.id}
                    href={`${langPrefix}/${article.category.toLowerCase()}/${article.slug}`}
                    className="block bg-white p-3.5 border-2 border-black rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition"
                  >
                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 bg-black text-white font-black text-xs rounded-lg flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div>
                        <span className="text-[10px] font-black uppercase text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded border border-blue-300 mb-1 inline-block">
                          {article.category}
                        </span>
                        <h3 className="text-xs font-black leading-snug line-clamp-2 hover:underline">
                          {article.title}
                        </h3>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Gen-Z Quick Poll / Newsletter Box */}
            <div className="bg-pink-300 border-3 border-black p-5 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] rounded-2xl">
              <div className="font-black text-sm uppercase mb-1 flex items-center gap-1.5">
                <span>📱</span>
                <span>{brandName} DAILY RECAP</span>
              </div>
              <p className="text-xs font-medium text-neutral-800 mb-3">
                Get high-impact verified news straight to your screen without filler or bias.
              </p>
              <div className="flex flex-col gap-2">
                <input
                  type="email"
                  placeholder="Drop your email here..."
                  className="bg-white border-2 border-black px-3 py-2 text-xs font-mono focus:outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                />
                <button
                  type="button"
                  className="bg-black text-white font-black text-xs uppercase py-2 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-lime-300 hover:text-black transition"
                >
                  SUBSCRIBE NOW 🚀
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stories Grid */}
        <div className="mt-14">
          <div className="flex items-center justify-between pb-3 border-b-4 border-black mb-8">
            <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
              <span className="bg-lime-300 px-2 py-0.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] -rotate-1">
                LATEST
              </span>
              <span>DROPS & DISPATCHES</span>
            </h2>
            <Link
              href={`${langPrefix}/latest`}
              className="text-xs font-black uppercase bg-white px-3 py-1.5 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-300 transition"
            >
              VIEW ALL &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentArticles.slice(0, 6).map((article) => (
              <div
                key={article.id}
                className="bg-white border-3 border-black rounded-2xl overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition duration-200"
              >
                {article.featured_image_url && (
                  <div className="relative h-48 w-full border-b-3 border-black overflow-hidden bg-neutral-100">
                    <Image
                      src={article.featured_image_url}
                      alt={article.title}
                      fill
                      loading="lazy"
                      decoding="async"
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover hover:scale-105 transition duration-500"
                    />
                    <div className="absolute top-2.5 left-2.5">
                      <span className="bg-white font-mono font-black text-[10px] uppercase px-2 py-0.5 border-2 border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                        {article.district || 'J&K'}
                      </span>
                    </div>
                  </div>
                )}

                <div className="p-5 flex flex-col flex-grow">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-cyan-200 text-black text-[10px] font-black uppercase px-2 py-0.5 border border-black rounded">
                      {article.category}
                    </span>
                    <span className="text-[10px] font-mono text-neutral-500 font-bold">
                      {new Date(article.published_at).toLocaleDateString()}
                    </span>
                  </div>

                  <Link href={`${langPrefix}/${article.category.toLowerCase()}/${article.slug}`}>
                    <h3 className="text-base font-black leading-snug hover:text-blue-600 transition mb-2">
                      {article.title}
                    </h3>
                  </Link>

                  {article.excerpt && (
                    <p className="text-xs text-neutral-700 line-clamp-3 leading-relaxed mb-4 flex-grow">
                      {article.excerpt}
                    </p>
                  )}

                  <div className="pt-3 border-t-2 border-black flex items-center justify-between text-[11px] font-mono font-bold mt-auto">
                    <span className="text-neutral-500">
                      BY {article.author_display_name ? article.author_display_name.split(' ')[0] : 'DESK'}
                    </span>
                    <Link
                      href={`${langPrefix}/${article.category.toLowerCase()}/${article.slug}`}
                      className="font-black text-black hover:underline"
                    >
                      READ MORE &rarr;
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
