'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { canTransitionArticleStatus } from '@kjin/db';
import { supabase } from '@/lib/supabase';

type ReviewArticle = {
  id: string;
  title: string;
  summary: string;
  body: string;
  category: string;
  author: string;
  language: string;
  status: 'draft' | 'review' | 'published' | 'archived';
};

export default function ArticleReviewPage() {
  const params = useParams<{ id: string }>();
  const [article, setArticle] = useState<ReviewArticle | null>(null);
  const [statusMessage, setStatusMessage] = useState('Loading article...');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadArticle() {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('id', params.id)
        .single();

      if (error) {
        setStatusMessage(`Unable to load article: ${error.message}`);
        return;
      }

      setArticle(data as ReviewArticle);
      setStatusMessage(`Article loaded with status: ${data.status}.`);
    }

    if (params.id) {
      loadArticle();
    }
  }, [params.id]);

  const updateStatus = async (nextStatus: ReviewArticle['status']) => {
    if (!article) {
      return;
    }

    if (!canTransitionArticleStatus(article.status, nextStatus)) {
      setStatusMessage(`Invalid transition from ${article.status} to ${nextStatus}.`);
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(`Updating article to ${nextStatus}...`);

    const { error } = await supabase.rpc('transition_article_status', {
      p_article_id: article.id,
      p_next_status: nextStatus,
    });

    if (error) {
      setStatusMessage(`Failed to update article: ${error.message}`);
      setIsSubmitting(false);
      return;
    }

    setArticle((current) => (current ? { ...current, status: nextStatus } : current));
    setStatusMessage(`Article marked as ${nextStatus}.`);
    setIsSubmitting(false);
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
          <Link href="/" className="rounded-full border border-slate-700 px-5 py-2.5 font-semibold text-white hover:border-slate-500 hover:bg-slate-900">
            Back to dashboard
          </Link>
        </div>

        <div className="mb-6 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-cyan-100">
          {statusMessage}
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
          <article className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-slate-300">
              <span className="rounded-full border border-slate-700 px-2 py-1">{article.category}</span>
              <span className="rounded-full border border-slate-700 px-2 py-1">{article.language.toUpperCase()}</span>
              <span className="rounded-full border border-slate-700 px-2 py-1">By {article.author}</span>
            </div>

            <p className="text-lg text-slate-300">{article.summary}</p>
            <div className="mt-6 whitespace-pre-line text-slate-200">{article.body}</div>
          </article>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Decision</p>
              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={() => updateStatus('published')}
                  disabled={isSubmitting}
                  className="w-full rounded-full bg-emerald-500 px-5 py-2.5 font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Approve and publish
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
                  disabled={isSubmitting}
                  className="w-full rounded-full border border-red-500/40 bg-red-500/10 px-5 py-2.5 font-semibold text-red-200 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Reject and archive
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Current status</p>
              <p className="mt-4 text-xl font-semibold text-white">{article.status}</p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
