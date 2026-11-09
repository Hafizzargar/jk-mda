'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface AuditNotification {
  id: number;
  action: string;
  target_type: string;
  result: string;
  reason: string;
  created_at: string;
  details?: Record<string, unknown>;
  actor?: {
    display_name: string;
    email: string;
    role_key: string;
  };
}

interface PendingAiDraft {
  id: string;
  proposed_headline: string | null;
  proposed_category: string | null;
  published_at: string;
}

interface NotificationBellProps {
  userRole?: string | null;
}

export function NotificationBell({ userRole }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AuditNotification[]>([]);
  const [pendingAiDrafts, setPendingAiDrafts] = useState<PendingAiDraft[]>([]);
  const [hasUnreadAlerts, setHasUnreadAlerts] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isPrivileged = userRole === 'owner' || userRole === 'superadmin' || userRole === 'admin' || userRole === 'editor';

  // Fetch recent notifications
  const loadNotifications = useCallback(async () => {
    if (!isPrivileged) return;
    try {
      setIsLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return;

      // 1. Fetch staff activity logs
      const response = await fetch('/api/audit?limit=8&recentOnly=true', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      let logs: AuditNotification[] = [];
      if (response.ok) {
        const data = await response.json();
        logs = (data.logs || []) as AuditNotification[];
        setNotifications(logs);
      }

      // 2. Fetch pending AI news drafts awaiting verification
      const { data: aiDrafts } = await supabase
        .from('youtube_videos')
        .select('id, proposed_headline, proposed_category, published_at')
        .eq('processing_status', 'draft_proposed')
        .order('published_at', { ascending: false })
        .limit(5);

      const aiList = (aiDrafts || []) as PendingAiDraft[];
      setPendingAiDrafts(aiList);

      // Check if any recent logs are alerts or if AI drafts are pending
      const hasSecurityAlert = logs.some(
        (l) => l.result === 'denied' || l.action === 'article.delete_attempt_blocked'
      );
      setHasUnreadAlerts(hasSecurityAlert || aiList.length > 0);
    } catch {
      // Quiet fail on network hiccups
    } finally {
      setIsLoading(false);
    }
  }, [isPrivileged]);

  useEffect(() => {
    if (isPrivileged) {
      loadNotifications();
      // Poll every 30 seconds for live updates
      const interval = setInterval(loadNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [isPrivileged, loadNotifications]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  if (!isPrivileged) {
    return null;
  }

  const formatShortTime = (isoDate: string) => {
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);

    if (diffMin < 1) return 'now';
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHour < 24) return `${diffHour}h`;
    return new Date(isoDate).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
  };

  const getActionSummary = (item: AuditNotification) => {
    const actorName = item.actor?.display_name || 'Staff';
    const rawTitle = typeof item.details?.title === 'string' ? item.details.title : '';
    const title = rawTitle ? `"${rawTitle.slice(0, 32)}..."` : 'article';

    if (item.action === 'article.delete_attempt_blocked') {
      return {
        text: `Blocked delete attempt by ${actorName}`,
        badge: '🚨 Blocked',
        badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
      };
    }
    if (item.action === 'article.deleted') {
      return {
        text: `${actorName} permanently deleted ${title}`,
        badge: '🗑️ Deleted',
        badgeColor: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
      };
    }
    if (item.action === 'article.updated') {
      return {
        text: `${actorName} edited ${title}`,
        badge: '✏️ Edited',
        badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
      };
    }
    if (item.action === 'article.created') {
      return {
        text: `${actorName} created draft ${title}`,
        badge: '📝 Draft',
        badgeColor: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
      };
    }
    if (item.action === 'article.submitted_for_review') {
      return {
        text: `${actorName} submitted draft for review`,
        badge: '⏳ Review',
        badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
      };
    }
    if (item.action === 'article.published') {
      return {
        text: `${actorName} published ${title} live`,
        badge: '✨ Published',
        badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
      };
    }

    return {
      text: `${actorName}: ${item.action.replace(/\./g, ' ')}`,
      badge: 'Activity',
      badgeColor: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
    };
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) loadNotifications();
        }}
        title="Newsroom Surveillance & Activity Alerts"
        aria-label="Activity Notifications"
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 active:scale-95 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <span className="text-sm">🔔</span>
        {hasUnreadAlerts && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-amber-500 text-[9px] font-black text-slate-950 shadow-sm">
            {pendingAiDrafts.length > 0 ? pendingAiDrafts.length : '!'}
          </span>
        )}
      </button>

      {/* Floating Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 z-50 overflow-hidden animate-in fade-in duration-150">
          {/* AI Stories Pending Verification Section */}
          {pendingAiDrafts.length > 0 && (
            <div className="bg-purple-50/90 dark:bg-purple-950/40 border-b border-purple-200/80 dark:border-purple-800/60 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-purple-900 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🤖</span>
                  <span>AI Drafts Waiting Approval ({pendingAiDrafts.length})</span>
                </span>
                <Link
                  href="/newsroom/youtube"
                  onClick={() => setIsOpen(false)}
                  className="text-[10px] font-bold text-purple-700 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-200 underline"
                >
                  Review All →
                </Link>
              </div>
              <div className="space-y-1.5">
                {pendingAiDrafts.map((draft) => (
                  <Link
                    key={draft.id}
                    href="/newsroom/youtube"
                    onClick={() => setIsOpen(false)}
                    className="block p-2 rounded-lg bg-white dark:bg-slate-900 border border-purple-100 dark:border-purple-900/60 hover:border-purple-300 transition"
                  >
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-1 leading-snug">
                      {draft.proposed_headline || 'Synthesized News Draft'}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                      <span className="font-bold text-purple-600 dark:text-purple-400">
                        {draft.proposed_category || 'General'}
                      </span>
                      <span>{formatShortTime(draft.published_at)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">🛡️</span>
              <span className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                Staff Activity & Alerts
              </span>
            </div>
            <Link
              href="/audit"
              onClick={() => setIsOpen(false)}
              className="text-[11px] font-bold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400"
            >
              Full Desk →
            </Link>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
            {isLoading && notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading activity feed...</div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No recent activity detected.</div>
            ) : (
              notifications.map((item) => {
                const summary = getActionSummary(item);
                const role = item.actor?.role_key || 'employee';

                return (
                  <Link
                    key={item.id}
                    href="/audit"
                    onClick={() => setIsOpen(false)}
                    className="block p-3 hover:bg-slate-50 transition-colors dark:hover:bg-slate-800/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`rounded px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase shrink-0 ${summary.badgeColor}`}
                        >
                          {summary.badge}
                        </span>
                        <span className="text-[10px] font-mono capitalize text-slate-500 shrink-0">
                          ({role})
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                        {formatShortTime(item.created_at)}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-slate-800 dark:text-slate-200 line-clamp-2 leading-snug">
                      {summary.text}
                    </p>

                    {item.reason && (
                      <p className="mt-0.5 text-[10px] text-slate-400 italic truncate">
                        &ldquo;{item.reason}&rdquo;
                      </p>
                    )}
                  </Link>
                );
              })
            )}
          </div>

          <div className="border-t border-slate-100 bg-slate-50/50 p-2 text-center dark:border-slate-800 dark:bg-slate-950/40">
            <Link
              href="/audit"
              onClick={() => setIsOpen(false)}
              className="block rounded-lg py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
            >
              View All Records in Surveillance Desk →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
