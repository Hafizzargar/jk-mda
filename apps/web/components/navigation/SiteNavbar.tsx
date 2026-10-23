'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SITE_SHORT_NAME } from '@/lib/config';
import { REGIONAL_DIVISIONS, NEWS_CATEGORIES } from '@/lib/taxonomy';
import { type TemplateTheme } from '@/lib/templates';

interface SiteNavbarProps {
  lang?: string;
  theme?: TemplateTheme;
  activeCategory?: string;
  activeDistrict?: string;
  activeRegion?: string;
}

export function SiteNavbar({
  lang = 'en',
  theme,
  activeCategory,
  activeDistrict,
  activeRegion,
}: SiteNavbarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [regionsOpen, setRegionsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const langPrefix = lang === 'en' ? '' : `/${lang}`;
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setRegionsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setRegionsOpen(false);
  }, [pathname]);

  const isDark = theme?.isDark ?? false;

  // Background and border tokens
  const navBg = theme?.headerBgClass || (isDark ? 'bg-slate-950/95' : 'bg-white/95');
  const navBorder = theme?.headerBorderClass || (isDark ? 'border-b border-slate-800' : 'border-b border-slate-200');
  const textPrimary = theme?.textPrimaryClass || (isDark ? 'text-white' : 'text-slate-900');
  const textMuted = theme?.textMutedClass || (isDark ? 'text-slate-400' : 'text-slate-500');
  const accentText = theme?.accentTextClass || (isDark ? 'text-cyan-400' : 'text-blue-700');
  const subtleBg = theme?.subtleBgClass || (isDark ? 'bg-slate-900' : 'bg-slate-100');

  const mainCategories = ['politics', 'local', 'economy', 'culture', 'investigation'];

  return (
    <header className={`sticky top-0 z-50 backdrop-blur-md ${navBg} ${navBorder} transition-colors duration-200`}>
      {/* 1. Slim Top Utility Strip (~28px) */}
      <div className={`border-b ${isDark ? 'border-slate-800/80' : 'border-slate-200/80'} px-4 py-1 text-[11px] font-sans flex items-center justify-between`}>
        {/* Left: Dateline & Pulse */}
        <div className="flex items-center gap-3">
          <span className={`font-semibold ${textPrimary}`}>{currentDate}</span>
          <span className="hidden sm:inline text-slate-400">&bull;</span>
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className={`font-mono text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
              Live Verified Wire
            </span>
          </div>
        </div>

        {/* Center: Publication Banner */}
        <div className={`hidden md:block text-[10px] font-bold uppercase tracking-widest ${textMuted}`}>
          Jammu & Kashmir Journal of Record
        </div>

        {/* Right: Language switchers & Quick Tip */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 font-mono text-[10px]">
            <Link
              href={pathname.replace(/^\/(ur|ks)/, '') || '/'}
              className={`px-1.5 py-0.5 rounded transition ${lang === 'en' ? 'font-bold bg-slate-200/60 dark:bg-slate-800 text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
            >
              EN
            </Link>
            <span className="text-slate-400">/</span>
            <Link
              href={`/ur${pathname.replace(/^\/(ur|ks)/, '')}`}
              className={`px-1.5 py-0.5 rounded transition ${lang === 'ur' ? 'font-bold bg-slate-200/60 dark:bg-slate-800 text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
            >
              اردو
            </Link>
            <span className="text-slate-400">/</span>
            <Link
              href={`/ks${pathname.replace(/^\/(ur|ks)/, '')}`}
              className={`px-1.5 py-0.5 rounded transition ${lang === 'ks' ? 'font-bold bg-slate-200/60 dark:bg-slate-800 text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
            >
              कॉशुर
            </Link>
          </div>

          <a
            href="mailto:editorial@kjin.org?subject=News%20Tip%20Dispatch"
            className={`hidden lg:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${isDark ? 'border-slate-800 hover:border-slate-700 text-slate-300' : 'border-slate-300 hover:border-slate-400 text-slate-700'} transition`}
          >
            Submit Tip
          </a>
        </div>
      </div>

      {/* 2. Compact Main Navigation Bar (~48px) */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-12 flex items-center justify-between gap-4">
        {/* Brand Mark */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href={`${langPrefix}/`}
            className={`text-2xl font-black tracking-tight uppercase hover:opacity-85 transition flex items-center gap-2 ${textPrimary}`}
            style={{ fontFamily: theme?.id === 'classic-editorial' ? 'Georgia, serif' : 'inherit' }}
          >
            <span>{SITE_SHORT_NAME}</span>
            <span className={`text-[10px] font-mono tracking-widest px-1.5 py-0.2 rounded font-bold uppercase hidden sm:inline-block ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700 border border-slate-300'}`}>
              J&K
            </span>
          </Link>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2 text-xs font-bold uppercase tracking-wider">
          {mainCategories.map((catKey) => {
            const cat = NEWS_CATEGORIES[catKey];
            const isActive = activeCategory === catKey;
            return (
              <Link
                key={catKey}
                href={`${langPrefix}/category/${catKey}`}
                className={`px-2.5 py-1.5 rounded-lg transition-colors duration-150 ${
                  isActive
                    ? `${accentText} font-extrabold ${subtleBg}`
                    : `${textMuted} hover:${textPrimary} hover:${subtleBg}`
                }`}
              >
                {cat?.name || catKey}
              </Link>
            );
          })}

          {/* Regional Divisions Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setRegionsOpen(!regionsOpen)}
              className={`px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 ${
                activeRegion || regionsOpen
                  ? `${accentText} font-extrabold ${subtleBg}`
                  : `${textMuted} hover:${textPrimary} hover:${subtleBg}`
              }`}
            >
              <span>Regions</span>
              <svg
                className={`w-3 h-3 transition-transform duration-200 ${regionsOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Panel */}
            {regionsOpen && (
              <div
                className={`absolute top-full left-0 mt-1.5 w-64 rounded-xl border shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 ${
                  isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-200/50 dark:border-slate-800 mb-1">
                  5 Regional Divisions
                </div>
                {Object.values(REGIONAL_DIVISIONS).map((reg) => (
                  <Link
                    key={reg.id}
                    href={`${langPrefix}/region/${reg.id}`}
                    onClick={() => setRegionsOpen(false)}
                    className={`block px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                      activeRegion === reg.id
                        ? `${accentText} font-bold ${subtleBg}`
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{reg.name}</span>
                      <span className="text-[10px] font-mono text-slate-400">{reg.districts.length} dist</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-normal truncate mt-0.5">
                      {reg.tagline}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Latest Wire Pill */}
          <Link
            href={`${langPrefix}/latest`}
            className={`ml-1 px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 border transition ${
              isDark
                ? 'border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                : 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            <span>Latest Wire</span>
          </Link>
        </nav>

        {/* Mobile Hamburger Toggle */}
        <div className="flex items-center md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`p-1.5 rounded-lg border ${
              isDark ? 'border-slate-800 text-slate-300 hover:bg-slate-900' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
            aria-label="Toggle navigation menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* 3. Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          className={`md:hidden border-t px-4 py-4 space-y-4 max-h-[80vh] overflow-y-auto ${navBg} ${navBorder}`}
        >
          {/* Quick Wire Button */}
          <Link
            href={`${langPrefix}/latest`}
            onClick={() => setMobileMenuOpen(false)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-red-600 text-white font-bold text-xs shadow-sm uppercase tracking-wider"
          >
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span>Live Breaking Wire Feed</span>
          </Link>

          {/* Categories */}
          <div>
            <div className={`text-[10px] font-mono uppercase tracking-widest font-bold ${textMuted} mb-2`}>
              News Categories
            </div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(NEWS_CATEGORIES).map(([key, cat]) => (
                <Link
                  key={key}
                  href={`${langPrefix}/category/${key}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`p-2 rounded-lg text-xs font-semibold border ${
                    activeCategory === key
                      ? `${accentText} font-bold ${subtleBg} border-cyan-500/50`
                      : `${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-slate-50'} text-slate-300 hover:${textPrimary}`
                  }`}
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>

          {/* Regional Divisions */}
          <div>
            <div className={`text-[10px] font-mono uppercase tracking-widest font-bold ${textMuted} mb-2`}>
              Regional Divisions
            </div>
            <div className="space-y-1.5">
              {Object.values(REGIONAL_DIVISIONS).map((reg) => (
                <Link
                  key={reg.id}
                  href={`${langPrefix}/region/${reg.id}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between p-2 rounded-lg text-xs font-medium border ${
                    activeRegion === reg.id
                      ? `${accentText} font-bold ${subtleBg} border-cyan-500/50`
                      : `${isDark ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-slate-50'} text-slate-300`
                  }`}
                >
                  <span className="font-bold">{reg.name}</span>
                  <span className="text-[10px] font-mono text-slate-400">{reg.shortName}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Languages */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className={textMuted}>Switch Edition:</span>
            <div className="flex gap-2 font-mono">
              <Link href="/" className="font-bold text-white hover:underline">English</Link>
              <span className="text-slate-600">&bull;</span>
              <Link href="/ur" className="font-bold text-cyan-400 hover:underline">اردو</Link>
              <span className="text-slate-600">&bull;</span>
              <Link href="/ks" className="font-bold text-emerald-400 hover:underline">कॉशुर</Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
