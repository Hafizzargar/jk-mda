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
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 md:px-8 backdrop-blur-xl shadow-xs transition-colors duration-200 dark:bg-slate-950 dark:border-slate-800">
      {/* Left: Mobile Toggle & Detailed Clean Breadcrumbs */}
      <div className="flex items-center gap-3 md:gap-4">
        {/* Mobile menu hamburger */}
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label="Open sidebar menu"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200 hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:text-white lg:hidden transition-colors"
        >
          <span className="text-lg">☰</span>
        </button>

        {/* Clean Breadcrumb Hierarchy */}
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 border border-slate-300 px-3 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200">
            {breadcrumb.section}
          </span>
          <span className="text-slate-400 dark:text-slate-600 font-black">/</span>
          <h1 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate max-w-[200px] sm:max-w-none">
            {breadcrumb.title}
          </h1>

          {/* Real-time Environment Capsule */}
          <div className="hidden xl:flex items-center gap-1.5 ml-2 rounded-full bg-emerald-50 border border-emerald-300 px-3 py-0.5 text-[11px] font-bold text-emerald-950 dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-600" />
            </span>
            <span>Live System</span>
          </div>
        </div>
      </div>

      {/* Center: Command Palette Trigger */}
      <div className="hidden md:flex flex-1 max-w-md mx-6">
        <button
          type="button"
          onClick={onOpenSearch}
          className="group flex w-full items-center justify-between rounded-xl border border-slate-300 bg-slate-50/90 px-3.5 py-1.5 text-xs text-slate-700 hover:border-cyan-500 hover:bg-white transition-all shadow-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-slate-600 group-hover:text-cyan-700 dark:text-slate-400 dark:group-hover:text-cyan-400 transition-colors">
              🔍
            </span>
            <span className="font-semibold text-slate-800 group-hover:text-slate-950 dark:text-slate-300 dark:group-hover:text-white">
              Quick jump or search...
            </span>
          </div>
          <kbd className="flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[10px] font-mono font-bold text-slate-700 border border-slate-300 shadow-2xs dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
            <span>⌘</span>K
          </kbd>
        </button>
      </div>

      {/* Right: Blocker Button, Theme Switcher, Reader Link, & Profile */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Mobile Search Icon */}
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Open command palette"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-700 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300 md:hidden"
        >
          <span>🔍</span>
        </button>

        {/* ======================================================== */}
        {/* THE BLOCKER BUTTON (Requested by user)                   */}
        {/* ======================================================== */}
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
            className={`group inline-flex items-center gap-1.5 rounded-lg border px-2.5 sm:px-3 py-1.5 text-xs font-bold transition-all shadow-xs active:scale-95 ${
              isBlockerActive
                ? 'border-rose-400 bg-rose-50 text-rose-950 hover:bg-rose-100 dark:border-rose-500 dark:bg-rose-950/50 dark:text-rose-200'
                : 'border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:text-white'
            }`}
          >
            <span
              className={`text-sm transition-transform ${
                isBlockerActive ? 'scale-110 drop-shadow-sm' : 'opacity-80 group-hover:scale-110'
              }`}
            >
              🛡️
            </span>
            <span className="hidden xs:inline">Blocker:</span>
            <span
              className={`rounded px-1.5 py-0.2 text-[10px] font-mono uppercase tracking-wider font-extrabold ${
                isBlockerActive
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              {isBlockerActive ? 'Active' : 'Off'}
            </span>
          </button>

          {/* Mini info menu on right-click or toggle */}
          {showBlockerMenu && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-300 bg-white p-3.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-900 dark:text-white">🛡️ Blocker Controls</span>
                <button
                  type="button"
                  onClick={() => setShowBlockerMenu(false)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              </div>
              <div className="mt-2 space-y-2 text-[11px] text-slate-700 dark:text-slate-300 font-medium">
                <div className="flex items-center justify-between">
                  <span>Ad &amp; Sponsor Banner Suppression</span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">Enabled</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Analytics &amp; Telemetry Shield</span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">Protected</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Notification Pop-ups</span>
                  <span className="font-mono text-slate-600 dark:text-slate-400">Muted</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onToggleBlocker?.();
                  setShowBlockerMenu(false);
                }}
                className="mt-3 w-full rounded-xl bg-slate-900 py-1.5 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 transition"
              >
                {isBlockerActive ? 'Turn Off Blocker' : 'Activate Blocker'}
              </button>
            </div>
          )}
        </div>

        {/* Theme Switcher Toggle (☀️ Light / 🌙 Dark) */}
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} theme`}
            aria-label="Toggle color theme"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:text-white transition-all active:scale-95"
          >
            <span className="text-base">{theme === 'light' ? '🌙' : '☀️'}</span>
          </button>
        )}

        {/* Reader Website Link */}
        <a
          href="http://localhost:3000"
          target="_blank"
          rel="noopener noreferrer"
          title="Open live public reader website"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-200 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:text-white transition-colors"
        >
          <span>Live Site</span>
          <span className="text-[11px] text-slate-500 font-bold">↗</span>
        </a>

        {/* Primary CTA: + New Article */}
        <Link
          href="/articles/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 px-3.5 py-1.5 text-xs font-extrabold text-white shadow-xs hover:from-cyan-500 hover:to-sky-500 transition-all active:scale-95"
        >
          <span className="text-sm leading-none">+</span>
          <span className="hidden xs:inline">New Story</span>
        </Link>

        {/* Role & Profile Link */}
        <Link
          href="/profile"
          title="My Profile & Author Settings"
          className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400 bg-cyan-50 hover:bg-cyan-100 px-3 py-1 text-xs font-mono font-bold text-cyan-950 capitalize transition-all dark:border-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-200 dark:hover:bg-cyan-900/50"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-600 dark:bg-cyan-400" />
          <span>{userRole || 'Profile'}</span>
          <span className="text-[10px] opacity-80">⚙️</span>
        </Link>
      </div>
    </header>
  );
}
