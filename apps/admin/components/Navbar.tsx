'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showBlockerMenu, setShowBlockerMenu] = useState(false);

  const getBreadcrumb = () => {
    if (pathname === '/') return { title: 'Newsroom Dashboard', section: 'Overview' };
    if (pathname === '/articles/new') return { title: 'New Article Draft', section: 'Articles' };
    if (pathname.startsWith('/articles/') && pathname.endsWith('/edit'))
      return { title: 'Edit Story Content', section: 'Articles' };
    if (pathname.startsWith('/articles/') && pathname.endsWith('/review'))
      return { title: 'Review Article', section: 'Articles' };
    if (pathname.startsWith('/articles/') && pathname !== '/articles')
      return { title: 'Article Details', section: 'Articles' };
    if (pathname === '/articles') {
      const cat = searchParams?.get('category');
      if (cat === 'Local') return { title: 'Area Problems & Civic Grievances', section: 'Local Issues' };
      return { title: 'Articles Directory', section: 'Editorial Desk' };
    }
    if (pathname === '/employees') return { title: 'Employees & Staff Roles', section: 'Team Directory' };
    if (pathname === '/profile') return { title: 'My Profile & Author Settings', section: 'Workspace' };
    if (pathname === '/templates') return { title: 'Website Templates & Layouts', section: 'Site Design' };
    if (pathname === '/settings/navbar') return { title: 'Header & Navigation Control', section: 'Site Design' };
    if (pathname === '/settings/footer') return { title: 'Footer & District Bureaus', section: 'Site Design' };
    if (pathname === '/settings/ads') return { title: 'Custom Ads & Monetization', section: 'Revenue & Ads' };
    return { title: 'KJIN Admin Portal', section: 'Editorial' };
  };

  const breadcrumb = getBreadcrumb();

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6 shadow-xs dark:bg-slate-950 dark:border-slate-800">
      {/* Left: Mobile Toggle & Clean Breadcrumb */}
      <div className="flex items-center gap-3">
        {/* Mobile menu hamburger */}
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label="Open sidebar menu"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 lg:hidden transition-colors"
        >
          <span className="text-base">☰</span>
        </button>

        {/* Clean Breadcrumbs (No oversized pills, no clipped text) */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {breadcrumb.section}
          </span>
          <span className="text-slate-300 dark:text-slate-600 font-bold">/</span>
          <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white whitespace-nowrap">
            {breadcrumb.title}
          </h1>
        </div>
      </div>

      {/* Center: Command Palette Trigger */}
      <div className="hidden md:flex flex-1 max-w-sm mx-4">
        <button
          type="button"
          onClick={onOpenSearch}
          className="group flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs text-slate-500 hover:border-slate-300 hover:bg-white transition-all shadow-2xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
        >
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs">🔍</span>
            <span className="font-medium text-slate-600 dark:text-slate-300">Quick search...</span>
          </div>
          <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-mono text-slate-500 dark:bg-slate-800 dark:border-slate-700">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Clean, spacious action controls */}
      <div className="flex items-center gap-2">
        {/* Mobile Search Icon */}
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Open search"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 md:hidden"
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
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition shadow-2xs ${
              isBlockerActive
                ? 'border-rose-400 bg-rose-50 text-rose-900 hover:bg-rose-100'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span>🛡️</span>
            <span className="hidden sm:inline">Blocker</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[9px] font-mono uppercase font-black ${
                isBlockerActive
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-100 text-slate-600'
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
                  className="text-xs font-bold text-slate-400 hover:text-slate-700"
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
                className="mt-3 w-full rounded-lg bg-slate-900 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition"
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
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition"
          >
            <span className="text-sm">{theme === 'light' ? '🌙' : '☀️'}</span>
          </button>
        )}

        {/* Reader Website Link */}
        <a
          href="http://localhost:3000"
          target="_blank"
          rel="noopener noreferrer"
          title="Open live public reader website"
          className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-cyan-800 transition"
        >
          <span>Live Site</span>
          <span className="text-[10px] text-slate-400 font-bold">↗</span>
        </a>

        {/* Primary CTA: + New Article */}
        <Link
          href="/articles/new"
          className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3 py-1 text-xs font-bold text-white shadow-2xs transition active:scale-95"
        >
          <span>+</span>
          <span>New Story</span>
        </Link>

        {/* Role Badge */}
        <Link
          href="/profile"
          title="My Profile & Author Settings"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 px-2.5 py-0.5 text-xs font-mono font-bold text-slate-800 capitalize transition"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span>{userRole || 'Profile'}</span>
        </Link>
      </div>
    </header>
  );
}
