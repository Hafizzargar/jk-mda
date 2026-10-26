'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { sanitizeArticleHtml, markdownToHtml } from '@/lib/sanitize';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Button } from '@/components/Button';
import { toast } from '@/components/Toast';

type Article = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  status: string;
  category: string;
  district: string | null;
  source_name: string | null;
  source_url: string | null;
  featured_image_url: string | null;
  author_display_name: string | null;
  author_id?: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
  archive_reason?: string | null;
  archived_by?: string | null;
};

type ArticleVersion = {
  version_number: number;
  created_at: string;
  title: string;
  edited_by: string;
  profiles?: { display_name: string } | null;
};

export default function ArticleViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  
  const [isLoading, setIsLoading] = useState(true);
  const [article, setArticle] = useState<Article | null>(null);
  const [versions, setVersions] = useState<ArticleVersion[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Retract / Inactivation Modal state
  const [showRetractModal, setShowRetractModal] = useState(false);
  const [retractionReasonPreset, setRetractionReasonPreset] = useState('Flagged as fake / misinformation');
  const [retractionCustomNotes, setRetractionCustomNotes] = useState('');

  // Permanent Delete Modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [deleteReason, setDeleteReason] = useState('Editorial purge / fake article removal');

  // Reusable Action Confirm Modal state
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    action: 'submit' | 'return' | 'publish' | 'reactivate' | null;
    title: string;
    description: string;
    confirmText: string;
    variant: 'emerald' | 'cyan' | 'amber' | 'primary';
    icon: string;
  }>({
    isOpen: false,
    action: null,
    title: '',
    description: '',
    confirmText: 'Confirm',
    variant: 'cyan',
    icon: 'ℹ️',
  });

  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);

      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!UUID_REGEX.test(id)) {
        setError('Invalid article ID format');
        setIsLoading(false);
        return;
      }
      
      const [sessionRes, articleRes, roleRes, permRes, versionsRes] = await Promise.all([
        supabase.auth.getSession(),
        supabase.from('articles').select('*').eq('id', id).single(),
        supabase.rpc('current_user_role'),
        supabase.rpc('current_user_permissions'),
        supabase.from('article_versions').select('version_number, created_at, edited_by, title, profiles!edited_by(display_name)').eq('article_id', id).order('version_number', { ascending: false })
      ]);

      if (sessionRes.data?.session?.user) {
        setCurrentUserId(sessionRes.data.session.user.id);
      }
      
      if (!roleRes.error && roleRes.data) {
        setUserRole(roleRes.data as string);
      }
      
      if (articleRes.error || !articleRes.data) {
        setError('Could not load article');
      } else {
        setArticle(articleRes.data);
      }
      
      if (!permRes.error && permRes.data) {
        setPermissions(permRes.data as string[]);
      }

      if (!versionsRes.error && versionsRes.data) {
        setVersions(versionsRes.data as unknown as ArticleVersion[]);
      }
      
      setIsLoading(false);
    }
    
    loadData();
  }, [id]);

  const can = (perm: string) => permissions.includes(perm);

  const handleAction = (action: 'submit' | 'return' | 'publish' | 'archive' | 'reactivate') => {
    if (action === 'archive') {
      setShowRetractModal(true);
      return;
    }

    if (action === 'submit') {
      setConfirmModalConfig({
        isOpen: true,
        action: 'submit',
        title: 'Submit for Editorial Review',
        description: 'Submit this article for editorial review? Newsroom editors will be notified to review the draft and prepare the story for publication.',
        confirmText: 'Submit for Review',
        variant: 'cyan',
        icon: '📨',
      });
      return;
    }

    if (action === 'return') {
      setConfirmModalConfig({
        isOpen: true,
        action: 'return',
        title: 'Return Article to Draft',
        description: 'Return this article back to draft status? The author will be able to make further editorial revisions.',
        confirmText: 'Return to Draft',
        variant: 'amber',
        icon: '↩️',
      });
      return;
    }

    if (action === 'publish') {
      setConfirmModalConfig({
        isOpen: true,
        action: 'publish',
        title: 'Publish Article Live',
        description: 'Publish this article now? It will become live on the public news website immediately for all readers.',
        confirmText: 'Publish Article',
        variant: 'emerald',
        icon: '🚀',
      });
      return;
    }

    if (action === 'reactivate') {
      setConfirmModalConfig({
        isOpen: true,
        action: 'reactivate',
        title: 'Reactivate Article',
        description: 'Reactivate this article? It will be restored from the archive and published live on the public website immediately.',
        confirmText: 'Reactivate Article',
        variant: 'emerald',
        icon: '✨',
      });
      return;
    }
  };

  const executeAction = async (action: 'submit' | 'return' | 'publish' | 'archive' | 'reactivate') => {
    setIsActionLoading(true);
    setError(null);
    setShowRetractModal(false);
    setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));

    const actionLabels = {
      submit: 'Submitting article for review...',
      return: 'Returning article to draft...',
      publish: 'Publishing article live...',
      archive: 'Deactivating and retracting article...',
      reactivate: 'Reactivating article live...',
    };

    const successLabels = {
      submit: 'Article submitted for review!',
      return: 'Article returned to draft.',
      publish: 'Article is now live on the public website! 🚀',
      archive: 'Article deactivated and taken offline.',
      reactivate: 'Article restored and published live! ✨',
    };

    const toastId = toast.loading(actionLabels[action]);

    try {
      const { data: session } = await supabase.auth.getSession();
      
      const combinedReason = retractionCustomNotes 
        ? `${retractionReasonPreset}: ${retractionCustomNotes}`
        : retractionReasonPreset;

      const body = action === 'archive' 
        ? JSON.stringify({ reason: combinedReason }) 
        : action === 'reactivate' 
        ? JSON.stringify({ target_status: 'published' }) 
        : undefined;

      const response = await fetch(`/api/articles/${id}/${action}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.session?.access_token}`,
        },
        body,
      });

      if (!response.ok) {
        const { error: errorMsg } = await response.json();
        // If MFA required, redirect to challenge flow
        if (errorMsg === 'Multi-factor authentication is required.') {
          toast.warning('Multi-factor authentication (MFA) required.', { id: toastId });
          setError('Recent multi-factor authentication (MFA) is required to complete this action.');
          router.push('/mfa/challenge');
          return;
        }
        throw new Error(errorMsg || `Failed to ${action} article`);
      }

      // Reload article to get new status
      const { data } = await supabase.from('articles').select('*').eq('id', id).single();
      if (data) setArticle(data);

      toast.success(successLabels[action], { id: toastId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(msg, { id: toastId });
    } finally {
      setIsActionLoading(false);
    }
  };

  const executeDelete = async () => {
    setIsActionLoading(true);
    setError(null);
    setShowDeleteModal(false);

    const toastId = toast.loading('Permanently deleting article from database...');

    try {
      const { data: session } = await supabase.auth.getSession();
      
      const response = await fetch(`/api/articles/${id}`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.session?.access_token}`,
        },
        body: JSON.stringify({ reason: deleteReason }),
      });

      if (!response.ok) {
        const { error: errorMsg } = await response.json();
        if (errorMsg === 'Multi-factor authentication is required.') {
          toast.warning('Multi-factor authentication (MFA) required.', { id: toastId });
          setError('Recent multi-factor authentication (MFA) is required to complete this action.');
          router.push('/mfa/challenge');
          return;
        }
        throw new Error(errorMsg || 'Failed to delete article');
      }

      toast.success('Article permanently deleted from database.', { id: toastId });
      // Redirect back to articles list upon successful deletion
      router.push('/articles');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(msg, { id: toastId });
      setIsActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-slate-400">Loading article...</p>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="mx-auto max-w-4xl p-8 text-center text-red-400">
        Article not found or access denied.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Top Breadcrumb & Status Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          <Button href="/articles" variant="secondary" size="sm" icon="←">
            Back to Stories
          </Button>
          <span className={`inline-flex items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-xs font-bold uppercase tracking-wider capitalize ${
            article.status === 'draft' ? 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' :
            article.status === 'review' ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800' :
            article.status === 'published' ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' :
            'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 font-bold'
          }`}>
            <span className={`h-2 w-2 rounded-full ${
              article.status === 'published' ? 'bg-emerald-500' :
              article.status === 'archived' ? 'bg-rose-500' :
              article.status === 'review' ? 'bg-amber-500' : 'bg-slate-500'
            }`} />
            {article.status === 'archived' ? 'Inactive / Retracted' : article.status}
          </span>
          <span className="text-xs text-slate-400">•</span>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{article.category}</span>
          {article.district && (
            <>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">📍 {article.district}</span>
            </>
          )}
        </div>

        {article.status === 'published' && (
          <a
            href={`http://localhost:3000/${article.category.toLowerCase()}/${article.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-600 hover:text-cyan-700 hover:underline dark:text-cyan-400"
          >
            <span>Live Article URL</span>
            <span>↗</span>
          </a>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* 2-Column Responsive Layout: Left content, Right vertical action sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Article Body & Content */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          {/* Prominent Banner when Article is Inactive / Retracted */}
          {article.status === 'archived' && (
            <div className="rounded-xl border border-red-500/40 bg-gradient-to-r from-red-950/60 to-slate-900 p-6 shadow-xl space-y-2">
              <div className="flex items-center gap-2.5 text-red-400 font-bold text-base">
                <span className="text-xl">⚠️</span>
                <span>ARTICLE INACTIVE &amp; RETRACTED — OFFLINE FROM PUBLIC VIEW</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                This article has been pulled offline and is no longer accessible to readers on the public news site.
                {article.archived_at && ` Retracted on ${new Date(article.archived_at).toLocaleString()}.`}
              </p>
              {article.archive_reason && (
                <div className="mt-3 rounded-lg border border-red-500/30 bg-black/50 p-3.5 text-xs text-slate-200">
                  <span className="font-bold text-red-300">Recorded Retraction Reason: </span>
                  <span>{article.archive_reason}</span>
                </div>
              )}
            </div>
          )}

          <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900/50">
            {article.featured_image_url && (
              <div className="relative aspect-[21/9] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                <Image
                  src={article.featured_image_url}
                  alt={article.title || 'Featured'}
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
            )}
            
            <div className="p-5 sm:p-7 md:p-8">
              <header className="mb-6">
                <div className="mb-3 flex items-center gap-2.5 text-xs text-cyan-600 dark:text-cyan-400 font-semibold uppercase tracking-wider">
                  <span>{article.category}</span>
                  {article.district && (
                    <>
                      <span className="text-slate-400 dark:text-slate-600">•</span>
                      <span>{article.district}</span>
                    </>
                  )}
                </div>
                
                <h1 className="mb-4 text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
                  {article.title}
                </h1>
                
                {article.excerpt && (
                  <p className="mb-4 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                    {article.excerpt}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400 border-t border-b border-slate-100 dark:border-slate-800 py-3">
                  <div>By <span className="font-semibold text-slate-900 dark:text-white">{article.author_display_name || 'KJIN desk'}</span></div>
                  <div className="flex items-center gap-1">
                    <span>Created: {new Date(article.created_at).toLocaleDateString()}</span>
                  </div>
                  {(article.source_name || article.source_url) && (
                    <div className="flex items-center gap-1">
                      <span>Source:</span>
                      {article.source_url ? (
                        <a href={article.source_url} target="_blank" rel="noopener noreferrer" className="text-cyan-600 hover:underline dark:text-cyan-400">
                          {article.source_name || article.source_url}
                        </a>
                      ) : (
                        <span className="text-slate-700 dark:text-white">{article.source_name}</span>
                      )}
                    </div>
                  )}
                </div>
              </header>

              <div 
                className="prose max-w-none text-slate-800 dark:prose-invert dark:text-slate-200 prose-p:text-sm sm:prose-p:text-[15px] prose-p:leading-relaxed prose-headings:font-bold prose-headings:text-slate-900 dark:prose-headings:text-white prose-h2:text-lg sm:prose-h2:text-xl prose-h2:mt-6 prose-h2:mb-3 prose-h3:text-base sm:prose-h3:text-lg prose-a:text-cyan-600 dark:prose-a:text-cyan-400 prose-ul:list-disc prose-ul:pl-5 prose-ul:my-3 prose-li:text-sm sm:prose-li:text-[15px] prose-li:my-1 prose-blockquote:border-l-4 prose-blockquote:border-cyan-500 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-slate-500 dark:prose-blockquote:text-slate-400 prose-strong:text-slate-900 dark:prose-strong:text-white"
                dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(markdownToHtml(article.content)) }}
              />
            </div>
          </article>

          {/* Quick Metrics Grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-900 dark:text-white capitalize">{article.status}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Views</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-900 dark:text-white">{article.view_count?.toLocaleString() || 0}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Last Updated</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-900 dark:text-white">{new Date(article.updated_at).toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Slug</p>
              <p className="mt-0.5 truncate text-xs font-mono text-slate-700 dark:text-slate-300" title={article.slug}>{article.slug}</p>
            </div>
          </div>

          {/* Version History Table */}
          {versions.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900/50">
              <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-white">Version History</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[550px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-500 dark:border-slate-800">
                      <th className="px-3.5 py-2.5 font-semibold">Version</th>
                      <th className="px-3.5 py-2.5 font-semibold">Date</th>
                      <th className="px-3.5 py-2.5 font-semibold">Title at Time</th>
                      <th className="px-3.5 py-2.5 font-semibold">Edited By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {versions.map((v) => (
                      <tr key={v.version_number} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                        <td className="px-3.5 py-3 font-mono font-bold text-cyan-700 dark:text-cyan-400">v{v.version_number}</td>
                        <td className="px-3.5 py-3 text-slate-600 dark:text-slate-300">
                          {new Date(v.created_at).toLocaleString()}
                        </td>
                        <td className="px-3.5 py-3 text-slate-800 dark:text-slate-200 font-medium">
                          {v.title}
                        </td>
                        <td className="px-3.5 py-3 text-slate-500 dark:text-slate-400">
                          {v.profiles?.display_name || 'Unknown'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        {/* Right Column: Actions in vertical sidebar */}
        <aside className="lg:col-span-4 xl:col-span-3 space-y-4 lg:sticky lg:top-6">
          {/* Editorial Actions Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Editorial Actions
              </h2>
              <span className="text-[10px] font-mono uppercase text-slate-400">Workflow</span>
            </div>

            <div className="flex flex-col gap-2">
              {/* Edit Content: Allowed for owner, superadmin, admin, editor across all states, and authors on their drafts */}
              {((['owner', 'superadmin', 'admin', 'editor'].includes(userRole || '')) ||
                (['draft', 'review'].includes(article.status) && (can('article.create') || can('article.review') || article.author_id === currentUserId)) ||
                (['published', 'archived'].includes(article.status) && can('article.review'))) && (
                <Button href={`/articles/${id}/edit`} variant="secondary" icon="✏️" className="w-full justify-start">
                  Edit Content
                </Button>
              )}

              {/* View on Website (for published articles) */}
              {article.status === 'published' && (
                <Button
                  href={`http://localhost:3000/${article.category.toLowerCase()}/${article.slug}`}
                  external
                  variant="cyan"
                  icon="🌐"
                  className="w-full justify-start"
                >
                  View on Website ↗
                </Button>
              )}

              {/* Submit for Review (for draft) */}
              {article.status === 'draft' && can('article.submit_review') && (
                <Button 
                  onClick={() => handleAction('submit')}
                  disabled={isActionLoading}
                  variant="cyan"
                  icon="📨"
                  className="w-full justify-start"
                >
                  Submit for Review
                </Button>
              )}

              {/* Return to Draft (for review) */}
              {article.status === 'review' && can('article.return') && (
                <Button 
                  onClick={() => handleAction('return')}
                  disabled={isActionLoading}
                  variant="amber"
                  icon="↩️"
                  className="w-full justify-start"
                >
                  Return to Draft
                </Button>
              )}

              {/* Publish Article (for review) */}
              {article.status === 'review' && can('article.publish') && (
                <Button 
                  onClick={() => handleAction('publish')}
                  disabled={isActionLoading}
                  variant="emerald"
                  icon="🚀"
                  className="w-full justify-start"
                >
                  Publish Article
                </Button>
              )}

              {/* Action 1: Reactivate (Restores an inactive/archived article back to published) */}
              {article.status === 'archived' && (can('article.publish') || can('article.review')) && (
                <Button 
                  onClick={() => handleAction('reactivate')}
                  disabled={isActionLoading}
                  variant="emerald"
                  icon="✨"
                  className="w-full justify-start"
                  title="Restore this article back to published and make it live on the public website"
                >
                  Reactivate Article
                </Button>
              )}

              {/* Action 2: Deactivate / Retract (Takes published article offline immediately) */}
              {(article.status === 'published' || article.status === 'review') && can('article.archive') && (
                <Button 
                  onClick={() => setShowRetractModal(true)}
                  disabled={isActionLoading}
                  variant="amber"
                  icon="🚫"
                  className="w-full justify-start"
                  title="Immediately pull this article offline from the public website"
                >
                  Deactivate / Retract
                </Button>
              )}

              {/* Action 3: Permanent Deletion (Purges article completely from DB) */}
              {(can('article.delete') || can('article.archive')) && (
                <Button 
                  onClick={() => {
                    setDeleteConfirmationInput('');
                    setShowDeleteModal(true);
                  }}
                  disabled={isActionLoading}
                  variant="danger"
                  icon="🗑️"
                  className="w-full justify-start"
                  title="Permanently delete article and versions from database"
                >
                  Delete Permanently
                </Button>
              )}
            </div>
          </div>

          {/* Article Info Sidebar Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 border-b border-slate-100 pb-2 dark:border-slate-800">
              Article Details
            </h3>
            <dl className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Desk</dt>
                <dd className="font-semibold text-slate-900 dark:text-white">{article.category}</dd>
              </div>
              {article.district && (
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500 dark:text-slate-400">District</dt>
                  <dd className="font-semibold text-slate-900 dark:text-white">📍 {article.district}</dd>
                </div>
              )}
              <div className="flex items-center justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Author</dt>
                <dd className="font-semibold text-slate-900 dark:text-white truncate max-w-[130px]" title={article.author_display_name || undefined}>
                  {article.author_display_name || 'Desk'}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Created</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-300">
                  {new Date(article.created_at).toLocaleDateString()}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Updated</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-300">
                  {new Date(article.updated_at).toLocaleDateString()}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Views</dt>
                <dd className="font-bold text-slate-900 dark:text-white">
                  {article.view_count?.toLocaleString() || 0}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>

      {/* Modal 1: Deactivate & Retract Article (Takes it offline immediately and stores reason) */}
      {showRetractModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20 overflow-hidden dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/80">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400 font-bold text-lg border-b border-slate-100 dark:border-slate-800 pb-3">
                <span>🚫</span>
                <span>Deactivate &amp; Retract Article</span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                This action will <strong>immediately pull the article offline</strong> from the public news website. The article and its complete version history will be preserved in the archive with the reason for retraction recorded.
              </p>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Select Retraction Reason
                </label>
                <select
                  value={retractionReasonPreset}
                  onChange={(e) => setRetractionReasonPreset(e.target.value)}
                  className="w-full rounded-[8px] border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                >
                  <option value="Flagged as fake / misinformation">🚩 Flagged as fake news / misinformation</option>
                  <option value="Factual inaccuracies in ground claims">⚠️ Factual inaccuracies in ground reporting / disputed claims</option>
                  <option value="Pending editorial reinvestigation">🔍 Pending editorial reinvestigation</option>
                  <option value="Legal or privacy takedown request">⚖️ Legal or privacy takedown request</option>
                  <option value="Source retracted initial statement">📄 Original source retracted initial statement</option>
                  <option value="Other editorial correction">📝 Other editorial correction</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Additional Editorial Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  value={retractionCustomNotes}
                  onChange={(e) => setRetractionCustomNotes(e.target.value)}
                  placeholder="Explain why this article was pulled down for internal record..."
                  className="w-full rounded-[8px] border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950">
              <Button 
                variant="secondary"
                size="md"
                onClick={() => setShowRetractModal(false)}
                disabled={isActionLoading}
              >
                Cancel
              </Button>
              <Button 
                variant="amber"
                size="md"
                onClick={() => executeAction('archive')}
                isLoading={isActionLoading}
              >
                Confirm Deactivation &amp; Retract
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Permanent Deletion (Hard Purge from Database) */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-rose-300 bg-white shadow-2xl shadow-rose-950/10 overflow-hidden dark:border-rose-500/40 dark:bg-slate-900 dark:shadow-black/80">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400 font-bold text-lg border-b border-slate-100 dark:border-slate-800 pb-3">
                <span>🗑️</span>
                <span>Permanently Delete Article?</span>
              </div>

              <div className="rounded-[8px] border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 leading-relaxed dark:border-rose-500/20 dark:bg-rose-950/30 dark:text-rose-200">
                <strong>Warning:</strong> This will permanently erase this article, its view counts, translation records, and all version history from the database. <strong>This cannot be undone.</strong>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Reason for Permanent Deletion
                </label>
                <input
                  type="text"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full rounded-[8px] border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-rose-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  placeholder="e.g. Fabricated news / spam draft / accidental duplicate"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1.5">
                  To confirm permanent deletion, type <strong className="text-slate-900 dark:text-white font-mono">DELETE</strong> below:
                </label>
                <input
                  type="text"
                  value={deleteConfirmationInput}
                  onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                  className="w-full rounded-[8px] border border-slate-300 bg-white px-3.5 py-2 text-sm font-mono text-slate-900 focus:border-rose-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  placeholder="DELETE"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950">
              <Button 
                variant="secondary"
                size="md"
                onClick={() => setShowDeleteModal(false)}
                disabled={isActionLoading}
              >
                Cancel
              </Button>
              <Button 
                variant="danger"
                size="md"
                onClick={executeDelete}
                disabled={isActionLoading || deleteConfirmationInput.trim() !== 'DELETE'}
                isLoading={isActionLoading}
              >
                Permanently Delete
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Modal 3: Reusable Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModalConfig.isOpen}
        onClose={() => setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={() => {
          if (confirmModalConfig.action) {
            executeAction(confirmModalConfig.action);
          }
        }}
        title={confirmModalConfig.title}
        description={confirmModalConfig.description}
        confirmText={confirmModalConfig.confirmText}
        variant={confirmModalConfig.variant}
        icon={confirmModalConfig.icon}
        isLoading={isActionLoading}
      />
    </div>
  );
}
