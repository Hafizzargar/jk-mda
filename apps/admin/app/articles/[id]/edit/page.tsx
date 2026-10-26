'use client';

import { FormEvent, useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  CATEGORY_OPTIONS,
  DISTRICT_GROUPS,
  IMAGE_PRESETS,
  fetchDynamicCategories,
  formatCategoryOptions,
  type DynamicCategoryItem,
} from '@/lib/taxonomy-options';
import { ImageUploader } from '@/components/ImageUploader';
import { RichTextEditor } from '@/components/RichTextEditor';
import { Button } from '@/components/Button';
import { toast } from '@/components/Toast';

type Article = {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'review' | 'published' | 'archived';
  district: string | null;
  category: string;
  excerpt: string | null;
  content: string;
  source_name: string | null;
  source_url: string | null;
  featured_image_url: string | null;
  author_id: string;
};

export default function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const [authStatus, setAuthStatus] = useState('Checking authorization...');
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [article, setArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Image mode state & live preview
  const [hasFeaturedImage, setHasFeaturedImage] = useState(true);
  const [imageUrl, setImageUrl] = useState('');
  const [categories, setCategories] = useState<DynamicCategoryItem[]>(() => formatCategoryOptions([]));
  const [selectedCategory, setSelectedCategory] = useState('Local');
  const [selectedDistrict, setSelectedDistrict] = useState('');

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session) {
        setAuthStatus('Sign in required.');
        setIsAuthorized(false);
        return;
      }
      const userId = data.session.user.id;

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

      const permissions = (permResult.data as string[] | null) ?? [];
      const hasReviewPermission = permissions.includes('article.review');
      const hasCreatePermission = permissions.includes('article.create');

      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!UUID_REGEX.test(id)) {
        setAuthStatus('Invalid article ID format.');
        setIsAuthorized(false);
        setIsLoading(false);
        return;
      }

      // Fetch article
      const { data: articleData, error: articleError } = await supabase
        .from('articles')
        .select('*')
        .eq('id', id)
        .single();

      if (articleError || !articleData) {
        setAuthStatus('Article not found or access denied.');
        setIsAuthorized(false);
        return;
      }

      const a = articleData as Article;
      
      // Verify edit authorization:
      // Owner and Superadmin have unconditional edit permissions across all states
      // Admin and Editor can edit drafts, in-review, published, and archived articles
      // Authors can edit their own draft articles
      const isPrivilegedStaff = ['owner', 'superadmin', 'admin', 'editor'].includes(userRole);
      const isAuthorOfDraft = a.author_id === userId && a.status === 'draft';
      const canEdit = 
        isPrivilegedStaff ||
        (hasReviewPermission && ['draft', 'review', 'published', 'archived'].includes(a.status)) ||
        (isAuthorOfDraft && (hasCreatePermission || userRole === 'author'));

      if (!canEdit) {
        setAuthStatus('You do not have permission to edit this article in its current state.');
        setIsAuthorized(false);
        return;
      }

      setArticle(a);
      setHasFeaturedImage(Boolean(a.featured_image_url));
      setImageUrl(a.featured_image_url ?? '');
      setSelectedCategory(a.category || 'General');
      setSelectedDistrict(a.district || '');

      // Load dynamic categories from database, ensuring article's current category is retained
      try {
        const dynamicCats = await fetchDynamicCategories(supabase, true);
        const matched = dynamicCats.find((c) => c.value.toLowerCase() === (a.category || '').toLowerCase());
        if (matched) {
          setSelectedCategory(matched.value);
        } else if (a.category) {
          dynamicCats.unshift({
            value: a.category,
            label: `${a.category} (Current)`,
            slug: a.category.toLowerCase(),
            description: 'Assigned article category',
            is_active: true,
          });
          setSelectedCategory(a.category);
        } else {
          setSelectedCategory('General');
        }
        if (dynamicCats && dynamicCats.length > 0) {
          setCategories(dynamicCats);
        }
      } catch (catErr) {
        console.warn('Failed to load dynamic categories:', catErr);
      }

      setIsAuthorized(true);
      setIsLoading(false);
    }
    
    init();
  }, [router, id]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    
    let slug = String(form.get('slug') ?? '').trim();
    if (!slug && article) {
      slug = article.slug;
    }
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

    const toastId = toast.loading('Saving article revisions...');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch(`/api/articles/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMsg = result.error ?? 'Failed to update article';
        setError(errorMsg);
        toast.error(errorMsg, { id: toastId });
        setIsSubmitting(false);
      } else {
        toast.success('Article revisions saved successfully!', { id: toastId });
        router.push(`/articles/${id}`);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      toast.error(errorMsg, { id: toastId });
      setIsSubmitting(false);
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

  if (isAuthorized === null || isLoading || !article) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-white">
        <div className="text-slate-400">Loading article...</div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Breadcrumb Navigation & Top Action Header */}
        <header className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <Link href="/articles" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition">
                  Stories
                </Link>
                <span>/</span>
                <span className="text-slate-400 dark:text-slate-600">Edit</span>
                <span>/</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 truncate max-w-[180px]">
                  {article.slug || id}
                </span>
                <span
                  className={`ml-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                    article.status === 'published'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                      : article.status === 'archived'
                        ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                  }`}
                >
                  {article.status}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href={`/articles/${id}`}
                  className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition shadow-2xs"
                  title="Back to article details"
                >
                  ←
                </Link>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                    Edit Story
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Update content, lead visual presentation, and regional taxonomy routing.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Button href={`/articles/${id}`} variant="secondary" size="md">
                Cancel
              </Button>
              <Button
                type="submit"
                form="edit-article-form"
                variant="primary"
                size="md"
                disabled={isSubmitting}
                isLoading={isSubmitting}
                icon={<span>💾</span>}
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-950/40 p-4 text-red-700 dark:text-red-200 font-medium text-sm flex items-center gap-3 shadow-xs">
            <span className="text-xl">⚠️</span>
            <div className="flex-1">{error}</div>
          </div>
        )}

        <form id="edit-article-form" onSubmit={handleSubmit} className="space-y-6">
          {/* Card 1: Core Content */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-xs dark:border-slate-800 dark:bg-slate-900/90">
            <div className="flex items-center gap-3 pb-4 mb-5 border-b border-slate-100 dark:border-slate-800/80">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950/60 dark:text-cyan-400 font-bold text-base">
                ✍️
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Core Content</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Headline, permanent URL identifier, and full story body.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Title <span className="text-rose-500">*</span>
                </span>
                <input
                  name="title"
                  defaultValue={article.title}
                  required
                  maxLength={255}
                  className="mt-1.5 w-full rounded-[8px] border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/70 px-3.5 py-2.5 text-base font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition shadow-2xs"
                  placeholder="Enter story headline..."
                />
              </label>

              <label className="block">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    URL Slug
                  </span>
                  {(article.status === 'published' || article.status === 'archived') && (
                    <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      🔒 Locked after publication
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex rounded-[8px] border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/70 focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/20 focus-within:bg-white dark:focus-within:bg-slate-950 overflow-hidden transition shadow-2xs">
                  <span className="inline-flex items-center px-3.5 text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100/80 dark:bg-slate-900/80 border-r border-slate-200 dark:border-slate-800 select-none">
                    kjin.org/
                  </span>
                  <input
                    name="slug"
                    defaultValue={article.slug}
                    maxLength={255}
                    pattern="^[a-z0-9-]+$"
                    title="Only lowercase letters, numbers, and hyphens are allowed"
                    className="w-full bg-transparent px-3 py-2 font-mono text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
                    disabled={article.status === 'published' || article.status === 'archived'}
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Lead Summary / Excerpt
                </span>
                <textarea
                  name="excerpt"
                  defaultValue={article.excerpt ?? ''}
                  maxLength={1000}
                  rows={2}
                  className="mt-1.5 w-full rounded-[8px] border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/70 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition shadow-2xs"
                  placeholder="Key highlight or teaser summary..."
                />
              </label>

              <div className="block">
                <span className="block mb-2 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Body Content <span className="text-rose-500">*</span>
                </span>
                <RichTextEditor name="content" defaultValue={article.content} required />
              </div>
            </div>
          </div>

          {/* Card 2: Visual Media Option */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-xs dark:border-slate-800 dark:bg-slate-900/90 space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800/80">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950/60 dark:text-cyan-400 font-bold text-base">
                🖼️
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Visual Media Option</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Choose whether this story features a lead photograph or will publish as a text-only editorial dispatch.
                </p>
              </div>
            </div>

            {/* Segmented Switcher */}
            <div className="grid grid-cols-2 gap-2 p-1.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setHasFeaturedImage(true)}
                className={`py-2.5 px-4 rounded-[8px] text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 ${
                  hasFeaturedImage
                    ? 'bg-white text-slate-900 shadow-xs font-bold dark:bg-cyan-500 dark:text-slate-950'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <span>🖼️</span>
                <span>Article With Photo</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setHasFeaturedImage(false);
                  setImageUrl('');
                }}
                className={`py-2.5 px-4 rounded-[8px] text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 ${
                  !hasFeaturedImage
                    ? 'bg-white text-slate-900 shadow-xs font-bold dark:bg-cyan-500 dark:text-slate-950'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <span>📄</span>
                <span>Text-Only Editorial</span>
              </button>
            </div>

            {/* Option A: With Image Selected */}
            {hasFeaturedImage ? (
              <div className="pt-2">
                <ImageUploader value={imageUrl} onChange={setImageUrl} presets={IMAGE_PRESETS} />
              </div>
            ) : (
              /* Option B: Text-Only Selected */
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/70 p-6 text-center space-y-2">
                <input type="hidden" name="featured_image_url" value="" />
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-lg shadow-2xs">
                  📰
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Text-Only Editorial Mode Active</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  No image will be assigned. On the public site, this dispatch will be rendered in traditional broadsheet typography with prominent headline prominence and drop-caps.
                </p>
                <div className="pt-1">
                  <span className="inline-block text-[11px] font-mono text-cyan-700 dark:text-cyan-300 bg-cyan-100 dark:bg-cyan-950/60 border border-cyan-300 dark:border-cyan-800/60 px-3 py-1 rounded-full">
                    Layout: Broadsheet Typographic Anchor
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Card 3: Regional Taxonomy & Classification */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-xs dark:border-slate-800 dark:bg-slate-900/90">
            <div className="flex items-center gap-3 pb-4 mb-5 border-b border-slate-100 dark:border-slate-800/80">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950/60 dark:text-cyan-400 font-bold text-base">
                🏷️
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Classification &amp; Area Tagging</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Accurate category and district tagging ensures your ground report appears in the right regional feeds.
                </p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Category <span className="text-rose-500">*</span>
                </span>
                <select
                  name="category"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="mt-1.5 w-full rounded-[8px] border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/70 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-cyan-500 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition shadow-2xs"
                >
                  {categories.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-cyan-600 dark:text-cyan-400 mt-1.5">
                  ⭐ Tip: For local issues, road/water problems, or citizen grievances, select <strong>Local</strong> or <strong>Investigation</strong>.
                </p>
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  District / Ground Area
                </span>
                <select
                  name="district"
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  className="mt-1.5 w-full rounded-[8px] border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/70 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-cyan-500 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition shadow-2xs"
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
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                  Ensures the dispatch matches regional directory tabs and district queries.
                </p>
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Original Source Name
                </span>
                <input
                  name="source_name"
                  defaultValue={article.source_name ?? ''}
                  className="mt-1.5 w-full rounded-[8px] border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/70 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition shadow-2xs"
                  placeholder="e.g. Ground Bureau / Field Correspondent"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Original Source URL
                </span>
                <input
                  name="source_url"
                  defaultValue={article.source_url ?? ''}
                  type="url"
                  className="mt-1.5 w-full rounded-[8px] border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/70 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition shadow-2xs"
                  placeholder="https://..."
                />
              </label>
            </div>
          </div>

          {/* Bottom Floating Action Bar */}
          <div className="sticky bottom-4 z-20 flex items-center justify-between rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-5 py-3.5 backdrop-blur shadow-lg">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
              <span>Editing story • unsaved revisions</span>
            </div>

            <div className="flex items-center gap-2.5">
              <Button href={`/articles/${id}`} variant="secondary" size="md">
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={isSubmitting}
                isLoading={isSubmitting}
                icon={<span>💾</span>}
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
