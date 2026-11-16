'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const newsList = useMemo(() => (Array.isArray(items) && items.length > 0 ? items : []), [items]);
  const total = newsList.length;

  const nextSlide = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const prevSlide = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  // Rotate every 4.5 seconds (4 to 5 sec user requirement)
  useEffect(() => {
    if (total <= 1 || isPaused) return;
    const timer = setInterval(() => {
      nextSlide();
    }, 4500);
    return () => clearInterval(timer);
  }, [total, isPaused, nextSlide]);

  if (total === 0) return null;

  const currentItem = newsList[currentIndex] || newsList[0];

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

  const zoneStyle = resolveZoneStyle(currentItem);

  // Time elapsed formatter
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

  const isExternalUrl = Boolean(currentItem.url && currentItem.url.startsWith('http'));
  const targetHref = isExternalUrl ? currentItem.url : `${langPrefix}/international`;

  return (
    <div
      className="w-full bg-[#080C16] border-y border-red-600/40 text-slate-100 font-sans shadow-sm select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      data-purpose="war-crisis-ticker"
    >
      <div className="max-w-7xl xl:max-w-[1536px] 2xl:max-w-[1780px] mx-auto px-3 sm:px-4 md:px-8 py-2">
        {/* DESKTOP / LAPTOP SINGLE-LINE FIXED TICKER */}
        <div className="hidden sm:flex items-center justify-between gap-3 text-xs leading-none">
          {/* Left: Crisis Beacon Label */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-950/80 border border-red-500/40 text-red-300 font-mono font-bold text-[10.5px] tracking-wider uppercase">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${zoneStyle.pulseColor}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${zoneStyle.pulseColor}`} />
              </span>
              <span>WAR &amp; CRISIS WIRE</span>
            </span>
          </div>

          {/* Center: Highlighted Conflict Zone + Single Line Headline */}
          <div className="flex-1 min-w-0 flex items-center gap-2.5 overflow-hidden">
            {/* Vivid Location Pill */}
            <span
              className={`shrink-0 px-2 py-0.5 rounded text-[10.5px] uppercase tracking-wide border shadow-xs transition-colors duration-300 ${zoneStyle.badgeClass}`}
            >
              {zoneStyle.label}
            </span>

            {/* Single Linear Headline */}
            <a
              href={targetHref}
              target={isExternalUrl ? '_blank' : undefined}
              rel={isExternalUrl ? 'noopener noreferrer' : undefined}
              className="text-[12.5px] text-slate-100 hover:text-white font-medium hover:underline truncate transition-colors duration-200"
              title={currentItem.title}
            >
              {currentItem.title}
            </a>

            {/* Freshness Badge */}
            <span className="shrink-0 text-[10.5px] text-slate-400 font-mono hidden md:inline-block">
              &bull; {getTimeAgo(currentItem.publishedAt)}
            </span>
          </div>

          {/* Right: Counter, Nav Arrows, Link to World Desk */}
          <div className="flex items-center gap-2.5 shrink-0 pl-2 text-slate-400">
            <span className="text-[10px] font-mono font-semibold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
              {currentIndex + 1} / {total}
            </span>

            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={prevSlide}
                className="w-5 h-5 rounded flex items-center justify-center bg-slate-900 hover:bg-slate-800 hover:text-white text-slate-300 transition text-[11px] border border-slate-800"
                aria-label="Previous War Alert"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={nextSlide}
                className="w-5 h-5 rounded flex items-center justify-center bg-slate-900 hover:bg-slate-800 hover:text-white text-slate-300 transition text-[11px] border border-slate-800"
                aria-label="Next War Alert"
              >
                ›
              </button>
            </div>

            <Link
              href={`${langPrefix}/international`}
              className="text-[10.5px] text-red-400 hover:text-red-300 font-semibold tracking-wide hover:underline hidden lg:inline-block ml-1"
            >
              World Desk →
            </Link>
          </div>
        </div>

        {/* MOBILE SINGLE LINE MARQUEE / SLIDER */}
        <div className="sm:hidden flex items-center gap-2 text-[11px] leading-tight">
          {/* Fixed Urgent Pill */}
          <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-950 border border-red-500/50 text-red-300 font-mono font-extrabold text-[9px] uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span>WAR</span>
          </span>

          {/* Dynamic Conflict Zone Pill */}
          <span
            className={`shrink-0 px-1.5 py-0.2 rounded text-[9.5px] uppercase font-bold border ${zoneStyle.badgeClass}`}
          >
            {zoneStyle.label.replace('🔴 ', '').replace('⚠️ ', '').replace('🟠 ', '')}
          </span>

          {/* Marquee / Single Line Headline */}
          <div className="flex-1 min-w-0 overflow-hidden relative">
            <a
              href={targetHref}
              target={isExternalUrl ? '_blank' : undefined}
              rel={isExternalUrl ? 'noopener noreferrer' : undefined}
              className="block truncate text-[11px] text-slate-200 active:text-white font-medium"
            >
              {currentItem.title}
            </a>
          </div>

          {/* Mobile Slide Next Control */}
          <button
            type="button"
            onClick={nextSlide}
            className="shrink-0 w-5 h-5 rounded flex items-center justify-center bg-slate-900 text-slate-300 text-xs border border-slate-800"
            aria-label="Next Alert"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
