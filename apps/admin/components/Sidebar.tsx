'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';

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
  isCategoryLocal?: boolean;
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
  const searchParams = useSearchParams();
  const [loggingOut, setLoggingOut] = useState(false);

  const currentCategory = searchParams?.get('category');

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
          name: 'All Articles',
          href: '/articles',
          icon: '📰',
          exact: false,
        },
        {
          name: 'Area Problems',
          href: '/articles?category=Local',
          icon: '🏛️',
          badge: 'Civic',
          badgeColor: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
          isCategoryLocal: true,
        },
        {
          name: 'New Article',
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
          name: 'Footer & Bureaus',
          href: '/settings/footer',
          icon: '📑',
          roles: ['owner', 'superadmin', 'admin', 'editor'],
        },
      ],
    },
  ];

  const handleSignOutClick = async () => {
    setLoggingOut(true);
    await onSignOut();
  };

  const isLinkActive = (item: NavItem) => {
    if (item.isCategoryLocal) {
      return pathname === '/articles' && currentCategory === 'Local';
    }
    if (item.href === '/articles' && currentCategory === 'Local') {
      return false;
    }
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
    <div className="flex h-full flex-col justify-between overflow-y-auto bg-slate-950/95 border-r border-slate-800/80 backdrop-blur-2xl text-slate-200">
      {/* Top Branding Section */}
      <div>
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800/80">
          <Link
            href="/"
            onClick={onCloseMobile}
            className="flex items-center gap-3 transition-opacity hover:opacity-90"
          >
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/40 p-1 shadow-lg shadow-cyan-950/50">
              <Image
                src="/kcpjln-symbol.webp"
                alt="KJIN Symbol"
                width={32}
                height={32}
                className="object-contain"
                priority
              />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-black text-lg tracking-wider text-white">KJIN</span>
                  <span className="rounded bg-cyan-500/20 px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase tracking-widest text-cyan-300 border border-cyan-500/40">
                    OS
                  </span>
                </div>
                <p className="text-[10px] font-medium tracking-widest text-slate-400 uppercase">
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
            className="hidden lg:flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-900 text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
          >
            <span className="text-xs">{isCollapsed ? '▶' : '◀'}</span>
          </button>
        </div>

        {/* Live Engine Status Banner */}
        {!isCollapsed && (
          <div className="mx-3 mt-3 flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="font-semibold text-emerald-300 text-[11px]">Newsdesk Online</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400/80 uppercase">v2.4</span>
          </div>
        )}

        {/* Navigation Sections */}
        <nav className="mt-4 space-y-6 px-3">
          {navSections.map((section) => {
            const filteredItems = section.items.filter((item) => {
              if (!item.roles || !userRole) return true;
              return item.roles.includes(userRole);
            });

            if (filteredItems.length === 0) return null;

            return (
              <div key={section.title} className="space-y-1">
                {!isCollapsed && (
                  <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-slate-300">
                    {section.title}
                  </p>
                )}
                <div className="space-y-1">
                  {filteredItems.map((item) => {
                    const active = isLinkActive(item);

                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={onCloseMobile}
                        title={isCollapsed ? item.name : undefined}
                        className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                          active
                            ? 'bg-gradient-to-r from-cyan-500/20 via-cyan-500/10 to-transparent text-white border-l-4 border-cyan-400 font-semibold shadow-sm shadow-cyan-950/40'
                            : 'text-slate-400 hover:bg-slate-900/80 hover:text-white border-l-4 border-transparent'
                        }`}
                      >
                        <span className={`text-base transition-transform group-hover:scale-110 ${active ? 'scale-110' : ''}`}>
                          {item.icon}
                        </span>
                        {!isCollapsed && (
                          <div className="flex flex-1 items-center justify-between overflow-hidden">
                            <span className="truncate">{item.name}</span>
                            {item.badge && (
                              <span
                                className={`ml-2 shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${
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
          <div className="pt-2">
            {!isCollapsed && (
              <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-slate-300">
                Reader Website
              </p>
            )}
            <a
              href="http://localhost:3000"
              target="_blank"
              rel="noopener noreferrer"
              title={isCollapsed ? 'View Live Public Site' : undefined}
              className="group mt-1 flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-900/80 hover:text-cyan-300 transition-all border-l-4 border-transparent"
            >
              <span className="text-base group-hover:scale-110 transition-transform">🌐</span>
              {!isCollapsed && (
                <div className="flex flex-1 items-center justify-between">
                  <span className="truncate">Public Site</span>
                  <span className="text-xs text-slate-300 group-hover:text-cyan-300">↗</span>
                </div>
              )}
            </a>
          </div>
        </nav>
      </div>

      {/* Bottom User Profile Section */}
      <div className="border-t border-slate-800/80 p-3 bg-slate-950/80">
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
