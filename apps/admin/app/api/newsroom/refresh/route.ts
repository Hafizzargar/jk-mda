import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';
import {
  collectRssFeed,
  collectOfficialPortal,
  collectApprovedYouTubeChannel,
  type CollectedItem,
} from '@/lib/newsroom/source-collector';
import { classifyDistrict, classifyEventCategory } from '@/lib/newsroom/district-classifier';
import { matchEventWithOfficialResponses } from '@/lib/newsroom/response-matcher';

export async function POST(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.review');
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    const { service } = auth;

    // 1. Fetch all active sources
    const { data: sources, error: sourcesError } = await service
      .from('newsroom_sources')
      .select('*')
      .eq('is_active', true);

    if (sourcesError || !sources) {
      console.error('Error reading active sources for refresh:', sourcesError);
      return Response.json({ error: 'Failed to retrieve active sources.' }, { status: 500 });
    }

    const reportingItems: CollectedItem[] = [];
    const officialNotices: CollectedItem[] = [];
    const failedOfficialSources: Array<{ name: string; error: string }> = [];

    // 2. Poll sources in bounded parallel batches
    for (const source of sources) {
      let result;
      if (source.source_type === 'rss') {
        result = await collectRssFeed(source.feed_url, source.name, source.authority, 10);
      } else if (source.source_type === 'youtube_channel') {
        result = await collectApprovedYouTubeChannel(
          source.youtube_channel_id || '',
          source.name,
          source.is_owner_approved
        );
      } else {
        result = await collectOfficialPortal(source.feed_url, source.name, source.authority);
      }

      const now = new Date().toISOString();

      if (result.success) {
        await service
          .from('newsroom_sources')
          .update({
            last_successful_check: now,
            collection_status: 'healthy',
            last_error: null,
            updated_at: now,
          })
          .eq('id', source.id);

        if (source.source_type === 'official_portal') {
          officialNotices.push(...result.items);
        } else {
          reportingItems.push(...result.items);
        }
      } else {
        await service
          .from('newsroom_sources')
          .update({
            collection_status: 'error',
            last_error: result.error || 'Failed to fetch',
            updated_at: now,
          })
          .eq('id', source.id);

        if (source.source_type === 'official_portal') {
          failedOfficialSources.push({
            name: source.name,
            error: result.error || 'Unreachable portal',
          });
        }
      }
    }

    // 3. Process candidate reports & deduplicate against existing events
    let newEventsCount = 0;
    let officialMatchesCount = 0;

    for (const item of reportingItems) {
      // Check if URL or exact headline is already recorded
      const { data: existing } = await service
        .from('newsroom_events')
        .select('id')
        .or(`headline.eq."${item.title.replace(/"/g, '\\"')}",original_sources.cs.[{"url":"${item.url}"}]`)
        .limit(1);

      if (existing && existing.length > 0) {
        continue; // Duplicate, skip
      }

      // Classify District & Category
      const combinedText = `${item.title} ${item.excerpt}`;
      const districtMatch = classifyDistrict(combinedText);
      const category = classifyEventCategory(combinedText);

      // Perform Official Response Matching
      const isFailed = failedOfficialSources.length > 0 && officialNotices.length === 0;
      const failureReason = failedOfficialSources.map((f) => `${f.name}: ${f.error}`).join('; ');

      const responseMatch = matchEventWithOfficialResponses(
        {
          headline: item.title,
          summary: item.excerpt,
          districtSlug: districtMatch?.districtSlug || null,
          division: districtMatch?.division || null,
          eventCategory: category,
          eventDate: item.publishedAt,
        },
        officialNotices,
        isFailed,
        failureReason
      );

      // Determine initial verification status
      const verificationStatus =
        responseMatch.matchStatus === 'confirmed_relevant'
          ? 'confirmed_event'
          : 'unverified_report';

      // Insert new event
      const { data: insertedEvent, error: eventInsertError } = await service
        .from('newsroom_events')
        .insert({
          headline: item.title,
          summary: item.excerpt || 'Initial report detected from newsroom monitor.',
          district_slug: districtMatch?.districtSlug || null,
          division: districtMatch?.division || 'National',
          location_name: districtMatch ? districtMatch.districtName : null,
          event_category: category,
          event_date: item.publishedAt,
          verification_status: verificationStatus,
          original_sources: [
            {
              source_name: item.sourceName,
              url: item.url,
              published_at: item.publishedAt,
              title: item.title,
              excerpt: item.excerpt,
            },
          ],
          uncertainty_flags:
            responseMatch.matchStatus === 'no_official_update'
              ? ['awaiting_official_confirmation']
              : [],
        })
        .select()
        .single();

      if (eventInsertError || !insertedEvent) {
        console.error('Error inserting candidate event:', eventInsertError);
        continue;
      }

      newEventsCount++;

      // Insert matched response record
      await service.from('newsroom_official_responses').insert({
        event_id: insertedEvent.id,
        authority_name: responseMatch.authorityName,
        document_title: responseMatch.documentTitle,
        document_url: responseMatch.documentUrl,
        published_at: responseMatch.publishedAt,
        response_type: responseMatch.responseType,
        match_status: responseMatch.matchStatus,
        match_explanation: responseMatch.matchExplanation,
        extracted_text_excerpt: responseMatch.extractedTextExcerpt,
      });

      if (responseMatch.matchStatus === 'confirmed_relevant') {
        officialMatchesCount++;
      }
    }

    return Response.json({
      success: true,
      sourcesChecked: sources.length,
      reportingItemsFetched: reportingItems.length,
      officialNoticesFetched: officialNotices.length,
      failedOfficialSourcesCount: failedOfficialSources.length,
      newEventsCount,
      officialMatchesCount,
    });
  } catch (err) {
    console.error('Unexpected error in newsroom refresh POST:', err);
    return Response.json({ error: 'Internal server error during refresh.' }, { status: 500 });
  }
}
