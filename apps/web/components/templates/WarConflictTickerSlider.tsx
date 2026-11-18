'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import type { ExternalNewsItem } from '@/lib/external-news';

interface WarConflictTickerSliderProps {
  items: ExternalNewsItem[];
  langPrefix: string;
}

interface ConflictZoneStyle {
  label: string;
  badgeClass: string;
  pulseColor: string;
}

export function WarConflictTickerSlider({ items, langPrefix }: WarConflictTickerSliderProps) {
  const newsList = useMemo(() => (Array.isArray(items) && items.length > 0 ? items : []), [items]);
  const total = newsList.length;

  if (total === 0) return null;

  // Resolve distinctive location highlight badge with high-visibility colors
  const resolveZoneStyle = (item: ExternalNewsItem): ConflictZoneStyle => {
    const raw = `${item.location || ''} ${item.badge || ''} ${item.title || ''}`.toLowerCase();

    if (raw.includes('earthquake') || raw.includes('quake') || raw.includes('seismic') || raw.includes('richter') || raw.includes('tremor')) {
      return {
        label: '⚠️ EARTHQUAKE ALERT',
        badgeClass: 'bg-amber-400 text-black border-amber-300 font-black',
        pulseColor: 'bg-amber-400',
      };
    }
    if (raw.includes('ukrain') || raw.includes('kyiv') || raw.includes('kharkiv') || raw.includes('donbas')) {
      return {
        label: '🔴 UKRAINE FRONT',
        badgeClass: 'bg-red-600 text-white border-red-500 font-bold',
        pulseColor: 'bg-red-500',
      };
    }
    if (raw.includes('gaza') || raw.includes('palestin') || raw.includes('rafah') || raw.includes('khan younis')) {
      return {
        label: '🔴 GAZA CRISIS',
        badgeClass: 'bg-rose-600 text-white border-rose-500 font-bold',
        pulseColor: 'bg-rose-500',
      };
    }
    if (raw.includes('iran') || raw.includes('red sea') || raw.includes('yemen') || raw.includes('houthi') || raw.includes('bab el-mandeb') || raw.includes('tehran')) {
      return {
        label: '🟠 IRAN / RED SEA',
        badgeClass: 'bg-amber-500 text-black border-amber-400 font-extrabold',
        pulseColor: 'bg-amber-500',
      };
    }
    if (raw.includes('lebanon') || raw.includes('beirut') || raw.includes('hezbollah') || raw.includes('blue line')) {
      return {
        label: '🔴 LEBANON BORDER',
        badgeClass: 'bg-red-600 text-white border-red-500 font-bold',
        pulseColor: 'bg-red-500',
      };
    }
    if (raw.includes('syria') || raw.includes('damascus') || raw.includes('aleppo')) {
      return {
        label: '🔴 SYRIA STRIKES',
        badgeClass: 'bg-red-700 text-white border-red-600 font-bold',
        pulseColor: 'bg-red-600',
      };
    }
    if (raw.includes('sudan') || raw.includes('darfur')) {
      return {
        label: '🔴 SUDAN RELIEF',
        badgeClass: 'bg-red-800 text-white border-red-700 font-bold',
        pulseColor: 'bg-red-600',
      };
    }

    const fallbackLoc = item.location ? `🔴 ${item.location.toUpperCase()}` : `🔴 ${item.badge || 'CRISIS RADAR'}`;
    return {
      label: fallbackLoc,
      badgeClass: 'bg-red-600 text-white border-red-500 font-bold',
      pulseColor: 'bg-red-500',
    };
  };

  const getTimeAgo = (dateStr?: string) => {
    if (!dateStr) return 'Just now';
    const diffMs = Date.now() - new Date(dateStr).getTime();
    if (isNaN(diffMs)) return 'Live';
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return 'Today';
  };

  // Duplicate items for continuous seamless 50% translation infinite loop
  const marqueeItems = [...newsList, ...newsList];

  return (
    <div
      className="w-full bg-[#080C16] border-y border-red-600/40 text-slate-100 font-sans shadow-sm select-none relative overflow-hidden"
      data-purpose="war-crisis-ticker"
    >
      <style>{`
        @keyframes warMarqueeScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .war-marquee-track {
          display: flex;
          width: max-content;
          animation: warMarqueeScroll 40s linear infinite;
          will-change: transform;
        }
        .war-marquee-track:hover,
        .war-marquee-track:active {
          animation-play-state: paused;
        }
      `}</style>

      <div className="w-full max-w-7xl xl:max-w-[1536px] 2xl:max-w-[1780px] mx-auto px-2 sm:px-4 md:px-8 py-1.5 sm:py-2 flex items-center justify-between gap-2 overflow-hidden">
        {/* Pinned Left Pill: Crisis Beacon Label */}
        <div className="flex items-center gap-1.5 shrink-0 z-10 bg-[#080C16] pr-2 shadow-[4px_0_12px_#080C16]">
          <span className="flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded bg-red-950/90 border border-red-500/50 text-red-300 font-mono font-extrabold text-[9px] sm:text-[10.5px] tracking-wider uppercase whitespace-nowrap">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-red-500" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="hidden xs:inline">WAR &amp; CRISIS WIRE</span>
            <span className="xs:hidden">WAR WIRE</span>
          </span>
        </div>

        {/* Continuous Smooth Scrolling Marquee Area */}
        <div className="flex-1 min-w-0 overflow-hidden relative">
          <div className="war-marquee-track flex items-center gap-6 sm:gap-8">
            {marqueeItems.map((item, idx) => {
              const zone = resolveZoneStyle(item);
              const resolveInternalHref = (url?: string) => {
                if (!url || url === '#' || url.startsWith('http://') || url.startsWith('https://')) {
                  return `${langPrefix}/international`;
                }
                if (url.startsWith('/en/') || url.startsWith('/ur/') || url.startsWith('/hi/')) {
                  return url;
                }
                if (url.startsWith('/')) {
                  return `${langPrefix}${url}`;
                }
                return `${langPrefix}/international`;
              };
              const href = resolveInternalHref(item.url);

              return (
                <div key={`${item.id}-${idx}`} className="flex items-center gap-2 shrink-0">
                  <span
                    className={`shrink-0 px-1.5 sm:px-2 py-0.5 rounded text-[9.5px] sm:text-[10.5px] uppercase tracking-wide border shadow-xs ${zone.badgeClass}`}
                  >
                    {zone.label}
                  </span>
                  <Link
                    href={href}
                    className="text-[11.5px] sm:text-[12.5px] text-slate-100 hover:text-white hover:underline font-medium whitespace-nowrap transition-colors"
                  >
                    {item.title}
                  </Link>
                  <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                    &bull; {getTimeAgo(item.publishedAt)}
                  </span>
                  <span className="text-red-500/60 font-bold select-none ml-2">&bull;</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pinned Right Link to World Desk */}
        <div className="shrink-0 z-10 bg-[#080C16] pl-2 shadow-[-4px_0_12px_#080C16] hidden md:flex items-center">
          <Link
            href={`${langPrefix}/international`}
            className="text-[10.5px] text-red-400 hover:text-red-300 font-semibold tracking-wide hover:underline whitespace-nowrap"
          >
            World Desk →
          </Link>
        </div>
      </div>
    </div>
  );
}
