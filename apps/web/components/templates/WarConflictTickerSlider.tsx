'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { FALLBACK_TOP_STORIES_NEWS, type ExternalNewsItem } from '@/lib/external-news';

interface WarConflictTickerSliderProps {
  items?: ExternalNewsItem[];
  langPrefix?: string;
}

interface ConflictZoneStyle {
  label: string;
  badgeClass: string;
  pulseColor: string;
}

export function WarConflictTickerSlider({
  items: initialItems,
  langPrefix = '/en',
}: WarConflictTickerSliderProps) {
  const [items, setItems] = useState<ExternalNewsItem[]>(
    Array.isArray(initialItems) && initialItems.length > 0 ? initialItems : FALLBACK_TOP_STORIES_NEWS
  );

  useEffect(() => {
    if (Array.isArray(initialItems) && initialItems.length > 0) {
      setItems(initialItems);
      return;
    }

    let isMounted = true;
    fetch('/api/ticker')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.items && Array.isArray(data.items) && data.items.length > 0) {
          setItems(data.items);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [initialItems]);

  const newsList = useMemo(() => (Array.isArray(items) && items.length > 0 ? items : FALLBACK_TOP_STORIES_NEWS), [items]);
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
    if (raw.includes('tech & space') || raw.includes('aerospace') || raw.includes('isro')) {
      return {
        label: '🚀 TECH & SPACE',
        badgeClass: 'bg-sky-600 text-white border-sky-400 font-bold',
        pulseColor: 'bg-sky-500',
      };
    }
    if (raw.includes('maritime') || raw.includes('shipping') || raw.includes('imo')) {
      return {
        label: '⚓ MARITIME & TRADE',
        badgeClass: 'bg-blue-600 text-white border-blue-400 font-bold',
        pulseColor: 'bg-blue-500',
      };
    }
    if (raw.includes('infrastructure') || raw.includes('transit') || raw.includes('bridge') || raw.includes('rail')) {
      return {
        label: '🚆 INFRASTRUCTURE',
        badgeClass: 'bg-teal-600 text-white border-teal-400 font-bold',
        pulseColor: 'bg-teal-500',
      };
    }
    if (raw.includes('aquaculture') || raw.includes('fisheries') || raw.includes('trout')) {
      return {
        label: '🐟 AQUACULTURE',
        badgeClass: 'bg-emerald-600 text-white border-emerald-400 font-bold',
        pulseColor: 'bg-emerald-500',
      };
    }
    if (raw.includes('culture') || raw.includes('craft') || raw.includes('shawl') || raw.includes('pashmina')) {
      return {
        label: '🧵 HERITAGE & CRAFT',
        badgeClass: 'bg-purple-600 text-white border-purple-400 font-bold',
        pulseColor: 'bg-purple-500',
      };
    }
    if (raw.includes('fiscal') || raw.includes('finance') || raw.includes('economy') || raw.includes('budget') || raw.includes('outlay') || raw.includes('crore')) {
      return {
        label: '📊 UNION ECONOMY',
        badgeClass: 'bg-emerald-700 text-white border-emerald-500 font-bold',
        pulseColor: 'bg-emerald-400',
      };
    }
    if (raw.includes('legal') || raw.includes('court') || raw.includes('judiciary') || raw.includes('bench')) {
      return {
        label: '⚖️ LEGAL RECORD',
        badgeClass: 'bg-indigo-700 text-white border-indigo-500 font-bold',
        pulseColor: 'bg-indigo-400',
      };
    }
    if (raw.includes('dysp') || raw.includes('civil dispatch') || raw.includes('police') || raw.includes('demise') || raw.includes('passes away')) {
      return {
        label: '🏛️ CIVIL DESK',
        badgeClass: 'bg-slate-700 text-white border-slate-500 font-bold',
        pulseColor: 'bg-slate-400',
      };
    }
    if (raw.includes('raabta') || raw.includes('pipeline') || raw.includes('water supply') || raw.includes('civic')) {
      return {
        label: '💧 CIVIC INITIATIVE',
        badgeClass: 'bg-teal-700 text-white border-teal-500 font-bold',
        pulseColor: 'bg-teal-400',
      };
    }
    if (raw.includes('agri') || raw.includes('mandi') || raw.includes('apple') || raw.includes('saffron')) {
      return {
        label: '🌾 AGRI & COMMERCE',
        badgeClass: 'bg-amber-600 text-white border-amber-400 font-bold',
        pulseColor: 'bg-amber-500',
      };
    }
    if (raw.includes('governance') || raw.includes('cabinet') || raw.includes('parliament')) {
      return {
        label: '🏛️ GOVERNANCE',
        badgeClass: 'bg-slate-700 text-white border-slate-500 font-bold',
        pulseColor: 'bg-slate-400',
      };
    }

    const fallbackLoc = item.badge || item.location || 'TOP STORY';
    return {
      label: `🔵 ${fallbackLoc.toUpperCase()}`,
      badgeClass: 'bg-slate-800 text-slate-100 border-slate-600 font-bold',
      pulseColor: 'bg-cyan-500',
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
      className="w-full bg-[#080C16] border-y border-slate-800 text-slate-100 font-sans shadow-sm select-none relative overflow-hidden"
      data-purpose="top-stories-ticker"
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
        {/* Pinned Left Pill: Live Beacon Label */}
        <div className="flex items-center gap-1.5 shrink-0 z-10 bg-[#080C16] pr-2 shadow-[4px_0_12px_#080C16]">
          <span className="flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded bg-slate-900 border border-cyan-500/40 text-cyan-300 font-mono font-extrabold text-[9px] sm:text-[10.5px] tracking-wider uppercase whitespace-nowrap">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-cyan-400" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
            </span>
            <span className="hidden xs:inline">TOP STORIES WIRE</span>
            <span className="xs:hidden">TOP WIRE</span>
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

        {/* Pinned Right Link to Live Dispatches */}
        <div className="shrink-0 z-10 bg-[#080C16] pl-2 shadow-[-4px_0_12px_#080C16] hidden md:flex items-center">
          <Link
            href={`${langPrefix}/latest`}
            className="text-[10.5px] text-cyan-400 hover:text-cyan-300 font-semibold tracking-wide hover:underline whitespace-nowrap"
          >
            All Dispatches →
          </Link>
        </div>
      </div>
    </div>
  );
}
