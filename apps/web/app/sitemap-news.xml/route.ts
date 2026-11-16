import { NextResponse } from 'next/server';
import { createServerAnonClient } from '@/lib/supabase-server';
import { SITE_URL, SITE_NAME } from '@/lib/config';
import { getCategorySlug } from '@/lib/taxonomy';
import { getBrandSettings } from '@/lib/brand';

export const revalidate = 300; // 5 minutes cache for ultra-fast Google News discovery

export async function GET() {
  const supabase = createServerAnonClient();
  const brand = await getBrandSettings(supabase);
  const publicationName = (brand.full_name || brand.name || SITE_NAME)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Google News Sitemaps strictly require articles published in the last 48 hours.
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  
  const { data: articles } = await supabase
    .from('articles')
    .select('slug, title, category, published_at')
    .eq('status', 'published')
    .gte('published_at', twoDaysAgo)
    .order('published_at', { ascending: false })
    .limit(1000);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  ${(articles || []).map((article) => {
    let pubDate = new Date().toISOString();
    try {
      if (article.published_at) pubDate = new Date(article.published_at).toISOString();
    } catch {
      // fallback
    }
    const cleanTitle = (article.title || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const categorySlug = getCategorySlug(article.category);
    return `
  <url>
    <loc>${SITE_URL}/en/${categorySlug}/${article.slug}</loc>
    <news:news>
      <news:publication>
        <news:name>${publicationName}</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${pubDate}</news:publication_date>
      <news:title>${cleanTitle}</news:title>
    </news:news>
  </url>`;
  }).join('')}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
