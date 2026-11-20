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

interface PendingReviewArticle {
  id: string;
  title: string;
  category: string;
  district?: string | null;
  author_display_name: string;
  updated_at: string;
}

interface CandidateApplicationNotification {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  city: string;
  experience_years: string;
  applied_at: string;
  status: string;
}

interface NotificationBellProps {
  userRole?: string | null;
}

export function NotificationBell({ userRole }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'ai_drafts' | 'review' | 'candidates' | 'activity'>('candidates');
  const [notifications, setNotifications] = useState<AuditNotification[]>([]);
  const [pendingAiDrafts, setPendingAiDrafts] = useState<PendingAiDraft[]>([]);
  const [pendingArticles, setPendingArticles] = useState<PendingReviewArticle[]>([]);
  const [pendingApplications, setPendingApplications] = useState<CandidateApplicationNotification[]>([]);
  const [hasUnreadAlerts, setHasUnreadAlerts] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isPrivileged = userRole === 'owner' || userRole === 'superadmin' || userRole === 'admin';

  // Fetch recent notifications
  const loadNotifications = useCallback(async () => {
    if (!isPrivileged) return;
    try {
      setIsLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return;

      // 1. Fetch staff activity logs
      const response = await fetch('/api/audit?limit=10&recentOnly=true', {
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

      // 2. Fetch pending AI video drafts awaiting verification
      const { data: aiDrafts } = await supabase
        .from('youtube_videos')
        .select('id, proposed_headline, proposed_category, published_at')
        .eq('processing_status', 'draft_proposed')
        .order('published_at', { ascending: false })
        .limit(5);

      const aiList = (aiDrafts || []) as PendingAiDraft[];
      setPendingAiDrafts(aiList);

      // 3. Fetch articles in Pending Approval queue (status: 'review')
      const { data: revArticles } = await supabase
        .from('articles')
        .select('id, title, category, district, author_display_name, updated_at')
        .eq('status', 'review')
        .order('updated_at', { ascending: false })
        .limit(6);

      const reviewList = (revArticles || []) as PendingReviewArticle[];
      setPendingArticles(reviewList);

      // 4. Fetch new candidate job applications (status: 'new') from site_settings
      const { data: careersRow } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'careers_settings')
        .maybeSingle();

      const candidateApps = ((careersRow?.value as { applications?: CandidateApplicationNotification[] } | null)?.applications || []) as CandidateApplicationNotification[];
      const newApps = candidateApps.filter((app) => !app.status || app.status === 'new').slice(0, 8);
      setPendingApplications(newApps);

      // Check if any alerts exist
      const hasSecurityAlert = logs.some(
        (l) => l.result === 'denied' || l.action === 'article.delete_attempt_blocked'
      );
      const totalPending = aiList.length + reviewList.length + newApps.length;
      setHasUnreadAlerts(hasSecurityAlert || totalPending > 0);

      // Auto-select the most relevant active tab if current is empty
      if (newApps.length > 0 && aiList.length === 0 && reviewList.length === 0) {
        setActiveTab('candidates');
      } else if (reviewList.length > 0 && aiList.length === 0) {
        setActiveTab('review');
      } else if (aiList.length > 0) {
        setActiveTab('ai_drafts');
      }
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

    if (item.action === 'career.application_submitted') {
      const applicantName = typeof item.details?.full_name === 'string' ? item.details.full_name : 'Candidate';
      const district = typeof item.details?.district === 'string' ? ` (${item.details.district})` : '';
      return {
        text: `New candidate dossier submitted: ${applicantName}${district}`,
        badge: '📋 Candidate',
        badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
      };
    }
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

  const totalPendingBadges = pendingArticles.length + pendingAiDrafts.length + pendingApplications.length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) loadNotifications();
        }}
        title="Newsroom Dispatch Center & Notifications"
        aria-label="Activity Notifications"
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 active:scale-95 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
      >
        <span className="text-sm">🔔</span>
        {hasUnreadAlerts && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-amber-500 text-[9px] font-black text-slate-950 shadow-sm animate-pulse">
            {totalPendingBadges > 0 ? totalPendingBadges : '!'}
          </span>
        )}
      </button>

      {/* Floating Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop on mobile */}
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-40 sm:hidden"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <div className="fixed inset-x-2 top-14 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[420px] rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/80 px-4 py-3 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0">🔔</span>
                <span className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wider truncate">
                  Newsroom Dispatch Center
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => loadNotifications()}
                  disabled={isLoading}
                  className="text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer px-1 py-0.5 rounded"
                  title="Refresh Alerts"
                >
                  {isLoading ? 'Refreshing...' : '↻ Refresh'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex sm:hidden items-center justify-center h-6 w-6 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800 text-xs font-bold transition"
                  aria-label="Close notification panel"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Segmented Tab Switcher with 4 Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar scrollbar-none border-b border-slate-100 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950/40 p-1.5 shrink-0">
              {/* Tab 1: AI Drafts */}
              <button
                type="button"
                onClick={() => setActiveTab('ai_drafts')}
                className={`flex-1 min-w-[65px] sm:min-w-0 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-bold whitespace-nowrap transition cursor-pointer ${
                  activeTab === 'ai_drafts'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
                }`}
              >
                <span>🤖 AI</span>
                {pendingAiDrafts.length > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-black ${
                      activeTab === 'ai_drafts'
                        ? 'bg-purple-800 text-purple-100'
                        : 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300'
                    }`}
                  >
                    {pendingAiDrafts.length}
                  </span>
                )}
              </button>

              {/* Tab 2: Review */}
              <button
                type="button"
                onClick={() => setActiveTab('review')}
                className={`flex-1 min-w-[75px] sm:min-w-0 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-bold whitespace-nowrap transition cursor-pointer ${
                  activeTab === 'review'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
                }`}
              >
                <span>⏳ Review</span>
                {pendingArticles.length > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-black ${
                      activeTab === 'review'
                        ? 'bg-amber-800 text-amber-100'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                    }`}
                  >
                    {pendingArticles.length}
                  </span>
                )}
              </button>

              {/* Tab 3: Candidates (Career Applications) */}
              <button
                type="button"
                onClick={() => setActiveTab('candidates')}
                className={`flex-1 min-w-[75px] sm:min-w-0 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-bold whitespace-nowrap transition cursor-pointer ${
                  activeTab === 'candidates'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
                }`}
              >
                <span>📋 Careers</span>
                {pendingApplications.length > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-black ${
                      activeTab === 'candidates'
                        ? 'bg-emerald-800 text-emerald-100'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                    }`}
                  >
                    {pendingApplications.length}
                  </span>
                )}
              </button>

              {/* Tab 4: Activity */}
              <button
                type="button"
                onClick={() => setActiveTab('activity')}
                className={`flex-1 min-w-[75px] sm:min-w-0 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-bold whitespace-nowrap transition cursor-pointer ${
                  activeTab === 'activity'
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
                }`}
              >
                <span>🛡️ Activity</span>
                {notifications.length > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-black ${
                      activeTab === 'activity'
                        ? 'bg-slate-800 text-slate-200'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-800/80 dark:text-slate-400'
                    }`}
                  >
                    {notifications.length}
                  </span>
                )}
              </button>
            </div>

          {/* Active Tab Feed Container */}
          <div className="flex-1 overflow-y-auto max-h-[380px] p-2 space-y-1.5 divide-y divide-slate-100 dark:divide-slate-800/60 pr-1">
            {/* TAB 1: AI DRAFTS */}
            {activeTab === 'ai_drafts' && (
              <>
                {pendingAiDrafts.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    <span className="text-2xl block mb-2">🎉</span>
                    No AI broadcast drafts waiting in the queue.
                  </div>
                ) : (
                  pendingAiDrafts.map((draft) => (
                    <Link
                      key={draft.id}
                      href="/newsroom/youtube"
                      onClick={() => setIsOpen(false)}
                      className="block p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40 hover:border-purple-400 dark:hover:border-purple-600 transition"
                    >
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
                        {draft.proposed_headline || 'Synthesized News Draft'}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-2">
                        <span className="font-bold text-purple-700 dark:text-purple-300 uppercase px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/60 border border-purple-200 dark:border-purple-800">
                          {draft.proposed_category || 'General'}
                        </span>
                        <span className="font-mono">{formatShortTime(draft.published_at)}</span>
                      </div>
                    </Link>
                  ))
                )}
              </>
            )}

            {/* TAB 2: IN REVIEW ARTICLES */}
            {activeTab === 'review' && (
              <>
                {pendingArticles.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    <span className="text-2xl block mb-2">✅</span>
                    All articles verified. Review desk is clear.
                  </div>
                ) : (
                  pendingArticles.map((art) => (
                    <Link
                      key={art.id}
                      href={`/articles/${art.id}`}
                      onClick={() => setIsOpen(false)}
                      className="block p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 hover:border-amber-400 dark:hover:border-amber-600 transition"
                    >
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
                        {art.title}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-2">
                        <span className="font-bold text-amber-700 dark:text-amber-300 uppercase px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 border border-amber-200 dark:border-amber-800">
                          {art.category} {art.district ? `• 📍 ${art.district}` : ''}
                        </span>
                        <span className="font-mono">{formatShortTime(art.updated_at)}</span>
                      </div>
                    </Link>
                  ))
                )}
              </>
            )}

            {/* TAB 3: CANDIDATES (CAREER APPLICATIONS) */}
            {activeTab === 'candidates' && (
              <>
                {pendingApplications.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    <span className="text-2xl block mb-2">📋</span>
                    No pending candidate applications. Review desk is clear.
                  </div>
                ) : (
                  pendingApplications.map((app) => (
                    <Link
                      key={app.id}
                      href="/careers"
                      onClick={() => setIsOpen(false)}
                      className="block p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 hover:border-emerald-400 dark:hover:border-emerald-500 transition"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {app.full_name}
                        </p>
                        <span className="font-mono text-[10px] text-slate-400">
                          {formatShortTime(app.applied_at)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 truncate">
                        {app.email} • {app.phone}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-2">
                        <span className="font-bold text-emerald-700 dark:text-emerald-300 uppercase px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800">
                          📍 {app.city || 'Jammu & Kashmir'}
                        </span>
                        <span className="font-semibold text-amber-500 dark:text-amber-300 text-[10px]">
                          {app.experience_years || 'Fresher'}
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </>
            )}

            {/* TAB 4: STAFF ACTIVITY LOGS */}
            {activeTab === 'activity' && (
              <>
                {isLoading && notifications.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">Loading activity feed...</div>
                ) : notifications.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">No recent staff actions recorded.</div>
                ) : (
                  notifications.map((item) => {
                    const summary = getActionSummary(item);
                    const role = item.actor?.role_key || 'employee';

                    return (
                      <Link
                        key={item.id}
                        href={item.action === 'career.application_submitted' ? '/careers' : '/audit'}
                        onClick={() => setIsOpen(false)}
                        className="block p-2.5 rounded-lg hover:bg-slate-50 transition-colors dark:hover:bg-slate-800/50"
                      >
                        <div className="flex items-center justify-between gap-2">
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
              </>
            )}
          </div>

          {/* Dynamic Footer */}
          <div className="border-t border-slate-100 bg-slate-50/70 p-2 text-center dark:border-slate-800 dark:bg-slate-950/60 shrink-0">
            {activeTab === 'ai_drafts' && (
              <Link
                href="/newsroom/youtube"
                onClick={() => setIsOpen(false)}
                className="block rounded-lg py-1.5 text-xs font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-950/60 transition"
              >
                Review All AI Drafts in YouTube Monitor ({pendingAiDrafts.length}) →
              </Link>
            )}
            {activeTab === 'review' && (
              <Link
                href="/articles?status=review"
                onClick={() => setIsOpen(false)}
                className="block rounded-lg py-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/60 transition"
              >
                Open Review Queue ({pendingArticles.length}) →
              </Link>
            )}
            {activeTab === 'candidates' && (
              <Link
                href="/careers"
                onClick={() => setIsOpen(false)}
                className="block rounded-lg py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 transition"
              >
                Review All Candidates in Careers Portal ({pendingApplications.length}) →
              </Link>
            )}
            {activeTab === 'activity' && (
              <Link
                href="/audit"
                onClick={() => setIsOpen(false)}
                className="block rounded-lg py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                View Complete Surveillance Audit Log →
              </Link>
            )}
          </div>
        </div>
        </>
      )}
    </div>
  );
}
