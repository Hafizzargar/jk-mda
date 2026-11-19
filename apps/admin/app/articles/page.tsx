'use client';

import { FormEvent, useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { requiresMfa } from '@/lib/mfa';
import {
  CATEGORY_OPTIONS,
  DISTRICT_GROUPS,
  fetchDynamicCategories,
  formatCategoryOptions,
  type DynamicCategoryItem,
} from '@/lib/taxonomy-options';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Button } from '@/components/Button';
import { toast } from '@/components/Toast';
import { DataTable, Column } from '@/components/DataTable';
import { getCorrespondentForArticle } from '@/lib/correspondents';

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
  featured_image_url?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  published_at?: string | null;
};

type TopicMode = 'news' | 'civic' | 'all';

const DEFAULT_PAGE_SIZE = 5;

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
  const initialStatus = searchParams?.get('status') || 'all';
  const initialTopic: TopicMode =
    initialCategory === 'Local' ? 'civic' : (searchParams?.get('topic') as TopicMode) || 'news';
  
  // Auth & Permissions State
  const [permissions, setPermissions] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState('Loading workspace...');
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  // Data State
  const [articles, setArticles] = useState<Article[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // Topic Architecture & Filters State (Default is 'news'!)
  const [categories, setCategories] = useState<DynamicCategoryItem[]>(() => formatCategoryOptions([]));
  const [topicFilter, setTopicFilter] = useState<TopicMode>(initialTopic);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategory || 'all');
  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  // Status Counts for Clean Header UI
  const [statusCounts, setStatusCounts] = useState({
    published: 0,
    review: 0,
    draft: 0,
    archived: 0,
    all: 0,
    noSource: 0,
  });

  const loadStatusCounts = async () => {
    try {
      const { data } = await supabase
        .from('articles')
        .select('id, status, source_name, source_url');
      if (data) {
        const pub = data.filter((a) => a.status === 'published');
        setStatusCounts({
          published: pub.length,
          review: data.filter((a) => a.status === 'review').length,
          draft: data.filter((a) => a.status === 'draft').length,
          archived: data.filter((a) => a.status === 'archived').length,
          all: data.length,
          noSource: pub.filter((a) => !a.source_url && (!a.source_name || !a.source_name.trim())).length,
        });
      }
    } catch (err) {
      console.warn('Failed to load status counts:', err);
    }
  };

  // Sync state if URL query params change (e.g. clicking sidebar links)
  useEffect(() => {
    let s = searchParams?.get('status') || 'all';
    if (['editor', 'author'].includes(userRole || '') && s === 'review') {
      s = 'published';
    }
    setStatusFilter(s);
    const cat = searchParams?.get('category') || 'all';
    setCategoryFilter(cat);
    if (cat === 'Local') {
      setTopicFilter('civic');
    }
    setPage(1);
  }, [searchParams, userRole]);

  // Modal States
  const [retractArticle, setRetractArticle] = useState<Article | null>(null);
  const [retractionPreset, setRetractionPreset] = useState(RETRACTION_REASON_PRESETS[0]);
  const [retractionNotes, setRetractionNotes] = useState('');
  const [deleteArticle, setDeleteArticle] = useState<Article | null>(null);
  const [confirmDeleteInput, setConfirmDeleteInput] = useState('');
  const [reactivateArticleTarget, setReactivateArticleTarget] = useState<Article | null>(null);
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
      setUserRole(userRole);
      
      if (requiresMfa(userRole)) {
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalData?.currentLevel !== 'aal2') {
          router.push(aalData?.nextLevel === 'aal2' ? '/mfa/challenge' : '/mfa/enroll');
          return;
        }
      }

      setPermissions((permResult.data as string[] | null) ?? []);
      setIsAuthorized(true);

      // Load dynamic categories for filtering
      try {
        const dynamicCats = await fetchDynamicCategories(supabase, true);
        if (dynamicCats && dynamicCats.length > 0) {
          setCategories(dynamicCats);
        }
      } catch (catErr) {
        console.warn('Failed to load categories for filtering:', catErr);
      }
    }
    checkAuth();
  }, [router]);

  // Load Articles with topic segregation
  const loadArticles = async () => {
    if (isAuthorized !== true) return;
    setIsLoading(true);
    setError(null);
    
    let query = supabase.from('articles').select('*', { count: 'exact' });
    
    if (search && search.trim()) {
      const s = search.trim().replace(/,/g, '');
      query = query.or(`title.ilike.%${s}%,slug.ilike.%${s}%,district.ilike.%${s}%,author_display_name.ilike.%${s}%`);
    }
    if (statusFilter !== 'all') {
      if (['editor', 'author'].includes(userRole || '') && statusFilter === 'review') {
        query = query.eq('status', 'published');
      } else {
        query = query.eq('status', statusFilter);
      }
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
    
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    
    // Order strictly by latest publication time near current time first, then descending
    if (statusFilter === 'published' || statusFilter === 'all') {
      query = query
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range(from, to);
    } else {
      query = query
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to);
    }
    
    const { data, error, count } = await query;
    
    if (error) {
      setError(error.message);
    } else {
      setArticles(data as Article[]);
      if (count !== null) setTotalCount(count);
    }
    setIsLoading(false);
    void loadStatusCounts();
  };

  useEffect(() => {
    loadArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorized, search, statusFilter, topicFilter, categoryFilter, districtFilter, page, pageSize]);

  // Handle Quick Reactivate
  const handleReactivate = (article: Article) => {
    setReactivateArticleTarget(article);
  };

  const executeReactivate = async () => {
    if (!reactivateArticleTarget) return;
    const article = reactivateArticleTarget;
    setIsSubmitting(true);
    const toastId = toast.loading('Reactivating article live...');
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
      const successMsg = `Article "${article.title}" reactivated and published live! ✨`;
      setFeedback({ type: 'success', message: successMsg });
      toast.success(successMsg, { id: toastId, title: 'Article Reactivated' });
      setReactivateArticleTarget(null);
      await loadArticles();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setFeedback({ type: 'error', message: errorMsg });
      toast.error(errorMsg, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Retract/Inactivate Confirm
  const handleRetractSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!retractArticle) return;
    setIsSubmitting(true);
    const toastId = toast.loading('Deactivating and pulling article offline...');
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
      const successMsg = `Article "${retractArticle.title}" deactivated and pulled offline.`;
      setFeedback({
        type: 'success',
        message: `${successMsg} Reason recorded: "${combinedReason}"`,
      });
      toast.success(successMsg, { id: toastId, title: 'Article Deactivated' });
      setRetractArticle(null);
      setRetractionNotes('');
      await loadArticles();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setFeedback({ type: 'error', message: errorMsg });
      toast.error(errorMsg, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Confirm
  const handleDeleteSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!deleteArticle) return;
    if (confirmDeleteInput.trim() !== 'DELETE') {
      const msg = 'Please type DELETE in capital letters to confirm permanent deletion.';
      setFeedback({ type: 'error', message: msg });
      toast.warning(msg);
      return;
    }
    setIsSubmitting(true);
    const toastId = toast.loading('Permanently purging article from database...');
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
      const successMsg = `Article "${deleteArticle.title}" and revision history permanently deleted.`;
      setFeedback({
        type: 'success',
        message: successMsg,
      });
      toast.success(successMsg, { id: toastId, title: 'Article Deleted' });
      setDeleteArticle(null);
      setConfirmDeleteInput('');
      await loadArticles();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setFeedback({ type: 'error', message: errorMsg });
      toast.error(errorMsg, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Selection State
  const [selectedArticleIds, setSelectedArticleIds] = useState<string[]>([]);

  const toggleSelectArticle = (id: string) => {
    setSelectedArticleIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedArticleIds.length === articles.length && articles.length > 0) {
      setSelectedArticleIds([]);
    } else {
      setSelectedArticleIds(articles.map((a) => a.id));
    }
  };

  function formatRelativeTime(dateString?: string | null): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} h ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays} d ago`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths} mo ago`;
    return `${Math.floor(diffMonths / 12)} y ago`;
  }

  function isAiAssisted(article: Article): boolean {
    if (article.category === 'International') return true;
    const author = article.author_display_name || '';
    const src = article.source_name || '';
    if (
      src.includes('PIB') ||
      src.includes('AIR') ||
      src.includes('DD') ||
      src.includes('AI') ||
      src.includes('Wire') ||
      src.includes('Surveillance') ||
      src.includes('Radar') ||
      src.includes('Greater Kashmir') ||
      src.includes('Hindu')
    ) {
      return true;
    }
    if (
      author.includes('National Bureau') ||
      author.includes('AI') ||
      author.includes('Desk') ||
      author.includes('Wire') ||
      author.includes('Surveillance')
    ) {
      return true;
    }
    return false;
  }

  function hasNoSource(article: Article): boolean {
    return !article.source_url && (!article.source_name || article.source_name.trim().length === 0);
  }

  const columns: Column<Article>[] = [
    {
      key: 'article',
      header: (
        <div className="flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={articles.length > 0 && selectedArticleIds.length === articles.length}
            onChange={toggleSelectAll}
            aria-label="Select all articles"
            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
          />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
            {totalCount} article{totalCount === 1 ? '' : 's'}
          </span>
        </div>
      ),
      render: (article) => {
        const isSelected = selectedArticleIds.includes(article.id);
        const ai = isAiAssisted(article);
        const noSource = hasNoSource(article);

        return (
          <div className="flex items-start gap-3.5">
            {/* Selection Checkbox */}
            <div className="pt-0.5">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSelectArticle(article.id)}
                aria-label={`Select article ${article.title}`}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
            </div>

            {/* Thumbnail Box */}
            <div className="w-16 h-12 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-center shrink-0 overflow-hidden text-slate-400">
              {article.featured_image_url ? (
                <img
                  src={article.featured_image_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium select-none">
                  No image
                </span>
              )}
            </div>

            {/* Title, Slug & Badges */}
            <div className="min-w-0 flex-1">
              <Link
                href={`/articles/${article.id}`}
                className="font-serif font-bold text-slate-900 hover:text-cyan-700 text-sm sm:text-base leading-snug dark:text-white dark:hover:text-cyan-300 transition-colors block"
              >
                {article.title}
              </Link>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono">
                /{article.slug.replace(/^\//, '')}
              </p>

              {/* Badges row */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {article.category && (
                  <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                    {article.category}
                  </span>
                )}
                {article.district && (
                  <span className="text-xs text-slate-600 dark:text-slate-300 font-medium capitalize">
                    {article.district}
                  </span>
                )}
                {noSource && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300">
                    <span>⚠️</span> No source
                  </span>
                )}
                {ai && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300">
                    <span>🤖</span> AI-assisted
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'author_bureau',
      header: '',
      width: '180px',
      render: (article) => {
        const author = article.author_display_name;
        const isGenericOrOwnerAuthor =
          !author ||
          typeof author !== 'string' ||
          author === 'Hafeez Zargar' ||
          author.startsWith('KJIN') ||
          author.includes('Bureau') ||
          author.includes('Team');
        const displayAuthor = isGenericOrOwnerAuthor
          ? getCorrespondentForArticle(article)
          : author;

        return (
          <div>
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
              {displayAuthor}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 whitespace-nowrap">
              {formatRelativeTime(article.published_at || article.updated_at || article.created_at)}
            </div>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: '',
      width: '100px',
      render: (article) => {
        const isLive = article.status === 'published';
        const isReview = article.status === 'review';
        const isArchived = article.status === 'archived';

        if (isLive) {
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Live
            </span>
          );
        }
        if (isReview) {
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300 whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              In Review
            </span>
          );
        }
        if (isArchived) {
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:text-red-300 whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              Inactive
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Draft
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      width: '160px',
      align: 'right',
      render: (article) => {
        const isRestrictedStaff = !!userRole && ['editor', 'author'].includes(userRole);
        const isOwnDraft =
          article.author_id === userId && ['draft', 'review'].includes(article.status);
        const canEdit =
          can('article.review') ||
          isOwnDraft ||
          isRestrictedStaff ||
          (article.status === 'draft' && can('article.create'));
        const isDeletePrivileged = !!userRole && ['owner', 'superadmin', 'admin'].includes(userRole);
        const canDelete = isDeletePrivileged && can('article.delete');

        return (
          <div className="flex items-center justify-end gap-1.5">
            {/* View */}
            <Link
              href={`/articles/${article.id}`}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition"
              title="View Article"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </Link>

            {/* Edit */}
            {canEdit && (
              <Link
                href={`/articles/${article.id}/edit`}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition"
                title="Edit Article"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </Link>
            )}

            {/* Inactivate / Reactivate */}
            {article.status === 'published' && can('article.archive') && !isRestrictedStaff ? (
              <button
                type="button"
                onClick={() => {
                  setRetractArticle(article);
                  setRetractionPreset(RETRACTION_REASON_PRESETS[0]);
                  setRetractionNotes('');
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition"
                title="Deactivate / Pull Offline"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                  <line x1="12" y1="2" x2="12" y2="12" />
                </svg>
              </button>
            ) : article.status === 'archived' && !isRestrictedStaff && (can('article.publish') || can('article.review')) ? (
              <button
                type="button"
                onClick={() => handleReactivate(article)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-emerald-600 shadow-2xs hover:bg-emerald-50 hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 transition"
                title="Reactivate Live"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                  <line x1="12" y1="2" x2="12" y2="12" />
                </svg>
              </button>
            ) : null}

            {/* Delete */}
            {canDelete && (
              <button
                type="button"
                onClick={() => {
                  setDeleteArticle(article);
                  setConfirmDeleteInput('');
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition"
                title="Permanently Delete"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        );
      },
    },
  ];

  const renderMobileArticleCard = (article: Article) => {
    const isRestrictedStaff = !!userRole && ['editor', 'author'].includes(userRole);
    const isOwnDraft =
      article.author_id === userId && ['draft', 'review'].includes(article.status);
    const canEdit =
      can('article.review') ||
      isOwnDraft ||
      isRestrictedStaff ||
      (article.status === 'draft' && can('article.create'));
    const isDeletePrivileged = !!userRole && ['owner', 'superadmin', 'admin'].includes(userRole);
    const canDelete = isDeletePrivileged && can('article.delete');

    const tagClass =
      article.status === 'review'
        ? 'bg-amber-50 text-amber-950 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-700'
        : article.status === 'published'
        ? 'bg-emerald-50 text-emerald-950 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-700'
        : article.status === 'archived'
        ? 'bg-red-50 text-red-950 border-red-300 font-bold dark:bg-red-950/40 dark:text-red-200 dark:border-red-700'
        : 'bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700';

    const dotClass =
      article.status === 'published'
        ? 'bg-emerald-500'
        : article.status === 'archived'
        ? 'bg-red-500'
        : article.status === 'review'
        ? 'bg-amber-500'
        : 'bg-slate-500';

    const statusLabel =
      article.status === 'archived'
        ? 'Inactive'
        : article.status === 'published'
        ? 'Live'
        : article.status === 'review'
        ? 'In Review'
        : 'Draft';

    const author = article.author_display_name;
    const isGenericOrOwnerAuthor =
      !author ||
      typeof author !== 'string' ||
      author === 'Hafeez Zargar' ||
      author === 'Hafiz Zargar' ||
      author.startsWith('KJIN') ||
      author.includes('Bureau') ||
      author.includes('Team');
    const displayAuthor = isGenericOrOwnerAuthor
      ? getCorrespondentForArticle(article)
      : author;
    const ai = isAiAssisted(article);
    const noSource = hasNoSource(article);

    return (
      <div className={`space-y-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 ${
        article.status === 'published'
          ? 'border-l-4 border-l-emerald-500'
          : article.status === 'review'
          ? 'border-l-4 border-l-amber-500'
          : article.status === 'archived'
          ? 'border-l-4 border-l-rose-500'
          : 'border-l-4 border-l-slate-300 dark:border-l-slate-700'
      }`}>
        {/* Top: Status & Relative Time */}
        <div className="flex items-center justify-between gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${tagClass}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
            {statusLabel}
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            {formatRelativeTime(article.published_at || article.updated_at || article.created_at)}
          </span>
        </div>

        {/* Middle: Thumbnail + Title + Badges */}
        <div className="flex items-start gap-3">
          <div className="w-14 h-11 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-center shrink-0 overflow-hidden text-slate-400">
            {article.featured_image_url ? (
              <img src={article.featured_image_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] text-slate-400 font-medium">No image</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <Link
              href={`/articles/${article.id}`}
              className="font-serif font-bold text-sm text-slate-950 dark:text-white line-clamp-2 leading-snug hover:text-cyan-700 dark:hover:text-cyan-400 transition-colors"
            >
              {article.title}
            </Link>
            <p className="mt-0.5 text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate">
              /{article.slug.replace(/^\//, '')}
            </p>
          </div>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {article.category && (
            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              {article.category}
            </span>
          )}
          {article.district && (
            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium capitalize">
              {article.district}
            </span>
          )}
          {noSource && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300">
              <span>⚠️</span> No source
            </span>
          )}
          {ai && (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300">
              <span>🤖</span> AI-assisted
            </span>
          )}
        </div>

        {/* Bottom: Author & Icon Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[170px]">
            {displayAuthor}
          </span>

          <div className="flex items-center gap-1.5">
            <Link
              href={`/articles/${article.id}`}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-2xs hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 transition"
              title="View Article"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </Link>

            {canEdit && (
              <Link
                href={`/articles/${article.id}/edit`}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-2xs hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 transition"
                title="Edit Article"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </Link>
            )}

            {article.status === 'published' && can('article.archive') && !isRestrictedStaff ? (
              <button
                type="button"
                onClick={() => {
                  setRetractArticle(article);
                  setRetractionPreset(RETRACTION_REASON_PRESETS[0]);
                  setRetractionNotes('');
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-2xs hover:bg-amber-50 hover:text-amber-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 transition"
                title="Deactivate / Pull Offline"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                  <line x1="12" y1="2" x2="12" y2="12" />
                </svg>
              </button>
            ) : null}

            {canDelete && (
              <button
                type="button"
                onClick={() => {
                  setDeleteArticle(article);
                  setConfirmDeleteInput('');
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-2xs hover:bg-rose-50 hover:text-rose-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 transition"
                title="Permanently Delete"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    );
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
    <div className="p-3 sm:p-6 md:p-8 pb-24 lg:pb-8">
      <div className="mx-auto max-w-7xl">
        {/* Clean Header & New Article CTA */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="font-serif font-black text-2xl sm:text-3xl tracking-tight text-slate-900 dark:text-white">
              Articles
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-sans">
              {statusCounts.published} live, {statusCounts.review} waiting for an editor
              {statusCounts.noSource > 0 ? `, ${statusCounts.noSource} live without a source` : ''}
            </p>
          </div>

          {can('article.create') ? (
            <Link
              href="/articles/new"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-slate-950 px-4 py-2 text-xs sm:text-sm font-bold shadow-2xs transition-colors shrink-0"
            >
              <span className="text-base leading-none font-bold">+</span>
              <span>New article</span>
            </Link>
          ) : null}
        </div>

        {/* Horizontal Status Tabs with Cyan Active Indicator Line */}
        <div className="flex items-center gap-6 sm:gap-8 border-b border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar mb-4 text-xs sm:text-sm">
          {[
            { id: 'published', label: 'Live', count: statusCounts.published },
            ...(!['editor', 'author'].includes(userRole || '')
              ? [{ id: 'review', label: 'Needs review', count: statusCounts.review }]
              : []),
            { id: 'draft', label: 'Drafts', count: statusCounts.draft },
            ...(!['editor', 'author'].includes(userRole || '')
              ? [{ id: 'archived', label: 'Inactive', count: statusCounts.archived }]
              : []),
            { id: 'all', label: 'All', count: statusCounts.all },
          ].map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.id);
                  setPage(1);
                }}
                className={`shrink-0 whitespace-nowrap pb-3 -mb-px flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isActive
                    ? 'border-b-2 border-cyan-500 text-slate-900 dark:text-white font-bold'
                    : 'border-b-2 border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={
                    isActive
                      ? 'font-bold text-slate-900 dark:text-white'
                      : 'text-slate-400 dark:text-slate-500'
                  }
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Clean Single-Row Search & Category Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 dark:text-slate-500">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search title, district or author"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 shadow-2xs"
            />
          </div>

          <div className="w-full sm:w-56 shrink-0">
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 shadow-2xs cursor-pointer"
            >
              <option value="all">All categories</option>
              {categories.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Feedback Message */}
        {feedback && (
          <div
            role="status"
            className={`mb-4 flex items-center justify-between rounded-xl border p-3.5 shadow-2xs ${
              feedback.type === 'success'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200'
                : 'border-red-300 bg-red-50 text-red-950 dark:border-red-700 dark:bg-red-950/60 dark:text-red-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  feedback.type === 'success'
                    ? 'bg-emerald-200 text-emerald-900'
                    : 'bg-red-200 text-red-900'
                }`}
              >
                {feedback.type === 'success' ? '✓' : '!'}
              </span>
              <p className="font-semibold text-xs">{feedback.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs font-bold uppercase text-slate-500 hover:text-slate-800"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Error notification if query fails */}
        {error ? (
          <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3.5 text-xs font-bold text-red-900">
            Error: {error}
          </div>
        ) : null}

        {/* Selected Articles Toolbar */}
        {selectedArticleIds.length > 0 && (
          <div className="mb-3 flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2 text-xs font-semibold text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200">
            <div className="flex items-center gap-2">
              <span>✓ {selectedArticleIds.length} article{selectedArticleIds.length > 1 ? 's' : ''} selected</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedArticleIds([])}
                className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white underline text-xs"
              >
                Clear selection
              </button>
            </div>
          </div>
        )}

        {/* Reusable Data Table with Native Mobile Card View */}
        <DataTable<Article>
          columns={columns}
          data={articles}
          keyExtractor={(a) => a.id}
          isLoading={isLoading}
          rowClassName={(article) =>
            article.status === 'published'
              ? 'border-l-4 border-l-emerald-500'
              : article.status === 'review'
              ? 'border-l-4 border-l-amber-500'
              : article.status === 'archived'
              ? 'border-l-4 border-l-rose-500'
              : 'border-l-4 border-l-slate-300 dark:border-l-slate-700'
          }
          emptyMessage={
            <div>
              <p>No articles found matching filters.</p>
              {categoryFilter === 'Local' ? (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-300 font-bold">
                  No articles under &quot;Local — Civic Issues &amp; Ground Reporting&quot; found. You can create one with the New Article button above.
                </p>
              ) : null}
            </div>
          }
          pagination={{
            page,
            pageSize,
            totalCount,
            pageSizeOptions: [5, 10, 15, 20],
            onPageChange: (p) => setPage(p),
            onPageSizeChange: (s) => {
              setPageSize(s);
              setPage(1);
            },
          }}
          mobileCardRender={renderMobileArticleCard}
        />


        {/* Retraction / Inactivate Modal */}
        {retractArticle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-in fade-in duration-150" role="dialog" aria-modal="true">
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="text-amber-500">🚫</span> Deactivate Article
                  </h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Immediately pulls <strong className="text-slate-900 dark:text-white">{retractArticle.title}</strong> offline from the public website.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRetractArticle(null)}
                  disabled={isSubmitting}
                  className="rounded-[8px] p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleRetractSubmit} className="mt-5 space-y-4">
                <label className="block text-sm text-slate-700 dark:text-slate-300">
                  Select Reason for Inactivation / Retraction:
                  <select
                    value={retractionPreset}
                    onChange={(e) => setRetractionPreset(e.target.value)}
                    className="mt-1.5 w-full rounded-[8px] border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    {RETRACTION_REASON_PRESETS.map((preset) => (
                      <option key={preset} value={preset}>{preset}</option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm text-slate-700 dark:text-slate-300">
                  Additional Editorial Notes <span className="text-xs text-slate-500">(Optional explanation for audit records)</span>
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={retractionNotes}
                    onChange={(e) => setRetractionNotes(e.target.value)}
                    placeholder="Details about disputed claims, fake report findings, or facts being re-investigated..."
                    className="mt-1.5 w-full rounded-[8px] border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder-slate-500"
                  />
                </label>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setRetractArticle(null)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="amber"
                    size="md"
                    isLoading={isSubmitting}
                  >
                    Confirm &amp; Deactivate
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Permanent Delete Modal */}
        {deleteArticle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-in fade-in duration-150" role="dialog" aria-modal="true">
            <div className="w-full max-w-lg rounded-2xl border border-rose-300 bg-white p-6 shadow-2xl dark:border-rose-500/50 dark:bg-slate-900">
              <div className="flex items-start justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="text-rose-500">🗑️</span> Permanent Article Deletion
                  </h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Purging <strong className="text-slate-900 dark:text-white">{deleteArticle.title}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteArticle(null)}
                  disabled={isSubmitting}
                  className="rounded-[8px] p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleDeleteSubmit} className="mt-5 space-y-4">
                <div className="rounded-[8px] border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900 space-y-2 dark:border-rose-500/50 dark:bg-red-950/40 dark:text-red-200">
                  <p className="font-bold text-rose-800 dark:text-red-300 uppercase tracking-wide">⚠️ IRREVERSIBLE DATABASE ACTION</p>
                  <p>
                    This will permanently delete this article, all associated versions, and translations from the database. This action CANNOT be undone.
                  </p>
                  <p className="text-slate-600 dark:text-slate-300">
                    If this article was fake or inaccurate, you can also use <strong>Inactivate</strong> instead of deleting if you want to keep an audit trail of the retraction.
                  </p>
                </div>

                <label className="block text-sm text-slate-700 dark:text-slate-300">
                  To confirm deletion, please type <span className="font-mono text-rose-600 dark:text-rose-400 font-bold">DELETE</span> below:
                  <input
                    type="text"
                    required
                    value={confirmDeleteInput}
                    onChange={(e) => setConfirmDeleteInput(e.target.value)}
                    placeholder="DELETE"
                    className="mt-1.5 w-full rounded-[8px] border border-rose-300 bg-white px-3 py-2 text-sm text-slate-900 font-mono placeholder-slate-400 focus:border-rose-500 focus:outline-none dark:border-rose-500/50 dark:bg-slate-950 dark:text-white dark:placeholder-slate-600"
                  />
                </label>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setDeleteArticle(null)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="danger"
                    size="md"
                    disabled={isSubmitting || confirmDeleteInput.trim() !== 'DELETE'}
                    isLoading={isSubmitting}
                  >
                    Permanently Delete from DB
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmModal
          isOpen={Boolean(reactivateArticleTarget)}
          onClose={() => setReactivateArticleTarget(null)}
          onConfirm={executeReactivate}
          title="Reactivate Article"
          description={`Reactivate "${reactivateArticleTarget?.title}"? It will immediately be restored and published live on the public website.`}
          confirmText="Reactivate Article"
          variant="emerald"
          icon="✨"
          isLoading={isSubmitting}
        />
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
