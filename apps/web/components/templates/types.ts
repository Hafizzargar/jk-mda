import type { TemplateTheme } from '@/lib/templates';
import type { FooterContactSettings } from '@/lib/contact';
import type { PaginationMeta } from '@/lib/pagination';
import type { CustomAdsSettings } from '@/lib/ads';
import type { NavbarSettings } from '@/lib/navbar';

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
  theme?: TemplateTheme;
  contactSettings?: FooterContactSettings;
  paginationMeta?: PaginationMeta;
  adsSettings?: CustomAdsSettings;
  navbarSettings?: NavbarSettings;
}
