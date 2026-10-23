'use client';

import { FormEvent, useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { requiresMfa } from '@/lib/mfa';
import { CATEGORY_OPTIONS, DISTRICT_GROUPS } from '@/lib/taxonomy-options';

type Article = {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'review' | 'published' | 'archived';
  district: string | null;
  category: string;
  author_display_name: string;
  created_at: string;
  updated_at: string;
  author_id: string;
  archive_reason?: string | null;
  archived_at?: string | null;
};

type TopicMode = 'news' | 'civic' | 'all';

const PAGE_SIZE = 20;

const RETRACTION_REASON_PRESETS = [
  'Reported as fake / false news',
  'Unverified claims requiring ground investigation',
  'Factual inaccuracies requiring editorial correction',
  'Retracted following official bureau verification',
  'Civic issue resolved by local authorities',
  'Legal or policy compliance notice',
];

function ArticlesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCategory = searchParams?.get('category');
  const initialTopic: TopicMode =
    initialCategory === 'Local' ? 'civic' : (searchParams?.get('topic') as TopicMode) || 'news';
  
  // Auth & Permissions State
  const [permissions, setPermissions] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState('Loading workspace...');
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  // Data State
  const [articles, setArticles] = useState<Article[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // Topic Architecture & Filters State (Default is 'news'!)
  const [topicFilter, setTopicFilter] = useState<TopicMode>(initialTopic);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategory || 'all');
  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  // Modal States
  const [retractArticle, setRetractArticle] = useState<Article | null>(null);
  const [retractionPreset, setRetractionPreset] = useState(RETRACTION_REASON_PRESETS[0]);
  const [retractionNotes, setRetractionNotes] = useState('');
  const [deleteArticle, setDeleteArticle] = useState<Article | null>(null);
  const [confirmDeleteInput, setConfirmDeleteInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const can = (permission: string) => permissions.includes(permission);

  // Load Auth
  useEffect(() => {
    async function checkAuth() {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        setAuthStatus('Sign in required.');
        setIsAuthorized(false);
        return;
      }
      setUserId(data.session.user.id);

      const [roleResult, permResult] = await Promise.all([
        supabase.rpc('current_user_role'),
        supabase.rpc('current_user_permissions'),
      ]);

      if (roleResult.error || permResult.error) {
        setAuthStatus('Failed to load permissions.');
        setIsAuthorized(false);
        return;
      }
      
      const userRole = roleResult.data as string | null;
      if (!userRole) {
        setAuthStatus('No role found.');
        setIsAuthorized(false);
        return;
      }
      
      if (requiresMfa(userRole)) {
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalData?.currentLevel !== 'aal2') {
          router.push(aalData?.nextLevel === 'aal2' ? '/mfa/challenge' : '/mfa/enroll');
          return;
        }
      }

      setPermissions((permResult.data as string[] | null) ?? []);
      setIsAuthorized(true);
    }
    checkAuth();
  }, [router]);

  // Load Articles with topic segregation
  const loadArticles = async () => {
    if (isAuthorized !== true) return;
    setIsLoading(true);
    setError(null);
    
    let query = supabase.from('articles').select('*', { count: 'exact' });
    
    if (search) {
      query = query.or(`title.ilike.%${search}%,slug.ilike.%${search}%`);
    }
    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    // Apply Topic segregation
    if (topicFilter === 'news') {
      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      } else {
        query = query.neq('category', 'Local');
      }
    } else if (topicFilter === 'civic') {
      query = query.eq('category', 'Local');
    } else if (categoryFilter !== 'all') {
      query = query.eq('category', categoryFilter);
    }

    if (districtFilter !== 'all') {
      query = query.eq('district', districtFilter);
    }
    
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    
    query = query.order('updated_at', { ascending: false }).range(from, to);
    
    const { data, error, count } = await query;
    
    if (error) {
      setError(error.message);
    } else {
      setArticles(data as Article[]);
      if (count !== null) setTotalCount(count);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorized, search, statusFilter, topicFilter, categoryFilter, districtFilter, page]);

  // Handle Quick Reactivate
  const handleReactivate = async (article: Article) => {
    if (!confirm(`Reactivate "${article.title}"? It will immediately be live on the public website.`)) {
      return;
    }
    setIsSubmitting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(`/api/articles/${article.id}/reactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.session?.access_token}`,
        },
        body: JSON.stringify({ target_status: 'published' }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to reactivate article.');
      }
      setFeedback({ type: 'success', message: `Article "${article.title}" reactivated and published live.` });
      await loadArticles();
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Retract/Inactivate Confirm
  const handleRetractSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!retractArticle) return;
    setIsSubmitting(true);
    try {
      const combinedReason = retractionNotes.trim()
        ? `${retractionPreset}: ${retractionNotes.trim()}`
        : retractionPreset;

      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(`/api/articles/${retractArticle.id}/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.session?.access_token}`,
        },
        body: JSON.stringify({ reason: combinedReason }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to deactivate article.');
      }
      setFeedback({
        type: 'success',
        message: `Article "${retractArticle.title}" deactivated and pulled offline. Reason recorded: "${combinedReason}"`,
      });
      setRetractArticle(null);
      setRetractionNotes('');
      await loadArticles();
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Confirm
  const handleDeleteSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!deleteArticle) return;
    if (confirmDeleteInput.trim() !== 'DELETE') {
      alert('Please type DELETE in capital letters to confirm permanent deletion.');
      return;
    }
    setIsSubmitting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(`/api/articles/${deleteArticle.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.session?.access_token}`,
        },
        body: JSON.stringify({ reason: 'Permanently deleted by newsroom editorial action' }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete article.');
      }
      setFeedback({
        type: 'success',
        message: `Article "${deleteArticle.title}" and its revision history permanently deleted from database.`,
      });
      setDeleteArticle(null);
      setConfirmDeleteInput('');
      await loadArticles();
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthorized === false) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-white">
        <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-200">
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Access required</p>
          <h1 className="mt-4 text-2xl font-bold">{authStatus}</h1>
        </div>
      </main>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono uppercase tracking-widest text-cyan-400">Editorial Desk</span>
              <span className="text-slate-600">•</span>
              <span className="text-xs text-slate-400">Topic Architecture</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Articles &amp; Newsroom Desks</h1>
            <p className="mt-1 text-sm text-slate-400">Full editorial CRUD management with dedicated News, Civic Area Problems, and Investigative Desks</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void loadArticles()}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold hover:border-cyan-500"
            >
              Refresh
            </button>
            {can('article.create') ? (
              <Link href="/articles/new" className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 shadow-md shadow-cyan-950/40">
                + New story
              </Link>
            ) : null}
          </div>
        </header>

        {/* Primary Newsroom Topic Tabs */}
        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-2 shadow-xl backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setTopicFilter('news');
                setCategoryFilter('all');
                setPage(1);
              }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
                topicFilter === 'news'
                  ? 'bg-gradient-to-r from-cyan-500/25 via-sky-500/20 to-transparent text-white border border-cyan-400/50 shadow-md shadow-cyan-950/60'
                  : 'border border-transparent text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="text-base">📰</span>
              <span>News &amp; Reports</span>
              <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-mono ${
                topicFilter === 'news' ? 'bg-cyan-400 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
              }`}>
                Default Topic
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTopicFilter('civic');
                setCategoryFilter('Local');
                setPage(1);
              }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
                topicFilter === 'civic'
                  ? 'bg-gradient-to-r from-amber-500/25 via-orange-500/20 to-transparent text-amber-200 border border-amber-400/50 shadow-md shadow-amber-950/60'
                  : 'border border-transparent text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="text-base">🏛️</span>
              <span>Civic &amp; Area Problems</span>
              <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-mono ${
                topicFilter === 'civic' ? 'bg-amber-400 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
              }`}>
                Ground Issues
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTopicFilter('all');
                setCategoryFilter('all');
                setPage(1);
              }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
                topicFilter === 'all'
                  ? 'bg-gradient-to-r from-slate-700/50 to-slate-800/50 text-white border border-slate-600/70 shadow-md'
                  : 'border border-transparent text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="text-base">📂</span>
              <span>All Articles &amp; Desks</span>
              <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-mono ${
                topicFilter === 'all' ? 'bg-slate-200 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
              }`}>
                Archive ({totalCount})
              </span>
            </button>
          </div>
        </div>

        {/* Feedback Message */}
        {feedback && (
          <div
            role="status"
            className={`mb-6 flex items-center justify-between rounded-xl border p-4 shadow-lg ${
              feedback.type === 'success'
                ? 'border-emerald-500/50 bg-emerald-950/60 text-emerald-200'
                : 'border-red-500/50 bg-red-950/60 text-red-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                feedback.type === 'success' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
              }`}>
                {feedback.type === 'success' ? '✓' : '!'}
              </span>
              <p className="font-medium text-sm">{feedback.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="rounded px-2 py-1 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Quick Filter Presets */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mr-1">Quick Status:</span>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setPage(1);
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              statusFilter === 'all'
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
            }`}
          >
            All Statuses
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('published');
              setPage(1);
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition flex items-center gap-1.5 ${
              statusFilter === 'published'
                ? 'bg-emerald-400 text-slate-950 font-bold'
                : 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Live Published
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('review');
              setPage(1);
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition flex items-center gap-1.5 ${
              statusFilter === 'review'
                ? 'bg-amber-400 text-slate-950 font-bold'
                : 'border border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
            }`}
          >
            <span>⏳</span>
            In Review
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('archived');
              setPage(1);
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition flex items-center gap-1.5 ${
              statusFilter === 'archived'
                ? 'bg-red-500 text-white font-bold'
                : 'border border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20'
            }`}
          >
            <span>🚫</span>
            Inactive / Retracted
          </button>
        </div>

        {/* Detailed Search & Filters */}
        <section className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-xs font-medium uppercase text-slate-400">Search</label>
              <input 
                type="text" 
                placeholder="Title or slug keywords..." 
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase text-slate-400">Status</label>
              <select 
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="review">Review</option>
                <option value="published">Published (Active on site)</option>
                <option value="archived">Inactive / Retracted (Offline)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium uppercase text-slate-400">
                {topicFilter === 'news' ? 'News Beat / Category' : topicFilter === 'civic' ? 'Civic Category' : 'Category / Desk'}
              </label>
              <select 
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
              >
                {topicFilter === 'civic' ? (
                  <option value="Local">Local — Civic Issues &amp; Ground Reporting</option>
                ) : (
                  <>
                    <option value="all">
                      {topicFilter === 'news' ? 'All News Desks (General, Politics, Economy, etc.)' : 'All Categories'}
                    </option>
                    {CATEGORY_OPTIONS.filter((opt) => topicFilter !== 'news' || opt.value !== 'Local').map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium uppercase text-slate-400">District / Coverage Area</label>
              <select 
                value={districtFilter}
                onChange={(e) => { setDistrictFilter(e.target.value); setPage(1); }}
                className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="all">All Districts</option>
                {DISTRICT_GROUPS.map((group) => (
                  <optgroup key={group.region} label={group.region}>
                    {group.districts.map((dist) => (
                      <option key={dist.slug} value={dist.slug}>
                        {dist.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Table Area */}
        <section className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
          {error ? (
            <div className="m-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              Error loading articles: {error}
            </div>
          ) : null}

          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase text-slate-400 bg-slate-950/40">
                <th className="px-5 py-4 font-semibold">Article</th>
                <th className="px-5 py-4 font-semibold">Status / Public State</th>
                <th className="px-5 py-4 font-semibold">Author</th>
                <th className="px-5 py-4 font-semibold">Last updated</th>
                <th className="px-5 py-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {isLoading ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400">Loading articles...</td></tr>
              ) : articles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                    No articles found matching filters.
                    {categoryFilter === 'Local' ? (
                      <p className="mt-2 text-xs text-amber-300">
                        No articles under &quot;Local — Civic Issues &amp; Ground Reporting&quot; found. You can create one with the New Article button above.
                      </p>
                    ) : null}
                  </td>
                </tr>
              ) : (
                articles.map((article) => {
                  const tagClass =
                    article.status === 'review' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : article.status === 'published' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : article.status === 'archived' ? 'bg-red-500/15 text-red-300 border-red-500/40 font-semibold'
                    : 'bg-slate-800 text-slate-300 border-slate-700';

                  const isOwnDraft = article.author_id === userId && ['draft', 'review'].includes(article.status);
                  const canEdit =
                    can('article.review') ||
                    isOwnDraft ||
                    (article.status === 'draft' && can('article.create'));

                  const canDelete = can('article.delete') || can('article.archive');

                  return (
                    <tr key={article.id} className="align-top hover:bg-slate-800/20 transition-colors">
                      <td className="px-5 py-5">
                        <Link href={`/articles/${article.id}`} className="font-medium text-white hover:text-cyan-400">
                          {article.title}
                        </Link>
                        <p className="mt-1 text-xs text-slate-500 font-mono truncate max-w-sm">{article.slug}</p>
                        <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                          {article.category ? (
                            <span className="rounded bg-slate-800 px-2 py-0.5 font-medium text-slate-300">
                              {article.category}
                            </span>
                          ) : null}
                          {article.district ? (
                            <span className="capitalize text-slate-400">📍 {article.district}</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-5">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${tagClass}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            article.status === 'published' ? 'bg-emerald-400' :
                            article.status === 'archived' ? 'bg-red-400' :
                            article.status === 'review' ? 'bg-amber-400' : 'bg-slate-400'
                          }`} />
                          {article.status === 'archived' ? 'Inactive / Retracted' :
                           article.status === 'published' ? 'Live Published' :
                           article.status === 'review' ? 'In Review' : 'Draft'}
                        </span>
                        {article.status === 'archived' && article.archive_reason ? (
                          <p className="mt-1.5 max-w-xs text-[11px] text-red-300/80 italic line-clamp-2" title={article.archive_reason}>
                            Reason: {article.archive_reason}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-5 py-5 text-slate-300">{article.author_display_name}</td>
                      <td className="whitespace-nowrap px-5 py-5 text-slate-400">
                        {new Date(article.updated_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link 
                            href={`/articles/${article.id}`} 
                            className="rounded-md border border-slate-700 px-2.5 py-1 text-xs font-semibold hover:border-slate-500 hover:text-white transition"
                          >
                            View
                          </Link>

                          {/* Edit Action (Available across all states for reviewers/authors) */}
                          {canEdit ? (
                            <Link 
                              href={`/articles/${article.id}/edit`} 
                              className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20 transition"
                            >
                              Edit
                            </Link>
                          ) : null}

                          {/* Inactive / Retract Action (for Published articles) */}
                          {article.status === 'published' && can('article.archive') ? (
                            <button
                              type="button"
                              onClick={() => {
                                setRetractArticle(article);
                                setRetractionPreset(RETRACTION_REASON_PRESETS[0]);
                                setRetractionNotes('');
                              }}
                              className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 transition flex items-center gap-1"
                              title="Immediately pull this article offline from the website"
                            >
                              <span>🚫</span> Inactivate
                            </button>
                          ) : null}

                          {/* Reactivate / Restore Action (for Inactive/Archived articles) */}
                          {article.status === 'archived' && (can('article.publish') || can('article.review')) ? (
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={() => handleReactivate(article)}
                              className="rounded-md bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition flex items-center gap-1 shadow-sm"
                              title="Reactivate this article and publish it live on the site"
                            >
                              <span>✨</span> Reactivate
                            </button>
                          ) : null}

                          {/* Review Action (for articles in review) */}
                          {article.status === 'review' && can('article.review') ? (
                            <Link 
                              href={`/articles/${article.id}/review`} 
                              className="rounded-md bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 transition"
                            >
                              Review
                            </Link>
                          ) : null}

                          {/* Permanent Delete Action */}
                          {canDelete ? (
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteArticle(article);
                                setConfirmDeleteInput('');
                              }}
                              className="rounded-md border border-red-500/40 bg-red-950/30 px-2.5 py-1 text-xs font-semibold text-red-300 hover:bg-red-900/50 hover:text-white transition flex items-center gap-1"
                              title="Permanently purge article from database"
                            >
                              <span>🗑️</span> Delete
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          
          {/* Pagination */}
          {!isLoading && totalCount > 0 ? (
            <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/40 px-5 py-4">
              <p className="text-sm text-slate-400">
                Showing <span className="font-medium text-slate-200">{(page - 1) * PAGE_SIZE + 1}</span> to <span className="font-medium text-slate-200">{Math.min(page * PAGE_SIZE, totalCount)}</span> of <span className="font-medium text-slate-200">{totalCount}</span>
              </p>
              <div className="flex gap-2">
                <button 
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:border-slate-500 hover:text-white disabled:opacity-50 disabled:hover:border-slate-700 disabled:hover:text-slate-400 transition"
                >
                  Previous
                </button>
                <button 
                  disabled={page * PAGE_SIZE >= totalCount}
                  onClick={() => setPage(p => p + 1)}
                  className="rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:border-slate-500 hover:text-white disabled:opacity-50 disabled:hover:border-slate-700 disabled:hover:text-slate-400 transition"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </section>

        {/* Retraction / Inactivate Modal */}
        {retractArticle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
            <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <span className="text-amber-400">🚫</span> Deactivate Article
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Immediately pulls <strong className="text-white">{retractArticle.title}</strong> offline from the public website.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRetractArticle(null)}
                  disabled={isSubmitting}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleRetractSubmit} className="mt-5 space-y-4">
                <label className="block text-sm text-slate-300">
                  Select Reason for Inactivation / Retraction:
                  <select
                    value={retractionPreset}
                    onChange={(e) => setRetractionPreset(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
                  >
                    {RETRACTION_REASON_PRESETS.map((preset) => (
                      <option key={preset} value={preset}>{preset}</option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm text-slate-300">
                  Additional Editorial Notes <span className="text-xs text-slate-500">(Optional explanation for audit records)</span>
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={retractionNotes}
                    onChange={(e) => setRetractionNotes(e.target.value)}
                    placeholder="Details about disputed claims, fake report findings, or facts being re-investigated..."
                    className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                  />
                </label>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setRetractArticle(null)}
                    disabled={isSubmitting}
                    className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Pulling offline...' : 'Confirm & Deactivate'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Permanent Delete Modal */}
        {deleteArticle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
            <div className="w-full max-w-lg rounded-2xl border border-red-500/50 bg-slate-900 p-6 shadow-2xl">
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <span className="text-red-400">🗑️</span> Permanent Article Deletion
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Purging <strong className="text-white">{deleteArticle.title}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteArticle(null)}
                  disabled={isSubmitting}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleDeleteSubmit} className="mt-5 space-y-4">
                <div className="rounded-xl border border-red-500/50 bg-red-950/40 p-4 text-xs text-red-200 space-y-2">
                  <p className="font-bold text-red-300 uppercase tracking-wide">⚠️ IRREVERSIBLE DATABASE ACTION</p>
                  <p>
                    This will permanently delete this article, all associated versions, and translations from the database. This action CANNOT be undone.
                  </p>
                  <p className="text-slate-300">
                    If this article was fake or inaccurate, you can also use <strong>Inactivate</strong> instead of deleting if you want to keep an audit trail of the retraction.
                  </p>
                </div>

                <label className="block text-sm text-slate-300">
                  To confirm deletion, please type <span className="font-mono text-red-400 font-bold">DELETE</span> below:
                  <input
                    type="text"
                    required
                    value={confirmDeleteInput}
                    onChange={(e) => setConfirmDeleteInput(e.target.value)}
                    placeholder="DELETE"
                    className="mt-1.5 w-full rounded-lg border border-red-500/50 bg-slate-950 px-3 py-2 text-sm text-white font-mono placeholder-slate-600 focus:border-red-400 focus:outline-none"
                  />
                </label>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeleteArticle(null)}
                    disabled={isSubmitting}
                    className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || confirmDeleteInput.trim() !== 'DELETE'}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-red-900/40"
                  >
                    {isSubmitting ? 'Deleting...' : 'Permanently Delete from DB'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ArticlesPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-white">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
            <span className="font-mono text-sm text-slate-400">Loading newsroom editorial desks...</span>
          </div>
        </main>
      }
    >
      <ArticlesPageContent />
    </Suspense>
  );
}
