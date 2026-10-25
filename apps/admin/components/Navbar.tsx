'use client';

import { useState } from 'react';
import Link from 'next/link';

interface NavbarProps {
  onOpenMobile: () => void;
  onOpenSearch: () => void;
  userRole?: string | null;
  userEmail?: string | null;
  onSignOut: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  isBlockerActive?: boolean;
  onToggleBlocker?: () => void;
  brandName?: string;
}

export function Navbar({
  onOpenMobile,
  onOpenSearch,
  userRole,
  theme = 'light',
  onToggleTheme,
  isBlockerActive = false,
  onToggleBlocker,
}: NavbarProps) {
  const [showBlockerMenu, setShowBlockerMenu] = useState(false);

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

        {/* Compact Blocker Button */}
        <div className="relative">
          <button
            type="button"
            onClick={onToggleBlocker}
            onContextMenu={(e) => {
              e.preventDefault();
              setShowBlockerMenu((prev) => !prev);
            }}
            title={
              isBlockerActive
                ? 'Admin Blocker is ACTIVE: Native Ads & Trackers are suppressed. Click to turn off.'
                : 'Admin Blocker is OFF: Click to block ads, telemetry and popup overlays.'
            }
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-xs font-bold transition shadow-2xs ${
              isBlockerActive
                ? 'border-rose-400 bg-rose-50 text-rose-900 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <span className="text-xs">🛡️</span>
            <span className="hidden md:inline text-[11px]">Blocker</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[9px] font-mono uppercase font-black ${
                isBlockerActive
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {isBlockerActive ? 'On' : 'Off'}
            </span>
          </button>

          {/* Mini info menu */}
          {showBlockerMenu && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-900 dark:text-white">🛡️ Blocker Controls</span>
                <button
                  type="button"
                  onClick={() => setShowBlockerMenu(false)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              </div>
              <div className="mt-2 space-y-2 text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                <div className="flex items-center justify-between">
                  <span>Ad &amp; Sponsor Banner Suppression</span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">Enabled</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Analytics &amp; Telemetry Shield</span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">Protected</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onToggleBlocker?.();
                  setShowBlockerMenu(false);
                }}
                className="mt-3 w-full rounded-lg bg-slate-900 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                {isBlockerActive ? 'Turn Off Blocker' : 'Activate Blocker'}
              </button>
            </div>
          )}
        </div>

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
