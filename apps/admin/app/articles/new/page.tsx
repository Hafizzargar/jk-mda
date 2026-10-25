'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { requiresMfa } from '@/lib/mfa';
import { CATEGORY_OPTIONS, DISTRICT_GROUPS, IMAGE_PRESETS } from '@/lib/taxonomy-options';
import { ImageUploader } from '@/components/ImageUploader';

export default function NewArticlePage() {
  const router = useRouter();

  const [authStatus, setAuthStatus] = useState('Checking authorization...');
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Image mode state & live preview
  const [hasFeaturedImage, setHasFeaturedImage] = useState(true);
  const [imageUrl, setImageUrl] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Local');
  const [selectedDistrict, setSelectedDistrict] = useState('srinagar');

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

    const rawDistrict = form.get('district');
    const districtValue = rawDistrict && String(rawDistrict).trim() ? String(rawDistrict).trim().toLowerCase() : null;

    const rawImageUrl = form.get('featured_image_url') || imageUrl;
    const finalImageUrl = hasFeaturedImage && rawImageUrl && String(rawImageUrl).trim() ? String(rawImageUrl).trim() : null;

    const payload = {
      title,
      slug,
      content: String(form.get('content') ?? ''),
      excerpt: form.get('excerpt') ? String(form.get('excerpt')) : null,
      category: form.get('category') ? String(form.get('category')) : 'General',
      district: districtValue,
      source_name: form.get('source_name') ? String(form.get('source_name')) : null,
      source_url: form.get('source_url') ? String(form.get('source_url')) : null,
      featured_image_url: finalImageUrl,
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
    <div className="p-4 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Link
              href="/articles"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors shadow-2xs"
              title="Back to articles"
            >
              ←
            </Link>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Draft Story</h1>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/articles"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors shadow-2xs"
            >
              Cancel
            </Link>
            <button
              type="submit"
              form="new-article-form"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-cyan-500 disabled:opacity-50 transition-colors"
            >
              <span>💾</span>
              <span>{isSubmitting ? 'Saving...' : 'Save Draft'}</span>
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/40 p-4 text-red-700 dark:text-red-200 font-medium text-sm flex items-center gap-3 shadow-xs">
            <span className="text-xl">⚠️</span>
            <div className="flex-1">{error}</div>
          </div>
        )}

        <form id="new-article-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">Core Content</h2>
            
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Title <span className="text-red-500">*</span></span>
                <input 
                  name="title" 
                  required 
                  maxLength={255} 
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white shadow-2xs" 
                  placeholder="Enter article headline..."
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Slug</span>
                <input 
                  name="slug" 
                  maxLength={255}
                  pattern="^[a-z0-9-]+$"
                  title="Only lowercase letters, numbers, and hyphens"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-mono text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white shadow-2xs" 
                  placeholder="auto-generated-from-title"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Excerpt</span>
                <textarea 
                  name="excerpt" 
                  maxLength={1000} 
                  rows={2}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white shadow-2xs" 
                  placeholder="Brief summary or introductory lead..."
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Body Content <span className="text-red-500">*</span></span>
                <textarea 
                  name="content" 
                  required 
                  rows={15}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-mono text-sm leading-relaxed text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white shadow-2xs" 
                  placeholder="Write the full article content here..."
                />
              </label>
            </div>
          </div>

          {/* Visual Presentation: With Image vs Without Image Option */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-white">Visual Media Option</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Choose whether this report has a lead photograph or will be published as a text-only editorial dispatch.
              </p>
            </div>

            {/* Segmented Switcher */}
            <div className="grid grid-cols-2 gap-3 p-1.5 rounded-xl bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => setHasFeaturedImage(true)}
                className={`py-3 px-4 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2.5 ${
                  hasFeaturedImage
                    ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <span>🖼️</span>
                <span>Article With Image</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setHasFeaturedImage(false);
                  setImageUrl('');
                }}
                className={`py-3 px-4 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2.5 ${
                  !hasFeaturedImage
                    ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <span>📄</span>
                <span>Text-Only Editorial (No Image)</span>
              </button>
            </div>

            {/* Option A: With Image Selected */}
            {hasFeaturedImage ? (
              <div className="pt-2">
                <ImageUploader
                  value={imageUrl}
                  onChange={setImageUrl}
                  presets={IMAGE_PRESETS}
                />
              </div>
            ) : (
              /* Option B: Text-Only Selected */
              <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/70 p-6 text-center space-y-2">
                <input type="hidden" name="featured_image_url" value="" />
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-300 text-lg">
                  📰
                </div>
                <h4 className="text-sm font-bold text-white">Text-Only Editorial Mode Active</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  No image will be assigned. On the public site, this dispatch will be rendered in traditional broadsheet typography with prominent headline prominence and drop-caps.
                </p>
                <div className="pt-2">
                  <span className="inline-block text-[11px] font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-800/60 px-3 py-1 rounded-full">
                    Layout: Broadsheet Typographic Anchor
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Regional Taxonomy & Classification */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Classification &amp; Area Tagging</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Accurate category and district tagging ensures your ground report appears in the right regional feeds.
              </p>
            </div>
            
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-300">Category <span className="text-red-400">*</span></span>
                <select 
                  name="category" 
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none"
                >
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-cyan-400/80 mt-1.5">
                  ⭐ Tip: For local issues, road/water problems, or citizen grievances, select <strong>Local</strong> or <strong>Investigation</strong>.
                </p>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-300">District / Ground Area</span>
                <select 
                  name="district" 
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none"
                >
                  <option value="">-- All Jammu &amp; Kashmir (Statewide / Regional) --</option>
                  {DISTRICT_GROUPS.map((group) => (
                    <optgroup key={group.region} label={group.region}>
                      {group.districts.map((d) => (
                        <option key={d.slug} value={d.slug}>
                          {d.name} ({group.region})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Ensures the dispatch matches regional directory tabs and district queries.
                </p>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-300">Original Source Name</span>
                <input 
                  name="source_name" 
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-white focus:border-cyan-500 focus:outline-none" 
                  placeholder="e.g. Ground Bureau / Field Correspondent"
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
    </div>
  );
}
