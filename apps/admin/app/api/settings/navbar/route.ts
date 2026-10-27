import { authenticateEmployeeRequest, isEmployeeAuthorization, requireRecentAuthentication } from '@/lib/employee-server';
import { DEFAULT_NAVBAR_SETTINGS, sanitizeNavbarSettings, type NavbarSettings } from '@/lib/navbar';

const ALLOWED_ROLES = ['owner', 'superadmin'];

export async function GET(request: Request) {
  const authorization = await authenticateEmployeeRequest(request);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  const { data: settingRow, error } = await authorization.service
    .from('site_settings')
    .select('key, value, updated_at, updated_by')
    .eq('key', 'navbar_settings')
    .maybeSingle();

  if (error) {
    return Response.json({ error: 'Failed to retrieve navbar settings.' }, { status: 500 });
  }

  const rawValue = settingRow?.value as Partial<NavbarSettings> | null;
  const navbarSettings = sanitizeNavbarSettings(rawValue || DEFAULT_NAVBAR_SETTINGS);

  return Response.json({
    navbar_settings: navbarSettings,
    updated_at: settingRow?.updated_at || null,
    can_manage: ALLOWED_ROLES.includes(authorization.profile.role_key),
  });
}

export async function POST(request: Request) {
  const authorization = await authenticateEmployeeRequest(request);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  if (!ALLOWED_ROLES.includes(authorization.profile.role_key)) {
    return Response.json(
      { error: 'You do not have permission to modify navbar and navigation settings.' },
      { status: 403 }
    );
  }

  const reauthError = await requireRecentAuthentication(authorization, request);
  if (reauthError) return reauthError;

  let body: Partial<NavbarSettings> & { reason?: string };
  try {
    body = (await request.json()) as Partial<NavbarSettings> & { reason?: string };
  } catch {
    return Response.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const sanitized = sanitizeNavbarSettings(body);
  const reason = body.reason?.trim() || 'Updated navbar and navigation configuration via Admin Portal';

  const { error: updateError } = await authorization.service
    .from('site_settings')
    .upsert({
      key: 'navbar_settings',
      value: sanitized,
      description: 'Public website navbar, brand identity, navigation categories, language switcher, and header tools',
      updated_at: new Date().toISOString(),
      updated_by: authorization.user.id,
    });

  if (updateError) {
    console.error('[Navbar Settings API] Failed to update site_settings:', updateError);
    return Response.json({ error: 'Database update failed.' }, { status: 500 });
  }

  // Synchronize nav_items into public.categories database table
  try {
    const activeNavSlugs: string[] = [];

    for (let index = 0; index < sanitized.nav_items.length; index++) {
      const item = sanitized.nav_items[index];
      const canonicalSlug =
        item.id === 'national' || item.slug === 'india'
          ? 'national'
          : (item.slug || item.id).toLowerCase().trim();

      activeNavSlugs.push(canonicalSlug);

      await authorization.service
        .from('categories')
        .upsert(
          {
            slug: canonicalSlug,
            name_en: item.label.trim(),
            is_active: Boolean(item.enabled),
            display_order: index + 1,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'slug' }
        );
    }

    // For any existing category in public.categories that was removed from navbar,
    // mark is_active = false so it no longer appears in new article category dropdowns
    const { data: existingCats } = await authorization.service
      .from('categories')
      .select('id, slug');

    if (existingCats && existingCats.length > 0) {
      for (const cat of existingCats) {
        if (!activeNavSlugs.includes(cat.slug.toLowerCase())) {
          await authorization.service
            .from('categories')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', cat.id);
        }
      }
    }
  } catch (catSyncErr) {
    console.warn('[Navbar Settings API] Category synchronization warning:', catSyncErr);
  }

  // Automatically keep footer organization name synchronized from unified brand config
  try {
    const { data: footerRow } = await authorization.service
      .from('site_settings')
      .select('value')
      .eq('key', 'footer_contact')
      .maybeSingle();

    const currentFooter = (footerRow?.value || {}) as Record<string, unknown>;
    const combinedOrgName = sanitized.brand.full_name
      ? `${sanitized.brand.name} (${sanitized.brand.full_name})`
      : sanitized.brand.name;

    await authorization.service
      .from('site_settings')
      .upsert({
        key: 'footer_contact',
        value: {
          ...currentFooter,
          organization_name: combinedOrgName,
        },
        description: 'Public website footer contact info, bureau addresses, emails, and hotlines',
        updated_at: new Date().toISOString(),
        updated_by: authorization.user.id,
      });
  } catch (syncErr) {
    console.warn('[Navbar Settings API] Footer contact sync warning:', syncErr);
  }

  await authorization.service.from('audit_logs').insert({
    actor_profile_id: authorization.user.id,
    action: 'site_settings.navbar_updated',
    target_type: 'site_settings',
    target_id: 'navbar_settings',
    result: 'success',
    reason,
    details: {
      role_key: authorization.profile.role_key,
      brand_name: sanitized.brand.name,
      show_logo_image: sanitized.brand.show_logo_image,
      enabled_categories: sanitized.nav_items.filter((i) => i.enabled).map((i) => i.id),
      languages_enabled: sanitized.languages.enabled,
      show_submit_tip: sanitized.actions.show_submit_tip,
    },
    ...authorization.auditContext,
  });

  return Response.json({
    success: true,
    message: 'Navbar and navigation settings updated successfully.',
    navbar_settings: sanitized,
  });
}
