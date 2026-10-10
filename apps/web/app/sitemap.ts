import { MetadataRoute } from 'next';
import { createServerAnonClient } from '@/lib/supabase-server';
import { SITE_URL } from '@/lib/config';
import { NEWS_CATEGORIES, JK_DISTRICTS } from '@/lib/taxonomy';

// Limit per sitemap file to comply with search engine standards and memory bounds
const SITEMAP_MAX_ARTICLES = 10000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createServerAnonClient();

  // 1. Fetch published articles (capped for scaling and memory bounds)
  const { data: articles } = await supabase
    .from('articles')
    .select('slug, category, updated_at, published_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(SITEMAP_MAX_ARTICLES);

  const articleUrls: MetadataRoute.Sitemap = (articles || []).map((article) => ({
    url: `${SITE_URL}/${article.category.toLowerCase()}/${article.slug}`,
    lastModified: new Date(article.updated_at || article.published_at || Date.now()),
    changeFrequency: 'daily',
    priority: 0.8,
  }));

  // 2. Controlled Category feeds
  const categoryUrls: MetadataRoute.Sitemap = Object.keys(NEWS_CATEGORIES).map((cat) => ({
    url: `${SITE_URL}/category/${cat}`,
    lastModified: new Date(),
    changeFrequency: 'hourly',
    priority: 0.9,
  }));

  // 3. Controlled District feeds
  const districtUrls: MetadataRoute.Sitemap = Object.keys(JK_DISTRICTS).map((dist) => ({
    url: `${SITE_URL}/district/${dist}`,
    lastModified: new Date(),
    changeFrequency: 'hourly',
    priority: 0.85,
  }));

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'always',
      priority: 1.0,
    },
    ...categoryUrls,
    ...districtUrls,
    ...articleUrls,
  ];
}
