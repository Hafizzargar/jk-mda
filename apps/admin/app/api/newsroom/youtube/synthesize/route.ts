import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';
import { synthesizeEnglishNewsDraft } from '@/lib/newsroom/ai-synthesizer';

export async function POST(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.review');
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    const body = await request.json();
    const { video_id, raw_title, raw_description, channel_name, region, category } = body;

    const { service } = auth;
    let title = raw_title;
    let description = raw_description;
    let channel = channel_name;
    let reg = region;
    let cat = category;
    let videoRecord: any = null;

    if (video_id) {
      const { data, error } = await service
        .from('youtube_videos')
        .select('*, youtube_sources(channel_name, country, region, category)')
        .eq('id', video_id)
        .single();

      if (error || !data) {
        return Response.json({ error: 'Video record not found.' }, { status: 404 });
      }

      videoRecord = data;
      title = data.title;
      description = data.description;
      channel = data.youtube_sources?.channel_name || 'Broadcaster';
      reg = data.youtube_sources?.region;
      cat = data.youtube_sources?.category || 'General';
    }

    if (!title) {
      return Response.json({ error: 'Title or video_id is required.' }, { status: 400 });
    }

    // Synthesize 100% English draft (translating foreign languages, generating headline, summary, script, clean image)
    const synthesized = await synthesizeEnglishNewsDraft({
      rawTitle: title,
      rawDescription: description || '',
      channelName: channel,
      region: reg,
      category: cat,
      transcript: videoRecord?.transcript_snippet || null,
    });

    // If video_id exists, persist the updated AI analysis and English draft to Supabase
    if (video_id && videoRecord) {
      await service
        .from('youtube_videos')
        .update({
          proposed_headline: synthesized.headline,
          proposed_summary: synthesized.summary,
          proposed_category: synthesized.category,
          ai_analysis: {
            headline: synthesized.headline,
            summary: synthesized.summary,
            category: synthesized.category,
            scope: synthesized.scope,
            district: synthesized.district,
            division: synthesized.division,
            articleBodyMarkdown: synthesized.body_markdown,
            featured_image_url: synthesized.featured_image_url,
          },
          processing_status: 'draft_proposed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', video_id);
    }

    return Response.json({
      success: true,
      draft: synthesized,
    });
  } catch (error: any) {
    console.error('Error synthesizing news draft:', error);
    return Response.json({ error: error.message || 'Failed to synthesize draft.' }, { status: 500 });
  }
}
