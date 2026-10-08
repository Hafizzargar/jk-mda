'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function ArticleViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  
  const [isLoading, setIsLoading] = useState(true);
  const [article, setArticle] = useState<any>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      
      const [articleRes, permRes] = await Promise.all([
        supabase.from('articles').select('*').eq('id', id).single(),
        supabase.rpc('current_user_permissions')
      ]);
      
      if (articleRes.error || !articleRes.data) {
        setError('Could not load article');
      } else {
        setArticle(articleRes.data);
      }
      
      if (!permRes.error && permRes.data) {
        setPermissions(permRes.data as string[]);
      }
      
      setIsLoading(false);
    }
    
    loadData();
  }, [id]);

  const can = (perm: string) => permissions.includes(perm);

  const handleAction = async (action: 'submit' | 'return' | 'publish' | 'archive') => {
    let confirmMsg = '';
    if (action === 'submit') confirmMsg = 'Submit this article for editorial review?';
    if (action === 'return') confirmMsg = 'Return this article to draft status?';
    if (action === 'publish') confirmMsg = 'Publish this article? It will be live on the public site immediately.';
    if (action === 'archive') confirmMsg = 'Archive this article? It will be hidden from the public site.';
    
    if (!confirm(confirmMsg)) return;

    setIsActionLoading(true);
    setError(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      
      const response = await fetch(`/api/articles/${id}/${action}`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${session?.session?.access_token}`,
        },
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
      
    } catch (err: any) {
      setError(err.message);
    } finally {
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
              'bg-red-500/10 text-red-400 border-red-500/20'
            }`}>
              {article.status}
            </span>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {(article.status === 'draft' || article.status === 'review') && can('article.create') && (
            <Link 
              href={`/articles/${id}/edit`}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              Edit Content
            </Link>
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

          {article.status === 'review' && can('article.review') && (
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
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              Publish Article
            </button>
          )}

          {(article.status === 'published' || article.status === 'review') && can('article.archive') && (
            <button 
              onClick={() => handleAction('archive')}
              disabled={isActionLoading}
              className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-50"
            >
              Archive
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      <article className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 shadow-xl">
        {article.featured_image_url && (
          <div className="aspect-[21/9] w-full overflow-hidden bg-slate-800">
            <img src={article.featured_image_url} alt="Featured" className="h-full w-full object-cover" />
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

          <div className="prose prose-invert max-w-none prose-p:text-slate-300 prose-headings:text-white prose-a:text-cyan-400">
            {article.content.split('\n').map((paragraph: string, idx: number) => (
              paragraph.trim() ? <p key={idx} className="mb-4">{paragraph}</p> : <br key={idx} />
            ))}
          </div>
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
    </div>
  );
}
