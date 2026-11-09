import { NextResponse } from 'next/server';
import { createServerAnonClient } from '@/lib/supabase-server';
import { applyTranslations } from '@/lib/i18n';
import { getTelemetrySettings } from '@/lib/telemetry';
import { getDistrictDisplayName } from '@/lib/taxonomy';

export const revalidate = 60; // 60 seconds edge cache

const EXCLUDED_CATEGORIES_FILTER =
  '(International,international,INTERNATIONAL,National,national,NATIONAL,"International","international","INTERNATIONAL","National","national","NATIONAL",Problems,problems,PROBLEMS,"Problems","problems","PROBLEMS")';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const section = searchParams.get('section') || 'wire';
    const lang = searchParams.get('lang') || 'en';
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '5', 10), 1), 20);

    const supabase = createServerAnonClient();

    // 1. SECTION: Bureau Wire Dispatches
    if (section === 'wire') {
      const { data, error } = await supabase
        .from('articles')
        .select(
          'id, slug, title, category, district, author_display_name, published_at, article_translations(title, language_code)'
        )
        .eq('status', 'published')
        .not('category', 'in', EXCLUDED_CATEGORIES_FILTER)
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(limit);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const translated = applyTranslations(data || [], lang) as any[];
      const articles = translated.map((art, idx) => ({
        id: art.id,
        slug: art.slug,
        title: art.title,
        category: art.category,
        district: art.district ? getDistrictDisplayName(art.district) : null,
        author: art.author_display_name || 'Staff Wire',
        publishedAt: art.published_at,
        timeTag: `${13 - idx * 2}:28 IST`,
        isVetted: true,
      }));

      return NextResponse.json(
        { section: 'wire', items: articles },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
          },
        }
      );
    }

    // 2. SECTION: Problems & Civic Issues Desk
    if (section === 'problems') {
      const { data, error } = await supabase
        .from('articles')
        .select(
          'id, slug, title, excerpt, category, district, author_display_name, published_at, article_translations(title, excerpt, language_code)'
        )
        .eq('status', 'published')
        .ilike('category', 'problems')
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const translated = data ? (applyTranslations([data], lang) as any[])[0] : null;

      return NextResponse.json(
        { section: 'problems', item: translated },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
          },
        }
      );
    }

    // 3. SECTION: Voices of the Corridors
    if (section === 'voices') {
      const telemetry = await getTelemetrySettings(supabase);
      return NextResponse.json(
        {
          section: 'voices',
          items: telemetry.voices_of_corridors || [],
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
          },
        }
      );
    }

    // 4. SECTION: Agricultural & Commodity Mandi Telemetry
    if (section === 'mandi') {
      const telemetry = await getTelemetrySettings(supabase);
      return NextResponse.json(
        {
          section: 'mandi',
          items: (telemetry.mandi_commodities || []).slice(0, 4),
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
          },
        }
      );
    }

    // 5. SECTION: Territorial Corridors at a Glance
    if (section === 'corridors') {
      const telemetry = await getTelemetrySettings(supabase);
      return NextResponse.json(
        {
          section: 'corridors',
          items: telemetry.corridors_at_a_glance || [],
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
          },
        }
      );
    }

    return NextResponse.json({ error: `Unknown section: ${section}` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

