import type { ArticleDraft, ArticleStatus, NewsLanguage } from '@kjin/types';

export const dbConfig = {
  schema: 'public',
  tablePrefix: 'kjin',
};

export type DashboardStat = {
  label: string;
  value: number;
};

export type DashboardQueueItem = {
  id?: string;
  title: string;
  status: ArticleStatus;
  summary: string;
};

export const articleStatusOptions = ['draft', 'review', 'published', 'archived'] as const;
export const articleLanguageOptions: NewsLanguage[] = ['en', 'ur', 'hi'];

export function normalizeArticleInsert(article: ArticleDraft) {
  return {
    title: article.title.trim(),
    summary: article.summary.trim(),
    body: article.body.trim(),
    category: article.category.trim(),
    author: article.author.trim() || 'KJIN desk',
    language: article.language,
    status: article.status,
  };
}

export function summarizeArticleQueue(articles: Array<Pick<ArticleDraft, 'id' | 'title' | 'summary' | 'status'>>) {
  const counts = {
    draft: 0,
    review: 0,
    published: 0,
    archived: 0,
  };

  for (const article of articles) {
    const status = article.status ?? 'draft';
    if (status in counts) {
      counts[status] += 1;
    }
  }

  const queue = [...articles]
    .filter((article) => article.title)
    .sort((left, right) => {
      const order = { review: 0, draft: 1, published: 2, archived: 3 } as const;
      return (order[left.status ?? 'draft'] ?? 99) - (order[right.status ?? 'draft'] ?? 99);
    })
    .slice(0, 6)
    .map((article) => ({
      id: article.id,
      title: article.title,
      status: article.status ?? 'draft',
      summary: article.summary || 'No summary available yet.',
    }));

  const stats: DashboardStat[] = [
    { label: 'Drafts', value: counts.draft },
    { label: 'Pending review', value: counts.review },
    { label: 'Published today', value: counts.published },
    { label: 'Alerts', value: counts.archived },
  ];

  return { stats, queue };
}

