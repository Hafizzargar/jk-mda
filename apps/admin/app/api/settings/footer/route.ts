import { authenticateEmployeeRequest, isEmployeeAuthorization, requireRecentAuthentication } from '@/lib/employee-server';
import { DEFAULT_FOOTER_CONTACT, sanitizeContactSettings, type FooterContactSettings } from '@/lib/contact';

const ALLOWED_ROLES = ['owner', 'superadmin', 'admin'];

export async function GET(request: Request) {
  const authorization = await authenticateEmployeeRequest(request);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  const { data: settingRow, error } = await authorization.service
    .from('site_settings')
    .select('key, value, updated_at, updated_by')
    .eq('key', 'footer_contact')
    .maybeSingle();

  if (error) {
    return Response.json({ error: 'Failed to retrieve footer contact settings.' }, { status: 500 });
  }

  const rawValue = settingRow?.value as Partial<FooterContactSettings> | null;
  const footerContact = sanitizeContactSettings(rawValue || DEFAULT_FOOTER_CONTACT);

  return Response.json({
    footer_contact: footerContact,
    updated_at: settingRow?.updated_at || null,
    can_manage: ALLOWED_ROLES.includes(authorization.profile.role_key),
  });
}

export async function POST(request: Request) {
  const authorization = await authenticateEmployeeRequest(request);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  if (!ALLOWED_ROLES.includes(authorization.profile.role_key)) {
    return Response.json(
      { error: 'You do not have permission to modify footer contact settings.' },
      { status: 403 }
    );
  }

  const reauthError = await requireRecentAuthentication(authorization, request);
  if (reauthError) return reauthError;

  let body: Partial<FooterContactSettings> & { reason?: string };
  try {
    body = (await request.json()) as Partial<FooterContactSettings> & { reason?: string };
  } catch {
    return Response.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const sanitized = sanitizeContactSettings(body);
  const reason = body.reason?.trim() || 'Updated footer contact information via Admin Portal';

  const { error: updateError } = await authorization.service
    .from('site_settings')
    .upsert({
      key: 'footer_contact',
      value: sanitized,
      description: 'Public website footer contact info, bureau addresses, emails, and hotlines',
      updated_at: new Date().toISOString(),
      updated_by: authorization.user.id,
    });

  if (updateError) {
    console.error('[Footer Settings API] Failed to update site_settings:', updateError);
    return Response.json({ error: 'Database update failed.' }, { status: 500 });
  }

  // Cross-portal synchronization: synchronize contact emails across technical support, careers, and navbar tip submission
  try {
    const primaryContactEmail = sanitized.email_editorial || sanitized.email_grievance || 'h26412301@gmail.com';

    // 1. Sync developer_support support_email
    const { data: devSetting } = await authorization.service
      .from('site_settings')
      .select('value')
      .eq('key', 'developer_support')
      .maybeSingle();

    if (devSetting?.value) {
      const devVal = devSetting.value as Record<string, unknown>;
      await authorization.service.from('site_settings').upsert({
        key: 'developer_support',
        value: {
          ...devVal,
          support_email: primaryContactEmail,
        },
        description: 'Developer Attribution and Technical Support Settings',
        updated_at: new Date().toISOString(),
        updated_by: authorization.user.id,
      });
    }

    // 2. Sync careers_settings contact_email
    const { data: careersSetting } = await authorization.service
      .from('site_settings')
      .select('value')
      .eq('key', 'careers_settings')
      .maybeSingle();

    if (careersSetting?.value) {
      const careersVal = careersSetting.value as Record<string, unknown>;
      await authorization.service.from('site_settings').upsert({
        key: 'careers_settings',
        value: {
          ...careersVal,
          contact_email: sanitized.email_careers || primaryContactEmail,
        },
        description: 'Careers portal configuration and job openings',
        updated_at: new Date().toISOString(),
        updated_by: authorization.user.id,
      });
    }

    // 3. Sync navbar_settings submit_tip_url
    const { data: navSetting } = await authorization.service
      .from('site_settings')
      .select('value')
      .eq('key', 'navbar_settings')
      .maybeSingle();

    if (navSetting?.value) {
      const navVal = navSetting.value as { actions?: Record<string, unknown> };
      await authorization.service.from('site_settings').upsert({
        key: 'navbar_settings',
        value: {
          ...navVal,
          actions: {
            ...(navVal.actions || {}),
            submit_tip_url: `mailto:${primaryContactEmail}?subject=News%20Tip%20Dispatch`,
          },
        },
        description: 'Header masthead navigation, brand, and actions configuration',
        updated_at: new Date().toISOString(),
        updated_by: authorization.user.id,
      });
    }
  } catch (syncErr) {
    console.warn('[Footer Settings API] Cross-portal email sync non-fatal warning:', syncErr);
  }

  await authorization.service.from('audit_logs').insert({
    actor_profile_id: authorization.user.id,
    action: 'site_settings.footer_contact_updated',
    target_type: 'site_settings',
    target_id: 'footer_contact',
    result: 'success',
    reason,
    details: {
      role_key: authorization.profile.role_key,
      organization_name: sanitized.organization_name,
      primary_address: sanitized.primary_address,
      phone_primary: sanitized.phone_primary,
      email_editorial: sanitized.email_editorial,
      editor_in_chief: sanitized.editor_in_chief,
    },
    ...authorization.auditContext,
  });

  return Response.json({
    success: true,
    message: 'Footer contact information updated successfully.',
    footer_contact: sanitized,
  });
}
