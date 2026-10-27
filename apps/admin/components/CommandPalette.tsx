'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from './AdminShell';

export interface CommandItem {
  id: string;
  title: string;
  category: 'Editorial' | 'Civic & Areas' | 'Administration' | 'Settings' | 'External';
  description: string;
  href: string;
  icon: string;
  badge?: string;
  external?: boolean;
}

const COMMANDS: CommandItem[] = [
  {
    id: 'dashboard',
    title: 'Dashboard Overview',
    category: 'Editorial',
    description: 'Newsroom metrics, queue, and real-time status',
    href: '/',
    icon: '📊',
  },
  {
    id: 'articles',
    title: 'All Articles',
    category: 'Editorial',
    description: 'Manage, edit, publish, or retract stories',
    href: '/articles',
    icon: '📰',
  },
  {
    id: 'new-article',
    title: 'Create New Article',
    category: 'Editorial',
    description: 'Compose a fresh news report or editorial',
    href: '/articles/new',
    icon: '✍️',
    badge: 'Draft',
  },
  {
    id: 'area-problems',
    title: 'Area Problems & Civic Grievances',
    category: 'Civic & Areas',
    description: 'Filter local issues, roads, water, power & district reports',
    href: '/articles?category=Local',
    icon: '🏛️',
    badge: 'Civic Priority',
  },
  {
    id: 'live-articles',
    title: 'Live Published Articles',
    category: 'Editorial',
    description: 'View active public stories on the newsdesk',
    href: '/articles?status=published',
    icon: '🟢',
  },
  {
    id: 'inactive-articles',
    title: 'Inactive & Retracted Articles',
    category: 'Editorial',
    description: 'Inspect retracted, fake news reports, or archived items',
    href: '/articles?status=archived',
    icon: '🚫',
    badge: 'Retracted',
  },
  {
    id: 'employees',
    title: 'Employees & Staff',
    category: 'Administration',
    description: 'Manage reporters, editors, permissions and access',
    href: '/employees',
    icon: '👥',
  },
  {
    id: 'my-profile',
    title: 'My Profile & Author Settings',
    category: 'Administration',
    description: 'Edit your author byline name, view account details, or update password',
    href: '/profile',
    icon: '👤',
    badge: 'Account',
  },
  {
    id: 'templates',
    title: 'Website Templates & Layouts',
    category: 'Settings',
    description: 'Preview and switch public editorial themes',
    href: '/templates',
    icon: '🎨',
  },
  {
    id: 'footer-settings',
    title: 'Footer & Bureau Contact Info',
    category: 'Settings',
    description: 'Manage bureau phone numbers, addresses, and grievance cell',
    href: '/settings/footer',
    icon: '📑',
  },
  {
    id: 'public-site',
    title: 'Open Public Reader Website',
    category: 'External',
    description: 'View the live Kashmir Journalist Information Network reader portal',
    href: 'http://localhost:3000',
    icon: '🌐',
    badge: 'Live',
    external: true,
  },
];

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { brandName } = useAdmin();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Trigger open via custom event if closed
          window.dispatchEvent(new CustomEvent('open-command-palette'));
        }
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return COMMANDS;
    const q = query.toLowerCase();
    return COMMANDS.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q)
    );
  }, [query]);

  const handleSelect = (cmd: CommandItem) => {
    onClose();
    if (cmd.external) {
      window.open(cmd.href, '_blank', 'noopener,noreferrer');
    } else {
      router.push(cmd.href);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (filteredCommands.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredCommands[selectedIndex];
      if (selected) {
        handleSelect(selected);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 md:p-20 bg-slate-950/80 backdrop-blur-md transition-opacity animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/95 shadow-2xl shadow-cyan-950/50 ring-1 ring-cyan-500/20 transition-transform scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3.5">
          <span className="text-xl text-cyan-400">🔍</span>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, page name, or area problem..."
            className="w-full bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-400 border border-slate-700">
            ESC to close
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-2xl mb-2">🔍</p>
              <p className="text-sm font-medium text-slate-300">No matching commands or pages found</p>
              <p className="text-xs text-slate-500 mt-1">Try searching for &quot;Articles&quot;, &quot;Area&quot;, or &quot;Employees&quot;</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredCommands.map((cmd, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={cmd.id}
                    type="button"
                    onClick={() => handleSelect(cmd)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-left transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/10 text-white border border-cyan-500/40'
                        : 'text-slate-300 hover:bg-slate-800/60 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-lg border border-slate-700/60">
                        {cmd.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-semibold truncate ${isSelected ? 'text-cyan-200' : 'text-slate-200'}`}>
                            {cmd.title}
                          </p>
                          {cmd.badge && (
                            <span className="rounded-full bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 text-[10px] font-medium text-cyan-300 shrink-0">
                              {cmd.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{cmd.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">{cmd.category}</span>
                      {cmd.external ? (
                        <span className="text-xs text-slate-400">↗</span>
                      ) : (
                        <span className={`text-xs ${isSelected ? 'text-cyan-400' : 'text-slate-600'}`}>↵</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between border-t border-slate-800/80 bg-slate-950/60 px-4 py-2.5 text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300 border border-slate-700">↑</kbd>{' '}
              <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300 border border-slate-700">↓</kbd> to navigate
            </span>
            <span>
              <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300 border border-slate-700">↵</kbd> to select
            </span>
          </div>
          <span className="text-slate-500 font-mono">{brandName || 'KCPJLN'} Command OS</span>
        </div>
      </div>
    </div>
  );
}
