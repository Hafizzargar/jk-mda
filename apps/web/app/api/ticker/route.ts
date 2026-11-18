import { NextResponse } from 'next/server';
import { getWarAndConflictNews } from '@/lib/external-news';

export const revalidate = 60;

export async function GET() {
  try {
    const items = await getWarAndConflictNews(8);
    return NextResponse.json({ items }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error('[API /api/ticker] Error retrieving ticker items:', error);
    return NextResponse.json({ items: [] });
  }
}
