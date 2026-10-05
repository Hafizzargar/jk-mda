import type { ArticleDraft, NewsLanguage } from '@kjin/types';

export const dbConfig = {
  schema: 'public',
  tablePrefix: 'kjin',
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

