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
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (err) {
    console.error('[Celebrations Web API] Error:', err);
    return Response.json({ error: 'Failed to retrieve celebrations' }, { status: 500 });
  }
}
