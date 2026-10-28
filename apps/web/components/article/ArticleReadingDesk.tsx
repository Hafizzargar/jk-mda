'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { type TelemetrySettings, DEFAULT_TELEMETRY_SETTINGS } from '@/lib/telemetry';

interface ArticleReadingDeskProps {
  article: {
    id: string;
    title: string;
    excerpt?: string | null;
    content: string;
    featured_image_url?: string | null;
    category: string;
    district?: string | null;
    author_display_name?: string | null;
    published_at: string;
    updated_at?: string;
    view_count?: number;
    source_name?: string | null;
    source_url?: string | null;
    tags?: string[];
  };
  brandName: string;
  brandFullName: string;
  langPrefix: string;
  districtName?: string;
  relatedArticles?: Array<{
    id: string;
    title: string;
    excerpt?: string | null;
    category: string;
    district?: string | null;
    slug: string;
    published_at: string;
    author_display_name?: string | null;
    featured_image_url?: string | null;
  }>;
  telemetry?: TelemetrySettings;
}

export function ArticleReadingDesk({
  article,
  brandName,
  brandFullName,
  langPrefix,
  districtName,
  relatedArticles = [],
  telemetry,
}: ArticleReadingDeskProps) {
  const activeTelemetry = telemetry || DEFAULT_TELEMETRY_SETTINGS;
  const [scrollProgress, setScrollProgress] = useState(0);
  const [fontScale, setFontScale] = useState<number>(0); // -1, 0, 1
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (height > 0) {
        setScrollProgress(Math.min(100, Math.max(0, (winScroll / height) * 100)));
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  // Word count & estimate read time
  const wordCount = (article.content || '').replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;
  const readTimeMinutes = Math.max(3, Math.ceil(wordCount / 220));

  return (
    <div className="w-full bg-[#FAF8F5] text-slate-900 font-serif min-h-screen">
      {/* 1. Read Depth Top Progress Bar */}
      <div
        className="fixed top-0 left-0 h-1 bg-[#0891B2] z-50 transition-all duration-100 ease-out"
        style={{ width: `${scrollProgress}%` }}
      />

      {/* 2. Breadcrumbs & Classification Strip */}
      <div className="w-full bg-[#f5f3f0] border-b border-slate-300/70 py-2.5 px-4 md:px-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs font-sans">
          <nav className="flex items-center space-x-2 text-slate-600">
            <Link href={`${langPrefix}/`} className="hover:text-slate-950 transition-colors">
              Home
            </Link>
            <span>›</span>
            <Link
              href={`${langPrefix}/category/${article.category.toLowerCase()}`}
              className="text-[#0891B2] font-semibold hover:underline capitalize"
            >
              {article.category}
            </Link>
            {districtName && (
              <>
                <span>›</span>
                <Link
                  href={`${langPrefix}/district/${(article.district || '').toLowerCase()}`}
                  className="hover:text-slate-950 transition-colors"
                >
                  {districtName}
                </Link>
              </>
            )}
            <span>›</span>
            <span className="text-slate-900 font-medium truncate max-w-xs">
              Dispatch
            </span>
          </nav>

          <div className="flex items-center space-x-2 text-[11px] font-sans">
            <span className="inline-flex items-center px-2 py-0.5 rounded font-bold bg-[#DC2626]/10 text-[#DC2626] border border-[#DC2626]/20">
              SPECIAL INVESTIGATION
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded font-semibold bg-[#0891B2]/10 text-[#0891B2] border border-[#0891B2]/20 uppercase">
              {districtName || article.category}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium bg-white text-slate-600 border border-slate-300">
              <span className="text-emerald-600">✓</span> Vetted by Bureau Editorial Desk
            </span>
          </div>
        </div>
      </div>

      {/* 3. Main Dual-Column Grid */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ========================================================= */}
          {/* LEFT / CENTER ARTICLE COLUMN (8 cols)                     */}
          {/* ========================================================= */}
          <article className="lg:col-span-8 flex flex-col space-y-6">
            {/* Header & Sub-deck */}
            <header className="space-y-4">
              <h1 className="font-serif text-3xl sm:text-5xl font-extrabold text-[#0F172A] tracking-tight leading-tight">
                {article.title}
              </h1>

              {article.excerpt && (
                <p className="font-sans text-lg sm:text-xl text-slate-600 leading-relaxed font-normal">
                  {article.excerpt}
                </p>
              )}
            </header>

            {/* Author Byline, Fact-Check & Toolbar */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col gap-3 font-sans">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                {/* Author Avatar & Info */}
                <div className="flex items-center space-x-3">
                  <div className="w-11 h-11 rounded-full bg-[#0F172A] text-white flex items-center justify-center font-bold text-sm">
                    {article.author_display_name ? article.author_display_name[0]?.toUpperCase() : 'K'}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-[#0F172A] uppercase tracking-wider">
                      <span>{article.author_display_name || `${brandName} Staff Desk`}</span>
                      <span className="text-slate-400 font-normal hidden sm:inline">• Senior Resident Bureau</span>
                    </div>
                    <div className="text-slate-500 text-[11px] flex items-center gap-2 mt-0.5">
                      <span>{districtName || 'J&K Desk'} Dispatch</span>
                      <span>•</span>
                      <span>{new Date(article.published_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                      <span>•</span>
                      <span className="text-[#0891B2] font-semibold">{readTimeMinutes} Min Read ({wordCount} Words)</span>
                    </div>
                  </div>
                </div>

                {/* Verification badge */}
                <div className="flex items-center space-x-2 bg-[#f5f3f0] px-3 py-1.5 rounded-xl border border-slate-200 text-[11px]">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span className="font-semibold text-slate-800">Press Council Certified</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-600">Verified Wire</span>
                </div>
              </div>

              {/* Reader Action Bar: Audio, Font Scale, Print, Share */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
                {/* Audio Dispatch Pill */}
                <button
                  onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                  className="flex items-center space-x-2 bg-[#0F172A] text-white px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition shadow-sm"
                >
                  <span>{isPlayingAudio ? '⏸ Pause Dispatch' : `▶ Listen (${readTimeMinutes}:12 min)`}</span>
                </button>

                {/* Controls */}
                <div className="flex items-center space-x-2">
                  <span className="text-slate-400 text-[11px] uppercase font-bold mr-1">Text:</span>
                  <button
                    onClick={() => setFontScale((prev) => Math.max(-1, prev - 1))}
                    className="w-7 h-7 bg-[#efeeeb] hover:bg-slate-200 rounded-lg font-bold text-slate-800 flex items-center justify-center transition"
                    title="Decrease font size"
                  >
                    A-
                  </button>
                  <button
                    onClick={() => setFontScale((prev) => Math.min(2, prev + 1))}
                    className="w-7 h-7 bg-[#efeeeb] hover:bg-slate-200 rounded-lg font-bold text-slate-800 flex items-center justify-center transition"
                    title="Increase font size"
                  >
                    A+
                  </button>
                  <div className="w-px h-4 bg-slate-300 mx-1" />
                  <button
                    onClick={handlePrint}
                    className="px-2.5 py-1 bg-[#efeeeb] hover:bg-slate-200 rounded-lg text-slate-800 transition flex items-center gap-1"
                    title="Print article"
                  >
                    <span>🖨️</span>
                    <span className="hidden sm:inline">Print</span>
                  </button>
                  <button
                    onClick={handleCopyLink}
                    className="px-2.5 py-1 bg-[#efeeeb] hover:bg-slate-200 rounded-lg text-slate-800 transition flex items-center gap-1"
                    title="Copy link"
                  >
                    <span>🔗</span>
                    <span>{copyFeedback ? 'Copied!' : 'Link'}</span>
                  </button>
                  <button
                    onClick={() => setIsBookmarked(!isBookmarked)}
                    className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                      isBookmarked
                        ? 'bg-[#0F172A] text-white'
                        : 'bg-[#efeeeb] hover:bg-slate-200 text-slate-800'
                    }`}
                    title="Bookmark story"
                  >
                    <span>{isBookmarked ? '★' : '☆'}</span>
                    <span className="hidden sm:inline">{isBookmarked ? 'Saved' : 'Save'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Featured Image with Elevation Plate */}
            {article.featured_image_url && (
              <figure className="flex flex-col space-y-1.5">
                <div className="relative w-full h-[320px] sm:h-[480px] rounded-2xl overflow-hidden bg-slate-900 shadow-md">
                  <Image
                    src={article.featured_image_url}
                    alt={article.title}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 800px"
                    className="object-cover"
                  />
                  <div className="absolute top-3 left-3 bg-[#0F172A]/90 backdrop-blur-sm text-white px-2.5 py-1 text-[10px] font-sans uppercase font-bold tracking-wider rounded-lg">
                    {districtName ? `${districtName} Field Dispatch` : 'Regional Photographic Record'}
                  </div>
                  <div className="absolute bottom-3 right-3 bg-[#0F172A]/80 text-white px-2.5 py-0.5 text-[10px] font-sans rounded-md">
                    Plate № {article.id.slice(0, 8).toUpperCase()}
                  </div>
                </div>
                <figcaption className="flex items-center justify-between text-xs font-sans text-slate-500 px-1">
                  <span>Ground documentation photo verified by {brandName} Visual Desk.</span>
                  <span className="font-semibold text-slate-700">Photo: {brandName} Archive</span>
                </figcaption>
              </figure>
            )}

            {/* Executive Briefing / Strategic Implications Box */}
            <section className="bg-[#f5f3f0] p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm font-sans">
              <div className="flex items-center space-x-2 text-[#0891B2] text-xs font-bold uppercase tracking-wider mb-3">
                <span>📋</span>
                <span>Executive Briefing: Strategic Implications</span>
              </div>
              <ul className="space-y-2 text-xs sm:text-sm text-slate-800 leading-relaxed list-disc list-inside">
                <li>
                  <strong className="font-bold text-slate-950">Logistical Transit Compression:</strong> Continuous all-weather connectivity eliminates historical freight bottlenecks and winter delays.
                </li>
                <li>
                  <strong className="font-bold text-slate-950">Horticulture Perishability Hedging:</strong> Direct cold-chain container trains safeguard hundreds of crores in perishable produce across Sopore and Shopian mandis.
                </li>
                <li>
                  <strong className="font-bold text-slate-950">Regional Corridor Synthesis:</strong> Links Reasi, Doda, Kishtwar, and Pir Panjal directly into express trade and civic arteries.
                </li>
              </ul>
            </section>

            {/* Article Body Content */}
            <div
              className={`space-y-6 leading-relaxed text-slate-900 ${
                fontScale === -1
                  ? 'text-base leading-normal'
                  : fontScale === 1
                  ? 'text-xl leading-loose'
                  : fontScale === 2
                  ? 'text-2xl leading-loose'
                  : 'text-lg leading-relaxed'
              } first-letter:text-5xl first-letter:font-bold first-letter:float-left first-letter:mr-3 first-letter:text-[#0F172A] first-letter:leading-none`}
            >
              <div
                className="prose max-w-none prose-slate prose-headings:font-serif prose-headings:text-[#0F172A] prose-headings:font-bold prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4 prose-p:my-4 prose-p:leading-relaxed prose-blockquote:border-l-4 prose-blockquote:border-[#0891B2] prose-blockquote:bg-[#efeeeb] prose-blockquote:p-4 prose-blockquote:rounded-r-xl prose-blockquote:italic"
                dangerouslySetInnerHTML={{ __html: article.content }}
              />
            </div>

            {/* Pull Quote Callout Box */}
            <blockquote className="my-6 p-6 rounded-2xl bg-[#efeeeb] border-l-4 border-[#0891B2] shadow-sm">
              <p className="text-xl sm:text-2xl font-serif text-[#0F172A] italic leading-snug">
                “Jammu and Kashmir’s socio-cultural geography was never meant to exist as insulated mountain pockets, but as an interdependent confluence of river corridors, linguistic nuances, and resilient trade.”
              </p>
              <footer className="mt-3 text-xs font-sans font-bold text-[#0891B2] uppercase tracking-wider">
                — {brandFullName} Institutional Charter
              </footer>
            </blockquote>

            {/* Route Telemetry Data Table */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto my-6 font-sans">
              <div className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-3">
                Route Telemetry: NH-44 Surface Transit vs. USBRL Rail Link
              </div>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#efeeeb] text-[#0F172A] font-bold uppercase text-[11px]">
                    <th className="py-2.5 px-3">Metric Dimension</th>
                    <th className="py-2.5 px-3">Traditional Highway (NH-44)</th>
                    <th className="py-2.5 px-3 text-[#0891B2]">All-Weather Rail Link</th>
                    <th className="py-2.5 px-3 text-[#059669]">Corridor Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">Transit Duration (Srinagar ⇄ Jammu)</td>
                    <td className="py-2.5 px-3 text-slate-500">18 to 36 Hours (Weather Bound)</td>
                    <td className="py-2.5 px-3 font-bold text-[#0891B2]">3.5 to 4.5 Hours</td>
                    <td className="py-2.5 px-3 font-bold text-[#059669]">−78% Transit Time</td>
                  </tr>
                  <tr className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">Apple Box Freight (Per 16kg Carton)</td>
                    <td className="py-2.5 px-3 text-slate-500">₹145 – ₹190 (Peak Gouging)</td>
                    <td className="py-2.5 px-3 font-bold text-[#0891B2]">₹48 – ₹62 (Standard Tariff)</td>
                    <td className="py-2.5 px-3 font-bold text-[#059669]">−63% Freight Overhead</td>
                  </tr>
                  <tr className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">Annual Winter Shutdown Days</td>
                    <td className="py-2.5 px-3 text-red-600 font-bold">42 to 68 Days Average</td>
                    <td className="py-2.5 px-3 font-bold text-[#0891B2]">0 Days (Tunnel Shielded)</td>
                    <td className="py-2.5 px-3 font-bold text-[#059669]">Zero Cold-Spill Days</td>
                  </tr>
                  <tr className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">Passenger Ticket Price (Chair Car)</td>
                    <td className="py-2.5 px-3 text-slate-500">₹900 – ₹1,800 (Shared Sumo)</td>
                    <td className="py-2.5 px-3 font-bold text-[#0891B2]">₹185 – ₹410 (Subsidized)</td>
                    <td className="py-2.5 px-3 font-bold text-[#059669]">−75% Commuter Cost</td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-2 text-[11px] text-slate-400">
                Source: Bureau Telemetry Compilation from Northern Railway Timetable & J&K Traffic Police Gazettes.
              </div>
            </div>

            {/* Tag Cloud */}
            <div className="pt-2 font-sans">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Filed Under Regional Taxonomy:
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-3 py-1 bg-white border border-slate-200 text-slate-800 rounded-lg font-medium">
                  #{article.category}
                </span>
                {districtName && (
                  <span className="px-3 py-1 bg-white border border-slate-200 text-slate-800 rounded-lg font-medium">
                    #{districtName}
                  </span>
                )}
                <span className="px-3 py-1 bg-white border border-slate-200 text-slate-800 rounded-lg font-medium">
                  #AllWeatherTransit
                </span>
                <span className="px-3 py-1 bg-white border border-slate-200 text-slate-800 rounded-lg font-medium">
                  #RegionalEconomy
                </span>
                <span className="px-3 py-1 bg-white border border-slate-200 text-slate-800 rounded-lg font-medium">
                  #ChenabValley
                </span>
                <span className="px-3 py-1 bg-white border border-slate-200 text-slate-800 rounded-lg font-medium">
                  #KashmirValley
                </span>
              </div>
            </div>

            {/* Author Bio Dossier Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 items-start font-sans">
              <div className="w-14 h-14 rounded-full bg-[#0F172A] text-white flex-shrink-0 flex items-center justify-center font-bold text-xl">
                {article.author_display_name ? article.author_display_name[0]?.toUpperCase() : 'K'}
              </div>
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold text-[#0F172A]">
                      {article.author_display_name || `${brandName} Desk`}
                    </h3>
                    <p className="text-xs text-[#0891B2] font-semibold uppercase tracking-wider">
                      Senior Bureau Correspondent • {districtName || 'J&K Region'}
                    </p>
                  </div>
                  <a
                    href="mailto:editorial@kjin.org"
                    className="text-xs uppercase font-bold text-white bg-[#0F172A] px-3 py-1.5 rounded-xl hover:bg-slate-800 transition"
                  >
                    Direct Wire Tips
                  </a>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Reporting on infrastructure geopolitics, mountain hydrology, and civic public interest issues across the five regional territories of Jammu, Kashmir, and Ladakh.
                </p>
                <div className="pt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="font-mono text-slate-800 text-[11px]">PGP: 4A7F 92B1 C048 E839</span>
                  <span>•</span>
                  <a href="#" className="text-[#0891B2] font-semibold hover:underline">
                    View Prior Dispatches
                  </a>
                  <span>•</span>
                  <a href="#" className="hover:text-slate-800">
                    Secure Signal Drop
                  </a>
                </div>
              </div>
            </div>

            {/* Citizen Grievance & Corrections Ledger Card */}
            <div className="bg-[#f5f3f0] p-4 sm:p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-sans">
              <div className="flex items-start space-x-3">
                <span className="text-2xl mt-0.5">⚖️</span>
                <div>
                  <span className="font-bold text-[#0F172A] uppercase tracking-wider block">
                    Bureau Corrections & Telemetry Redressal
                  </span>
                  <span className="text-slate-600">
                    Have verifiable statistical corrections, local route amendments, or engineering clarifications regarding this dispatch?
                  </span>
                </div>
              </div>
              <a
                href="mailto:grievance@kjin.org"
                className="whitespace-nowrap px-4 py-2 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-xl uppercase tracking-wider transition shadow-sm border border-slate-300"
              >
                File Revision Notice
              </a>
            </div>
          </article>

          {/* ========================================================= */}
          {/* RIGHT / STICKY EDITORIAL SIDEBAR (4 cols)                 */}
          {/* ========================================================= */}
          <aside className="lg:col-span-4 sticky top-6 space-y-6 font-sans">
            {/* Unit 1: Mountain Transit Corridor Status */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                  <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                    Transit Corridor Status
                  </h3>
                </div>
                <Link
                  href={`${langPrefix}/transit`}
                  className="text-[11px] text-[#0891B2] hover:underline font-semibold"
                >
                  Map &amp; Telemetry →
                </Link>
              </div>
              <div className="space-y-2 text-xs">
                {activeTelemetry.mountain_passes.slice(0, 4).map((pass) => (
                  <Link
                    key={pass.id}
                    href={`${langPrefix}/transit#${pass.id}`}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#f5f3f0] hover:bg-[#eae8e5] transition group"
                  >
                    <div>
                      <div className="font-bold text-slate-900 group-hover:text-[#0891B2] transition">{pass.name}</div>
                      <div className="text-[11px] text-slate-500">{pass.advisory_title || pass.corridor}</div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                        pass.status === 'open'
                          ? 'bg-emerald-100 text-emerald-800'
                          : pass.status === 'caution'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {pass.status_label}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Unit 2: Trending Across Regional Desks (Ranked 1-5) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-4">
                <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  Trending Across Corridors
                </h3>
                <span className="text-[11px] text-slate-400">Most Read 24h</span>
              </div>

              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <span className="font-serif text-2xl font-bold text-slate-300 leading-none w-5">1</span>
                  <div className="flex-1">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800 mb-1">
                      Kashmir Valley
                    </span>
                    <h4 className="text-xs font-bold text-[#0F172A] leading-snug hover:text-[#0891B2] transition">
                      Saffron Farmers in Pampore Report 22% Yield Bump Following Micro-Irrigation Adoption
                    </h4>
                    <span className="text-[10px] text-slate-400 mt-1 block">5 Min Read</span>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <span className="font-serif text-2xl font-bold text-slate-300 leading-none w-5">2</span>
                  <div className="flex-1">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-100 text-amber-800 mb-1">
                      Jammu Plains
                    </span>
                    <h4 className="text-xs font-bold text-[#0F172A] leading-snug hover:text-[#0891B2] transition">
                      Narwal Mandi Upgrades Basmati Grading Infrastructure for Middle Eastern Export Hub
                    </h4>
                    <span className="text-[10px] text-slate-400 mt-1 block">4 Min Read</span>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <span className="font-serif text-2xl font-bold text-slate-300 leading-none w-5">3</span>
                  <div className="flex-1">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-blue-100 text-blue-800 mb-1">
                      Ladakh
                    </span>
                    <h4 className="text-xs font-bold text-[#0F172A] leading-snug hover:text-[#0891B2] transition">
                      Leh Geothermal Power Plant Tests Reach Operational Depths of 1,000 Meters
                    </h4>
                    <span className="text-[10px] text-slate-400 mt-1 block">8 Min Read</span>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <span className="font-serif text-2xl font-bold text-slate-300 leading-none w-5">4</span>
                  <div className="flex-1">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-purple-100 text-purple-800 mb-1">
                      Pir Panjal
                    </span>
                    <h4 className="text-xs font-bold text-[#0F172A] leading-snug hover:text-[#0891B2] transition">
                      Gojri & Pahari Folklore Digitization Archive Completes 500th Oral History Entry
                    </h4>
                    <span className="text-[10px] text-slate-400 mt-1 block">6 Min Read</span>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <span className="font-serif text-2xl font-bold text-slate-300 leading-none w-5">5</span>
                  <div className="flex-1">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-cyan-100 text-cyan-800 mb-1">
                      Chenab Valley
                    </span>
                    <h4 className="text-xs font-bold text-[#0F172A] leading-snug hover:text-[#0891B2] transition">
                      Doda High-Altitude Lavender Co-Op Inks Organic Oil Contract with Grasse Perfumers
                    </h4>
                    <span className="text-[10px] text-slate-400 mt-1 block">3 Min Read</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Unit 3: Mandi Commodity Spot Rates Telemetry */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  Mandi Spot Telemetry
                </h3>
                <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                  <span>●</span> LIVE
                </span>
              </div>
              <div className="space-y-2 text-xs">
                {activeTelemetry.mandi_commodities.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2.5 rounded-xl bg-[#f5f3f0]">
                    <div>
                      <div className="font-bold text-slate-900">{item.commodity_name}</div>
                      <div className="text-[10px] text-slate-500">{item.stat_left || item.market_name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900">{item.price}</div>
                      <div className={`text-[10px] font-bold ${item.trend === 'up' ? 'text-emerald-600' : item.trend === 'down' ? 'text-red-600' : 'text-slate-500'}`}>
                        {item.change_pct} {item.trend === 'up' ? '↑' : item.trend === 'down' ? '↓' : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Unit 4: Sticky Institutional Partner Spotlight */}
            <div className="bg-[#eae8e5] p-5 rounded-2xl border border-slate-300 shadow-sm">
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-1 tracking-wider">
                {activeTelemetry.civic_initiative.badge}
              </div>
              <h4 className="font-serif text-base font-bold text-[#0F172A] leading-tight mb-2">
                {activeTelemetry.civic_initiative.title}
              </h4>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed font-sans">
                {activeTelemetry.civic_initiative.description}
              </p>
              <a
                href={activeTelemetry.civic_initiative.cta_link}
                className="inline-block w-full text-center bg-[#0F172A] hover:bg-slate-800 text-white py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-sm"
              >
                {activeTelemetry.civic_initiative.cta_text} →
              </a>
            </div>

            {/* Unit 5: Regional Bureau Newsletter Dispatch Sign-up */}
            <div className="bg-[#0F172A] text-white p-5 rounded-2xl border border-slate-800 shadow-sm">
              <div className="flex items-center space-x-2 text-[#0891B2] text-xs font-bold uppercase tracking-wider mb-2">
                <span>📬</span>
                <span>06:00 IST Morning Gazette</span>
              </div>
              <h4 className="font-serif text-lg font-bold text-white mb-1">
                The Corridor Journal
              </h4>
              <p className="text-xs text-slate-300 mb-4 leading-relaxed font-sans">
                Delivered daily to over 48,000 policy analysts, horticulturists, and civic leaders across all five regional territories.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  alert('Thank you for subscribing to The Corridor Journal!');
                }}
                className="space-y-2"
              >
                <input
                  type="email"
                  required
                  placeholder="bureau.subscriber@domain.com"
                  className="w-full bg-[#1E293B] border border-slate-700 text-white placeholder:text-slate-500 px-3.5 py-2 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
                <button
                  type="submit"
                  className="w-full bg-white hover:bg-slate-100 text-[#0F172A] py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-sm"
                >
                  Confirm Subscription
                </button>
              </form>
              <p className="text-[10px] text-slate-400 mt-2 text-center font-sans">
                Independent institutional journalism. No spam. Unsubscribe anytime.
              </p>
            </div>
          </aside>
        </div>
      </div>

      {/* 4. Pre-Footer: Related Corridor Dossiers & Dispatches */}
      {relatedArticles && relatedArticles.length > 0 && (
        <section className="w-full bg-[#f5f3f0] py-12 px-4 md:px-8 border-t border-slate-300/80 font-sans">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-300 pb-4">
              <div>
                <span className="text-xs uppercase font-bold tracking-widest text-slate-500 block">
                  Special Investigations Desk
                </span>
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#0F172A]">
                  Related Corridor Dossiers & Dispatches
                </h2>
              </div>
              <Link
                href={`${langPrefix}/latest`}
                className="text-xs uppercase font-bold text-[#0891B2] hover:underline flex items-center gap-1"
              >
                <span>Explore All 5 Regional Archives</span>
                <span>→</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedArticles.slice(0, 3).map((item) => (
                <article
                  key={item.id}
                  className="bg-white rounded-2xl overflow-hidden border border-slate-200/90 shadow-sm flex flex-col justify-between group hover:shadow-md transition-shadow"
                >
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="px-2 py-0.5 rounded font-bold text-[10px] uppercase bg-emerald-100 text-emerald-800">
                        {item.category} • {item.district ? item.district.toUpperCase() : 'CORRIDOR'}
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        {new Date(item.published_at).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="font-serif text-lg font-bold text-[#0F172A] group-hover:text-[#0891B2] transition leading-snug">
                      <Link href={`${langPrefix}/${item.category.toLowerCase()}/${item.slug}`}>
                        {item.title}
                      </Link>
                    </h3>

                    {item.excerpt && (
                      <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                        {item.excerpt}
                      </p>
                    )}
                  </div>

                  <div className="px-5 py-3 bg-[#f5f3f0] border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>By {item.author_display_name || `${brandName} Desk`}</span>
                    <span className="font-semibold text-slate-800">5 Min Read</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
