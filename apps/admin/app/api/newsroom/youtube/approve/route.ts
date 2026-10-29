import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';
import { generateSlug } from '@/lib/newsroom/gemini-drafter';

export async function POST(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.review');
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    const body = await request.json();
    const { video_id, headline, summary, category, body_markdown, target_status = 'review' } = body;

    if (!video_id || typeof video_id !== 'string') {
      return Response.json({ error: 'Video record ID is required.' }, { status: 400 });
    }

    const { service, profile } = auth;

    // Fetch video record
    const { data: videoRecord, error: videoErr } = await service
      .from('youtube_videos')
      .select('*, youtube_sources(channel_name, country, region)')
      .eq('id', video_id)
      .single();

    if (videoErr || !videoRecord) {
      return Response.json({ error: 'Video record not found.' }, { status: 404 });
    }

    const finalTitle = (headline || videoRecord.proposed_headline || videoRecord.title).trim();
    const finalSummary = (summary || videoRecord.proposed_summary || videoRecord.description || '').trim().slice(0, 400);
    const finalCategory = (category || videoRecord.proposed_category || 'General News').trim();
    const finalContent = (body_markdown || videoRecord.ai_analysis?.articleBodyMarkdown || videoRecord.description || '').trim();
    const { data: profileRecord } = await service
      .from('profiles')
      .select('display_name')
      .eq('id', profile.id)
      .maybeSingle();

    const baseSlug = generateSlug(finalTitle);
    const finalSlug = `${baseSlug || 'youtube-news'}-${Date.now().toString(36).slice(-4)}`;

    const authorName = profileRecord?.display_name?.trim() || auth.user.email?.split('@')[0] || 'KJIN Newsroom';
    const sourceChannelName = videoRecord.youtube_sources?.channel_name || 'YouTube Broadcast';

    // Step 1: Create article in articles table as 'draft' (enforced by DB integrity trigger)
    const { data: newArticle, error: articleErr } = await service
      .from('articles')
      .insert({
        title: finalTitle.slice(0, 250),
        slug: finalSlug,
        excerpt: finalSummary,
        content: finalContent,
        category: finalCategory,
        status: 'draft',
        author_id: profile.id,
        author_display_name: authorName,
        source_name: sourceChannelName,
        source_url: videoRecord.video_url,
        featured_image_url: videoRecord.thumbnail_url || null,
      })
      .select()
      .single();

    if (articleErr || !newArticle) {
      console.error('Error creating article from YouTube draft:', articleErr);
      return Response.json({ error: articleErr?.message || 'Failed to create article record.' }, { status: 500 });
    }

    // Step 2: If target is review, transition status from 'draft' to 'review'
    if (target_status === 'review') {
      const { error: transitionErr } = await service
        .from('articles')
        .update({ status: 'review', updated_at: new Date().toISOString() })
        .eq('id', newArticle.id);

      if (transitionErr) {
        console.warn('Warning: Could not transition draft to review status:', transitionErr);
      }
    }

    // Step 3: Insert initial version into article_versions
    await service.from('article_versions').insert({
      article_id: newArticle.id,
      version_number: 1,
      title: finalTitle.slice(0, 250),
      excerpt: finalSummary,
      content: finalContent,
      edited_by: profile.id,
    });

    // Update video record status to approved and link article
    await service
      .from('youtube_videos')
      .update({
        processing_status: 'approved',
        article_id: newArticle.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', video_id);

    // Record audit log
    await service.from('audit_logs').insert({
      actor_profile_id: profile.id,
      action: 'article.created_from_youtube',
      target_type: 'article',
      target_id: newArticle.id,
      result: 'success',
      details: {
        youtube_video_id: videoRecord.video_id,
        channel_name: videoRecord.youtube_sources?.channel_name,
        target_status,
      },
    });

    return Response.json({
      success: true,
      message: `Article drafted successfully and sent to editorial review.`,
      article: newArticle,
    });
  } catch (err) {
    console.error('Error approving YouTube video draft:', err);
    return Response.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
