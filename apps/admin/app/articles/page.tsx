'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { requiresMfa } from '@/lib/mfa';

type Article = {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'review' | 'published' | 'archived';
  district: string | null;
  category: string;
  author_display_name: string;
  created_at: string;
  updated_at: string;
  author_id: string;
};

const PAGE_SIZE = 20;

export default function ArticlesPage() {
  const router = useRouter();
  
  // Auth & Permissions State
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState('Loading workspace...');
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  // Data State
  const [articles, setArticles] = useState<Article[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  const can = (permission: string) => permissions.includes(permission);

  // Load Auth
  useEffect(() => {
    async function checkAuth() {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        setAuthStatus('Sign in required.');
        setIsAuthorized(false);
        return;
      }
      setUserId(data.session.user.id);

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

      setRole(userRole);
      setPermissions((permResult.data as string[] | null) ?? []);
      setIsAuthorized(true);
    }
    checkAuth();
  }, [router]);

  // Load Articles
  useEffect(() => {
    if (isAuthorized !== true) return;
    
    async function loadArticles() {
      setIsLoading(true);
      setError(null);
      
      let query = supabase.from('articles').select('*', { count: 'exact' });
      
      if (search) {
        query = query.or(`title.ilike.%${search}%,slug.ilike.%${search}%`);
      }
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }
      if (districtFilter !== 'all') {
        query = query.eq('district', districtFilter);
      }
      
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      query = query.order('updated_at', { ascending: false }).range(from, to);
      
      const { data, error, count } = await query;
      
      if (error) {
        setError(error.message);
      } else {
        setArticles(data as Article[]);
        if (count !== null) setTotalCount(count);
      }
      setIsLoading(false);
    }
    
    loadArticles();
  }, [isAuthorized, search, statusFilter, categoryFilter, districtFilter, page]);

  if (isAuthorized === false) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-white">
        <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-200">
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Access required</p>
          <h1 className="mt-4 text-2xl font-bold">{authStatus}</h1>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <Link href="/" className="text-sm font-medium text-cyan-300 hover:text-cyan-200">KJIN newsroom</Link>
            <h1 className="mt-2 text-3xl font-bold">Articles</h1>
            <p className="mt-2 text-sm text-slate-400">Manage and publish content</p>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setPage(page)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold hover:border-cyan-500">
              Refresh
            </button>
            {can('article.create') ? (
              <Link href="/articles/new" className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300">
                New article
              </Link>
            ) : null}
          </div>
        </header>

        {/* Filters */}
        <section className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs uppercase text-slate-400">Search</label>
              <input 
                type="text" 
                placeholder="Title or slug..." 
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div className="w-[150px]">
              <label className="block text-xs uppercase text-slate-400">Status</label>
              <select 
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="all">All</option>
                <option value="draft">Draft</option>
                <option value="review">Review</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="w-[150px]">
              <label className="block text-xs uppercase text-slate-400">Category</label>
              <input 
                type="text" 
                placeholder="All..." 
                value={categoryFilter === 'all' ? '' : categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value || 'all'); setPage(1); }}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div className="w-[150px]">
              <label className="block text-xs uppercase text-slate-400">District</label>
              <input 
                type="text" 
                placeholder="All..." 
                value={districtFilter === 'all' ? '' : districtFilter}
                onChange={(e) => { setDistrictFilter(e.target.value || 'all'); setPage(1); }}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* Table Area */}
        <section className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
          {error ? (
            <div className="m-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              Error loading articles: {error}
            </div>
          ) : null}

          <table className="w-full min-w-[800px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase text-slate-400">
                <th className="px-5 py-4 font-medium">Article</th>
                <th className="px-5 py-4 font-medium">Status</th>
                <th className="px-5 py-4 font-medium">Author</th>
                <th className="px-5 py-4 font-medium">Last updated</th>
                <th className="px-5 py-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {isLoading ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">Loading articles...</td></tr>
              ) : articles.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">No articles found matching filters.</td></tr>
              ) : (
                articles.map((article) => {
                  const tagClass =
                    article.status === 'review' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : article.status === 'published' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : article.status === 'archived' ? 'bg-slate-500/15 text-slate-300 border-slate-500/30'
                    : 'bg-slate-800 text-slate-300 border-slate-700';

                  const isOwnDraft = article.author_id === userId && article.status === 'draft';
                  const canEdit = (article.status === 'draft' || article.status === 'review') && (can('article.review') || isOwnDraft);
                  const canReviewAction = article.status === 'review' && can('article.review');
                  
                  return (
                    <tr key={article.id} className="align-top hover:bg-slate-800/20 transition-colors">
                      <td className="px-5 py-5">
                        <Link href={`/articles/${article.id}`} className="font-medium text-white hover:text-cyan-400">
                          {article.title}
                        </Link>
                        <p className="mt-1 text-xs text-slate-500 font-mono truncate max-w-sm">{article.slug}</p>
                        <div className="mt-2 flex gap-2 text-xs text-slate-400">
                          {article.category ? <span>{article.category}</span> : null}
                          {article.category && article.district ? <span>&middot;</span> : null}
                          {article.district ? <span>{article.district}</span> : null}
                        </div>
                      </td>
                      <td className="px-5 py-5">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${tagClass}`}>
                          {article.status}
                        </span>
                      </td>
                      <td className="px-5 py-5 text-slate-300">{article.author_display_name}</td>
                      <td className="whitespace-nowrap px-5 py-5 text-slate-400">
                        {new Date(article.updated_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-5">
                        <div className="flex flex-wrap gap-2">
                          <Link href={`/articles/${article.id}`} className="rounded-md border border-slate-700 px-3 py-1.5 hover:border-slate-500 hover:text-white">
                            View
                          </Link>
                          {canEdit ? (
                            <Link href={`/articles/${article.id}/edit`} className="rounded-md border border-slate-700 px-3 py-1.5 hover:border-cyan-400 hover:text-white">
                              Edit
                            </Link>
                          ) : null}
                          {canReviewAction ? (
                            <Link href={`/articles/${article.id}/review`} className="rounded-md bg-amber-500/20 px-3 py-1.5 text-amber-300 hover:bg-amber-500/30">
                              Review
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          
          {/* Pagination */}
          {!isLoading && totalCount > 0 ? (
            <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/50 px-5 py-4">
              <p className="text-sm text-slate-400">
                Showing <span className="font-medium text-slate-200">{(page - 1) * PAGE_SIZE + 1}</span> to <span className="font-medium text-slate-200">{Math.min(page * PAGE_SIZE, totalCount)}</span> of <span className="font-medium text-slate-200">{totalCount}</span>
              </p>
              <div className="flex gap-2">
                <button 
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:border-slate-500 hover:text-white disabled:opacity-50 disabled:hover:border-slate-700 disabled:hover:text-slate-400"
                >
                  Previous
                </button>
                <button 
                  disabled={page * PAGE_SIZE >= totalCount}
                  onClick={() => setPage(p => p + 1)}
                  className="rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:border-slate-500 hover:text-white disabled:opacity-50 disabled:hover:border-slate-700 disabled:hover:text-slate-400"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
