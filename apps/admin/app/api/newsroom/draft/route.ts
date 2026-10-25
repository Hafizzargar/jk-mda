import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';
import { generateNewsroomDraft, generateSlug } from '@/lib/newsroom/gemini-drafter';

export async function POST(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.create');
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    const { user, service, userClient } = auth;
    const body = await request.json();
    const { eventId } = body;

    if (!eventId || typeof eventId !== 'string') {
      return Response.json({ error: 'Event ID is required.' }, { status: 400 });
    }

    // 1. Fetch the event and its matched official responses
    const { data: event, error: eventError } = await service
      .from('newsroom_events')
      .select(`
        *,
        official_responses:newsroom_official_responses(*)
      `)
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return Response.json({ error: 'Event not found.' }, { status: 404 });
    }

    // 2. Check AI Rate Limiter to prevent quota exhaustion
    const { data: isAllowed, error: rateLimitError } = await service.rpc('check_ai_rate_limit', {
      p_user_id: user.id,
      p_endpoint: 'newsroom_draft',
      p_max_requests: 30,
      p_window_interval: '15 minutes',
    });

    if (rateLimitError) {
      console.error('Rate limiter RPC error:', rateLimitError);
    } else if (isAllowed === false) {
      return Response.json(
        { error: 'AI drafting quota reached. Please wait a few minutes before drafting another story.' },
        { status: 429 }
      );
    }

    // 3. Prepare inputs for Gemini drafter
    const officialResponse = event.official_responses?.[0] || null;
    const sources = Array.isArray(event.original_sources) ? event.original_sources : [];

    const draftResult = await generateNewsroomDraft({
      headline: event.headline,
      summary: event.summary,
      districtName: event.location_name || event.district_slug,
      locationName: event.location_name,
      eventCategory: event.event_category,
      eventDate: event.event_date,
      sources,
      officialResponse,
    });

    const slug = generateSlug(draftResult.title);

    // 4. Save into public.articles via RPC create_article or fallback service insert as draft
    const primarySource = sources[0] || null;
    let createdArticleId: string | null = null;

    const { data: rpcData, error: rpcError } = await userClient.rpc('create_article', {
      p_title: draftResult.title,
      p_excerpt: draftResult.excerpt,
      p_content: draftResult.content,
      p_slug: slug,
      p_district: draftResult.suggestedDistrict || event.district_slug,
      p_category: draftResult.suggestedCategory || 'General',
      p_source_name: primarySource?.source_name || 'Regional Newsroom Monitor',
      p_source_url: primarySource?.url || null,
      p_featured_image_url: null,
    });

    if (!rpcError && rpcData) {
      createdArticleId = typeof rpcData === 'object' && rpcData !== null && 'id' in rpcData
        ? String((rpcData as { id: string }).id)
        : String(rpcData);
    } else {
      // Authoritative fallback via service client
      const { data: profileData } = await service
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle();

      const authorDisplayName = profileData?.display_name || user.email?.split('@')[0] || 'KJIN Newsroom';

      const { data: fallbackArticle, error: fallbackError } = await service
        .from('articles')
        .insert({
          title: draftResult.title,
          slug,
          content: draftResult.content,
          excerpt: draftResult.excerpt,
          category: draftResult.suggestedCategory || 'General',
          district: draftResult.suggestedDistrict || event.district_slug,
          source_name: primarySource?.source_name || 'Regional Newsroom Monitor',
          source_url: primarySource?.url || null,
          featured_image_url: null,
          status: 'draft',
          author_id: user.id,
          author_display_name: authorDisplayName,
        })
        .select('id')
        .single();

      if (fallbackError || !fallbackArticle) {
        console.error('Error creating draft article:', rpcError || fallbackError);
        return Response.json({ error: 'Failed to create article record.' }, { status: 500 });
      }

      createdArticleId = fallbackArticle.id;

      await service.from('article_versions').insert({
        article_id: createdArticleId,
        version_number: 1,
        title: draftResult.title,
        excerpt: draftResult.excerpt,
        content: draftResult.content,
        edited_by: user.id,
      });
    }

    // 5. Insert claims to verify into public.newsroom_fact_checks
    if (draftResult.claimsToVerify && draftResult.claimsToVerify.length > 0) {
      const claimsToInsert = draftResult.claimsToVerify.map((claim) => ({
        event_id: event.id,
        article_id: createdArticleId,
        claim,
        verification_status: 'unverified',
        source_reference_url: primarySource?.url || null,
        notes: draftResult.missingInformationWarning || null,
      }));

      await service.from('newsroom_fact_checks').insert(claimsToInsert);
    }

    // 6. Update event status to 'drafted'
    await service
      .from('newsroom_events')
      .update({
        status: 'drafted',
        article_id: createdArticleId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', event.id);

    return Response.json({
      success: true,
      articleId: createdArticleId,
      draft: draftResult,
    });
  } catch (err) {
    console.error('Unexpected error in newsroom draft POST:', err);
    return Response.json({ error: 'Internal server error during draft generation.' }, { status: 500 });
  }
}
