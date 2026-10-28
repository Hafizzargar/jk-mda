import { authenticateEmployeeRequest, isEmployeeAuthorization, requireRecentAuthentication } from '@/lib/employee-server';
import { getCurationSettings, DEFAULT_CURATION_SETTINGS, type HomepageCurationSettings } from '@/lib/curation';

const EDIT_ROLES = ['owner', 'superadmin', 'admin', 'editor'];

export async function GET(request: Request) {
  const authorization = await authenticateEmployeeRequest(request);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  const [curation, { data: articles }] = await Promise.all([
    getCurationSettings(authorization.service),
    authorization.service
      .from('articles')
      .select('id, slug, title, category, district, published_at, view_count, author_display_name, featured_image_url')
      .eq('status', 'published')
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(80),
  ]);

  return Response.json({
    curation,
    articles: articles || [],
    can_manage: EDIT_ROLES.includes(authorization.profile.role_key),
  });
}

export async function POST(request: Request) {
  const authorization = await authenticateEmployeeRequest(request);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  if (!EDIT_ROLES.includes(authorization.profile.role_key)) {
    return Response.json(
      { error: 'You do not have permission to modify homepage curation layout.' },
      { status: 403 }
    );
  }

  const reauthError = await requireRecentAuthentication(authorization, request);
  if (reauthError) return reauthError;

  let body: Partial<HomepageCurationSettings> & { reason?: string };
  try {
    body = (await request.json()) as Partial<HomepageCurationSettings> & { reason?: string };
  } catch {
    return Response.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const current = await getCurationSettings(authorization.service);
  const updated: HomepageCurationSettings = {
    lead_hero_id: body.lead_hero_id !== undefined ? body.lead_hero_id : current.lead_hero_id,
    sub_lead_ids: Array.isArray(body.sub_lead_ids) ? body.sub_lead_ids.slice(0, 2) : current.sub_lead_ids,
    wire_ids: Array.isArray(body.wire_ids) ? body.wire_ids.slice(0, 5) : current.wire_ids,
    dossier_ids: Array.isArray(body.dossier_ids) ? body.dossier_ids.slice(0, 3) : current.dossier_ids,
    editorial_id: body.editorial_id !== undefined ? body.editorial_id : current.editorial_id,
    developing_headline: body.developing_headline !== undefined ? body.developing_headline : current.developing_headline,
    developing_is_active: body.developing_is_active !== undefined ? Boolean(body.developing_is_active) : current.developing_is_active,
    developing_article_id: body.developing_article_id !== undefined ? body.developing_article_id : current.developing_article_id,
    corridor_assignments: body.corridor_assignments !== undefined ? body.corridor_assignments : current.corridor_assignments,
    takeaways: Array.isArray(body.takeaways) ? body.takeaways : current.takeaways,
    last_curated_at: new Date().toISOString(),
    curated_by: authorization.user.id,
  };

  const reason = body.reason?.trim() || 'Curated homepage broadsheet layout via Visual Drag-and-Drop Curator';

  const { error: updateError } = await authorization.service
    .from('site_settings')
    .upsert({
      key: 'homepage_curation',
      value: updated,
      description: 'Curated editorial slots, lead hero, bureau wire, corridor dossiers, and op-ed layout',
      updated_at: new Date().toISOString(),
      updated_by: authorization.user.id,
    });

  if (updateError) {
    console.error('[Curation API] Failed to update site_settings:', updateError);
    return Response.json({ error: 'Database update failed.' }, { status: 500 });
  }

  await authorization.service.from('audit_logs').insert({
    actor_profile_id: authorization.user.id,
    action: 'site_settings.curation_updated',
    target_type: 'site_settings',
    target_id: 'homepage_curation',
    result: 'success',
    reason,
    details: {
      role_key: authorization.profile.role_key,
      lead_hero_id: updated.lead_hero_id,
      sub_lead_count: updated.sub_lead_ids.length,
      wire_count: updated.wire_ids.length,
      dossier_count: updated.dossier_ids.length,
      editorial_id: updated.editorial_id,
    },
    ...authorization.auditContext,
  });

  return Response.json({
    success: true,
    message: 'Homepage layout and slot curation published successfully.',
    curation: updated,
  });
}
