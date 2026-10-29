import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';

export async function GET(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.review');
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const sourceId = searchParams.get('source_id');
    const limit = Math.min(Number(searchParams.get('limit')) || 30, 100);

    const { service } = auth;

    let query = service
      .from('youtube_videos')
      .select('*, youtube_sources(channel_name, country, region, language, category)')
      .order('published_at', { ascending: false })
      .limit(limit);

    if (status && status !== 'all') {
      query = query.eq('processing_status', status);
    }

    if (sourceId) {
      query = query.eq('source_id', sourceId);
    }

    const { data: videos, error } = await query;

    if (error) {
      console.error('Error fetching youtube videos:', error);
      return Response.json({ error: 'Failed to retrieve YouTube videos.' }, { status: 500 });
    }

    return Response.json({ videos: videos || [] });
  } catch (err) {
    console.error('Unexpected error in youtube videos GET:', err);
    return Response.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
