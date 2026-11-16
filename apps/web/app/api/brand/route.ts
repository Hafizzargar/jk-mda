
import { createServerAnonClient } from '@/lib/supabase-server';
import { getBrandSettings } from '@/lib/brand';
import { getNavbarSettings } from '@/lib/navbar';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createServerAnonClient();
    const [brand, navbar] = await Promise.all([
      getBrandSettings(supabase),
      getNavbarSettings(supabase),
    ]);

    return Response.json(
      {
        brand,
        navbar,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=10, s-maxage=30, stale-while-revalidate=120',
        },
      }
    );
  } catch (err) {
    console.error('[Brand Web API] Error:', err);
    return Response.json({ error: 'Failed to retrieve brand settings' }, { status: 500 });
  }
}
