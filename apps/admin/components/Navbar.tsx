'use client';

import Link from 'next/link';

interface NavbarProps {
  onOpenMobile: () => void;
  onOpenSearch: () => void;
  userRole?: string | null;
  userEmail?: string | null;
  onSignOut: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  brandName?: string;
}

export function Navbar({
  onOpenMobile,
  onOpenSearch,
  userRole,
  theme = 'light',
  onToggleTheme,
}: NavbarProps) {

  return (
    <header className="sticky top-0 z-30 flex h-10 sm:h-11 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-3 sm:px-4 md:px-6 shadow-2xs backdrop-blur-sm dark:bg-slate-950/95 dark:border-slate-800 transition-all">
      {/* Left: Mobile Toggle & Quick Search */}
      <div className="flex items-center gap-2.5">
        {/* Mobile menu hamburger */}
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label="Open sidebar menu"
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 lg:hidden transition-colors dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        >
          <span className="text-sm">☰</span>
        </button>

        {/* Desktop Quick Search Trigger */}
        <button
          type="button"
          onClick={onOpenSearch}
          className="group hidden sm:flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-xs text-slate-500 hover:border-slate-300 hover:bg-white transition-all shadow-2xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 w-52 md:w-60"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-xs">🔍</span>
            <span className="text-xs text-slate-600 dark:text-slate-300">Quick search...</span>
          </div>
          <kbd className="rounded border border-slate-200 bg-white px-1 py-0.2 text-[9px] font-mono text-slate-500 dark:bg-slate-800 dark:border-slate-700">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Clean, low-profile utility controls */}
      <div className="flex items-center gap-2">
        {/* Mobile Search Icon */}
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Open search"
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 sm:hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
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
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <span className="text-xs">{theme === 'light' ? '🌙' : '☀️'}</span>
          </button>
        )}

        {/* Role Badge */}
        <Link
          href="/profile"
          title="My Profile & Author Settings"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 px-2 py-0.5 text-[11px] font-mono font-bold text-slate-800 capitalize transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span>{userRole || 'Profile'}</span>
        </Link>
      </div>
    </header>
  );
}
