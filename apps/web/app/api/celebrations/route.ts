import { createServerAnonClient } from '@/lib/supabase-server';
import { getFestiveSettings } from '@/lib/festive';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createServerAnonClient();
    const celebrations = await getFestiveSettings(supabase);
    return Response.json(
      { celebrations },
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

