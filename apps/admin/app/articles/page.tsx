'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type Article = {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'review' | 'published' | 'archived';
  category: string;
  author_display_name: string | null;
  created_at: string;
  updated_at: string;
};

const tabs = [
  { id: 'all', label: 'All articles' },
  { id: 'draft', label: 'Drafts' },
  { id: 'review', label: 'In Review' },
  { id: 'published', label: 'Published' },
  { id: 'archived', label: 'Archived' },
] as const;

type TabId = (typeof tabs)[number]['id'];

export default function ArticlesPage() {
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadArticles() {
      setIsLoading(true);
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) return;

      const { data, error } = await supabase
        .from('articles')
        .select('id, title, slug, status, category, author_display_name, created_at, updated_at')
        .order('updated_at', { ascending: false });
      
      if (!error && data) {
        setArticles(data);
      }
      setIsLoading(false);
    }
    loadArticles();
  }, []);

  const filteredArticles = articles.filter(article => 
    activeTab === 'all' || article.status === activeTab
  );

  const tabCount = (tab: TabId) => {
    if (tab === 'all') return articles.length;
    return articles.filter(a => a.status === tab).length;
  };

  const getStatusBadge = (status: Article['status']) => {
    const styles = {
      draft: 'bg-slate-800 text-slate-300 border-slate-700',
      review: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      published: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      archived: 'bg-red-500/10 text-red-400 border-red-500/20',
    };
    
    return (
      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${styles[status]}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Articles</h1>
          <p className="text-sm text-slate-400">Manage publications, reviews, and drafts.</p>
        </div>
        <Link 
          href="/articles/new" 
          className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-300"
        >
          Create article
        </Link>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 shadow-xl">
        <nav className="flex overflow-x-auto border-b border-slate-800 px-4 text-sm font-medium" aria-label="Tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={`shrink-0 border-b-2 px-4 py-4 text-sm font-medium transition-colors ${
                activeTab === tab.id 
                  ? 'border-cyan-400 text-cyan-400' 
                  : 'border-transparent text-slate-400 hover:border-slate-700 hover:text-slate-300'
              }`}
            >
              {tab.label}
              <span className="ml-2 rounded-full bg-slate-800 px-2 py-0.5 text-xs">
                {tabCount(tab.id)}
              </span>
            </button>
          ))}
        </nav>

        <div className="min-h-[400px]">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <p className="text-slate-400">Loading articles...</p>
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <p className="text-slate-400">No articles found in this category.</p>
              {activeTab === 'all' && (
                <Link href="/articles/new" className="mt-4 text-cyan-400 hover:underline">
                  Create your first article
                </Link>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-slate-800">
              {filteredArticles.map(article => (
                <li key={article.id} className="group flex items-center justify-between p-4 transition-colors hover:bg-slate-800/50">
                  <div className="min-w-0 flex-1 px-4">
                    <div className="flex items-center gap-3">
                      <Link 
                        href={`/articles/${article.id}`}
                        className="truncate text-base font-semibold text-white hover:text-cyan-400"
                      >
                        {article.title}
                      </Link>
                      {getStatusBadge(article.status)}
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-sm text-slate-400">
                      <span>{article.author_display_name || 'KJIN desk'}</span>
                      <span>•</span>
                      <span>{article.category}</span>
                      <span>•</span>
                      <span>{new Date(article.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <div className="flex shrink-0 items-center gap-3 pr-4 opacity-0 transition-opacity group-hover:opacity-100">
                    <Link 
                      href={`/articles/${article.id}/edit`}
                      className="rounded bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-700 hover:text-white"
                    >
                      Edit
                    </Link>
                    <Link 
                      href={`/articles/${article.id}`}
                      className="rounded bg-cyan-500/10 px-3 py-1.5 text-sm font-medium text-cyan-400 hover:bg-cyan-500/20"
                    >
                      View
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
