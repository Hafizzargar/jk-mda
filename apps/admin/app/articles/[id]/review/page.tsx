'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { sanitizeArticleHtml, markdownToHtml } from '@/lib/sanitize';

type ReviewArticle = {
  id: string;
  title: string;
  summary: string;
  body: string;
  category: string;
  author: string;
  language: string;
  status: 'draft' | 'review' | 'published' | 'archived';
  slug?: string;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FALLBACK_ARTICLES: Record<string, ReviewArticle> = {
  'fallback-review-1': {
    id: 'fallback-review-1',
    title: 'District update: Srinagar power outage',
    summary: 'Awaiting editorial sign-off.',
    body: '<p>Power grid operations in downtown Srinagar were disrupted following unexpected sub-station maintenance. Repair teams are active on site and full restoration is estimated within 4 hours.</p>',
    category: 'District',
    author: 'Staff Reporter',
    language: 'en',
    status: 'review',
  },
  'fallback-draft-1': {
    id: 'fallback-draft-1',
    title: 'Election monitoring brief',
    summary: 'Ready for final review.',
    body: '<p>Observer teams have completed verification across polling districts. Final documentation and security assessments are compiled for editorial review.</p>',
    category: 'Governance',
    author: 'Desk Correspondent',
    language: 'en',
    status: 'draft',
  },
  'fallback-published-1': {
    id: 'fallback-published-1',
    title: 'Local development coverage',
    summary: 'Published to the public desk.',
    body: '<p>Infrastructure upgrades across high-density corridors have reached milestone completion, improving inter-district transit times.</p>',
    category: 'Development',
    author: 'Bureau Staff',
    language: 'en',
    status: 'published',
  },
};

export default function ArticleReviewPage() {
  const params = useParams<{ id: string }>();
  const [article, setArticle] = useState<ReviewArticle | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState('Loading article...');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadArticle() {
      if (!params.id) {
        return;
      }

      // Check if it's a fallback demo article
      const fallbackItem = FALLBACK_ARTICLES[params.id];
      if (fallbackItem) {
        const { data: permData } = await supabase.rpc('current_user_permissions');
        setPermissions((permData as string[] | null) ?? ['article.review', 'article.publish']);
        setArticle(fallbackItem);
        setStatusMessage(`Previewing demo article: ${fallbackItem.title}.`);
        return;
      }

      // Ensure valid UUID before querying PostgREST to prevent 400 Bad Request
      if (!UUID_REGEX.test(params.id)) {
        setStatusMessage('Invalid article ID format.');
        return;
      }

      const [{ data, error }, permissionResult] = await Promise.all([
        supabase.from('articles').select('*').eq('id', params.id).single(),
        supabase.rpc('current_user_permissions'),
      ]);

      if (error) {
        setStatusMessage(`Unable to load article: ${error.message}`);
        return;
      }

      if (!permissionResult.error) {
        setPermissions((permissionResult.data as string[] | null) ?? []);
      }

      setArticle({
        id: data.id,
        title: data.title,
        summary: data.excerpt || data.summary || '',
        body: data.content || data.body || '',
        category: data.category || 'General',
        author: data.author_display_name || data.author || 'KJIN Desk',
        language: (data.language_code || data.language || 'en'),
        status: data.status,
        slug: data.slug,
      });
      setStatusMessage(`Article loaded with status: ${data.status}.`);
    }

    loadArticle();
  }, [params.id]);

  const updateStatus = async (nextStatus: ReviewArticle['status']) => {
    if (!article) {
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(`Updating article to ${nextStatus}...`);

    if (article.id.startsWith('fallback-')) {
      setArticle((current) => (current ? { ...current, status: nextStatus } : current));
      setStatusMessage(`Article marked as ${nextStatus} (Demo mode).`);
      setIsSubmitting(false);
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (nextStatus === 'published' && article.status === 'draft') {
        // Transition draft to review first to satisfy database state machine
        await fetch(`/api/articles/${article.id}/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
      }

      let endpoint = '';
      if (nextStatus === 'published') endpoint = `/api/articles/${article.id}/publish`;
      else if (nextStatus === 'draft') endpoint = `/api/articles/${article.id}/return`;
      else if (nextStatus === 'archived') endpoint = `/api/articles/${article.id}/archive`;

      if (!endpoint) {
        throw new Error(`Unsupported status action: ${nextStatus}`);
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: nextStatus === 'archived' ? JSON.stringify({ reason: 'Rejected from editorial review' }) : undefined,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to update status to ${nextStatus}`);
      }

      setArticle((current) => (current ? { ...current, status: nextStatus } : current));
      setStatusMessage(`Article successfully marked as ${nextStatus}!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Failed: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!article) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-white">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-slate-200">
          {statusMessage}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Review</p>
            <h1 className="mt-2 text-3xl font-bold">{article.title}</h1>
          </div>
          <div className="flex items-center gap-3">
            {article.status === 'published' && article.slug && (
              <a
                href={`http://localhost:3000/${article.category.toLowerCase()}/${article.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-5 py-2.5 font-semibold text-emerald-300 hover:bg-emerald-500/20"
              >
                View on Website ↗
              </a>
            )}
            <Link href="/" className="rounded-full border border-slate-700 px-5 py-2.5 font-semibold text-white hover:border-slate-500 hover:bg-slate-900">
              Back to dashboard
            </Link>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-cyan-100">
          {statusMessage}
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
          <article className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-slate-300">
              <span className="rounded-full border border-slate-700 px-2 py-1">{article.category}</span>
              <span className="rounded-full border border-slate-700 px-2 py-1">{(article.language || 'en').toUpperCase()}</span>
              <span className="rounded-full border border-slate-700 px-2 py-1">By {article.author}</span>
            </div>

            {article.summary && (
              <p className="text-lg text-slate-300 font-light leading-relaxed mb-6 pb-6 border-b border-slate-800">
                {article.summary}
              </p>
            )}

            {/* Sanitized Rich Typography Rendering: No literal HTML tags shown */}
            <div 
              className="prose prose-invert max-w-none text-slate-200 prose-headings:text-white prose-h2:text-2xl prose-h2:mt-6 prose-h2:mb-3 prose-h3:text-xl prose-a:text-cyan-400 prose-a:underline hover:prose-a:text-cyan-300 prose-ul:list-disc prose-ul:pl-5 prose-li:my-1 prose-blockquote:border-l-4 prose-blockquote:border-cyan-500 prose-blockquote:pl-4 prose-blockquote:italic"
              dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(markdownToHtml(article.body)) }}
            />
          </article>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Decision</p>
              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={() => updateStatus('published')}
                  disabled={isSubmitting || article.status === 'published'}
                  className="w-full rounded-full bg-emerald-500 px-5 py-2.5 font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  <span>🚀</span>
                  <span>{article.status === 'published' ? 'Already Published' : 'Approve and publish'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus('draft')}
                  disabled={isSubmitting}
                  className="w-full rounded-full border border-slate-700 bg-slate-950 px-5 py-2.5 font-semibold text-white hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Send back to draft
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus('archived')}
                  disabled={isSubmitting || article.status === 'archived'}
                  className="w-full rounded-full border border-red-500/40 bg-red-500/10 px-5 py-2.5 font-semibold text-red-200 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Reject and archive
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Current status</p>
              <p className="mt-4 text-xl font-semibold text-white capitalize">{article.status}</p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
