export type ArticleStatus = 'draft' | 'review' | 'published' | 'archived';

export type NewsLanguage = 'en' | 'ur' | 'hi';

export type ArticleDraft = {
  id?: string;
  title: string;
  summary: string;
  body: string;
  category: string;
  author: string;
  language: NewsLanguage;
  status: ArticleStatus;
  created_at?: string;
  updated_at?: string;
};
