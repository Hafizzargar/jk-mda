'use client';

import { useState } from 'react';
import Link from 'next/link';
import { REGIONAL_DIVISIONS, JK_DISTRICTS, KJINRegionKey } from '@/lib/taxonomy';

interface RegionalCoverageWidgetProps {
  langPrefix?: string;
  className?: string;
}

export function RegionalCoverageWidget({ langPrefix = '', className = '' }: RegionalCoverageWidgetProps) {
  const [activeTab, setActiveTab] = useState<'all' | KJINRegionKey>('all');

  const regions = Object.values(REGIONAL_DIVISIONS);

  const displayedRegions = activeTab === 'all'
    ? regions
    : regions.filter((r) => r.id === activeTab);

  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-md shadow-xl ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-300">
              Regional Coverage
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Verified ground reporting across sub-regions
          </p>
        </div>
        <span className="rounded-full bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-0.5 text-[9px] font-mono font-bold text-cyan-300 uppercase tracking-wider">
          5 Regions &bull; 22 Districts
        </span>
      </div>

      {/* Regional Selector Pills */}
      <div className="flex flex-wrap gap-1 mb-4 pb-3 border-b border-slate-800/80">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
            activeTab === 'all'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          All
        </button>
        {regions.map((reg) => {
          const isActive = activeTab === reg.id;
          return (
            <button
              key={reg.id}
              type="button"
              onClick={() => setActiveTab(reg.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1.5 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                  : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span>{reg.shortName}</span>
              <span className="text-[9px] opacity-75 font-mono">({reg.districts.length})</span>
            </button>
          );
        })}
      </div>

      {/* Regions & Districts Grid */}
      <div className="space-y-3.5">
        {displayedRegions.map((reg) => (
          <div
            key={reg.id}
            className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3 hover:border-slate-700/80 transition"
          >
            {/* Region Title & Tagline */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-white tracking-tight">
                    {reg.name}
                  </h4>
                  <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${reg.badgeBg}`}>
                    {reg.districts.length} Districts
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                  {reg.tagline}
                </p>
              </div>

              <Link
                href={`${langPrefix}/region/${reg.id}`}
                className="text-[10px] font-medium text-cyan-400 hover:text-cyan-300 shrink-0 hover:underline inline-flex items-center gap-0.5"
                title={`View all ${reg.name} news`}
              >
                Feed &rarr;
              </Link>
            </div>

            {/* Districts Pills */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {reg.districts.map((distSlug) => {
                const distInfo = JK_DISTRICTS[distSlug];
                return (
                  <Link
                    key={distSlug}
                    href={`${langPrefix}/district/${distSlug}`}
                    className="px-2 py-0.5 rounded-md bg-slate-800/80 hover:bg-cyan-500/20 hover:text-cyan-200 hover:border-cyan-500/40 border border-slate-700/60 text-[11px] text-slate-300 font-medium transition"
                  >
                    {distInfo?.name || distSlug}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
