'use client';

import Link from 'next/link';
import Image from 'next/image';

interface NavbarProps {
  onOpenMobile: () => void;
  onOpenSearch: () => void;
  userRole?: string | null;
  userEmail?: string | null;
  onSignOut: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  brandName?: string;
  brandLogo?: string;
}

export function Navbar({
  onOpenMobile,
  onOpenSearch,
  userRole,
  theme = 'light',
  onToggleTheme,
  brandName = 'KCPJLN',
  brandLogo = '/kcpjln-symbol.webp',
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-12 sm:h-11 w-full items-center justify-between border-b border-slate-200/90 bg-white/95 px-3 sm:px-4 md:px-6 shadow-2xs backdrop-blur-md dark:bg-slate-950/95 dark:border-slate-800 transition-all">
      {/* Left: Mobile Toggle & Quick Search */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Mobile menu hamburger */}
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label="Open sidebar menu"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 active:scale-95 lg:hidden transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        >
          <span className="text-base leading-none">☰</span>
        </button>

        {/* Mobile Brand Identity */}
        <Link
          href="/"
          className="flex lg:hidden items-center gap-1.5 active:opacity-80 transition"
        >
          {brandLogo && (
            <div className="relative h-6 w-6 rounded-md overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shrink-0">
              <Image
                src={brandLogo}
                alt={brandName}
                fill
                className="object-contain p-0.5"
                sizes="24px"
              />
            </div>
          )}
          <span className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-tight">
            {brandName}
          </span>
          <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 px-1 py-0.2 rounded border border-cyan-200/70 dark:border-cyan-800/60">
            Desk
          </span>
        </Link>

        {/* Desktop Quick Search Trigger */}
        <button
          type="button"
          onClick={onOpenSearch}
          className="group hidden sm:flex items-center justify-between gap-4 rounded-[8px] border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-xs text-slate-500 hover:border-slate-300 hover:bg-white transition-all shadow-2xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 w-52 md:w-60"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-xs">🔍</span>
            <span className="text-xs text-slate-600 dark:text-slate-300">Quick search...</span>
          </div>
          <kbd className="rounded-[4px] border border-slate-200 bg-white px-1 py-0.2 text-[9px] font-mono text-slate-500 dark:bg-slate-800 dark:border-slate-700">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Clean, touch-friendly utility controls */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Mobile Search Icon */}
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Open search"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 sm:hidden active:scale-95 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
        >
          <span className="text-xs">🔍</span>
        </button>

        {/* Theme Switcher Toggle */}
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} theme`}
            aria-label="Toggle color theme"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 active:scale-95 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <span className="text-xs">{theme === 'light' ? '🌙' : '☀️'}</span>
          </button>
        )}

        {/* Role Badge */}
        <Link
          href="/profile"
          title="My Profile & Author Settings"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-[11px] font-mono font-bold text-slate-800 capitalize transition active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="truncate max-w-[64px] sm:max-w-none">{userRole || 'Profile'}</span>
        </Link>
      </div>
    </header>
  );
}

