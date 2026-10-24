'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  userRole?: string | null;
  userEmail?: string | null;
  onSignOut: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: string;
  badge?: string;
  badgeColor?: string;
  roles?: string[];
  exact?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export function Sidebar({
  isCollapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  userRole,
  userEmail,
  onSignOut,
}: SidebarProps) {
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  const navSections: NavSection[] = [
    {
      title: 'Editorial Desk',
      items: [
        {
          name: 'Dashboard',
          href: '/',
          icon: '📊',
          exact: true,
        },
        {
          name: 'Articles & Stories',
          href: '/articles',
          icon: '📰',
          exact: false,
        },
        {
          name: 'New Story',
          href: '/articles/new',
          icon: '✍️',
          badge: 'Draft',
          badgeColor: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300',
        },
      ],
    },
    {
      title: 'Workspace',
      items: [
        {
          name: 'Employees & Access',
          href: '/employees',
          icon: '👥',
        },
        {
          name: 'My Profile & Author',
          href: '/profile',
          icon: '👤',
        },
      ],
    },
    {
      title: 'Display & Configuration',
      items: [
        {
          name: 'Website Templates',
          href: '/templates',
          icon: '🎨',
          roles: ['owner', 'superadmin', 'admin'],
        },
        {
          name: 'Header & Navigation',
          href: '/settings/navbar',
          icon: '🧭',
          roles: ['owner', 'superadmin', 'admin', 'editor'],
          badge: 'Live',
          badgeColor: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 font-semibold',
        },
        {
          name: 'Footer & Bureaus',
          href: '/settings/footer',
          icon: '📑',
          roles: ['owner', 'superadmin', 'admin', 'editor'],
        },
        {
          name: 'Custom Ads & Monetization',
          href: '/settings/ads',
          icon: '💰',
          roles: ['owner', 'superadmin', 'admin', 'editor'],
          badge: '✨ Earn',
          badgeColor: 'bg-gradient-to-r from-amber-500/25 to-emerald-500/25 border-amber-400/50 text-amber-300 font-bold shadow-sm shadow-amber-950/40',
        },
      ],
    },
  ];

  const handleSignOutClick = async () => {
    setLoggingOut(true);
    await onSignOut();
  };

  const isLinkActive = (item: NavItem) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  const userInitials = userEmail
    ? userEmail.slice(0, 2).toUpperCase()
    : userRole
      ? userRole.slice(0, 2).toUpperCase()
      : 'KJ';

  const sidebarContent = (
    <div className="flex h-full flex-col bg-slate-950/95 border-r border-slate-800/80 backdrop-blur-2xl text-slate-200 overflow-hidden">
      {/* Top Branding Section (Fixed) */}
      <div className="shrink-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80">
          <Link
            href="/"
            onClick={onCloseMobile}
            className="flex items-center gap-2.5 transition-opacity hover:opacity-90"
          >
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/40 p-1 shadow-md shadow-cyan-950/50">
              <Image
                src="/kcpjln-symbol.webp"
                alt="KJIN Symbol"
                width={26}
                height={26}
                className="object-contain"
                priority
              />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-base tracking-wider text-white">KJIN</span>
                  <span className="rounded bg-cyan-500/20 px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase tracking-widest text-cyan-300 border border-cyan-500/40">
                    OS
                  </span>
                </div>
                <p className="text-[9px] font-medium tracking-widest text-slate-400 uppercase">
                  Newsroom Admin
                </p>
              </div>
            )}
          </Link>

          {/* Desktop collapse toggle */}
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:flex h-6 w-6 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-900 text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
          >
            <span className="text-[10px]">{isCollapsed ? '▶' : '◀'}</span>
          </button>
        </div>

        {/* Live Engine Status Mini Banner */}
        {!isCollapsed && (
          <div className="mx-3 mt-2 flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-2.5 py-1 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="font-semibold text-emerald-300 text-[11px]">Newsdesk Online</span>
            </div>
            <span className="text-[9px] font-mono text-emerald-400/80 uppercase">v2.4</span>
          </div>
        )}
      </div>

      {/* Navigation Sections (Scrollable flex-1) */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-3.5">
        {navSections.map((section) => {
          const filteredItems = section.items.filter((item) => {
            if (!item.roles || !userRole) return true;
            return item.roles.includes(userRole);
          });

          if (filteredItems.length === 0) return null;

          return (
            <div key={section.title} className="space-y-1">
              {!isCollapsed && (
                <p className="px-2.5 text-[9px] font-bold uppercase tracking-widest text-slate-400">
                  {section.title}
                </p>
              )}
              <div className="space-y-0.5">
                {filteredItems.map((item) => {
                  const active = isLinkActive(item);
                  const isAdsItem = item.href === '/settings/ads';

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onCloseMobile}
                      title={isCollapsed ? item.name : undefined}
                      className={`group flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-all ${
                        active
                          ? 'bg-gradient-to-r from-cyan-500/20 via-cyan-500/10 to-transparent text-white border-l-4 border-cyan-400 font-semibold shadow-sm shadow-cyan-950/40'
                          : isAdsItem
                            ? 'bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent text-amber-200 hover:bg-amber-500/20 hover:text-white border-l-4 border-amber-400/60 shadow-sm'
                            : 'text-slate-300 hover:bg-slate-900/80 hover:text-white border-l-4 border-transparent'
                      }`}
                    >
                      <span className={`text-sm transition-transform group-hover:scale-110 ${active ? 'scale-110' : ''}`}>
                        {item.icon}
                      </span>
                      {!isCollapsed && (
                        <div className="flex flex-1 items-center justify-between overflow-hidden">
                          <span className="truncate">{item.name}</span>
                          {item.badge && (
                            <span
                              className={`ml-1.5 shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-wide ${
                                item.badgeColor || 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Quick Reader Portal Link */}
        <div className="pt-1">
          {!isCollapsed && (
            <p className="px-2.5 text-[9px] font-bold uppercase tracking-widest text-slate-400">
              Reader Website
            </p>
          )}
          <a
            href="http://localhost:3000"
            target="_blank"
            rel="noopener noreferrer"
            title={isCollapsed ? 'View Live Public Site' : undefined}
            className="group mt-0.5 flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-900/80 hover:text-cyan-300 transition-all border-l-4 border-transparent"
          >
            <span className="text-sm group-hover:scale-110 transition-transform">🌐</span>
            {!isCollapsed && (
              <div className="flex flex-1 items-center justify-between">
                <span className="truncate">Public Site</span>
                <span className="text-[10px] text-slate-400 group-hover:text-cyan-300">↗</span>
              </div>
            )}
          </a>
        </div>
      </nav>

      {/* Bottom User Profile Section */}
      <div className="shrink-0 border-t border-slate-800/80 p-2.5 bg-slate-950/90">
        <div
          className={`flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-2 transition-all ${
            isCollapsed ? 'justify-center p-2' : ''
          }`}
        >
          {/* Avatar - Clickable Link to Profile */}
          <Link
            href="/profile"
            onClick={onCloseMobile}
            title="My Profile & Author Settings"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-xs font-bold text-slate-950 shadow-md shadow-cyan-950/50 hover:scale-105 transition-transform"
          >
            {userInitials}
          </Link>

          {!isCollapsed && (
            <Link
              href="/profile"
              onClick={onCloseMobile}
              title="My Profile & Author Settings"
              className="flex-1 min-w-0 group"
            >
              <p className="truncate text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors">
                {userEmail || 'Editor Session'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="truncate text-[10px] font-mono text-cyan-300 capitalize group-hover:underline">
                  {userRole || 'Editor'} • Edit
                </span>
              </div>
            </Link>
          )}

          {/* Profile / Settings Button */}
          {!isCollapsed && (
            <Link
              href="/profile"
              onClick={onCloseMobile}
              title="Edit Profile & Author Name"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700/80 text-slate-400 hover:border-cyan-500/50 hover:bg-cyan-500/10 hover:text-cyan-300 transition-colors"
            >
              <span className="text-xs">⚙️</span>
            </Link>
          )}

          {/* Sign Out Button */}
          <button
            type="button"
            onClick={handleSignOutClick}
            disabled={loggingOut}
            title="Sign out of newsroom"
            aria-label="Sign out"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700/80 text-slate-400 hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <span className="text-sm">{loggingOut ? '⏳' : '🚪'}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className={`fixed top-0 bottom-0 z-40 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>
          {sidebarContent}
        </div>
      </aside>

      {/* Mobile Sliding Drawer & Backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          {/* Sliding drawer */}
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
