import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';
import { validateSourceUrl } from '@/lib/newsroom/ssrf-guard';

export async function GET(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.review');
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    const { service } = auth;
    const { data: sources, error } = await service
      .from('newsroom_sources')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching newsroom sources:', error);
      return Response.json({ error: 'Failed to retrieve newsroom sources.' }, { status: 500 });
    }

    return Response.json({ sources: sources || [] });
  } catch (err) {
    console.error('Unexpected error in newsroom sources GET:', err);
    return Response.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.review');
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    const body = await request.json();
    const {
      name,
      authority,
      feed_url,
      source_type,
      division,
      district_slug,
      topics,
      collection_frequency_minutes,
      is_active,
      attribution_terms,
      youtube_channel_id,
      is_owner_approved,
    } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return Response.json({ error: 'Source name is required.' }, { status: 400 });
    }

    if (!authority || typeof authority !== 'string' || authority.trim().length === 0) {
      return Response.json({ error: 'Authority name is required.' }, { status: 400 });
    }

    // SSRF validation
    const ssrfCheck = validateSourceUrl(feed_url);
    if (!ssrfCheck.isValid) {
      return Response.json({ error: `Invalid source URL: ${ssrfCheck.error}` }, { status: 400 });
    }

    if (!['rss', 'official_portal', 'api', 'youtube_channel'].includes(source_type)) {
      return Response.json({ error: 'Invalid source_type.' }, { status: 400 });
    }

    // YouTube requires explicit owner approval check
    const isApprovedYoutube = source_type === 'youtube_channel' ? Boolean(is_owner_approved) : false;

    const { service } = auth;
    const { data, error } = await service
      .from('newsroom_sources')
      .insert({
        name: name.trim(),
        authority: authority.trim(),
        feed_url: ssrfCheck.normalizedUrl,
        source_type,
        division: division || null,
        district_slug: district_slug || null,
        topics: Array.isArray(topics) ? topics : [],
        collection_frequency_minutes: Number(collection_frequency_minutes) || 60,
        is_active: is_active ?? true,
        attribution_terms: attribution_terms?.trim() || null,
        youtube_channel_id: youtube_channel_id?.trim() || null,
        is_owner_approved: isApprovedYoutube,
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting newsroom source:', error);
      if (error.code === '23505') {
        return Response.json({ error: 'A source with this feed URL already exists.' }, { status: 409 });
      }
      return Response.json({ error: 'Database error saving newsroom source.' }, { status: 500 });
    }

    return Response.json({ success: true, source: data }, { status: 201 });
  } catch (err) {
    console.error('Unexpected error in newsroom sources POST:', err);
    return Response.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.review');
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    const body = await request.json();
    const { id, is_active, is_owner_approved, collection_frequency_minutes } = body;

    if (!id || typeof id !== 'string') {
      return Response.json({ error: 'Source ID is required.' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof is_active === 'boolean') {
      updates.is_active = is_active;
    }
    if (typeof is_owner_approved === 'boolean') {
      updates.is_owner_approved = is_owner_approved;
    }
    if (typeof collection_frequency_minutes === 'number') {
      updates.collection_frequency_minutes = collection_frequency_minutes;
    }

    const { service } = auth;
    const { data, error } = await service
      .from('newsroom_sources')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating newsroom source:', error);
      return Response.json({ error: 'Failed to update source.' }, { status: 500 });
    }

    return Response.json({ success: true, source: data });
  } catch (err) {
    console.error('Unexpected error in newsroom sources PATCH:', err);
    return Response.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.review');
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return Response.json({ error: 'Source ID query parameter is required.' }, { status: 400 });
    }

    const { service } = auth;
    const { error } = await service
      .from('newsroom_sources')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting newsroom source:', error);
      return Response.json({ error: 'Failed to delete source.' }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('Unexpected error in newsroom sources DELETE:', err);
    return Response.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
