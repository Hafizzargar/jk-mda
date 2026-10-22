import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { TemplateProps } from './types';

export function TechTerminalTemplate({
  langPrefix,
  heroArticle,
  recentArticles,
  trendingArticles,
}: TemplateProps) {
  return (
    <div className="min-h-screen bg-[#050805] text-[#22c55e] pb-24 font-mono selection:bg-[#22c55e] selection:text-black">
      {/* CLI Command Status Bar */}
      <div className="border-b border-[#14532d] bg-[#020402] py-2 px-4 text-xs flex justify-between items-center text-[#4ade80]">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e] animate-ping" />
          <span>$ kjin-wire --region=jk --channel=verified --stream=live</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-neutral-400">
          <span>ENC: AES-GCM-256</span>
          <span className="text-[#22c55e] font-bold">[FEED_ACTIVE]</span>
        </div>
      </div>

      {/* Terminal Header */}
      <header className="border-b border-[#14532d] bg-[#050805] py-6 px-4 md:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Link
              href={`${langPrefix}/`}
              className="text-3xl md:text-4xl font-black tracking-tight text-white flex items-center gap-2"
            >
              <span className="text-[#22c55e]">&gt;_</span>
              <span>KJIN::TERMINAL</span>
            </Link>
            <div className="text-xs text-neutral-400 mt-1">
              Automated Newsroom Telemetry &bull; Jammu &amp; Kashmir Bureau
            </div>
          </div>

          <nav className="flex flex-wrap gap-2 text-xs">
            {['politics', 'local', 'economy', 'culture', 'investigation'].map((cat) => (
              <Link
                key={cat}
                href={`${langPrefix}/category/${cat}`}
                className="px-2.5 py-1 border border-[#166534] bg-[#064e3b]/30 text-[#4ade80] hover:bg-[#22c55e] hover:text-black transition uppercase font-bold"
              >
                /{cat}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Hero Terminal Frame */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 mt-8">
        {heroArticle && (
          <div className="border border-[#166534] bg-[#020502] p-6 rounded-lg shadow-[0_0_20px_rgba(34,197,94,0.1)] mb-10">
            <div className="flex items-center justify-between text-xs text-neutral-400 pb-3 border-b border-[#14532d] mb-6">
              <span className="text-[#f59e0b] font-bold">[PRIORITY_BROADCAST_001]</span>
              <span>STAMP: {new Date(heroArticle.published_at).toISOString()}</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {heroArticle.featured_image_url && (
                <div className="lg:col-span-5 relative h-64 md:h-80 w-full rounded border border-[#166534] overflow-hidden bg-black">
                  <Image
                    src={heroArticle.featured_image_url}
                    alt={heroArticle.title}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    className="object-cover opacity-85 hover:opacity-100 transition filter contrast-125"
                  />
                  <div className="absolute top-2 left-2 bg-black/80 text-[#22c55e] text-[10px] px-2 py-0.5 border border-[#166534]">
                    IMG_SRC_VERIFIED
                  </div>
                </div>
              )}

              <div className={heroArticle.featured_image_url ? 'lg:col-span-7' : 'lg:col-span-12'}>
                <div className="text-xs text-neutral-400 mb-2 uppercase">
                  TAG: <span className="text-[#22c55e] font-bold">{heroArticle.category}</span> &bull; LOC: <span className="text-white">{heroArticle.district || 'ALL_DISTRICTS'}</span>
                </div>

                <Link href={`${langPrefix}/${heroArticle.category.toLowerCase()}/${heroArticle.slug}`}>
                  <h1 className="text-2xl md:text-3xl font-bold text-white hover:text-[#4ade80] transition leading-tight mb-4">
                    {heroArticle.title}
                  </h1>
                </Link>

                {heroArticle.excerpt && (
                  <p className="text-sm text-neutral-300 leading-relaxed mb-6">
                    {heroArticle.excerpt}
                  </p>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-[#14532d] text-xs">
                  <span className="text-neutral-500">
                    BYLINE: {heroArticle.author_display_name || 'SYSTEM_OPERATOR'}
                  </span>
                  <Link
                    href={`${langPrefix}/${heroArticle.category.toLowerCase()}/${heroArticle.slug}`}
                    className="px-4 py-2 border border-[#22c55e] text-[#22c55e] hover:bg-[#22c55e] hover:text-black transition uppercase font-bold"
                  >
                    ACCESS_FULL_LOG &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Telemetry Dispatches Stream & Ranked Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8">
            <div className="border border-[#14532d] bg-[#020502] rounded-lg overflow-hidden">
              <div className="bg-[#050805] px-4 py-3 border-b border-[#14532d] flex justify-between items-center text-xs text-neutral-400">
                <span className="text-white font-bold">&gt; DISPATCH_FEED</span>
                <span>{recentArticles.length} LOGS BUFFERED</span>
              </div>

              <div className="divide-y divide-[#14532d]/60">
                {recentArticles.slice(0, 6).map((article) => (
                  <div key={article.id} className="p-4 hover:bg-[#064e3b]/10 transition">
                    <div className="flex items-center gap-3 text-[11px] text-neutral-400 mb-1">
                      <span className="text-[#f59e0b] font-bold">[{article.category.toUpperCase()}]</span>
                      <span>{article.district || 'J&K'}</span>
                      <span>&bull;</span>
                      <span>{new Date(article.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <Link href={`${langPrefix}/${article.category.toLowerCase()}/${article.slug}`}>
                      <h3 className="text-base font-bold text-white hover:text-[#4ade80] transition mb-1 leading-snug">
                        {article.title}
                      </h3>
                    </Link>

                    {article.excerpt && (
                      <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                        {article.excerpt}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="border border-[#14532d] bg-[#020502] p-4 rounded-lg">
              <div className="text-xs font-bold text-white border-b border-[#14532d] pb-2 mb-4">
                &gt; HIGH_TRAFFIC_TELEMETRY
              </div>

              <div className="space-y-3">
                {trendingArticles.slice(0, 5).map((article, idx) => (
                  <Link
                    key={article.id}
                    href={`${langPrefix}/${article.category.toLowerCase()}/${article.slug}`}
                    className="block group"
                  >
                    <div className="flex items-start gap-2.5 text-xs">
                      <span className="text-[#f59e0b] font-bold">#0{idx + 1}</span>
                      <div>
                        <h4 className="text-white group-hover:text-[#4ade80] transition leading-snug">
                          {article.title}
                        </h4>
                        <span className="text-[10px] text-neutral-500 uppercase">
                          {article.category}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
