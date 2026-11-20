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
    let author = (raw || '').trim();
    if (author.includes('KJIN')) author = author.replace(/\bKJIN\b/g, 'KJCPL');
    if (author.startsWith('KCPJLN')) author = author.replace(/\bKCPJLN\b/g, 'KJCPL');
    if (!author || author === 'Hafeez Zargar' || author === 'Hafiz Zargar' || author === 'KJCPL Team' || author === 'Team') {
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
      <div className="relative overflow-hidden bg-white p-5 rounded-2xl border-2 border-red-500/35 shadow-md shadow-red-500/5 bg-gradient-to-br from-white via-red-50/25 to-rose-50/20 font-sans" data-purpose="civic-problems">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-rose-500 to-red-600" />
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-red-100">
          <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md bg-red-600/10 text-red-700 border border-red-600/25 flex items-center gap-2 shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
            </span>
            Problems • Civic Issues
          </span>
        </div>
        <div className="py-2.5 text-center text-xs text-slate-600">
          <p className="italic font-serif">Monitoring drinking water, electricity, road cutoffs &amp; transit issues across J&amp;K districts.</p>
          <Link
            href={`${langPrefix}/category/problems`}
            className="mt-2 inline-block text-[11px] font-bold text-red-700 hover:text-red-800 hover:underline"
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
      className="relative overflow-hidden bg-white p-5 rounded-2xl border-2 border-red-500/35 shadow-md shadow-red-500/5 bg-gradient-to-br from-white via-red-50/30 to-rose-50/25 font-sans transition-all group"
      data-purpose="civic-problems-slider"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Red Alert Emergency Strip */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-rose-500 to-red-600" />

      {/* Header with Slider Controls */}
      <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-red-100/80">
        <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md bg-red-600/10 text-red-700 border border-red-600/25 flex items-center gap-2 shadow-2xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
          </span>
          Problems • Civic Issues
        </span>

        {count > 1 ? (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-red-950 font-bold bg-red-100/80 border border-red-200/80 px-2 py-0.5 rounded">
              {currentIndex + 1} / {count}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={prevSlide}
                className="w-5 h-5 rounded flex items-center justify-center bg-red-100/90 hover:bg-red-200 text-red-900 text-xs font-bold transition cursor-pointer border border-red-200/60"
                aria-label="Previous civic problem"
                title="Previous problem"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={nextSlide}
                className="w-5 h-5 rounded flex items-center justify-center bg-red-100/90 hover:bg-red-200 text-red-900 text-xs font-bold transition cursor-pointer border border-red-200/60"
                aria-label="Next civic problem"
                title="Next problem"
              >
                ›
              </button>
            </div>
          </div>
        ) : (
          <span className="text-[10px] font-mono text-red-700/80 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-200/50">Ground Radar</span>
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

          <h3 className="font-serif text-sm font-bold text-[#0F172A] leading-snug mb-1.5 hover:text-red-700 transition">
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
                idx === currentIndex ? 'w-5 bg-red-600 shadow-sm shadow-red-500/30' : 'w-1.5 bg-red-200 hover:bg-red-300'
              }`}
              aria-label={`Go to problem ${idx + 1}`}
            />
          ))}
        </div>
      )}

      {/* Footer link to Archive */}
      <div className="pt-2.5 mt-2 border-t border-red-100/90 flex items-center justify-between text-[10px]">
        <span className="text-[9px] text-red-900/80 font-mono font-semibold">
          {count} Active Grievance{count === 1 ? '' : 's'}
        </span>
        <Link
          href={`${langPrefix}/category/problems`}
          className="font-bold text-red-700 hover:text-red-800 transition flex items-center gap-1 group-hover:underline"
        >
          All J&amp;K Ground Grievances →
        </Link>
      </div>
    </div>
  );
}
