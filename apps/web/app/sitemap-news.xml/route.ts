import { NextResponse } from 'next/server';
import { createServerAnonClient } from '@/lib/supabase-server';
import { SITE_URL, SITE_NAME } from '@/lib/config';

export const revalidate = 600; // 10 minutes cache

export async function GET() {
  const supabase = createServerAnonClient();
  
  // Google News Sitemaps should only include articles published in the last 48 hours.
  // We'll fetch up to 1000 recent articles.
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
  ${(articles || []).map((article) => `
  <url>
    <loc>${SITE_URL}/${article.category.toLowerCase()}/${article.slug}</loc>
    <news:news>
      <news:publication>
        <news:name>${SITE_NAME.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${new Date(article.published_at).toISOString()}</news:publication_date>
      <news:title>${article.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</news:title>
    </news:news>
  </url>
  `).join('')}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600, s-maxage=600, stale-while-revalidate=1200',
    },
  });
}
