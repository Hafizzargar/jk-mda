import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';

export async function GET(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.review');
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    const { service } = auth;
    const url = new URL(request.url);

    const district = url.searchParams.get('district');
    const category = url.searchParams.get('category');
    const verificationStatus = url.searchParams.get('verification_status');
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('q');
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);

    let query = service
      .from('newsroom_events')
      .select(`
        *,
        official_responses:newsroom_official_responses(*),
        fact_checks:newsroom_fact_checks(*)
      `)
      .order('detected_at', { ascending: false })
      .limit(limit);

    if (district && district !== 'all') {
      query = query.eq('district_slug', district);
    }
    if (category && category !== 'all') {
      query = query.eq('event_category', category);
    }
    if (verificationStatus && verificationStatus !== 'all') {
      query = query.eq('verification_status', verificationStatus);
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (search && search.trim()) {
      query = query.ilike('headline', `%${search.trim()}%`);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error('Error querying newsroom events:', error);
      return Response.json({ error: 'Failed to query events.' }, { status: 500 });
    }

    return Response.json({ events: events || [] });
  } catch (err) {
    console.error('Unexpected error in newsroom events GET:', err);
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
    const { id, status, verification_status, editor_notes } = body;

    if (!id || typeof id !== 'string') {
      return Response.json({ error: 'Event ID is required.' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status && ['discovered', 'reviewed', 'draft_approved', 'drafted', 'dismissed'].includes(status)) {
      updates.status = status;
    }
    if (
      verification_status &&
      ['unverified_report', 'confirmed_event', 'official_announcement'].includes(verification_status)
    ) {
      updates.verification_status = verification_status;
    }
    if (typeof editor_notes === 'string') {
      updates.editor_notes = editor_notes.trim();
    }

    const { service } = auth;
    const { data, error } = await service
      .from('newsroom_events')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating newsroom event:', error);
      return Response.json({ error: 'Failed to update event.' }, { status: 500 });
    }

    return Response.json({ success: true, event: data });
  } catch (err) {
    console.error('Unexpected error in newsroom events PATCH:', err);
    return Response.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
