'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { SITE_SHORT_NAME } from '@/lib/config';
import { REGIONAL_DIVISIONS } from '@/lib/taxonomy';
import { type TemplateTheme } from '@/lib/templates';
import { supabase } from '@/lib/supabase';
import {
  DEFAULT_NAVBAR_SETTINGS,
  sanitizeNavbarSettings,
  type NavbarSettings,
  BASE_TERRITORIAL_CORRIDORS,
  getDailyRotatedCorridors,
} from '@/lib/navbar';

interface SiteNavbarProps {
  lang?: string;
  theme?: TemplateTheme;
  activeCategory?: string;
  activeDistrict?: string;
  activeRegion?: string;
  navbarSettings?: NavbarSettings;
}

export function SiteNavbar({
  lang = 'en',
  theme,
  activeCategory,
  activeRegion,
  navbarSettings,
}: SiteNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');
  const [regionsOpen, setRegionsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when mobile menu is active for smooth drawer feel & close on Escape
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileMenuOpen]);

  const handleMobileSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobileSearchQuery.trim()) return;
    setMobileMenuOpen(false);
    router.push(`${langPrefix}/search?q=${encodeURIComponent(mobileSearchQuery.trim())}`);
  };

  // Initialize with passed settings or default
  const [navSettings, setNavSettings] = useState<NavbarSettings>(() =>
    sanitizeNavbarSettings(navbarSettings || DEFAULT_NAVBAR_SETTINGS)
  );

  // Sync if prop updates
  useEffect(() => {
    if (navbarSettings) {
      setNavSettings(sanitizeNavbarSettings(navbarSettings));
    } else {
      let isMounted = true;
      async function fetchSettings() {
        try {
          const { data } = await supabase
            .from('site_settings')
            .select('value')
            .eq('key', 'navbar_settings')
            .maybeSingle();

          if (isMounted && data?.value) {
            setNavSettings(sanitizeNavbarSettings(data.value));
          }
        } catch {
          // Fall back gracefully
        }
      }
      fetchSettings();
      return () => {
        isMounted = false;
      };
    }
  }, [navbarSettings]);

  // Cache brand settings in localStorage for instantaneous loader display
  useEffect(() => {
    if (navSettings?.brand && typeof window !== 'undefined') {
      try {
        localStorage.setItem('kjin_brand_config', JSON.stringify(navSettings.brand));
      } catch {
        // ignore storage errors
      }
    }
  }, [navSettings?.brand]);

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

  // Territorial Corridors Horizontal Scroll Indicator & Helpers
  const corridorsScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollCorridorsLeft, setCanScrollCorridorsLeft] = useState(false);
  const [canScrollCorridorsRight, setCanScrollCorridorsRight] = useState(true);

  const checkCorridorsScroll = useCallback(() => {
    const el = corridorsScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollCorridorsLeft(scrollLeft > 4);
    setCanScrollCorridorsRight(scrollLeft + clientWidth < scrollWidth - 6);
  }, []);

  useEffect(() => {
    checkCorridorsScroll();
    const el = corridorsScrollRef.current;
    if (!el) return;
    const onScroll = () => checkCorridorsScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', checkCorridorsScroll);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', checkCorridorsScroll);
    };
  }, [checkCorridorsScroll, mounted]);

  const scrollCorridors = (direction: 'left' | 'right') => {
    const el = corridorsScrollRef.current;
    if (!el) return;
    const offset = direction === 'left' ? -180 : 180;
    el.scrollBy({ left: offset, behavior: 'smooth' });
  };

  const isDark = theme?.isDark ?? false;
  const corridors = (navSettings.actions.daily_corridor_rotation ?? true)
    ? getDailyRotatedCorridors(BASE_TERRITORIAL_CORRIDORS)
    : BASE_TERRITORIAL_CORRIDORS;

  // Background and border tokens
  const navBg = theme?.headerBgClass || (isDark ? 'bg-slate-950/95' : 'bg-white/95');
  const navBorder = theme?.headerBorderClass || (isDark ? 'border-b border-slate-800' : 'border-b border-slate-200');
  const textPrimary = theme?.textPrimaryClass || (isDark ? 'text-white' : 'text-slate-900');
  const textMuted = theme?.textMutedClass || (isDark ? 'text-slate-400' : 'text-slate-500');
  const accentText = theme?.accentTextClass || (isDark ? 'text-cyan-400' : 'text-blue-700');
  const subtleBg = theme?.subtleBgClass || (isDark ? 'bg-slate-900' : 'bg-slate-100');

  const visibleNavItems = navSettings.nav_items.filter((item) => item.enabled);

  const getNavItemHref = (item: { id: string; slug: string }) => {
    if (item.slug === 'india' || item.id === 'national') return `${langPrefix}/india`;
    if (item.slug === 'international' || item.id === 'international') return `${langPrefix}/international`;
    return `${langPrefix}/category/${item.slug}`;
  };

  const isNavItemActive = (item: { id: string; slug: string }) => {
    if (activeCategory === item.id || activeCategory === item.slug) return true;
    if (
      (item.slug === 'india' || item.id === 'national') &&
      (pathname === `${langPrefix}/india` || pathname.startsWith(`${langPrefix}/india/`))
    ) {
      return true;
    }
    if (
      (item.slug === 'international' || item.id === 'international') &&
      (pathname === `${langPrefix}/international` || pathname.startsWith(`${langPrefix}/international/`))
    ) {
      return true;
    }
    return false;
  };

  return (
    <header className={`w-full max-w-full overflow-x-hidden sticky top-0 z-50 backdrop-blur-md ${navBg} ${navBorder} transition-colors duration-200`}>
      {/* 1. Slim Top Utility Strip */}
      {navSettings.top_strip.enabled && (
        <div className="w-full border-b border-stone-200/80">
          <div className="w-full max-w-7xl 2xl:max-w-[1440px] mx-auto px-3 sm:px-4 md:px-8 py-1 sm:py-1.5 flex items-center justify-between text-[9px] sm:text-[10.5px] uppercase tracking-wider text-stone-600 font-medium overflow-hidden gap-1.5 sm:gap-2">
            {/* Left: Dateline & Hijri/Calendar */}
            <div className="flex items-center space-x-1 sm:space-x-2 min-w-0 truncate">
              <span className="font-semibold text-stone-800 truncate" suppressHydrationWarning>{currentDate}</span>
              <span className="text-stone-300 hidden xs:inline">|</span>
              <span className="text-stone-500 font-serif lowercase italic text-[9px] sm:text-[10.5px] truncate hidden xs:inline">16 Jumada al-awwal 1448</span>
            </div>

            {/* Right: Verified Wire Badge & Languages */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <div className="flex items-center space-x-1 bg-emerald-50 text-emerald-800 px-1.5 sm:px-2 py-0.5 rounded-full border border-emerald-200 text-[8px] sm:text-[9.5px] font-semibold whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                <span>VERIFIED WIRE</span>
              </div>
              {navSettings.languages.enabled && (
                <div className="hidden sm:flex items-center gap-1 font-mono text-[10px] ml-1">
                  <Link href={pathname.replace(/^\/(ur|ks|hi)/, '') || '/'} className={`px-1 py-0.5 rounded ${lang === 'en' ? 'font-bold bg-stone-200/80 text-stone-900' : 'text-stone-500'}`}>EN</Link>
                  <span className="text-stone-300">/</span>
                  <Link href={`/ur${pathname.replace(/^\/(ur|ks|hi)/, '')}`} className={`px-1 py-0.5 rounded ${lang === 'ur' ? 'font-bold bg-stone-200/80 text-stone-900' : 'text-stone-500'}`}>اردو</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Master Heraldic Masthead */}
      <div className="w-full max-w-7xl 2xl:max-w-[1440px] mx-auto px-3 sm:px-4 md:px-8 py-2.5 flex items-center justify-between gap-2 sm:gap-3">
        {/* Brand Crest & Name */}
        <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
          <Link href={`${langPrefix}/`} className="flex items-center space-x-2 sm:space-x-3 group transition-all min-w-0">
            {navSettings.brand.show_logo_image && (
              <div className="relative w-9 h-9 sm:w-11 sm:h-11 rounded-full p-0.5 bg-gradient-to-tr from-amber-600 via-amber-200 to-amber-700 shadow-sm flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <div className="w-full h-full bg-stone-900 rounded-full flex flex-col items-center justify-center p-0.5 sm:p-1 text-center border border-amber-300/40 relative overflow-hidden">
                  <Image
                    src={navSettings.brand.logo_url || '/kjin-emblem.png'}
                    alt={navSettings.brand.name || 'KJIN'}
                    fill
                    className="object-contain p-0.5 rounded-full"
                    decoding="async"
                    sizes="44px"
                  />
                </div>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline space-x-1 sm:space-x-1.5">
                <h1 className="font-masthead text-lg sm:text-xl font-black text-stone-900 tracking-tight leading-none truncate">
                  {navSettings.brand.name || 'KJIN'}
                </h1>
                {(navSettings.brand.show_est_badge ?? true) && (
                  <span className="text-[8px] sm:text-[9px] font-serif font-bold text-amber-800 tracking-widest uppercase bg-amber-100/70 px-1 py-0.5 rounded shrink-0">
                    {navSettings.brand.est_badge_text || 'EST. 1948'}
                  </span>
                )}
              </div>
              {(navSettings.brand.show_tagline ?? true) && Boolean(navSettings.brand.tagline?.trim()) && (
                <p className="text-[8.5px] sm:text-[9.5px] font-serif italic text-stone-600 leading-tight tracking-wide mt-0.5 truncate">
                  {navSettings.brand.tagline}
                </p>
              )}
            </div>
          </Link>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2 text-xs font-bold uppercase tracking-wider">
          {visibleNavItems.map((item) => {
            const isActive = isNavItemActive(item);
            return (
              <Link
                key={item.id}
                href={getNavItemHref(item)}
                className={`px-2.5 py-1.5 rounded-lg transition-colors duration-150 ${
                  isActive
                    ? `${accentText} font-extrabold ${subtleBg}`
                    : `${textMuted} hover:${textPrimary} hover:${subtleBg}`
                }`}
              >
                {item.label}
              </Link>
            );
          })}

          {/* Regional Divisions Dropdown */}
          {navSettings.actions.show_regions_dropdown && (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setRegionsOpen(!regionsOpen)}
                className={`px-2.5 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                  activeRegion || regionsOpen
                    ? `${accentText} font-extrabold ${subtleBg}`
                    : `${textMuted} hover:${textPrimary} hover:${subtleBg}`
                }`}
                aria-expanded={regionsOpen}
                aria-label="Regional Desks Menu"
              >
                <span>Regions</span>
                <svg
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${regionsOpen ? 'rotate-180' : ''}`}
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
                  className={`absolute top-full right-0 mt-2 w-88 sm:w-96 rounded-2xl border shadow-2xl p-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 font-sans normal-case tracking-normal ${
                    isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="px-3 py-2 flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 mb-2">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">
                        J&amp;K Coverage Desks
                      </p>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        5 Regional Divisions &bull; 22 Districts
                      </p>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300">
                      Live
                    </span>
                  </div>

                  <div className="space-y-1">
                    {Object.values(REGIONAL_DIVISIONS).map((reg) => {
                      const icons: Record<string, string> = {
                        'pir-panjal': '🏔️',
                        'chenab-valley': '🌊',
                        'kashmir': '🍁',
                        'jammu': '🏛️',
                        'leh': '❄️',
                      };
                      const icon = icons[reg.id] || '📍';
                      const districtCount = reg.districts.length;
                      const districtListPreview = reg.districts
                        .slice(0, 3)
                        .map((d) => d.charAt(0).toUpperCase() + d.slice(1))
                        .join(', ') + (reg.districts.length > 3 ? ` +${reg.districts.length - 3} more` : '');

                      return (
                        <Link
                          key={reg.id}
                          href={`${langPrefix}/region/${reg.id}`}
                          onClick={() => setRegionsOpen(false)}
                          className={`group flex items-start gap-3 p-2.5 rounded-xl transition-all ${
                            activeRegion === reg.id
                              ? `${accentText} font-bold bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800`
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/70 border border-transparent'
                          }`}
                        >
                          <span className="text-xl shrink-0 p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:scale-110 transition-transform">
                            {icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-cyan-700 dark:group-hover:text-cyan-400 transition-colors">
                                {reg.name}
                              </span>
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 shrink-0">
                                {districtCount} {districtCount === 1 ? 'district' : 'districts'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5 line-clamp-1">
                              {reg.tagline}
                            </p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                              {districtListPreview}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-200/80 dark:border-slate-800/80 px-2 py-1 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400">Looking for civic ground reports?</span>
                    <Link
                      href={`${langPrefix}/map`}
                      onClick={() => setRegionsOpen(false)}
                      className="font-bold text-cyan-700 dark:text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      <span>🗺️</span>
                      <span>Map Overview &rarr;</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Map Overview Link */}
          <Link
            href={`${langPrefix}/map`}
            className={`px-2.5 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              pathname?.includes('/map')
                ? `${accentText} font-extrabold ${subtleBg}`
                : `${textMuted} hover:${textPrimary} hover:${subtleBg}`
            }`}
          >
            <span>🗺️</span>
            <span>Map</span>
          </Link>

          {/* Latest Wire Pill */}
          {navSettings.actions.show_latest_wire_badge && (
            <Link
              href={`${langPrefix}/latest`}
              className={`ml-1 px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 border transition ${
                isDark
                  ? 'border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                  : 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
              <span>{navSettings.actions.latest_wire_label}</span>
            </Link>
          )}
        </nav>

        {/* Mobile Actions: Search & Hamburger Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 md:hidden">
          <Link
            href={`${langPrefix}/search`}
            className={`p-1.5 sm:p-2 rounded-xl border transition-all duration-150 ${
              isDark
                ? 'border-slate-800 text-slate-200 hover:bg-slate-900 bg-slate-900/60'
                : 'border-slate-200 text-slate-700 hover:bg-slate-100 bg-slate-50/80 shadow-xs'
            }`}
            aria-label="Search dispatches"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`p-1.5 sm:p-2 rounded-xl border transition-all duration-150 active:scale-95 ${
              isDark
                ? 'border-slate-800 text-slate-200 hover:bg-slate-900 bg-slate-900/60'
                : 'border-slate-200 text-slate-700 hover:bg-slate-100 bg-slate-50/80 shadow-xs'
            }`}
            aria-label="Toggle navigation menu"
          >
            <svg className="w-4.5 h-4.5 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* 2b. Five Territorial Corridor Filter Navigation Bar (Daily +1 Shift Rotation) */}
      <nav
        aria-label="Regional Corridors"
        className="w-full border-t border-stone-200/80 bg-stone-100/60"
      >
        <div className="w-full max-w-7xl 2xl:max-w-[1440px] mx-auto px-3 sm:px-4 md:px-8 py-1.5 flex items-center justify-between gap-3">
          {/* Scrollable pill container wrapped in relative flex with interactive chevron buttons */}
          <div className="relative flex items-center min-w-0 flex-1">
            {/* Left Scroll Indicator Arrow */}
            {canScrollCorridorsLeft && (
              <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center pr-2 bg-gradient-to-r from-stone-100 via-stone-100/90 to-transparent">
                <button
                  type="button"
                  onClick={() => scrollCorridors('left')}
                  aria-label="Scroll regional bureaus left"
                  title="Previous bureaus"
                  className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white border border-stone-300 shadow-xs text-stone-700 hover:text-stone-900 hover:bg-stone-50 flex items-center justify-center transition cursor-pointer"
                >
                  <svg className="w-3 h-3 text-stone-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </div>
            )}

            {/* Scrollable Bureaus Pills */}
            <div
              ref={corridorsScrollRef}
              onScroll={checkCorridorsScroll}
              className="flex items-center space-x-2 text-[11px] font-semibold tracking-wide whitespace-nowrap overflow-x-auto no-scrollbar py-0.5 min-w-0 scroll-smooth w-full"
            >
              <Link
                href={`${langPrefix}/`}
                className={`shrink-0 px-2.5 py-1 rounded-full shadow-xs flex items-center space-x-1.5 transition-colors ${
                  !activeRegion
                    ? 'bg-stone-900 text-stone-100'
                    : 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-50'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>ALL BUREAUS</span>
              </Link>
              {corridors.map((c) => {
                const isActive = activeRegion === c.id || activeRegion === c.slug;
                return (
                  <Link
                    key={c.id}
                    href={`${langPrefix}/region/${c.slug}`}
                    className={`shrink-0 px-2.5 py-1 rounded-full border transition-colors flex items-center space-x-1.5 ${
                      isActive ? c.activeClass : c.idleClass
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${c.dotColor}`}></span>
                    <span>{c.name}</span>
                  </Link>
                );
              })}
            </div>

            {/* Right Scroll Indicator Arrow (Guides reader that more bureaus exist) */}
            {canScrollCorridorsRight && (
              <div className="absolute right-0 top-0 bottom-0 z-10 flex items-center pl-3 bg-gradient-to-l from-stone-100 via-stone-100/95 to-transparent">
                <button
                  type="button"
                  onClick={() => scrollCorridors('right')}
                  aria-label="Scroll more regional bureaus"
                  title="More regional bureaus"
                  className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white border border-stone-300 shadow-xs text-stone-700 hover:text-stone-900 hover:bg-stone-50 flex items-center justify-center transition cursor-pointer group"
                >
                  <svg className="w-3 h-3 text-stone-700 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Right Status / Telemetry Link on Desktop to Balance Large Screens */}
          <div className="hidden lg:flex items-center gap-3 text-[11px] font-mono text-stone-500 shrink-0">
            <span className="flex items-center gap-1.5 text-stone-600 font-sans font-medium text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>5 Territorial Corridors Active</span>
            </span>
            <span className="text-stone-300">|</span>
            <Link
              href={`${langPrefix}/transit`}
              className="hover:text-stone-900 transition flex items-center gap-1 font-sans font-semibold text-stone-700 hover:underline"
            >
              <span>Mountain Transit Telemetry</span>
              <span>&rarr;</span>
            </Link>
          </div>
        </div>
      </nav>
      {/* 3. Mobile Navigation Dropdown Menu (Broadsheet Editorial Architecture) */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-label="Site Navigation Directory"
          className="w-full md:hidden border-t border-stone-200 bg-[#FAF8F5] text-stone-900 shadow-xl max-h-[calc(100dvh-120px)] overflow-y-auto px-4 py-4 space-y-4 font-sans"
        >
            {/* 1. Integrated Search Bar */}
            <form onSubmit={handleMobileSearch} className="relative">
              <input
                type="search"
                value={mobileSearchQuery}
                onChange={(e) => setMobileSearchQuery(e.target.value)}
                placeholder="Search dispatches, corridors, archives..."
                className="w-full bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 pl-10 pr-20 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-sans placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/50 shadow-xs"
              />
              <svg
                className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-stone-800 transition shadow-xs"
              >
                Search
              </button>
            </form>

            {/* 2. Refined Editorial Actions (Live Wire & Radar Map) */}
            <div className="grid grid-cols-2 gap-2 font-serif">
              {navSettings.actions.show_latest_wire_badge && (
                <Link
                  href={`${langPrefix}/latest`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-950 font-bold text-xs shadow-xs border border-stone-900 dark:border-stone-100 hover:opacity-95 transition"
                >
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                  <span className="uppercase tracking-wider">Field Wire</span>
                </Link>
              )}

              <Link
                href={`${langPrefix}/map`}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 font-bold text-xs shadow-xs border border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 transition"
              >
                <span>🗺️</span>
                <span className="uppercase tracking-wider">Interactive Map</span>
              </Link>
            </div>

            {/* 3. News Categories (High-contrast Broadside Grid) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-stone-600">
                  Editorial Desks &amp; Topics
                </span>
                <span className="text-[9px] font-mono text-stone-500">
                  Select Desk
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {visibleNavItems.map((item) => {
                  const isActive = isNavItemActive(item);
                  return (
                    <Link
                      key={item.id}
                      href={getNavItemHref(item)}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`p-3 rounded-xl text-xs font-serif font-bold border transition flex items-center justify-between shadow-xs ${
                        isActive
                          ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                          : 'bg-white text-stone-900 border-stone-300 hover:border-stone-400 hover:bg-stone-50'
                      }`}
                    >
                      <span className="truncate">{item.label}</span>
                      <span className="text-[10px] font-mono opacity-50 shrink-0 ml-1">&rarr;</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* 4. Territorial Regional Divisions */}
            {navSettings.actions.show_regions_dropdown && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-stone-600">
                    Regional Divisions &bull; 22 Districts
                  </span>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-900">
                    Active
                  </span>
                </div>
                <div className="space-y-2 font-sans">
                  {Object.values(REGIONAL_DIVISIONS).map((reg) => {
                    const icons: Record<string, string> = {
                      'pir-panjal': '🏔️',
                      'chenab-valley': '🌊',
                      'kashmir': '🍁',
                      'jammu': '🏛️',
                      'leh': '❄️',
                    };
                    const icon = icons[reg.id] || '📍';
                    const isActive = activeRegion === reg.id;
                    const districtListPreview = reg.districts
                      .slice(0, 3)
                      .map((d) => d.charAt(0).toUpperCase() + d.slice(1))
                      .join(' • ') + (reg.districts.length > 3 ? ` +${reg.districts.length - 3}` : '');

                    return (
                      <Link
                        key={reg.id}
                        href={`${langPrefix}/region/${reg.id}`}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center justify-between p-3 rounded-xl border transition shadow-xs ${
                          isActive
                            ? 'bg-amber-50 border-amber-400 text-amber-950 font-bold'
                            : 'bg-white text-stone-800 border-stone-300 hover:border-stone-400 hover:bg-stone-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xl shrink-0">{icon}</span>
                          <div className="min-w-0">
                            <span className="font-serif font-bold text-xs text-stone-900 block truncate">
                              {reg.name}
                            </span>
                            <span className="text-[10px] text-stone-600 font-sans block truncate mt-0.5">
                              {districtListPreview}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 shrink-0 ml-2">
                          {reg.districts.length} {reg.districts.length === 1 ? 'dist' : 'dists'}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. Transit & Passes Telemetry Card */}
            <div className="p-3 bg-white rounded-xl border border-stone-300 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">🏔️</span>
                  <div>
                    <span className="font-serif font-bold text-xs text-stone-900 block">
                      Mountain Passes Telemetry
                    </span>
                    <span className="text-[10px] text-stone-600 font-sans block">
                      Zojila &bull; Peer Ki Gali &bull; Banihal &bull; Sinthan
                    </span>
                  </div>
                </div>
                <Link
                  href={`${langPrefix}/transit`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-[11px] font-bold text-amber-800 hover:underline shrink-0 font-sans"
                >
                  Live Status &rarr;
                </Link>
              </div>
            </div>

            {/* 6. Edition Switcher (Languages) */}
            {navSettings.languages.enabled && (
              <div className="pt-2 border-t border-stone-300">
                <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-stone-600 block mb-2">
                  Language Edition / زبان ایڈیشن
                </span>
                <div className="grid grid-cols-4 gap-1.5 font-sans">
                  {navSettings.languages.en && (
                    <Link
                      href="/"
                      onClick={() => setMobileMenuOpen(false)}
                      className="py-2 px-1 text-center rounded-lg border border-stone-300 bg-white font-bold text-xs text-stone-900 hover:bg-stone-100"
                    >
                      English
                    </Link>
                  )}
                  {navSettings.languages.ur && (
                    <Link
                      href="/ur"
                      onClick={() => setMobileMenuOpen(false)}
                      className="py-2 px-1 text-center rounded-lg border border-stone-300 bg-white font-bold text-xs text-cyan-700 hover:bg-stone-100"
                    >
                      اردو
                    </Link>
                  )}
                  {navSettings.languages.ks && (
                    <Link
                      href="/ks"
                      onClick={() => setMobileMenuOpen(false)}
                      className="py-2 px-1 text-center rounded-lg border border-stone-300 bg-white font-bold text-xs text-emerald-700 hover:bg-stone-100"
                    >
                      कॉशुर
                    </Link>
                  )}
                  {navSettings.languages.hi && (
                    <Link
                      href="/hi"
                      onClick={() => setMobileMenuOpen(false)}
                      className="py-2 px-1 text-center rounded-lg border border-stone-300 bg-white font-bold text-xs text-amber-700 hover:bg-stone-100"
                    >
                      हिन्दी
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* 7. Institutional Footer Seal */}
            <div className="pt-2 pb-6 border-t border-stone-200 text-center font-serif text-[10px] text-stone-600 space-y-1">
              <p className="font-bold uppercase tracking-wider text-stone-700">
                {navSettings.brand.name || 'KJIN'} Institutional Dispatch
              </p>
              <p className="text-[9px] text-stone-600">
                Independent Field Press of Record &bull; Certified Editorial Standards
              </p>
            </div>
        </div>
      )}
    </header>
  );
}
