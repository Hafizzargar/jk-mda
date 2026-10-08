import { MetadataRoute } from 'next';
import { createServerAnonClient } from '@/lib/supabase-server';

const BASE_URL = 'https://kjin.news'; // Or env variable NEXT_PUBLIC_SITE_URL

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createServerAnonClient();
  
  // Fetch all published articles
  const { data: articles } = await supabase
    .from('articles')
    .select('slug, category, updated_at')
    .order('updated_at', { ascending: false });
    
  const articleUrls: MetadataRoute.Sitemap = (articles || []).map((article) => ({
    url: `${BASE_URL}/${article.category.toLowerCase()}/${article.slug}`,
    lastModified: new Date(article.updated_at),
    changeFrequency: 'daily',
    priority: 0.8,
  }));

  // Fetch unique categories and districts to index their feeds
  const { data: categories } = await supabase
    .from('articles')
    .select('category')
    .not('category', 'is', null);
    
  const { data: districts } = await supabase
    .from('articles')
    .select('district')
    .not('district', 'is', null);

  const uniqueCategories = Array.from(new Set((categories || []).map(c => c.category.toLowerCase())));
  const uniqueDistricts = Array.from(new Set((districts || []).map(d => d.district.toLowerCase())));

  const categoryUrls: MetadataRoute.Sitemap = uniqueCategories.map((cat) => ({
    url: `${BASE_URL}/category/${cat}`,
    lastModified: new Date(),
    changeFrequency: 'hourly',
    priority: 0.9,
  }));

  const districtUrls: MetadataRoute.Sitemap = uniqueDistricts.map((dist) => ({
    url: `${BASE_URL}/district/${dist}`,
    lastModified: new Date(),
    changeFrequency: 'hourly',
    priority: 0.9,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1.0,
    },
    ...categoryUrls,
    ...districtUrls,
    ...articleUrls,
  ];
}
