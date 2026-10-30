import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';
import { generateSlug } from '@/lib/newsroom/gemini-drafter';
import { getCanonicalCategory } from '@/lib/taxonomy-options';

export async function POST(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.review');
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    const body = await request.json();
    const {
      video_id,
      headline,
      summary,
      category,
      body_markdown,
      featured_image_url,
      scope,
      district,
      target_status = 'review'
    } = body;

    if (!video_id || typeof video_id !== 'string') {
      return Response.json({ error: 'Video record ID is required.' }, { status: 400 });
    }

    const { service, profile } = auth;

    // Fetch video record
    const { data: videoRecord, error: videoErr } = await service
      .from('youtube_videos')
      .select('*, youtube_sources(channel_name, country, region, category)')
      .eq('id', video_id)
      .single();

    if (videoErr || !videoRecord) {
      return Response.json({ error: 'Video record not found.' }, { status: 404 });
    }

    const finalTitle = (headline || videoRecord.proposed_headline || videoRecord.title)
      .replace(/#[a-zA-Z0-9_\u0900-\u097F]+/g, '')
      .trim();
    const finalSummary = (summary || videoRecord.proposed_summary || videoRecord.description || '')
      .replace(/#[a-zA-Z0-9_\u0900-\u097F]+/g, '')
      .trim()
      .slice(0, 400);

    // Determine 2-way distribution: Scope (Tier 1) + Topic (Tier 2) + District
    const effectiveScope = scope || videoRecord.ai_analysis?.scope || 'National';
    const isLocalScope = effectiveScope.includes('Local') || effectiveScope.includes('State') || effectiveScope.includes('Jammu') || effectiveScope.includes('Chenab');

    let canonicalCat: { name: string; slug: string };
    if (!isLocalScope && (effectiveScope === 'International' || category === 'International')) {
      canonicalCat = { name: 'International', slug: 'international' };
    } else if (!isLocalScope && (effectiveScope === 'National' || category === 'National')) {
      canonicalCat = { name: 'National', slug: 'national' };
    } else {
      canonicalCat = getCanonicalCategory(category || videoRecord.proposed_category, 'Local News (J&K)');
    }
    const finalCategory = canonicalCat.name;

    // Resolve category_id from public.categories
    const { data: catRecord } = await service
      .from('categories')
      .select('id')
      .eq('slug', canonicalCat.slug)
      .maybeSingle();

    const rawContent = (body_markdown || videoRecord.ai_analysis?.articleBodyMarkdown || videoRecord.description || '').trim();

    // Ensure 100% link-free and hashtag-free article script
    const linkFreeContent = rawContent
      .replace(/#[a-zA-Z0-9_\u0900-\u097F]+/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/https?:\/\/[^\s]+/g, '')
      .trim();

    // Priority for featured image: explicit choice > AI editorial image > video thumbnail
    const finalImageUrl =
      featured_image_url ||
      videoRecord.ai_analysis?.featured_image_url ||
      videoRecord.thumbnail_url ||
      null;

    const { data: profileRecord } = await service
      .from('profiles')
      .select('display_name')
      .eq('id', profile.id)
      .maybeSingle();

    const baseSlug = generateSlug(finalTitle);
    const finalSlug = `${baseSlug || 'news-report'}-${Date.now().toString(36).slice(-4)}`;

    const authorName = profileRecord?.display_name?.trim() || auth.user.email?.split('@')[0] || 'KJIN Newsroom';
    const sourceChannelName = videoRecord.youtube_sources?.channel_name || 'Broadcast Surveillance';
    const finalDistrict = isLocalScope ? (district || videoRecord.ai_analysis?.district || null) : null;

    // Step 1: Create article in articles table as 'draft' (enforced by DB integrity trigger)
    const { data: newArticle, error: articleErr } = await service
      .from('articles')
      .insert({
        title: finalTitle.slice(0, 250),
        slug: finalSlug,
        excerpt: finalSummary,
        content: linkFreeContent,
        category: finalCategory,
        category_id: catRecord?.id || null,
        district: finalDistrict,
        status: 'draft',
        author_id: profile.id,
        author_display_name: authorName,
        source_name: sourceChannelName,
        source_url: videoRecord.video_url,
        featured_image_url: finalImageUrl,
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
      content: linkFreeContent,
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
