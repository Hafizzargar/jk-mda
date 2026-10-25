import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';
import { collectOfficialPortal, type CollectedItem } from '@/lib/newsroom/source-collector';
import { matchEventWithOfficialResponses } from '@/lib/newsroom/response-matcher';

export async function POST(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.review');
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    const { service } = auth;
    const body = await request.json();
    const { eventId } = body;

    if (!eventId || typeof eventId !== 'string') {
      return Response.json({ error: 'Event ID is required.' }, { status: 400 });
    }

    // 1. Fetch the event
    const { data: event, error: eventError } = await service
      .from('newsroom_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return Response.json({ error: 'Event not found.' }, { status: 404 });
    }

    // 2. Fetch relevant active official sources (filtered by district or state/national level)
    let sourcesQuery = service
      .from('newsroom_sources')
      .select('*')
      .eq('source_type', 'official_portal')
      .eq('is_active', true);

    if (event.district_slug) {
      sourcesQuery = sourcesQuery.or(`district_slug.eq.${event.district_slug},district_slug.is.null`);
    } else {
      sourcesQuery = sourcesQuery.is('district_slug', null);
    }

    const { data: sources } = await sourcesQuery;

    const officialNotices: CollectedItem[] = [];
    const failedSources: string[] = [];

    if (sources && sources.length > 0) {
      for (const src of sources) {
        const res = await collectOfficialPortal(src.feed_url, src.name, src.authority);
        if (res.success) {
          officialNotices.push(...res.items);
        } else {
          failedSources.push(`${src.name}: ${res.error}`);
        }
      }
    }

    const isSourceFailed = failedSources.length > 0 && officialNotices.length === 0;
    const failureReason = failedSources.join('; ');

    // 3. Match against official notices
    const matchResult = matchEventWithOfficialResponses(
      {
        headline: event.headline,
        summary: event.summary,
        districtSlug: event.district_slug,
        division: event.division,
        eventCategory: event.event_category,
        eventDate: event.event_date,
      },
      officialNotices,
      isSourceFailed,
      failureReason
    );

    // 4. Update or replace official response record
    await service.from('newsroom_official_responses').delete().eq('event_id', event.id);

    const { data: newResponse } = await service
      .from('newsroom_official_responses')
      .insert({
        event_id: event.id,
        authority_name: matchResult.authorityName,
        document_title: matchResult.documentTitle,
        document_url: matchResult.documentUrl,
        published_at: matchResult.publishedAt,
        response_type: matchResult.responseType,
        match_status: matchResult.matchStatus,
        match_explanation: matchResult.matchExplanation,
        extracted_text_excerpt: matchResult.extractedTextExcerpt,
        last_checked_at: new Date().toISOString(),
      })
      .select()
      .single();

    // 5. Update event verification status if confirmed
    if (matchResult.matchStatus === 'confirmed_relevant') {
      await service
        .from('newsroom_events')
        .update({
          verification_status: 'confirmed_event',
          updated_at: new Date().toISOString(),
        })
        .eq('id', event.id);
    }

    return Response.json({
      success: true,
      officialResponse: newResponse,
      matchResult,
    });
  } catch (err) {
    console.error('Unexpected error in newsroom recheck POST:', err);
    return Response.json({ error: 'Internal server error during recheck.' }, { status: 500 });
  }
}
