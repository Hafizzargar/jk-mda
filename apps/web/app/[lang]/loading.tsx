export default function Loading() {
  return (
    <div className="min-h-screen bg-[#020817] text-slate-200">
      {/* 1. Live Newsroom Wire Ticker Header */}
      <div className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
            {/* Left: Teletype Wire Indicator */}
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600" />
              </span>
              <span className="px-2 py-0.5 rounded bg-red-950/80 text-red-400 border border-red-500/40 uppercase font-bold tracking-wider">
                Live Newsroom Wire
              </span>
              <span className="hidden sm:inline text-slate-500">•</span>
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="inline-block w-1.5 h-3 bg-red-500 animate-pulse" />
                <span className="tracking-wide">
                  PRESS ENCLAVE DISPATCH: Receiving verified transmissions across 22 J&K districts...
                </span>
              </div>
            </div>

            {/* Right: Edition Stamp */}
            <div className="flex items-center gap-3 text-slate-400 text-[11px] self-end sm:self-auto">
              <span className="hidden md:inline text-emerald-400/90 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ENCRYPTED FIELD RELAY
              </span>
              <span className="hidden md:inline text-slate-600">|</span>
              <span className="text-slate-400 uppercase tracking-widest font-semibold">
                EDITION: LIVE PRINT WIRE
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Standardized Breadcrumb Shimmer (max-w-7xl mx-auto px-4 md:px-8) */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6 pb-2">
        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="h-5 w-28 bg-slate-800/80 rounded-md animate-pulse border border-slate-700/40" />
          <span className="text-slate-600">/</span>
          <div className="h-5 w-20 bg-slate-800/60 rounded-md animate-pulse border border-slate-700/30" />
          <span className="text-slate-600">/</span>
          <div className="h-5 w-44 bg-slate-800/40 rounded-md animate-pulse" />
        </div>
      </div>

      {/* 3. Broadsheet 12-Column Grid (max-w-7xl mx-auto px-4 md:px-8 py-6) */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Lead Story & Editorial Shimmer (lg:col-span-8) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 sm:p-8 backdrop-blur-sm shadow-xl relative overflow-hidden">
            {/* Top metadata row */}
            <div className="flex items-center gap-3 mb-6">
              <div className="h-5 w-24 bg-red-950/60 border border-red-500/30 rounded-full animate-pulse" />
              <div className="h-4 w-28 bg-slate-800/80 rounded animate-pulse" />
              <div className="h-4 w-20 bg-slate-800/60 rounded animate-pulse hidden sm:block" />
            </div>

            {/* Broadsheet Headline Shimmer Bars */}
            <div className="space-y-3 mb-6">
              <div className="h-9 w-full bg-slate-800/90 rounded-lg animate-pulse" />
              <div className="h-9 w-11/12 bg-slate-800/80 rounded-lg animate-pulse" />
              <div className="h-9 w-3/4 bg-slate-800/70 rounded-lg animate-pulse" />
            </div>

            {/* Deck / Excerpt Shimmer */}
            <div className="space-y-2 mb-8 pt-1">
              <div className="h-5 w-full bg-slate-800/60 rounded animate-pulse" />
              <div className="h-5 w-5/6 bg-slate-800/50 rounded animate-pulse" />
            </div>

            {/* Author Dateline Shimmer */}
            <div className="flex items-center justify-between border-y border-slate-800/80 py-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-slate-800 border border-slate-700/60 animate-pulse flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full bg-slate-700/80 animate-pulse" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-4 w-36 bg-slate-700/80 rounded animate-pulse" />
                  <div className="h-3 w-28 bg-slate-800/80 rounded animate-pulse" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700/40 animate-pulse" />
                <div className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700/40 animate-pulse" />
              </div>
            </div>

            {/* Lead Photo Plate Shimmer (16:9 Aspect Ratio) */}
            <div className="mb-8">
              <div className="aspect-video w-full rounded-xl bg-slate-800/80 border border-slate-700/60 relative overflow-hidden flex flex-col justify-between p-4 animate-pulse">
                <div className="flex justify-between items-start">
                  <div className="h-4 w-28 bg-slate-700/80 rounded-md" />
                  <div className="h-4 w-16 bg-slate-700/60 rounded-md" />
                </div>
                <div className="flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2 text-slate-600">
                    <svg className="w-10 h-10 animate-pulse text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs font-mono uppercase tracking-wider text-slate-500">
                      Developing Photo Plate...
                    </span>
                  </div>
                </div>
                <div className="h-3 w-48 bg-slate-700/60 rounded" />
              </div>
            </div>

            {/* Editorial Columns / Broadsheet Paragraphs */}
            <div className="space-y-4 mb-8">
              <div className="h-4 w-full bg-slate-800/80 rounded animate-pulse" />
              <div className="h-4 w-full bg-slate-800/80 rounded animate-pulse" />
              <div className="h-4 w-11/12 bg-slate-800/70 rounded animate-pulse" />
              <div className="h-4 w-full bg-slate-800/80 rounded animate-pulse" />
              <div className="h-4 w-4/5 bg-slate-800/60 rounded animate-pulse" />
            </div>

            {/* Pull Quote Box Shimmer */}
            <div className="border-l-4 border-amber-500/60 bg-amber-950/15 p-5 rounded-r-xl border border-y-slate-800/40 border-r-slate-800/40 mb-8 space-y-2.5">
              <div className="h-4 w-11/12 bg-amber-400/20 rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-amber-400/15 rounded animate-pulse" />
              <div className="h-3 w-32 bg-amber-400/25 rounded mt-2 animate-pulse" />
            </div>

            {/* Secondary Paragraph Block */}
            <div className="space-y-4 mb-8">
              <div className="h-4 w-full bg-slate-800/70 rounded animate-pulse" />
              <div className="h-4 w-11/12 bg-slate-800/70 rounded animate-pulse" />
              <div className="h-4 w-full bg-slate-800/80 rounded animate-pulse" />
              <div className="h-4 w-2/3 bg-slate-800/60 rounded animate-pulse" />
            </div>

            {/* Native Sponsored Dispatch Shimmer Plate */}
            <div className="border border-cyan-500/30 bg-cyan-950/15 rounded-xl p-5 relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <div className="h-4 w-32 bg-cyan-500/20 rounded-md animate-pulse" />
                <div className="h-3 w-20 bg-cyan-500/15 rounded animate-pulse" />
              </div>
              <div className="h-5 w-4/5 bg-cyan-400/20 rounded mb-2 animate-pulse" />
              <div className="h-4 w-2/3 bg-cyan-400/15 rounded mb-4 animate-pulse" />
              <div className="h-9 w-40 bg-cyan-500/25 rounded-lg animate-pulse" />
            </div>
          </div>
        </div>

        {/* Right Column: The Ledger & Field Dispatches Rail (lg:col-span-4) */}
        <aside className="lg:col-span-4 space-y-6">
          {/* 1. The Ledger / Trending Shimmer Box */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 font-mono">
                  The Ledger • Most Read
                </h3>
              </div>
              <span className="text-[10px] font-mono uppercase text-slate-500">Live 24H</span>
            </div>

            {/* 4 Ranked Story Shimmer Rows */}
            <div className="space-y-5">
              {[1, 2, 3, 4].map((rank) => (
                <div key={rank} className="flex gap-4 items-start group">
                  <span className="text-2xl font-black font-mono text-slate-700 select-none">
                    0{rank}
                  </span>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-16 bg-slate-800/90 rounded animate-pulse" />
                      <div className="h-3 w-12 bg-slate-800/60 rounded animate-pulse" />
                    </div>
                    <div className="h-4 w-full bg-slate-800/80 rounded animate-pulse" />
                    <div className="h-4 w-4/5 bg-slate-800/70 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Sidebar Custom Sponsor Banner Shimmer */}
          <div className="bg-gradient-to-br from-emerald-950/20 via-slate-900 to-teal-950/20 border border-emerald-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="h-4 w-28 bg-emerald-500/20 rounded-md animate-pulse" />
              <div className="h-3 w-16 bg-emerald-500/15 rounded animate-pulse" />
            </div>
            <div className="h-6 w-11/12 bg-emerald-400/20 rounded mb-2 animate-pulse" />
            <div className="h-4 w-full bg-slate-800/80 rounded mb-2 animate-pulse" />
            <div className="h-4 w-3/4 bg-slate-800/70 rounded mb-5 animate-pulse" />
            <div className="h-10 w-full bg-gradient-to-r from-emerald-500/30 to-teal-500/30 rounded-lg animate-pulse" />
          </div>

          {/* 3. Field Bureau Morning Wire Newsletter Shimmer */}
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6">
            <div className="h-4 w-36 bg-slate-800 rounded mb-2 animate-pulse" />
            <div className="h-3 w-48 bg-slate-800/70 rounded mb-4 animate-pulse" />
            <div className="space-y-2.5">
              <div className="h-10 w-full bg-slate-800/80 rounded-lg animate-pulse" />
              <div className="h-10 w-full bg-red-600/30 rounded-lg animate-pulse" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
