import 'server-only';

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { env } from '@kjin/config';
import { requiresMfa } from './mfa.ts';

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
  aal: string | null;
};

export async function authenticateEmployeeRequest(
  request: Request
): Promise<EmployeeAuthorization | Response> {
  const authorization = request.headers.get('authorization');
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    return Response.json({ error: 'Sign-in required.' }, { status: 401 });
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return Response.json({ error: 'Employee management is not configured on this server.' }, { status: 503 });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
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
  let aal: string | null = null;
  try {
    const tokenPayload = token.split('.')[1];
    const claims = JSON.parse(Buffer.from(tokenPayload, 'base64url').toString('utf8')) as { session_id?: string, aal?: string };
    sessionId = claims.session_id ?? null;
    aal = claims.aal ?? null;
  } catch {
    sessionId = null;
    aal = null;
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
      details: { method: request.method, path: new URL(request.url).pathname },
      ...auditContext,
    });
    return Response.json({ error: 'An active KJIN employee profile is required.' }, { status: 403 });
  }

  return { user: userData.user, profile, service, userClient, auditContext, aal };
}

export async function checkEmployeePermission(
  auth: EmployeeAuthorization,
  request: Request,
  permission: string
): Promise<Response | null> {
  const mfaRequired = requiresMfa(auth.profile.role_key);
  if (mfaRequired && auth.aal !== 'aal2') {
    await auth.service.from('audit_logs').insert({
      actor_profile_id: auth.user.id,
      action: 'employee.mfa_denied',
      target_type: 'api_operation',
      result: 'denied',
      reason: 'Multi-factor authentication is required.',
      details: { method: request.method, path: new URL(request.url).pathname },
      ...auth.auditContext,
    });
    return Response.json({ error: 'Multi-factor authentication is required.' }, { status: 403 });
  }

  const { data: hasPermission, error: rpcError } = await auth.userClient.rpc('has_permission', {
    p_permission_key: permission
  });

  if (rpcError || !hasPermission) {
    await auth.service.from('audit_logs').insert({
      actor_profile_id: auth.user.id,
      action: 'employee.permission_denied',
      target_type: 'api_operation',
      result: 'denied',
      reason: `Missing permission: ${permission}`,
      details: { permission, method: request.method, path: new URL(request.url).pathname },
      ...auth.auditContext,
    });
    return Response.json({ error: 'You do not have permission to perform this action.' }, { status: 403 });
  }
  return null;
}

export async function authorizeEmployeeRequest(
  request: Request,
  permission: string
): Promise<EmployeeAuthorization | Response> {
  const auth = await authenticateEmployeeRequest(request);
  if (auth instanceof Response) return auth;

  const permissionError = await checkEmployeePermission(auth, request, permission);
  if (permissionError) return permissionError;

  return auth;
}

export function isEmployeeAuthorization(
  result: EmployeeAuthorization | Response
): result is EmployeeAuthorization {
  return !(result instanceof Response);
}
