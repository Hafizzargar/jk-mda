import 'server-only';

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'demo-anon-key';

type EmployeeProfile = {
  id: string;
  role_key: string;
  status: string;
};

type EmployeeAuthorization = {
  user: User;
  profile: EmployeeProfile;
  service: SupabaseClient;
  userClient: SupabaseClient;
  auditContext: {
    session_id: string | null;
    request_id: string | null;
    user_agent: string | null;
  };
};

export async function authorizeEmployeeRequest(
  request: Request,
  permission: string
): Promise<EmployeeAuthorization | Response> {
  const authorization = request.headers.get('authorization');
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!token) {
    return Response.json({ error: 'Sign-in required.' }, { status: 401 });
  }

  if (!serviceKey) {
    return Response.json({ error: 'Employee management is not configured on this server.' }, { status: 503 });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(token);

  if (userError || !userData.user) {
    return Response.json({ error: 'A valid staff session is required.' }, { status: 401 });
  }

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let sessionId: string | null = null;
  try {
    const tokenPayload = token.split('.')[1];
    const claims = JSON.parse(Buffer.from(tokenPayload, 'base64url').toString('utf8')) as { session_id?: string };
    sessionId = claims.session_id ?? null;
  } catch {
    sessionId = null;
  }
  const auditContext = {
    session_id: sessionId,
    request_id: request.headers.get('x-request-id'),
    user_agent: request.headers.get('user-agent'),
  };
  const { data: profile, error: profileError } = await service
    .from('profiles')
    .select('id, role_key, status')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileError || !profile || profile.status !== 'active') {
    await service.from('audit_logs').insert({
      actor_profile_id: userData.user.id,
      action: 'employee.access_denied',
      target_type: 'api_operation',
      result: 'denied',
      reason: 'An active employee profile is required.',
      details: { permission, method: request.method, path: new URL(request.url).pathname },
      ...auditContext,
    });
    return Response.json({ error: 'An active KJIN employee profile is required.' }, { status: 403 });
  }

  const { data: grant, error: grantError } = await service
    .from('role_permissions')
    .select('permission_key')
    .eq('role_key', profile.role_key)
    .eq('permission_key', permission)
    .maybeSingle();

  if (grantError || !grant) {
    await service.from('audit_logs').insert({
      actor_profile_id: userData.user.id,
      action: 'employee.permission_denied',
      target_type: 'api_operation',
      result: 'denied',
      reason: `Missing permission: ${permission}`,
      details: { permission, method: request.method, path: new URL(request.url).pathname },
      ...auditContext,
    });
    return Response.json({ error: 'You do not have permission to perform this action.' }, { status: 403 });
  }

  return { user: userData.user, profile, service, userClient, auditContext };
}

export function isEmployeeAuthorization(
  result: EmployeeAuthorization | Response
): result is EmployeeAuthorization {
  return !(result instanceof Response);
}
