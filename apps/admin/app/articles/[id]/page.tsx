'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { sanitizeArticleHtml, markdownToHtml } from '@/lib/sanitize';

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

  const handleAction = async (action: 'submit' | 'return' | 'publish' | 'archive' | 'reactivate') => {
    if (action === 'archive') {
      setShowRetractModal(true);
      return;
    }

    let confirmMsg = '';
    if (action === 'submit') confirmMsg = 'Submit this article for editorial review?';
    if (action === 'return') confirmMsg = 'Return this article to draft status?';
    if (action === 'publish') confirmMsg = 'Publish this article? It will be live on the public site immediately.';
    if (action === 'reactivate') confirmMsg = 'Reactivate this article? It will be published live on the public site immediately.';
    
    if (!confirm(confirmMsg)) return;

    await executeAction(action);
  };

  const executeAction = async (action: 'submit' | 'return' | 'publish' | 'archive' | 'reactivate') => {
    setIsActionLoading(true);
    setError(null);
    setShowRetractModal(false);

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
        // If MFA required, redirect to verification flow (handled natively or custom)
        if (errorMsg === 'Multi-factor authentication is required.') {
          alert('You must perform recent multi-factor authentication (MFA) to complete this action.');
          router.push('/mfa/verify');
          return;
        }
        throw new Error(errorMsg || `Failed to ${action} article`);
      }

      // Reload article to get new status
      const { data } = await supabase.from('articles').select('*').eq('id', id).single();
      if (data) setArticle(data);
      
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsActionLoading(false);
    }
  };

  const executeDelete = async () => {
    setIsActionLoading(true);
    setError(null);
    setShowDeleteModal(false);

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
          alert('You must perform recent multi-factor authentication (MFA) to complete this action.');
          router.push('/mfa/verify');
          return;
        }
        throw new Error(errorMsg || 'Failed to delete article');
      }

      // Redirect back to articles list upon successful deletion
      router.push('/articles');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
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
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link 
            href="/articles"
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
          >
            ← Back
          </Link>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
              article.status === 'draft' ? 'bg-slate-800 text-slate-300 border-slate-700' :
              article.status === 'review' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
              article.status === 'published' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
              'bg-red-500/20 text-red-300 border-red-500/40 font-bold'
            }`}>
              {article.status === 'archived' ? 'Inactive / Retracted' : article.status}
            </span>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Edit Content: Allowed for owner, superadmin, admin, editor across all states, and authors on their drafts */}
          {((['owner', 'superadmin', 'admin', 'editor'].includes(userRole || '')) ||
            (['draft', 'review'].includes(article.status) && (can('article.create') || can('article.review') || article.author_id === currentUserId)) ||
            (['published', 'archived'].includes(article.status) && can('article.review'))) && (
            <Link 
              href={`/articles/${id}/edit`}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              Edit Content
            </Link>
          )}

          {article.status === 'draft' && (can('article.publish') || ['owner', 'superadmin', 'admin', 'editor'].includes(userRole || '')) && (
            <button 
              onClick={() => handleAction('publish')}
              disabled={isActionLoading}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-emerald-950/40"
              title="Publish this draft immediately to the live public website"
            >
              <span>🚀</span>
              <span>Publish Now</span>
            </button>
          )}

          {article.status === 'draft' && can('article.submit_review') && (
            <button 
              onClick={() => handleAction('submit')}
              disabled={isActionLoading}
              className="rounded-lg bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-400 hover:bg-cyan-500/20 disabled:opacity-50"
            >
              Submit for Review
            </button>
          )}

          {article.status === 'review' && can('article.return') && (
            <button 
              onClick={() => handleAction('return')}
              disabled={isActionLoading}
              className="rounded-lg bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
            >
              Return to Draft
            </button>
          )}

          {article.status === 'review' && can('article.publish') && (
            <button 
              onClick={() => handleAction('publish')}
              disabled={isActionLoading}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-emerald-950/40"
            >
              <span>🚀</span>
              <span>Publish Article</span>
            </button>
          )}

          {article.status === 'published' && (
            <a
              href={`http://localhost:3000/${article.category.toLowerCase()}/${article.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/20 flex items-center gap-1.5"
            >
              <span>🌐</span>
              <span>View on Website ↗</span>
            </a>
          )}

          {/* Action 1: Reactivate (Restores an inactive/archived article back to published) */}
          {article.status === 'archived' && (can('article.publish') || can('article.review')) && (
            <button 
              onClick={() => handleAction('reactivate')}
              disabled={isActionLoading}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-emerald-950/40"
              title="Restore this article back to published and make it live on the public website"
            >
              <span>✨</span>
              <span>Reactivate Article</span>
            </button>
          )}

          {/* Action 2: Deactivate / Retract (Takes published article offline immediately) */}
          {(article.status === 'published' || article.status === 'review') && can('article.archive') && (
            <button 
              onClick={() => setShowRetractModal(true)}
              disabled={isActionLoading}
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-500/20 disabled:opacity-50 flex items-center gap-1.5"
              title="Immediately pull this article offline from the public website"
            >
              <span>🚫</span>
              <span>Deactivate / Retract</span>
            </button>
          )}

          {/* Action 2: Permanent Deletion (Purges article completely from DB) */}
          {(can('article.delete') || can('article.archive')) && (
            <button 
              onClick={() => {
                setDeleteConfirmationInput('');
                setShowDeleteModal(true);
              }}
              disabled={isActionLoading}
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50 flex items-center gap-1.5"
              title="Permanently delete article and versions from database"
            >
              <span>🗑️</span>
              <span>Delete Permanently</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Prominent Banner when Article is Inactive / Retracted */}
      {article.status === 'archived' && (
        <div className="mb-8 rounded-xl border border-red-500/40 bg-gradient-to-r from-red-950/60 to-slate-900 p-6 shadow-xl space-y-2">
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

      <article className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 shadow-xl">
        {article.featured_image_url && (
          <div className="relative aspect-[21/9] w-full overflow-hidden bg-slate-800">
            <Image
              src={article.featured_image_url}
              alt={article.title || 'Featured'}
              fill
              unoptimized
              className="object-cover"
            />
          </div>
        )}
        
        <div className="p-6 md:p-10">
          <header className="mb-8">
            <div className="mb-4 flex items-center gap-3 text-sm text-cyan-400 font-semibold">
              <span>{article.category}</span>
              {article.district && (
                <>
                  <span className="text-slate-600">•</span>
                  <span>{article.district}</span>
                </>
              )}
            </div>
            
            <h1 className="mb-6 text-3xl font-bold text-white md:text-5xl lg:text-6xl">{article.title}</h1>
            
            {article.excerpt && (
              <p className="mb-6 text-lg text-slate-300 md:text-xl">
                {article.excerpt}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-400 border-t border-b border-slate-800 py-4">
              <div>By <span className="font-semibold text-white">{article.author_display_name || 'KJIN desk'}</span></div>
              <div className="flex items-center gap-1.5">
                <span>Created: {new Date(article.created_at).toLocaleDateString()}</span>
              </div>
              {(article.source_name || article.source_url) && (
                <div className="flex items-center gap-1.5">
                  <span>Source:</span>
                  {article.source_url ? (
                    <a href={article.source_url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                      {article.source_name || article.source_url}
                    </a>
                  ) : (
                    <span className="text-white">{article.source_name}</span>
                  )}
                </div>
              )}
            </div>
          </header>

          <div 
            className="prose prose-invert max-w-none prose-p:text-slate-300 prose-p:leading-relaxed prose-headings:text-white prose-headings:font-bold prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4 prose-h2:border-b prose-h2:border-slate-800 prose-h2:pb-2 prose-h3:text-xl prose-h3:mt-6 prose-a:text-cyan-400 prose-a:underline hover:prose-a:text-cyan-300 prose-ul:list-disc prose-ul:pl-6 prose-ul:my-4 prose-li:text-slate-300 prose-li:my-1 prose-blockquote:border-l-4 prose-blockquote:border-cyan-500 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-slate-400 prose-strong:text-white"
            dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(markdownToHtml(article.content)) }}
          />
        </div>
      </article>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status</p>
          <p className="mt-1 font-medium text-white capitalize">{article.status}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Views</p>
          <p className="mt-1 font-medium text-white">{article.view_count?.toLocaleString() || 0}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Last Updated</p>
          <p className="mt-1 font-medium text-white">{new Date(article.updated_at).toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Slug</p>
          <p className="mt-1 truncate font-medium text-white" title={article.slug}>{article.slug}</p>
        </div>
      </div>

      {versions.length > 0 && (
        <section className="mt-12 rounded-xl border border-slate-800 bg-slate-900/50 p-6 md:p-8">
          <h2 className="mb-6 text-xl font-bold text-white">Version History</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 font-semibold">Version</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Title at Time</th>
                  <th className="px-4 py-3 font-semibold">Edited By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {versions.map((v) => (
                  <tr key={v.version_number} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-4 font-mono text-cyan-400">v{v.version_number}</td>
                    <td className="px-4 py-4 text-slate-300">
                      {new Date(v.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-slate-200 font-medium">
                      {v.title}
                    </td>
                    <td className="px-4 py-4 text-slate-400">
                      {v.profiles?.display_name || 'Unknown'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Modal 1: Deactivate & Retract Article (Takes it offline immediately and stores reason) */}
      {showRetractModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2.5 text-amber-400 font-bold text-lg border-b border-slate-800 pb-3">
                <span>🚫</span>
                <span>Deactivate &amp; Retract Article</span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                This action will <strong>immediately pull the article offline</strong> from the public news website. The article and its complete version history will be preserved in the archive with the reason for retraction recorded.
              </p>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Select Retraction Reason
                </label>
                <select
                  value={retractionReasonPreset}
                  onChange={(e) => setRetractionReasonPreset(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
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
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Additional Editorial Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  value={retractionCustomNotes}
                  onChange={(e) => setRetractionCustomNotes(e.target.value)}
                  placeholder="Explain why this article was pulled down for internal record..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-800 bg-slate-950 p-4">
              <button 
                onClick={() => setShowRetractModal(false)}
                disabled={isActionLoading}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={() => executeAction('archive')}
                disabled={isActionLoading}
                className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
              >
                {isActionLoading ? 'Deactivating...' : 'Confirm Deactivation & Retract'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Permanent Deletion (Hard Purge from Database) */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-red-500/40 bg-slate-900 shadow-2xl overflow-hidden">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2.5 text-red-400 font-bold text-lg border-b border-slate-800 pb-3">
                <span>🗑️</span>
                <span>Permanently Delete Article?</span>
              </div>

              <div className="rounded-lg border border-red-500/20 bg-red-950/30 p-3 text-xs text-red-200 leading-relaxed">
                <strong>Warning:</strong> This will permanently erase this article, its view counts, translation records, and all version history from the database. <strong>This cannot be undone.</strong>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Reason for Permanent Deletion
                </label>
                <input
                  type="text"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-red-500 focus:outline-none"
                  placeholder="e.g. Fabricated news / spam draft / accidental duplicate"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1.5">
                  To confirm permanent deletion, type <strong className="text-white font-mono">DELETE</strong> below:
                </label>
                <input
                  type="text"
                  value={deleteConfirmationInput}
                  onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm font-mono text-white focus:border-red-500 focus:outline-none"
                  placeholder="DELETE"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-800 bg-slate-950 p-4">
              <button 
                onClick={() => setShowDeleteModal(false)}
                disabled={isActionLoading}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={executeDelete}
                disabled={isActionLoading || deleteConfirmationInput.trim() !== 'DELETE'}
                className="rounded-lg bg-red-600 px-5 py-2 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isActionLoading ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
