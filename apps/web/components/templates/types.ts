export interface ArticleItem {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  category: string;
  district?: string | null;
  author_display_name?: string | null;
  published_at: string;
  featured_image_url?: string | null;
  view_count?: number;
}

export interface TemplateProps {
  lang: string;
  langPrefix: string;
  heroArticle: ArticleItem | null;
  recentArticles: ArticleItem[];
  trendingArticles: ArticleItem[];
  allArticles: ArticleItem[];
}
