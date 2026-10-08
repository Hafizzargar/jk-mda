'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type PublicArticle = {
  id: string;
  title: string;
  summary: string;
  body: string;
  category: string;
  author: string;
  language: string;
  status: string;
};

export default function ArticleDetailPage() {
  const params = useParams<{ id: string }>();
  const [article, setArticle] = useState<PublicArticle | null>(null);
  const [status, setStatus] = useState('Loading article...');

  useEffect(() => {
    async function loadArticle() {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('id', params.id)
        .eq('status', 'published')
        .single();

      if (error) {
        setStatus(`Unable to load this article: ${error.message}`);
        return;
      }

      setArticle(data as PublicArticle);
      setStatus('Article is live.');
    }

    if (params.id) {
      loadArticle();
    }
  }, [params.id]);

  // Record a view once the article is successfully loaded
  useEffect(() => {
    if (article) {
      fetch(`/api/articles/${article.id}/view`, { method: 'POST' }).catch((err) => {
        console.error('Failed to record view:', err);
      });
    }
  }, [article]);

  if (!article) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-white">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-slate-200">{status}</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="rounded-full border border-slate-700 px-5 py-2.5 font-semibold text-white hover:border-slate-500 hover:bg-slate-900">
            Back to home
          </Link>
          <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-cyan-200">
            {article.category}
          </span>
        </div>

        <article className="rounded-3xl border border-slate-800 bg-slate-900 p-8">
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">{article.language.toUpperCase()}</p>
          <h1 className="mt-4 text-4xl font-black text-white md:text-5xl">{article.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-400">
            <span>By {article.author}</span>
            <span>•</span>
            <span>{article.status}</span>
          </div>

          <p className="mt-8 text-lg text-slate-200">{article.summary}</p>

          <div className="mt-8 whitespace-pre-line text-lg leading-8 text-slate-300">{article.body}</div>
        </article>
      </div>
    </main>
  );
}
