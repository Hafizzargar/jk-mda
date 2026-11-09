import { authenticateEmployeeRequest, isEmployeeAuthorization, requireRecentAuthentication } from '@/lib/employee-server';
import { getHomepageLayout, sanitizeHomepageLayout, type HomepageLayoutConfig } from '@/lib/homepage-layout';

const EDIT_ROLES = ['owner', 'superadmin', 'admin', 'editor'];

export async function GET(request: Request) {
  const authorization = await authenticateEmployeeRequest(request);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  const layout = await getHomepageLayout(authorization.service);

  return Response.json({
    layout,
    can_manage: EDIT_ROLES.includes(authorization.profile.role_key),
  });
}

export async function POST(request: Request) {
  const authorization = await authenticateEmployeeRequest(request);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  if (!EDIT_ROLES.includes(authorization.profile.role_key)) {
    return Response.json(
      { error: 'You do not have permission to modify the homepage section layout.' },
      { status: 403 }
    );
  }

  const reauthError = await requireRecentAuthentication(authorization, request);
  if (reauthError) return reauthError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const sanitized: HomepageLayoutConfig = sanitizeHomepageLayout(body);
  sanitized.updated_at = new Date().toISOString();
  sanitized.updated_by = authorization.profile.id;

  const { error: upsertError } = await authorization.service
    .from('site_settings')
    .upsert(
      {
        key: 'homepage_layout',
        value: sanitized,
        description: 'Dynamic drag-and-drop section arrangement for the homepage broadsheet layout',
        updated_at: sanitized.updated_at,
        updated_by: authorization.profile.id,
      },
      { onConflict: 'key' }
    );

  if (upsertError) {
    console.error('Failed to save homepage_layout in database:', upsertError);
    return Response.json({ error: 'Failed to save homepage layout in database.' }, { status: 500 });
  }

  return Response.json({
    success: true,
    layout: sanitized,
    message: 'Homepage section layout published live successfully.',
  });
}

