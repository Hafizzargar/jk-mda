import { authenticateEmployeeRequest, isEmployeeAuthorization, requireRecentAuthentication } from '@/lib/employee-server';
import { AVAILABLE_TEMPLATES, type TemplateId } from '@/lib/templates';

const ALLOWED_ROLES = ['owner', 'superadmin'];

export async function GET(request: Request) {
  const authorization = await authenticateEmployeeRequest(request);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  // Query current active template from site_settings
  const { data: settingRow, error } = await authorization.service
    .from('site_settings')
    .select('key, value, updated_at, updated_by')
    .eq('key', 'active_template')
    .maybeSingle();

  if (error) {
    return Response.json({ error: 'Failed to retrieve site settings.' }, { status: 500 });
  }

  const activeTemplate = (settingRow?.value as { template_id?: string; name?: string; activated_at?: string } | null) || {
    template_id: 'classic-editorial',
    name: 'Classic Editorial Broadsheet',
  };

  return Response.json({
    active_template: activeTemplate,
    available_templates: AVAILABLE_TEMPLATES,
    can_manage: ALLOWED_ROLES.includes(authorization.profile.role_key),
  });
}

export async function POST(request: Request) {
  const authorization = await authenticateEmployeeRequest(request);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  // Strict role check: Only owner and superadmin can change presentation templates
  if (!ALLOWED_ROLES.includes(authorization.profile.role_key)) {
    return Response.json(
      { error: 'Only Owner and Superadmin can control website presentation templates.' },
      { status: 403 }
    );
  }

  const reauthError = await requireRecentAuthentication(authorization, request);
  if (reauthError) return reauthError;

  let body: { template_id?: string; reason?: string };
  try {
    body = (await request.json()) as { template_id?: string; reason?: string };
  } catch {
    return Response.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const templateId = body.template_id as TemplateId | undefined;
  if (!templateId) {
    return Response.json({ error: 'template_id is required.' }, { status: 400 });
  }

  const matchedTemplate = AVAILABLE_TEMPLATES.find((t) => t.id === templateId);
  if (!matchedTemplate) {
    return Response.json(
      { error: `Invalid template_id. Allowed templates: ${AVAILABLE_TEMPLATES.map((t) => t.id).join(', ')}` },
      { status: 400 }
    );
  }

  const reason = body.reason?.trim() || `Activated ${matchedTemplate.name} via Admin Portal`;

  const newValue = {
    template_id: matchedTemplate.id,
    name: matchedTemplate.name,
    activated_at: new Date().toISOString(),
    activated_by: authorization.user.id,
    activated_by_role: authorization.profile.role_key,
  };

  // Upsert into site_settings
  const { error: updateError } = await authorization.service
    .from('site_settings')
    .upsert({
      key: 'active_template',
      value: newValue,
      description: 'Currently active public website presentation template',
      updated_at: new Date().toISOString(),
      updated_by: authorization.user.id,
    });

  if (updateError) {
    console.error('[Template API] Failed to update site_settings:', updateError);
    return Response.json({ error: 'Database update failed.' }, { status: 500 });
  }

  // Audit log
  await authorization.service.from('audit_logs').insert({
    actor_profile_id: authorization.user.id,
    action: 'site_settings.template_changed',
    target_type: 'site_settings',
    target_id: 'active_template',
    result: 'success',
    reason,
    details: {
      template_id: matchedTemplate.id,
      template_name: matchedTemplate.name,
      role_key: authorization.profile.role_key,
    },
    ...authorization.auditContext,
  });

  return Response.json({
    success: true,
    message: `Active website template changed to ${matchedTemplate.name}.`,
    active_template: newValue,
  });
}
