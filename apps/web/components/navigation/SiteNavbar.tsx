'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { SITE_SHORT_NAME } from '@/lib/config';
import { REGIONAL_DIVISIONS } from '@/lib/taxonomy';
import { type TemplateTheme } from '@/lib/templates';
import { supabase } from '@/lib/supabase';
import {
  DEFAULT_NAVBAR_SETTINGS,
  sanitizeNavbarSettings,
  type NavbarSettings,
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [regionsOpen, setRegionsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const isDark = theme?.isDark ?? false;

  // Background and border tokens
  const navBg = theme?.headerBgClass || (isDark ? 'bg-slate-950/95' : 'bg-white/95');
  const navBorder = theme?.headerBorderClass || (isDark ? 'border-b border-slate-800' : 'border-b border-slate-200');
  const textPrimary = theme?.textPrimaryClass || (isDark ? 'text-white' : 'text-slate-900');
  const textMuted = theme?.textMutedClass || (isDark ? 'text-slate-400' : 'text-slate-500');
  const accentText = theme?.accentTextClass || (isDark ? 'text-cyan-400' : 'text-blue-700');
  const subtleBg = theme?.subtleBgClass || (isDark ? 'bg-slate-900' : 'bg-slate-100');

  const visibleNavItems = navSettings.nav_items.filter((item) => item.enabled);

  return (
    <header className={`sticky top-0 z-50 backdrop-blur-md ${navBg} ${navBorder} transition-colors duration-200`}>
      {/* 1. Slim Top Utility Strip */}
      {navSettings.top_strip.enabled && (
        <div className={`border-b ${isDark ? 'border-slate-800/80' : 'border-slate-200/80'} px-4 py-1 text-[11px] font-sans flex items-center justify-between`}>
          {/* Left: Dateline & Pulse */}
          <div className="flex items-center gap-3">
            {navSettings.top_strip.show_date && (
              <span className={`font-semibold ${textPrimary}`}>{currentDate}</span>
            )}
            {navSettings.top_strip.show_date && navSettings.top_strip.show_live_wire && (
              <span className="hidden sm:inline text-slate-400">&bull;</span>
            )}
            {navSettings.top_strip.show_live_wire && (
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className={`font-mono text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                  {navSettings.top_strip.live_wire_label}
                </span>
              </div>
            )}
          </div>

          {/* Center: Publication Banner */}
          {navSettings.top_strip.show_center_banner && (
            <div className={`hidden md:block text-[10px] font-bold uppercase tracking-widest ${textMuted}`}>
              {navSettings.top_strip.center_banner_text}
            </div>
          )}

          {/* Right: Language switchers & Quick Tip */}
          <div className="flex items-center gap-3">
            {navSettings.languages.enabled && (
              <div className="flex items-center gap-1 font-mono text-[10px]">
                {navSettings.languages.en && (
                  <Link
                    href={pathname.replace(/^\/(ur|ks|hi)/, '') || '/'}
                    className={`px-1.5 py-0.5 rounded transition ${lang === 'en' ? 'font-bold bg-slate-200/60 dark:bg-slate-800 text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    EN
                  </Link>
                )}
                {navSettings.languages.en && navSettings.languages.ur && <span className="text-slate-400">/</span>}
                {navSettings.languages.ur && (
                  <Link
                    href={`/ur${pathname.replace(/^\/(ur|ks|hi)/, '')}`}
                    className={`px-1.5 py-0.5 rounded transition ${lang === 'ur' ? 'font-bold bg-slate-200/60 dark:bg-slate-800 text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    اردو
                  </Link>
                )}
                {(navSettings.languages.en || navSettings.languages.ur) && navSettings.languages.ks && <span className="text-slate-400">/</span>}
                {navSettings.languages.ks && (
                  <Link
                    href={`/ks${pathname.replace(/^\/(ur|ks|hi)/, '')}`}
                    className={`px-1.5 py-0.5 rounded transition ${lang === 'ks' ? 'font-bold bg-slate-200/60 dark:bg-slate-800 text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    कॉशुर
                  </Link>
                )}
                {(navSettings.languages.en || navSettings.languages.ur || navSettings.languages.ks) && navSettings.languages.hi && <span className="text-slate-400">/</span>}
                {navSettings.languages.hi && (
                  <Link
                    href={`/hi${pathname.replace(/^\/(ur|ks|hi)/, '')}`}
                    className={`px-1.5 py-0.5 rounded transition ${lang === 'hi' ? 'font-bold bg-slate-200/60 dark:bg-slate-800 text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    हिन्दी
                  </Link>
                )}
              </div>
            )}

            {navSettings.actions.show_submit_tip && (
              <a
                href={navSettings.actions.submit_tip_url}
                className={`hidden lg:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${isDark ? 'border-slate-800 hover:border-slate-700 text-slate-300' : 'border-slate-300 hover:border-slate-400 text-slate-700'} transition`}
              >
                {navSettings.actions.submit_tip_label}
              </a>
            )}
          </div>
        </div>
      )}

      {/* 2. Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-4">
        {/* Brand Mark — controlled from Admin portal */}
        <div className="flex items-center shrink-0">
          <Link
            href={`${langPrefix}/`}
            className="flex items-center gap-3 group transition-all duration-300"
          >
            {/* The emblem icon with ambient glowing ring & micro-zoom */}
            {navSettings.brand.show_logo_image && (
              <div className="relative flex items-center justify-center h-12 w-12 shrink-0 rounded-2xl bg-gradient-to-br from-white/95 via-slate-50/80 to-slate-100/60 dark:from-slate-800/80 dark:via-slate-900/90 dark:to-slate-950 p-1.5 shadow-xs border border-slate-200/90 dark:border-slate-700/60 transition-all duration-300 ease-out group-hover:scale-105 group-hover:shadow-md group-hover:shadow-cyan-500/25 group-hover:border-cyan-500/50">
                {/* Radiant background aura on hover */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-cyan-500/15 via-blue-500/10 to-amber-500/15 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <Image
                  src={navSettings.brand.logo_url || '/kjin-emblem.png'}
                  alt={navSettings.brand.name || 'KJIN'}
                  fill
                  className="object-contain p-1 transition-transform duration-300 ease-out group-hover:rotate-1 group-hover:scale-105"
                  priority
                  sizes="48px"
                />
              </div>
            )}

            {/* Wordmark next to emblem with dynamic color transition & animated underline */}
            {(navSettings.brand.show_name || navSettings.brand.show_tagline) && (
              <div className="flex flex-col justify-center">
                {navSettings.brand.show_name && (
                  <span
                    className={`relative inline-block text-2xl font-black tracking-tight uppercase transition-all duration-300 ${
                      isDark
                        ? 'text-white group-hover:text-cyan-300 group-hover:drop-shadow-[0_0_12px_rgba(34,211,238,0.4)]'
                        : 'text-slate-950 group-hover:text-blue-900 group-hover:drop-shadow-[0_1px_3px_rgba(30,58,138,0.25)]'
                    }`}
                    style={{ fontFamily: theme?.id === 'classic-editorial' ? 'Georgia, serif' : 'inherit' }}
                  >
                    <span className="transition-all duration-300 group-hover:tracking-wide">
                      {navSettings.brand.name || SITE_SHORT_NAME}
                    </span>
                    {/* Animated gradient accent bar beneath the brand name */}
                    <span className="absolute -bottom-0.5 left-0 h-0.5 w-0 rounded-full bg-gradient-to-r from-blue-700 via-cyan-500 to-amber-500 transition-all duration-300 ease-out group-hover:w-full" />
                  </span>
                )}
                {navSettings.brand.show_tagline && (
                  <div className="flex items-center gap-1.5 mt-0.5 hidden sm:flex">
                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-500" />
                    </span>
                    <span
                      className={`text-[9px] font-mono tracking-[0.18em] uppercase font-bold transition-colors duration-200 ${
                        isDark
                          ? 'text-slate-400 group-hover:text-cyan-300'
                          : 'text-slate-600 group-hover:text-blue-900'
                      }`}
                    >
                      {navSettings.brand.tagline}
                    </span>
                  </div>
                )}
              </div>
            )}
          </Link>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2 text-xs font-bold uppercase tracking-wider">
          {visibleNavItems.map((item) => {
            const isActive = activeCategory === item.id || activeCategory === item.slug;
            return (
              <Link
                key={item.id}
                href={`${langPrefix}/category/${item.slug}`}
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
                      href={`${langPrefix}/category/local`}
                      onClick={() => setRegionsOpen(false)}
                      className="font-bold text-cyan-700 dark:text-cyan-400 hover:underline"
                    >
                      View All 22 Districts &rarr;
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

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
          {navSettings.actions.show_latest_wire_badge && (
            <Link
              href={`${langPrefix}/latest`}
              onClick={() => setMobileMenuOpen(false)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-red-600 text-white font-bold text-xs shadow-sm uppercase tracking-wider"
            >
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>{navSettings.actions.latest_wire_label}</span>
            </Link>
          )}

          {/* Categories */}
          <div>
            <div className={`text-[10px] font-mono uppercase tracking-widest font-bold ${textMuted} mb-2`}>
              News Categories
            </div>
            <div className="grid grid-cols-2 gap-2">
              {visibleNavItems.map((item) => (
                <Link
                  key={item.id}
                  href={`${langPrefix}/category/${item.slug}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`p-2 rounded-lg text-xs font-semibold border ${
                    activeCategory === item.id || activeCategory === item.slug
                      ? `${accentText} font-bold ${subtleBg} border-cyan-500/50`
                      : `${isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-200 bg-slate-50'} text-slate-300 hover:${textPrimary}`
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Regional Divisions */}
          {navSettings.actions.show_regions_dropdown && (
            <div>
              <div className={`text-[10px] font-mono uppercase tracking-widest font-bold ${textMuted} mb-2`}>
                Regional Divisions
              </div>
              <div className="space-y-1.5 font-sans normal-case">
                {Object.values(REGIONAL_DIVISIONS).map((reg) => {
                  const icons: Record<string, string> = {
                    'pir-panjal': '🏔️',
                    'chenab-valley': '🌊',
                    'kashmir': '🍁',
                    'jammu': '🏛️',
                    'leh': '❄️',
                  };
                  const icon = icons[reg.id] || '📍';
                  return (
                    <Link
                      key={reg.id}
                      href={`${langPrefix}/region/${reg.id}`}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between p-2.5 rounded-xl text-xs font-medium border transition ${
                        activeRegion === reg.id
                          ? `${accentText} font-bold ${subtleBg} border-cyan-500/50`
                          : `${isDark ? 'border-slate-800 bg-slate-900/40 text-slate-200' : 'border-slate-200 bg-white text-slate-800'}`
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">{icon}</span>
                        <span className="font-bold">{reg.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {reg.districts.length} {reg.districts.length === 1 ? 'dist' : 'districts'}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Languages */}
          {navSettings.languages.enabled && (
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className={textMuted}>Switch Edition:</span>
              <div className="flex gap-2 font-mono">
                {navSettings.languages.en && <Link href="/" className="font-bold text-white hover:underline">English</Link>}
                {navSettings.languages.ur && (
                  <>
                    <span className="text-slate-600">&bull;</span>
                    <Link href="/ur" className="font-bold text-cyan-400 hover:underline">اردو</Link>
                  </>
                )}
                {navSettings.languages.ks && (
                  <>
                    <span className="text-slate-600">&bull;</span>
                    <Link href="/ks" className="font-bold text-emerald-400 hover:underline">कॉशुर</Link>
                  </>
                )}
                {navSettings.languages.hi && (
                  <>
                    <span className="text-slate-600">&bull;</span>
                    <Link href="/hi" className="font-bold text-amber-400 hover:underline">हिन्दी</Link>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
