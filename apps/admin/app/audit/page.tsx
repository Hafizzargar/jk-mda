'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { requiresMfa } from '@/lib/mfa';
import { Button } from '@/components/Button';

interface AuditLogDetails {
  title?: string;
  previous_title?: string;
  slug?: string;
  category?: string;
  district?: string;
  version?: number;
  status?: string;
  attempted_by_role?: string;
  [key: string]: unknown;
}

interface AuditLog {
  id: number;
  actor_profile_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  result: 'success' | 'denied' | 'failure';
  reason: string;
  session_id: string | null;
  request_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details: AuditLogDetails;
  created_at: string;
  actor?: {
    id: string;
    display_name: string;
    email: string;
    role_key: string;
  };
}

interface AuditStats {
  totalActions: number;
  editsToday: number;
  deletionsCount: number;
  blockedAttemptsCount: number;
  authorEditorActions: number;
}

export default function AuditLogsPage() {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [authStatus, setAuthStatus] = useState('Verifying administrative clearance...');

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats>({
    totalActions: 0,
    editsToday: 0,
    deletionsCount: 0,
    blockedAttemptsCount: 0,
    authorEditorActions: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [roleFilter, setRoleFilter] = useState<'all' | 'author' | 'editor' | 'admin' | 'superadmin' | 'owner'>('all');
  const [actionCategory, setActionCategory] = useState<'all' | 'articles' | 'employees' | 'security'>('all');
  const [resultFilter, setResultFilter] = useState<'all' | 'success' | 'denied'>('all');
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<'all' | 'authors_editors' | 'deletions' | 'blocked'>('all');

  // Inspection Modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Load Auth
  useEffect(() => {
    async function checkClearance() {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !sessionData.session) {
        setAuthStatus('Sign-in required to access surveillance & audit logs.');
        setIsAuthorized(false);
        setIsLoading(false);
        return;
      }

      const { data: roleData, error: roleErr } = await supabase.rpc('current_user_role');
      if (roleErr || !roleData) {
        setAuthStatus('Unable to verify role clearance.');
        setIsAuthorized(false);
        setIsLoading(false);
        return;
      }

      const userRole = roleData as string;

      // Strictly allow ONLY owner and superadmin
      if (!['owner', 'superadmin'].includes(userRole)) {
        setAuthStatus('Restricted Access: Only Superadmins and Owners are cleared to inspect activity logs.');
        setIsAuthorized(false);
        setIsLoading(false);
        return;
      }

      if (requiresMfa(userRole)) {
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalData?.currentLevel !== 'aal2') {
          window.location.href = aalData?.nextLevel === 'aal2' ? '/mfa/challenge' : '/mfa/enroll';
          return;
        }
      }

      setIsAuthorized(true);
    }

    checkClearance();
  }, []);

  // Fetch Logs
  const fetchLogs = useCallback(async () => {
    if (isAuthorized !== true) return;
    setIsLoading(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) return;

      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(pageSize));

      if (quickFilter === 'authors_editors') {
        // Preset: Authors & Editors
        params.set('role', 'editor'); // or handled via search/query
      } else if (quickFilter === 'deletions') {
        params.set('action', 'article.deleted');
      } else if (quickFilter === 'blocked') {
        params.set('action', 'security');
      } else {
        if (actionCategory !== 'all') params.set('action', actionCategory);
        if (roleFilter !== 'all') params.set('role', roleFilter);
        if (resultFilter !== 'all') params.set('result', resultFilter);
      }

      if (search.trim()) {
        params.set('search', search.trim());
      }

      const response = await fetch(`/api/audit?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load audit records');
      }

      const data = await response.json();
      setLogs(data.logs || []);
      setTotalCount(data.totalCount || 0);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Error loading audit records:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthorized, page, pageSize, roleFilter, actionCategory, resultFilter, search, quickFilter]);

  useEffect(() => {
    if (isAuthorized) {
      fetchLogs();
    }
  }, [isAuthorized, fetchLogs]);

  // Relative timestamp formatter
  const formatTimeAgo = (isoDate: string) => {
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return new Date(isoDate).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };

  // Action badge helpers
  const getActionBadge = (action: string, result: string) => {
    if (result === 'denied' || action.includes('blocked')) {
      return {
        label: 'Blocked / Denied',
        icon: '🚨',
        color: 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800 font-extrabold',
      };
    }

    switch (action) {
      case 'article.created':
        return {
          label: 'New Draft Created',
          icon: '📝',
          color: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
        };
      case 'article.updated':
        return {
          label: 'Article Edited',
          icon: '✏️',
          color: 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800 font-bold',
        };
      case 'article.submitted_for_review':
        return {
          label: 'Submitted for Review',
          icon: '⏳',
          color: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
        };
      case 'article.published':
        return {
          label: 'Published Live',
          icon: '✨',
          color: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 font-bold',
        };
      case 'article.deleted':
        return {
          label: 'Article Deleted',
          icon: '🗑️',
          color: 'bg-red-100 text-red-900 border-red-300 dark:bg-red-950/60 dark:text-red-200 dark:border-red-800 font-bold',
        };
      case 'article.archived':
        return {
          label: 'Article Inactivated',
          icon: '🚫',
          color: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
        };
      case 'article.reactivated':
        return {
          label: 'Reactivated Live',
          icon: '🔄',
          color: 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800',
        };
      default:
        return {
          label: action.replace(/\./g, ' '),
          icon: '📋',
          color: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        };
    }
  };

  const getRoleBadge = (roleKey?: string) => {
    switch (roleKey) {
      case 'owner':
        return 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/60 dark:text-purple-200 dark:border-purple-800';
      case 'superadmin':
        return 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800';
      case 'admin':
        return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800';
      case 'editor':
        return 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-800';
      case 'author':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  if (isAuthorized === false) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-lg dark:border-red-900/50 dark:bg-slate-900">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl text-red-600 dark:bg-red-950/60 dark:text-red-400">
            🛡️
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">Clearance Required</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{authStatus}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">
        {/* Top Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 items-center rounded-md bg-rose-100 px-2 text-xs font-bold text-rose-800 border border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800">
                🛡️ Surveillance & Accountability
              </span>
              <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                Owner & Superadmin Only
              </span>
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Audit & Newsroom Activity Records
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
              Immutable ledger of all editor and author actions. Real-time surveillance of content edits,
              deletions, status transitions, and security enforcements.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon="🔄"
              disabled={isLoading}
              onClick={fetchLogs}
            >
              Refresh Logs
            </Button>
            <Link
              href="/articles"
              className="inline-flex items-center gap-1.5 h-8.5 px-3 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200"
            >
              <span>📰 Articles Desk</span>
            </Link>
          </div>
        </div>

        {/* Metric Statistics Cards */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {/* Card 1: Total Operations */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Total Records
              </span>
              <span className="text-lg">📊</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                {stats.totalActions.toLocaleString()}
              </span>
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                +{stats.editsToday} today
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Immutable append-only events
            </p>
          </div>

          {/* Card 2: Author & Editor Actions */}
          <div 
            onClick={() => {
              setQuickFilter('authors_editors');
              setRoleFilter('editor');
              setPage(1);
            }}
            className="cursor-pointer rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 shadow-2xs hover:border-indigo-400 transition-all dark:border-indigo-900/50 dark:bg-indigo-950/20"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                Author & Editor Actions
              </span>
              <span className="text-lg">✍️</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-indigo-950 dark:text-indigo-100">
                {stats.authorEditorActions.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                Filter →
              </span>
            </div>
            <p className="mt-1 text-[11px] text-indigo-700/80 dark:text-indigo-300/80">
              Drafts, story updates & reviews
            </p>
          </div>

          {/* Card 3: Permanent Deletions */}
          <div 
            onClick={() => {
              setQuickFilter('deletions');
              setPage(1);
            }}
            className="cursor-pointer rounded-xl border border-red-200 bg-red-50/40 p-4 shadow-2xs hover:border-red-400 transition-all dark:border-red-900/50 dark:bg-red-950/20"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-red-700 dark:text-red-300">
                Article Deletions
              </span>
              <span className="text-lg">🗑️</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-red-950 dark:text-red-100">
                {stats.deletionsCount.toLocaleString()}
              </span>
              <span className="text-xs font-bold text-red-600 dark:text-red-400">
                Admin/Owner only
              </span>
            </div>
            <p className="mt-1 text-[11px] text-red-700/80 dark:text-red-300/80">
              Only authorized staff permitted
            </p>
          </div>

          {/* Card 4: Blocked Attempts */}
          <div 
            onClick={() => {
              setQuickFilter('blocked');
              setResultFilter('denied');
              setPage(1);
            }}
            className="cursor-pointer rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-2xs hover:border-amber-400 transition-all dark:border-amber-900/50 dark:bg-amber-950/20"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Blocked / Denied
              </span>
              <span className="text-lg">🛡️</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-950 dark:text-amber-100">
                {stats.blockedAttemptsCount.toLocaleString()}
              </span>
              {stats.blockedAttemptsCount > 0 ? (
                <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-extrabold text-red-600 dark:text-red-400 animate-pulse">
                  Alerts
                </span>
              ) : (
                <span className="text-xs font-medium text-emerald-600">Zero breaches</span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-amber-800/80 dark:text-amber-300/80">
              Unauthorized delete / edit stops
            </p>
          </div>
        </div>

        {/* Quick Filter Bar */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => {
                setQuickFilter('all');
                setRoleFilter('all');
                setActionCategory('all');
                setResultFilter('all');
                setPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                quickFilter === 'all' && roleFilter === 'all' && actionCategory === 'all'
                  ? 'bg-slate-900 text-white dark:bg-cyan-600'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              All Records
            </button>

            <button
              type="button"
              onClick={() => {
                setQuickFilter('authors_editors');
                setRoleFilter('editor');
                setActionCategory('all');
                setPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                roleFilter === 'editor'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300'
              }`}
            >
              👨‍💻 Editors Only
            </button>

            <button
              type="button"
              onClick={() => {
                setQuickFilter('authors_editors');
                setRoleFilter('author');
                setActionCategory('all');
                setPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                roleFilter === 'author'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300'
              }`}
            >
              ✍️ Authors Only
            </button>

            <button
              type="button"
              onClick={() => {
                setQuickFilter('deletions');
                setActionCategory('articles');
                setPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                quickFilter === 'deletions'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300'
              }`}
            >
              🗑️ Deletions
            </button>

            <button
              type="button"
              onClick={() => {
                setQuickFilter('blocked');
                setResultFilter('denied');
                setPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                quickFilter === 'blocked' || resultFilter === 'denied'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300'
              }`}
            >
              🚨 Blocked Attempts
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by title, editor, slug..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Activity Feed Table */}
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          {isLoading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
              <p className="text-xs text-slate-500">Loading audit records...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 p-8 text-center">
              <span className="text-4xl">🛡️</span>
              <h3 className="font-bold text-slate-800 dark:text-slate-200">No activity records match your criteria</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Try resetting filters or expanding your search to inspect historical logs.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuickFilter('all');
                  setRoleFilter('all');
                  setActionCategory('all');
                  setResultFilter('all');
                  setSearch('');
                  setPage(1);
                }}
                className="mt-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="border-b border-slate-200 bg-slate-50/80 font-bold uppercase tracking-wider text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                  <tr>
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4">Actor / Responsible Staff</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Article / Resource Target</th>
                    <th className="py-3 px-4">Key Modifications & Details</th>
                    <th className="py-3 px-4 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {logs.map((log) => {
                    const actionInfo = getActionBadge(log.action, log.result);
                    const actorName = log.actor?.display_name || 'System';
                    const actorEmail = log.actor?.email || 'N/A';
                    const actorRole = log.actor?.role_key || 'employee';

                    const details = log.details || {};
                    const title = typeof details.title === 'string' ? details.title : typeof details.previous_title === 'string' ? details.previous_title : undefined;
                    const slug = typeof details.slug === 'string' ? details.slug : undefined;
                    const category = typeof details.category === 'string' ? details.category : undefined;
                    const version = typeof details.version === 'number' || typeof details.version === 'string' ? String(details.version) : undefined;
                    const statusStr = typeof details.status === 'string' ? details.status : undefined;
                    const attemptedRole = typeof details.attempted_by_role === 'string' ? details.attempted_by_role : undefined;

                    return (
                      <tr
                        key={log.id}
                        className="hover:bg-slate-50/70 transition-colors dark:hover:bg-slate-800/50"
                      >
                        {/* Time */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {formatTimeAgo(log.created_at)}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>

                        {/* Actor */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-200 uppercase">
                              {actorName.slice(0, 2)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 dark:text-white truncate max-w-[140px]">
                                  {actorName}
                                </span>
                                <span
                                  className={`rounded-sm border px-1.5 py-0.2 text-[9px] font-mono font-bold capitalize ${getRoleBadge(
                                    actorRole
                                  )}`}
                                >
                                  {actorRole}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 truncate max-w-[170px]">
                                {actorEmail}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Action Badge */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${actionInfo.color}`}
                          >
                            <span>{actionInfo.icon}</span>
                            <span>{actionInfo.label}</span>
                          </span>
                        </td>

                        {/* Target */}
                        <td className="py-3.5 px-4 max-w-xs">
                          {title ? (
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white line-clamp-1">
                                {title}
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                {category && (
                                  <span className="rounded bg-slate-100 px-1 py-0.2 font-mono font-bold dark:bg-slate-800">
                                    {category}
                                  </span>
                                )}
                                {slug && <span className="truncate max-w-[150px] font-mono">{slug}</span>}
                              </div>
                            </div>
                          ) : (
                            <span className="font-mono text-[11px] text-slate-400">
                              {log.target_type} ({log.target_id ? log.target_id.slice(0, 8) + '...' : 'general'})
                            </span>
                          )}
                        </td>

                        {/* Key Details / Modification Summary */}
                        <td className="py-3.5 px-4 text-[11px] max-w-sm">
                          {log.action === 'article.delete_attempt_blocked' ? (
                            <div className="text-rose-700 dark:text-rose-400 font-semibold">
                              ⚠️ Attempted unauthorized deletion by role: {attemptedRole || 'unknown'}
                            </div>
                          ) : log.action === 'article.deleted' ? (
                            <div className="text-red-700 dark:text-red-400 font-semibold">
                              Permanently purged from database. Reason: {log.reason || 'Admin deletion'}
                            </div>
                          ) : log.action === 'article.updated' ? (
                            <div className="text-slate-600 dark:text-slate-300">
                              {version ? <span className="font-bold text-indigo-600 dark:text-indigo-400">v{version} revision: </span> : ''}
                              Updated content/metadata. Status: <span className="capitalize font-mono">{statusStr || 'active'}</span>
                            </div>
                          ) : log.reason ? (
                            <div className="text-slate-600 dark:text-slate-300 italic">
                              &ldquo;{log.reason}&rdquo;
                            </div>
                          ) : (
                            <div className="text-slate-400 font-mono text-[10px]">
                              {JSON.stringify(log.details).slice(0, 70)}...
                            </div>
                          )}
                        </td>

                        {/* Inspect Button */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedLog(log)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-cyan-500 hover:text-cyan-700 shadow-2xs transition active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Showing page <span className="font-bold text-slate-800 dark:text-white">{page}</span> of{' '}
              <span className="font-bold text-slate-800 dark:text-white">{totalPages}</span> ({totalCount} total events)
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages || isLoading}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Record Inspection Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">🛡️</span>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Audit Record #{selectedLog.id}
                  </h3>
                  <p className="text-xs font-mono text-slate-500">
                    Timestamp: {new Date(selectedLog.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="h-8 w-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              {/* Actor Details */}
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px] dark:text-slate-300">
                  Responsible Staff Member
                </h4>
                <div className="mt-2 grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                  <div>
                    <span className="text-slate-400">Name: </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {selectedLog.actor?.display_name || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Role: </span>
                    <span className="font-mono font-bold capitalize">
                      {selectedLog.actor?.role_key || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Email: </span>
                    <span>{selectedLog.actor?.email || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Profile ID: </span>
                    <span className="font-mono">{selectedLog.actor_profile_id || 'System'}</span>
                  </div>
                </div>
              </div>

              {/* Action & Result */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px] dark:text-slate-300">
                    Action Execution
                  </h4>
                  <p className="mt-1 font-mono font-bold text-cyan-700 dark:text-cyan-400">
                    {selectedLog.action}
                  </p>
                  <p className="mt-0.5 text-slate-500">Target: {selectedLog.target_type}</p>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px] dark:text-slate-300">
                    Enforcement Result
                  </h4>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${
                        selectedLog.result === 'success' ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                    />
                    <span className="font-bold capitalize">{selectedLog.result}</span>
                  </div>
                  {selectedLog.reason && (
                    <p className="mt-1 text-slate-600 dark:text-slate-400 italic">
                      &ldquo;{selectedLog.reason}&rdquo;
                    </p>
                  )}
                </div>
              </div>

              {/* Network / Session Telemetry */}
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px] dark:text-slate-300">
                  Session & Request Telemetry
                </h4>
                <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                  <div>
                    <span className="text-slate-400">IP Address: </span>
                    <span>{selectedLog.ip_address || 'Internal/Loopback'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Target UUID: </span>
                    <span>{selectedLog.target_id || 'N/A'}</span>
                  </div>
                  <div className="col-span-2 truncate">
                    <span className="text-slate-400">User Agent: </span>
                    <span>{selectedLog.user_agent || 'KJIN Browser Session'}</span>
                  </div>
                </div>
              </div>

              {/* JSON Payload */}
              <div>
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px] dark:text-slate-300 mb-1.5">
                  Change Details (JSON Payload)
                </h4>
                <pre className="max-h-56 overflow-auto rounded-xl bg-slate-900 p-3 font-mono text-[11px] text-cyan-300">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setSelectedLog(null)}
              >
                Close Inspector
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
