'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { ArticleItem } from './types';
import { getDistrictDisplayName } from '@/lib/taxonomy';
import { formatArticleDate } from '@/lib/date';
import { getOptimizedMediaUrl } from '@/lib/media';
import { getCorrespondentByBeat } from '@/lib/i18n';

interface CivicProblemsSliderProps {
  articles: ArticleItem[];
  langPrefix: string;
}

export function CivicProblemsSlider({ articles, langPrefix }: CivicProblemsSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const items = Array.isArray(articles) ? articles : [];
  const count = items.length;

  const nextSlide = useCallback(() => {
    if (count <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % count);
  }, [count]);

  const prevSlide = useCallback(() => {
    if (count <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + count) % count);
  }, [count]);

  // Auto-slide every 6 seconds unless hovered
  useEffect(() => {
    if (count <= 1 || isPaused) return;
    const interval = setInterval(() => {
      nextSlide();
    }, 6000);
    return () => clearInterval(interval);
  }, [count, isPaused, nextSlide]);

  const getCivicProblemTag = (title?: string | null, excerpt?: string | null) => {
    const text = `${title || ''} ${excerpt || ''}`.toLowerCase();
    if (text.includes('grower') || text.includes('saffron') || text.includes('walnut') || text.includes('apple') || text.includes('cold chain') || text.includes('mandi') || text.includes('horticulture') || text.includes('farmer') || text.includes('harvest')) {
      return { label: '🌾 Agriculture & Growers', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    }
    if (text.includes('accident') || text.includes('collision') || text.includes('crash') || text.includes('fatal')) {
      return { label: '⚠️ Road Safety', color: 'bg-rose-100 text-rose-800 border-rose-200' };
    }
    if (text.includes('internet') || text.includes('connectivity') || text.includes('network') || text.includes('broadband') || text.includes('tower')) {
      return { label: '📶 Connectivity', color: 'bg-purple-100 text-purple-800 border-purple-200' };
    }
    if (text.includes('water') || text.includes('jal shakti') || text.includes('phe') || text.includes('drinking') || text.includes('tanker')) {
      return { label: '💧 Water Crisis', color: 'bg-blue-100 text-blue-800 border-blue-200' };
    }
    if (text.includes('electric') || text.includes('power') || text.includes('transformer') || text.includes('pdd') || text.includes('blackout') || text.includes('load shedding')) {
      return { label: '⚡ Power Outage', color: 'bg-amber-100 text-amber-800 border-amber-200' };
    }
    if (text.includes('landslide') || text.includes('cutoff') || text.includes('cut off') || text.includes('blocked') || text.includes('snowbound')) {
      return { label: '🛣️ Road Cutoff', color: 'bg-stone-100 text-stone-800 border-stone-200' };
    }
    if (text.includes('road') || text.includes('highway') || text.includes('bridge') || text.includes('transit') || text.includes('pothole') || text.includes('pass')) {
      return { label: '🛣️ Transit & Roads', color: 'bg-stone-100 text-stone-800 border-stone-200' };
    }
    if (text.includes('hospital') || text.includes('doctor') || text.includes('health') || text.includes('phc') || text.includes('sdh') || text.includes('ambulance')) {
      return { label: '🏥 Healthcare', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    }
    return { label: '⚠️ Civic Issue', color: 'bg-orange-100 text-orange-800 border-orange-200' };
  };

  const cleanAuthor = (raw?: string | null, art?: ArticleItem) => {
    const author = (raw || '').trim();
    if (!author || author === 'Hafeez Zargar' || author === 'Hafiz Zargar' || author === 'KJCPL Team' || author === 'Team' || author.startsWith('KJIN') || author.includes('Bureau')) {
      if (art) return getCorrespondentByBeat(art);
      return 'KJCPL Ground Bureau';
    }
    const cleaned = author.replace(/\b(Bureau|Desk|Team)\s+(Bureau|Desk|Team)\b/gi, '$1').trim();
    return cleaned || 'KJCPL Ground Bureau';
  };

  const getArtHref = (art: ArticleItem) => {
    const cat = (art.category || 'problems').toLowerCase().replace(/\s+/g, '-');
    return `${langPrefix}/${cat}/${art.slug}`;
  };

  if (count === 0) {
    return (
      <div className="bg-white p-5 rounded-2xl border border-amber-200/90 shadow-sm bg-gradient-to-br from-white via-amber-50/25 to-orange-50/30 font-sans" data-purpose="civic-problems">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-amber-100">
          <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-amber-600/10 text-amber-700 border border-amber-600/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse inline-block" />
            Problems • Civic Issues
          </span>
        </div>
        <div className="py-2.5 text-center text-xs text-slate-500">
          <p className="italic">Monitoring drinking water, electricity, internet blackouts &amp; transit issues across J&amp;K.</p>
          <Link
            href={`${langPrefix}/category/problems`}
            className="mt-2 inline-block text-[11px] font-bold text-amber-700 hover:underline"
          >
            View Problems Archive →
          </Link>
        </div>
      </div>
    );
  }

  const activeArticle = items[currentIndex] || items[0];
  const tag = getCivicProblemTag(activeArticle.title, activeArticle.excerpt);

  return (
    <div
      className="bg-white p-5 rounded-2xl border border-amber-200/90 shadow-sm bg-gradient-to-br from-white via-amber-50/25 to-orange-50/30 font-sans transition-all"
      data-purpose="civic-problems-slider"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Header with Slider Controls */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-amber-100">
        <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-amber-600/10 text-amber-700 border border-amber-600/20 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse inline-block" />
          Problems • Civic Issues
        </span>

        {count > 1 ? (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-amber-800/80 font-bold">
              {currentIndex + 1} / {count}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevSlide}
                className="w-5 h-5 rounded flex items-center justify-center bg-amber-100/80 hover:bg-amber-200 text-amber-900 text-xs font-bold transition cursor-pointer"
                aria-label="Previous civic problem"
                title="Previous problem"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={nextSlide}
                className="w-5 h-5 rounded flex items-center justify-center bg-amber-100/80 hover:bg-amber-200 text-amber-900 text-xs font-bold transition cursor-pointer"
                aria-label="Next civic problem"
                title="Next problem"
              >
                ›
              </button>
            </div>
          </div>
        ) : (
          <span className="text-[10px] font-mono text-slate-400 font-medium">Ground Radar</span>
        )}
      </div>

      {/* Slide Content */}
      <div className="min-h-[140px] flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded border ${tag.color}`}>
              {tag.label}
            </span>
            {activeArticle.district && (
              <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded bg-slate-100 text-slate-700 border border-slate-200">
                📍 {getDistrictDisplayName(activeArticle.district)}
              </span>
            )}
          </div>

          <h3 className="font-serif text-sm font-bold text-[#0F172A] leading-snug mb-1.5 hover:text-[#0891B2] transition">
            <Link href={getArtHref(activeArticle)}>
              {activeArticle.title}
            </Link>
          </h3>

          {activeArticle.excerpt && (
            <p className="text-xs text-slate-600 font-serif line-clamp-2 leading-relaxed mb-2.5">
              {activeArticle.excerpt}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
          <span suppressHydrationWarning>{formatArticleDate(activeArticle.published_at)}</span>
          <span className="text-slate-500 font-medium">By {cleanAuthor(activeArticle.author_display_name, activeArticle)}</span>
        </div>
      </div>

      {/* Dots Indicator for Slider */}
      {count > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-3 pb-1">
          {items.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                idx === currentIndex ? 'w-5 bg-amber-600' : 'w-1.5 bg-amber-200 hover:bg-amber-400'
              }`}
              aria-label={`Go to problem ${idx + 1}`}
            />
          ))}
        </div>
      )}

      {/* Footer link to Archive */}
      <div className="pt-2.5 mt-2 border-t border-amber-100 flex items-center justify-between text-[10px]">
        <span className="text-[9px] text-amber-800/70 font-mono">
          {count} Active Grievance{count === 1 ? '' : 's'}
        </span>
        <Link
          href={`${langPrefix}/category/problems`}
          className="font-bold text-amber-700 hover:text-amber-800 transition flex items-center gap-1"
        >
          All J&amp;K Ground Grievances →
        </Link>
      </div>
    </div>
  );
}
