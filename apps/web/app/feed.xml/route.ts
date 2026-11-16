import { NextResponse } from 'next/server';
import { createServerAnonClient } from '@/lib/supabase-server';
import { SITE_URL, SITE_NAME, SITE_SHORT_NAME } from '@/lib/config';
import { getCategorySlug } from '@/lib/taxonomy';

export const revalidate = 300; // 5 minutes cache

function escapeXml(unsafe?: string | null): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const supabase = createServerAnonClient();

  const { data: articles } = await supabase
    .from('articles')
    .select('id, slug, title, excerpt, category, district, author_display_name, published_at, updated_at, featured_image_url')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(50);

  const now = new Date().toUTCString();

  const itemsXml = (articles || []).map((art) => {
    const categorySlug = getCategorySlug(art.category);
    const articleUrl = `${SITE_URL}/en/${categorySlug}/${art.slug}`;
    const pubDate = art.published_at ? new Date(art.published_at).toUTCString() : now;
    const author = (art.author_display_name || `${SITE_SHORT_NAME} Bureau`).replace(/\bKJIN\b/gi, 'KJCPL');

    const imageTag = art.featured_image_url
      ? `<media:content url="${escapeXml(art.featured_image_url)}" medium="image" />`
      : '';

    return `    <item>
      <title>${escapeXml(art.title)}</title>
      <link>${articleUrl}</link>
      <guid isPermaLink="true">${articleUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <dc:creator>${escapeXml(author)}</dc:creator>
      <category>${escapeXml(art.category)}</category>
      <description>${escapeXml(art.excerpt || art.title)}</description>
      ${imageTag}
    </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${SITE_URL}/en</link>
    <description>Verified news, investigative reports, ground dispatches, and transit telemetry across Jammu, Kashmir, Ladakh, and India.</description>
    <language>en-in</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
${itemsXml}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
