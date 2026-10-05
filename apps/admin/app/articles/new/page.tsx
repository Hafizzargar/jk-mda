'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { normalizeArticleInsert } from '@kjin/db';
import type { ArticleDraft, ArticleStatus, NewsLanguage } from '@kjin/types';
import { supabase } from '@/lib/supabase';

const emptyDraft: ArticleDraft = {
  title: '',
  summary: '',
  body: '',
  category: 'Local reporting',
  author: 'KJIN desk',
  language: 'en',
  status: 'draft',
};

export default function NewArticlePage() {
  const [draft, setDraft] = useState<ArticleDraft>(emptyDraft);
  const [notice, setNotice] = useState('Draft saved locally.');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const previewTitle = useMemo(() => draft.title.trim() || 'Untitled article', [draft.title]);

  const updateField = <K extends keyof ArticleDraft>(field: K, value: ArticleDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const saveArticle = async (nextStatus: ArticleStatus) => {
    if (!draft.title.trim() || !draft.body.trim()) {
      setNotice('Title and article body are required before saving.');
      return;
    }

    setIsSubmitting(true);
    setNotice('Saving article to Supabase...');

    const payload = normalizeArticleInsert({ ...draft, status: nextStatus });

    try {
      const { error } = await supabase.from('articles').insert([payload]);

      if (error) {
        throw error;
      }

      setDraft((current) => ({ ...current, status: nextStatus }));
      setNotice(
        nextStatus === 'review'
          ? 'Article submitted for editorial review.'
          : `Draft saved for ${payload.author || 'anonymous author'}.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save article right now.';
      setNotice(`Save failed: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = () => saveArticle('draft');
  const handleSubmitForReview = () => saveArticle('review');

  return (
    <main className="min-h-screen bg-slate-950 p-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Editorial workspace</p>
            <h1 className="mt-2 text-3xl font-bold">Create a new article</h1>
          </div>
          <Link
            href="/"
            className="rounded-full border border-slate-700 px-5 py-2.5 font-semibold text-white hover:border-slate-500 hover:bg-slate-900"
          >
            Back to dashboard
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.5fr_0.9fr]">
          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block text-sm text-slate-300 md:col-span-2">
                <span className="mb-2 block">Headline</span>
                <input
                  value={draft.title}
                  onChange={(event) => updateField('title', event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
                  placeholder="Srinagar launches new civic alert system"
                />
              </label>

              <label className="block text-sm text-slate-300">
                <span className="mb-2 block">Author</span>
                <input
                  value={draft.author}
                  onChange={(event) => updateField('author', event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
                />
              </label>

              <label className="block text-sm text-slate-300">
                <span className="mb-2 block">Category</span>
                <input
                  value={draft.category}
                  onChange={(event) => updateField('category', event.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
                />
              </label>

              <label className="block text-sm text-slate-300">
                <span className="mb-2 block">Language</span>
                <select
                  value={draft.language}
                  onChange={(event) => updateField('language', event.target.value as NewsLanguage)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
                >
                  <option value="en">English</option>
                  <option value="ur">Urdu</option>
                  <option value="hi">Hindi</option>
                </select>
              </label>

              <label className="block text-sm text-slate-300 md:col-span-2">
                <span className="mb-2 block">Summary</span>
                <textarea
                  value={draft.summary}
                  onChange={(event) => updateField('summary', event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
                  placeholder="A concise summary for the homepage and teaser cards."
                />
              </label>

              <label className="block text-sm text-slate-300 md:col-span-2">
                <span className="mb-2 block">Article body</span>
                <textarea
                  value={draft.body}
                  onChange={(event) => updateField('body', event.target.value)}
                  rows={11}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
                  placeholder="Write the full story here."
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSubmitting}
                className="rounded-full border border-slate-700 bg-slate-950 px-5 py-2.5 font-semibold text-white hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Saving...' : 'Save draft'}
              </button>
              <button
                type="button"
                onClick={handleSubmitForReview}
                disabled={isSubmitting}
                className="rounded-full bg-cyan-500 px-5 py-2.5 font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Submitting...' : 'Submit for review'}
              </button>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Status</p>
              <div className="mt-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-cyan-100">
                {notice}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Preview</p>
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{draft.category}</p>
                  <h2 className="mt-3 text-2xl font-bold text-white">{previewTitle}</h2>
                  <p className="mt-3 text-sm text-slate-300">{draft.summary || 'Add a summary to describe the article.'}</p>
                  <p className="mt-4 text-xs text-slate-400">By {draft.author || 'Unknown author'} • {draft.language.toUpperCase()}</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300 whitespace-pre-line">
                  {draft.body || 'The article content will appear here.'}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
