'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { requiresMfa } from '@/lib/mfa';

export default function NewArticlePage() {
  const router = useRouter();

  const [authStatus, setAuthStatus] = useState('Checking authorization...');
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkAuth() {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session) {
        setAuthStatus('Sign in required.');
        setIsAuthorized(false);
        return;
      }

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

      const permissions = (permResult.data as string[] | null) ?? [];
      if (!permissions.includes('article.create')) {
        setAuthStatus('You do not have permission to create articles.');
        setIsAuthorized(false);
        return;
      }

      setIsAuthorized(true);
    }
    checkAuth();
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    
    // Auto-generate slug from title if empty
    let slug = String(form.get('slug') ?? '').trim();
    const title = String(form.get('title') ?? '').trim();
    
    if (!slug && title) {
      slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    }

    const payload = {
      title,
      slug,
      content: String(form.get('content') ?? ''),
      excerpt: form.get('excerpt') ? String(form.get('excerpt')) : null,
      category: form.get('category') ? String(form.get('category')) : 'General',
      district: form.get('district') ? String(form.get('district')) : null,
      source_name: form.get('source_name') ? String(form.get('source_name')) : null,
      source_url: form.get('source_url') ? String(form.get('source_url')) : null,
      featured_image_url: form.get('featured_image_url') ? String(form.get('featured_image_url')) : null,
    };

    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch('/api/articles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionData.session?.access_token}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.error ?? 'Failed to create article');
      setIsSubmitting(false);
    } else {
      // Redirect to the view page upon success
      router.push(`/articles/${result.id}`);
    }
  };

  if (isAuthorized === false) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-white">
        <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-200">
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Access required</p>
          <h1 className="mt-4 text-2xl font-bold">{authStatus}</h1>
          <Link href="/articles" className="mt-6 inline-block rounded-full bg-cyan-500 px-5 py-2.5 font-semibold text-slate-950 hover:bg-cyan-400">
            Back to Articles
          </Link>
        </div>
      </main>
    );
  }

  if (isAuthorized === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-white">
        <div className="text-slate-400">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white md:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 border-b border-slate-800 pb-6">
          <Link href="/articles" className="text-sm font-medium text-cyan-300 hover:text-cyan-200">
            &larr; Back to articles
          </Link>
          <h1 className="mt-4 text-3xl font-bold">New article</h1>
          <p className="mt-2 text-sm text-slate-400">Create a new draft. It will not be visible to the public until published.</p>
        </header>

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold mb-4">Core Content</h2>
            
            <div className="space-y-5">
              <label className="block">
                <span className="text-sm font-medium text-slate-300">Title <span className="text-red-400">*</span></span>
                <input 
                  name="title" 
                  required 
                  maxLength={255} 
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none" 
                  placeholder="Enter article title"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-300">Slug</span>
                <p className="text-xs text-slate-500 mb-2">Leave blank to auto-generate from title. Only alphanumeric and hyphens allowed.</p>
                <input 
                  name="slug" 
                  maxLength={255}
                  pattern="^[a-z0-9-]+$"
                  title="Only lowercase letters, numbers, and hyphens are allowed"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white font-mono text-sm focus:border-cyan-500 focus:outline-none" 
                  placeholder="my-article-title"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-300">Excerpt</span>
                <p className="text-xs text-slate-500 mb-2">A brief summary for previews and social sharing.</p>
                <textarea 
                  name="excerpt" 
                  maxLength={1000} 
                  rows={3}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none" 
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-300">Body Content <span className="text-red-400">*</span></span>
                <textarea 
                  name="content" 
                  required 
                  rows={15}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white font-mono text-sm leading-relaxed focus:border-cyan-500 focus:outline-none" 
                  placeholder="Write the full article content here..."
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold mb-4">Metadata</h2>
            
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-300">Category</span>
                <input 
                  name="category" 
                  defaultValue="General"
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none" 
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-300">District</span>
                <input 
                  name="district" 
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none" 
                />
              </label>

              <label className="block md:col-span-2">
                <span className="text-sm font-medium text-slate-300">Featured Image URL</span>
                <input 
                  name="featured_image_url" 
                  type="url"
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none" 
                  placeholder="https://..."
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-300">Original Source Name</span>
                <input 
                  name="source_name" 
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none" 
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-300">Original Source URL</span>
                <input 
                  name="source_url" 
                  type="url"
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none" 
                  placeholder="https://..."
                />
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-4 pt-4">
            <Link href="/articles" className="text-sm font-medium text-slate-400 hover:text-white">
              Cancel
            </Link>
            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="rounded-lg bg-cyan-400 px-6 py-2.5 font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create draft'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
