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
    <header className="sticky top-0 z-30 flex h-13 w-full items-center justify-between border-b border-slate-200/90 bg-white/95 px-3 sm:px-4 md:px-6 shadow-2xs backdrop-blur-md dark:bg-slate-950/95 dark:border-slate-800 transition-all">
      {/* Left: Prominent Top Menu Button & Brand Identity */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Clean SVG Mobile Menu Button */}
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label="Open navigation menu"
          className="flex lg:hidden items-center justify-center h-8.5 w-8.5 shrink-0 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:border-cyan-500 active:scale-95 shadow-2xs transition dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {/* Brand Logo & Name (Shown on mobile/tablet when sidebar drawer is hidden) */}
        <Link
          href="/"
          className="flex lg:hidden items-center gap-2 active:opacity-80 transition shrink-0"
        >
          {brandLogo && (
            <div className="relative h-7 w-7 rounded-lg overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shrink-0 p-0.5">
              <Image
                src={brandLogo}
                alt={brandName}
                fill
                className="object-contain"
                sizes="28px"
              />
            </div>
          )}
          <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white uppercase tracking-tight">
            {brandName}
          </span>
          <span className="hidden sm:inline-block text-[9px] font-mono font-bold uppercase tracking-wider text-cyan-800 dark:text-cyan-300 bg-cyan-100 dark:bg-cyan-950/80 px-1.5 py-0.2 rounded border border-cyan-300 dark:border-cyan-700">
            Desk
          </span>
        </Link>

        {/* Desktop Quick Search Trigger */}
        <button
          type="button"
          onClick={onOpenSearch}
          className="group hidden md:flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-xs text-slate-500 hover:border-slate-300 hover:bg-white transition-all shadow-2xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 w-52 lg:w-64"
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

      {/* Right: Actions & Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Top + New Story Button (Hidden on mobile where primary action is directly on page) */}
        <Link
          href="/articles/new"
          title="Create New Story"
          className="hidden sm:flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs shadow-xs active:scale-95 transition"
        >
          <span className="text-sm font-bold leading-none">+</span>
          <span>New Story</span>
        </Link>

        {/* Mobile Search Trigger Icon */}
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Open search"
          className="flex md:hidden h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 active:scale-95 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
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

        {/* Live Public Site External Link */}
        <a
          href="http://localhost:3000"
          target="_blank"
          rel="noopener noreferrer"
          title="View Live Reader Site"
          className="hidden sm:flex items-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 text-xs font-semibold shadow-2xs transition"
        >
          <span>🌐 Site</span>
          <span className="text-[10px] text-slate-400 font-bold">↗</span>
        </a>

        {/* Role & Profile Badge */}
        <Link
          href="/profile"
          title="My Profile & Author Settings"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 px-2.5 py-1 text-xs font-mono font-bold text-slate-800 capitalize transition active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="truncate max-w-[70px] sm:max-w-none">{userRole || 'Profile'}</span>
        </Link>
      </div>
    </header>
  );
}
