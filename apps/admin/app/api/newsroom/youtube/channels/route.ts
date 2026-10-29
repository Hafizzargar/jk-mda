import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';
import { resolveChannelFromUrlOrHandle } from '@/lib/newsroom/youtube-monitor';

export async function GET(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.review');
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    const { service } = auth;

    // Fetch all channels with video counts
    const { data: channels, error } = await service
      .from('youtube_sources')
      .select('*, youtube_videos(count)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching youtube sources:', error);
      return Response.json({ error: 'Failed to retrieve YouTube sources.' }, { status: 500 });
    }

    const formatted = (channels || []).map((ch: any) => ({
      ...ch,
      video_count: ch.youtube_videos?.[0]?.count ?? 0,
    }));

    return Response.json({ channels: formatted });
  } catch (err) {
    console.error('Unexpected error in youtube channels GET:', err);
    return Response.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.review');
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    const userRole = auth.profile.role_key;
    if (!['owner', 'superadmin', 'admin'].includes(userRole)) {
      return Response.json(
        { error: 'Only owners, superadmins, and admins can register monitored channels.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { url, channel_name, country, region, language, category } = body;

    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      return Response.json({ error: 'A YouTube channel URL or handle (@name) is required.' }, { status: 400 });
    }

    // Resolve channel handle or URL into canonical Channel ID and name
    let resolved;
    try {
      resolved = await resolveChannelFromUrlOrHandle(url.trim());
    } catch (resolveErr: any) {
      return Response.json(
        { error: resolveErr.message || 'Could not resolve YouTube channel. Please check the URL.' },
        { status: 400 }
      );
    }

    const { service } = auth;

    const { data, error } = await service
      .from('youtube_sources')
      .insert({
        channel_name: (channel_name?.trim() || resolved.channelName).slice(0, 200),
        channel_url: resolved.channelUrl,
        channel_id: resolved.channelId,
        country: country?.trim() || 'India',
        region: region?.trim() || 'Jammu & Kashmir',
        language: language?.trim() || 'Hindi / Urdu / English',
        category: category?.trim() || 'General News',
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting youtube source:', error);
      if (error.code === '23505') {
        return Response.json({ error: 'This YouTube channel is already registered in the system.' }, { status: 409 });
      }
      return Response.json({ error: 'Database error saving channel.' }, { status: 500 });
    }

    return Response.json({ success: true, channel: data }, { status: 201 });
  } catch (err) {
    console.error('Unexpected error in youtube channels POST:', err);
    return Response.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.review');
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    const userRole = auth.profile.role_key;
    if (!['owner', 'superadmin', 'admin'].includes(userRole)) {
      return Response.json(
        { error: 'Only administrators can modify monitored channels.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, is_active, channel_name, category, region, language, country } = body;

    if (!id || typeof id !== 'string') {
      return Response.json({ error: 'Channel ID is required.' }, { status: 400 });
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (typeof is_active === 'boolean') updates.is_active = is_active;
    if (channel_name) updates.channel_name = channel_name.trim();
    if (category) updates.category = category.trim();
    if (region) updates.region = region.trim();
    if (language) updates.language = language.trim();
    if (country) updates.country = country.trim();

    const { service } = auth;
    const { data, error } = await service
      .from('youtube_sources')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating youtube source:', error);
      return Response.json({ error: 'Failed to update channel.' }, { status: 500 });
    }

    return Response.json({ success: true, channel: data });
  } catch (err) {
    console.error('Unexpected error in youtube channels PATCH:', err);
    return Response.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.review');
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    const userRole = auth.profile.role_key;
    if (!['owner', 'superadmin', 'admin'].includes(userRole)) {
      return Response.json(
        { error: 'Only administrators can delete monitored channels.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return Response.json({ error: 'Channel ID is required.' }, { status: 400 });
    }

    const { service } = auth;
    const { error } = await service.from('youtube_sources').delete().eq('id', id);

    if (error) {
      console.error('Error deleting youtube source:', error);
      return Response.json({ error: 'Failed to delete channel.' }, { status: 500 });
    }

    return Response.json({ success: true, message: 'Channel deleted successfully.' });
  } catch (err) {
    console.error('Unexpected error in youtube channels DELETE:', err);
    return Response.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
