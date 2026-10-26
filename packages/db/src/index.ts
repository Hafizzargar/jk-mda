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

export const articleStatusTransitions: Record<ArticleStatus, ArticleStatus[]> = {
  draft: ['review'],
  review: ['draft', 'published', 'archived'],
  published: ['archived'],
  archived: [],
};

export function canTransitionArticleStatus(currentStatus: ArticleStatus | null | undefined, nextStatus: ArticleStatus) {
  const validTransitions = articleStatusTransitions[currentStatus ?? 'draft'] ?? [];
  return validTransitions.includes(nextStatus);
}

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

export function summarizeArticleQueue(
  articles: Array<
    Partial<Pick<ArticleDraft, 'id' | 'title' | 'summary' | 'status'>> & {
      excerpt?: string | null;
      category?: string | null;
      updated_at?: string | null;
    }
  >
) {
  const counts = {
    draft: 0,
    review: 0,
    published: 0,
    archived: 0,
  };

  for (const article of articles) {
    const status = (article.status ?? 'draft') as ArticleStatus;
    if (status in counts) {
      counts[status] += 1;
    }
  }

  const queue = [...articles]
    .filter((article): article is typeof article & { title: string } => Boolean(article.title))
    .sort((left, right) => {
      const order = { review: 0, draft: 1, published: 2, archived: 3 } as const;
      const leftStatus = (left.status ?? 'draft') as ArticleStatus;
      const rightStatus = (right.status ?? 'draft') as ArticleStatus;
      return (order[leftStatus] ?? 99) - (order[rightStatus] ?? 99);
    })
    .slice(0, 6)
    .map((article) => ({
      id: article.id,
      title: article.title,
      status: article.status ?? 'draft',
      summary: article.excerpt?.trim() || article.summary?.trim() || 'No summary available yet.',
      category: article.category ?? undefined,
    }));

  const stats: DashboardStat[] = [
    { label: 'Drafts', value: counts.draft },
    { label: 'Pending review', value: counts.review },
    { label: 'Published today', value: counts.published },
    { label: 'Alerts', value: counts.archived },
  ];

  return { stats, queue };
}

export function summarizePublishedArticles(articles: Array<Pick<ArticleDraft, 'id' | 'title' | 'summary' | 'category' | 'author' | 'language' | 'status'>>) {
  return articles
    .filter((article) => article.status === 'published')
    .sort((left, right) => (right.title || '').localeCompare(left.title || ''))
    .map((article) => ({
      id: article.id,
      title: article.title,
      summary: article.summary || 'Read the latest report from KJIN.',
      category: article.category || 'General',
      author: article.author || 'KJIN desk',
      language: article.language || 'en',
    }));
}

