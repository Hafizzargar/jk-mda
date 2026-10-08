'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [article, setArticle] = useState<any>(null);

  useEffect(() => {
    async function fetchArticle() {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error || !data) {
        setError('Could not load article');
      } else {
        setArticle(data);
      }
      setIsLoading(false);
    }
    fetchArticle();
  }, [id]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get('title'),
      slug: formData.get('slug'),
      excerpt: formData.get('excerpt'),
      content: formData.get('content'),
      category: formData.get('category') || 'General',
      district: formData.get('district') || null,
      source_name: formData.get('source_name') || null,
      source_url: formData.get('source_url') || null,
      featured_image_url: formData.get('featured_image_url') || null,
    };

    try {
      const { data: session } = await supabase.auth.getSession();
      
      const response = await fetch(`/api/articles/${id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.session?.access_token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const { error: errorMsg } = await response.json();
        throw new Error(errorMsg || 'Failed to update article');
      }

      router.push(`/articles/${id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubmitReview() {
    if (!confirm('Are you sure you want to submit this draft for review? You will no longer be able to edit it unless it is returned.')) {
      return;
    }
    
    setIsSubmittingReview(true);
    setError(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      
      const response = await fetch(`/api/articles/${id}/submit`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${session?.session?.access_token}`,
        },
      });

      if (!response.ok) {
        const { error: errorMsg } = await response.json();
        throw new Error(errorMsg || 'Failed to submit article');
      }

      router.push(`/articles/${id}`);
    } catch (err: any) {
      setError(err.message);
      setIsSubmittingReview(false);
    }
  }

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
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link 
            href="/articles"
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
          >
            ← Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Edit Draft</h1>
            <p className="text-sm text-slate-400">Make changes to your article</p>
          </div>
        </div>
        
        {article.status === 'draft' && (
          <button 
            type="button"
            onClick={handleSubmitReview}
            disabled={isSubmittingReview || isSaving}
            className="rounded-lg bg-emerald-500/10 px-4 py-2 font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
          >
            {isSubmittingReview ? 'Submitting...' : 'Submit for Review'}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}
      
      {article.status !== 'draft' && article.status !== 'review' && (
        <div className="mb-6 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm text-amber-400">
          This article is {article.status}. Editing may be restricted.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8 rounded-xl border border-slate-800 bg-slate-900/50 p-6 shadow-xl lg:p-8">
        <div className="space-y-6">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-slate-300">Title</label>
            <input 
              id="title" 
              name="title" 
              type="text" 
              defaultValue={article.title}
              required 
              maxLength={255}
              className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder-slate-600 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400" 
            />
          </div>

          <div>
            <label htmlFor="slug" className="block text-sm font-medium text-slate-300">URL Slug</label>
            <input 
              id="slug" 
              name="slug" 
              type="text" 
              defaultValue={article.slug}
              required 
              maxLength={255}
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder-slate-600 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400" 
            />
          </div>

          <div>
            <label htmlFor="excerpt" className="block text-sm font-medium text-slate-300">Excerpt</label>
            <textarea 
              id="excerpt" 
              name="excerpt" 
              defaultValue={article.excerpt || ''}
              rows={2}
              maxLength={1000}
              className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder-slate-600 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400" 
            />
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-medium text-slate-300">Content</label>
            <textarea 
              id="content" 
              name="content" 
              defaultValue={article.content}
              required
              rows={12}
              className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder-slate-600 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400" 
            />
          </div>
          
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-slate-300">Category</label>
              <select 
                id="category" 
                name="category"
                defaultValue={article.category || 'General'}
                className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400" 
              >
                <option value="General">General</option>
                <option value="Politics">Politics</option>
                <option value="Business">Business</option>
                <option value="Tech">Tech</option>
                <option value="Sports">Sports</option>
                <option value="Local reporting">Local reporting</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="district" className="block text-sm font-medium text-slate-300">District</label>
              <input 
                id="district" 
                name="district" 
                type="text" 
                defaultValue={article.district || ''}
                className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder-slate-600 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400" 
              />
            </div>
          </div>
          
          <hr className="border-slate-800" />
          
          <div className="space-y-6">
            <h3 className="text-sm font-medium text-slate-300">Media & Attribution</h3>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <label htmlFor="featured_image_url" className="block text-sm font-medium text-slate-300">Featured Image URL</label>
                <input 
                  id="featured_image_url" 
                  name="featured_image_url" 
                  type="url" 
                  defaultValue={article.featured_image_url || ''}
                  className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder-slate-600 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400" 
                />
              </div>
              
              <div>
                <label htmlFor="source_name" className="block text-sm font-medium text-slate-300">Source Name</label>
                <input 
                  id="source_name" 
                  name="source_name" 
                  type="text" 
                  defaultValue={article.source_name || ''}
                  className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder-slate-600 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400" 
                />
              </div>
              
              <div>
                <label htmlFor="source_url" className="block text-sm font-medium text-slate-300">Source URL</label>
                <input 
                  id="source_url" 
                  name="source_url" 
                  type="url" 
                  defaultValue={article.source_url || ''}
                  className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder-slate-600 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400" 
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 border-t border-slate-800 pt-6">
          <Link href={`/articles/${id}`} className="text-sm text-slate-400 hover:text-white">Cancel</Link>
          <button 
            type="submit" 
            disabled={isSaving || isSubmittingReview}
            className="rounded-lg bg-cyan-400 px-6 py-2.5 font-semibold text-slate-950 transition-colors hover:bg-cyan-300 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
