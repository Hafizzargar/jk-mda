import { authenticateEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';

export async function GET(request: Request) {
  try {
    const auth = await authenticateEmployeeRequest(request);
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    const { user, profile, userClient, service, aal } = auth;

    // Fetch full profile info
    const { data: profileData, error: profileError } = await service
      .from('profiles')
      .select('id, email, display_name, role_key, role, status, phone, created_at, updated_at')
      .eq('id', user.id)
      .single();

    if (profileError || !profileData) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Count authored articles
    const { count: articlesCount } = await service
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', user.id);

    return Response.json({
      profile: {
        ...profileData,
        aal: aal || 'aal1',
        articles_count: articlesCount || 0,
        last_sign_in: user.last_sign_in_at,
      },
    });
  } catch (err: unknown) {
    console.error('Error in GET /api/profile:', err);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await authenticateEmployeeRequest(request);
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    const { userClient } = auth;
    const body = await request.json();

    const displayName = typeof body?.display_name === 'string' ? body.display_name.trim() : '';
    const updateArticles = body?.update_articles !== false; // defaults to true

    if (!displayName || displayName.length > 120) {
      return Response.json({ error: 'Display name must be between 1 and 120 characters.' }, { status: 400 });
    }

    const { data, error } = await userClient.rpc('update_my_profile', {
      p_display_name: displayName,
      p_update_articles: updateArticles,
    });

    if (error) {
      console.error('update_my_profile RPC failed:', error);
      return Response.json({ error: error.message || 'Unable to update profile' }, { status: 500 });
    }

    return Response.json({
      success: true,
      profile: data,
      message: 'Author profile and articles updated successfully.',
    });
  } catch (err: unknown) {
    console.error('Error in PATCH /api/profile:', err);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
