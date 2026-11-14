import { createServerAnonClient } from '@/lib/supabase-server';
import { getAllCelebrations } from '@/lib/festive';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createServerAnonClient();
    const { items, active } = await getAllCelebrations(supabase);

    return Response.json(
      {
        celebration: active,
        celebrations: active, // Backwards-compatibility
        items,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=10, s-maxage=30, stale-while-revalidate=120',
        },
      }
    );
  } catch (err) {
    console.error('[Celebrations Web API] Error:', err);
    return Response.json({ error: 'Failed to retrieve celebrations' }, { status: 500 });
  }
}
