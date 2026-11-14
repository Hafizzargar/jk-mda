import { authenticateEmployeeRequest, isEmployeeAuthorization, requireRecentAuthentication } from '@/lib/employee-server';
import {
  getAllCelebrations,
  sanitizeCelebrationItem,
  type FestiveCelebrationItem,
} from '@/lib/festive';

const ALLOWED_ROLES = ['owner', 'superadmin', 'admin', 'editor'];

export async function GET(request: Request) {
  const authorization = await authenticateEmployeeRequest(request);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  const { items, active } = await getAllCelebrations(authorization.service);

  return Response.json({
    items,
    active,
    celebrations: active, // Backwards-compatible
    can_manage: ALLOWED_ROLES.includes(authorization.profile.role_key),
  });
}

export async function POST(request: Request) {
  const authorization = await authenticateEmployeeRequest(request);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  if (!ALLOWED_ROLES.includes(authorization.profile.role_key)) {
    return Response.json(
      { error: 'You do not have permission to modify festive celebration settings.' },
      { status: 403 }
    );
  }

  const reauthError = await requireRecentAuthentication(authorization, request);
  if (reauthError) return reauthError;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const { items: currentItems } = await getAllCelebrations(authorization.service);
  let updatedItems: FestiveCelebrationItem[] = [...currentItems];
  let auditAction = 'site_settings.festive_updated';
  let auditDetails: Record<string, unknown> = {};

  const action = typeof body.action === 'string' ? body.action : null;

  if (action === 'create') {
    const rawItem = (body.item || {}) as Partial<FestiveCelebrationItem>;
    const newItem = sanitizeCelebrationItem({
      ...rawItem,
      id: rawItem.id || `celebration-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    // Add to beginning of items list
    updatedItems = [newItem, ...updatedItems];
    auditAction = 'site_settings.festive_created';
    auditDetails = { id: newItem.id, occasion_name: newItem.occasion_name };
  } else if (action === 'update') {
    const rawItem = (body.item || {}) as Partial<FestiveCelebrationItem>;
    if (!rawItem.id) {
      return Response.json({ error: 'Item ID is required for update.' }, { status: 400 });
    }
    const sanitized = sanitizeCelebrationItem(rawItem, rawItem.id);
    const index = updatedItems.findIndex((i) => i.id === sanitized.id);
    if (index === -1) {
      updatedItems.unshift(sanitized);
    } else {
      updatedItems[index] = sanitized;
    }
    auditAction = 'site_settings.festive_updated';
    auditDetails = { id: sanitized.id, occasion_name: sanitized.occasion_name };
  } else if (action === 'delete') {
    const targetId = typeof body.id === 'string' ? body.id : null;
    if (!targetId) {
      return Response.json({ error: 'Item ID is required for delete.' }, { status: 400 });
    }
    updatedItems = updatedItems.filter((i) => i.id !== targetId);
    auditAction = 'site_settings.festive_deleted';
    auditDetails = { id: targetId };
  } else if (action === 'toggle') {
    const targetId = typeof body.id === 'string' ? body.id : null;
    if (!targetId) {
      return Response.json({ error: 'Item ID is required for toggle.' }, { status: 400 });
    }
    updatedItems = updatedItems.map((i) => {
      if (i.id === targetId) {
        return { ...i, enabled: !i.enabled, updated_at: new Date().toISOString() };
      }
      return i;
    });
    auditAction = 'site_settings.festive_toggled';
    auditDetails = { id: targetId };
  } else if (action === 'test') {
    // Set force_active_now on the targeted item, reset on others
    const targetId = typeof body.id === 'string' ? body.id : null;
    updatedItems = updatedItems.map((i) => {
      if (i.id === targetId) {
        const nextForced = !i.force_active_now;
        return { ...i, force_active_now: nextForced, enabled: true, updated_at: new Date().toISOString() };
      }
      return { ...i, force_active_now: false };
    });
    auditAction = 'site_settings.festive_test_triggered';
    auditDetails = { id: targetId };
  } else if (Array.isArray(body.items)) {
    // Bulk save of items array
    updatedItems = body.items.map((item, idx) => sanitizeCelebrationItem(item, `item-${idx}`));
    auditAction = 'site_settings.festive_bulk_updated';
    auditDetails = { count: updatedItems.length };
  } else if (typeof body.occasion_name === 'string') {
    // Legacy single item update
    const single = sanitizeCelebrationItem(body, 'diwali-legacy');
    const existingIndex = updatedItems.findIndex((i) => i.id === single.id || i.occasion_name === single.occasion_name);
    if (existingIndex >= 0) {
      updatedItems[existingIndex] = single;
    } else {
      updatedItems.unshift(single);
    }
    auditAction = 'site_settings.festive_updated';
    auditDetails = { id: single.id, occasion_name: single.occasion_name };
  } else {
    return Response.json({ error: 'Unsupported action or payload format.' }, { status: 400 });
  }

  const reason = (typeof body.reason === 'string' && body.reason.trim())
    ? body.reason.trim()
    : `Celebrations schedule updated (${auditAction})`;

  const { error: updateError } = await authorization.service
    .from('site_settings')
    .upsert({
      key: 'festive_celebration',
      value: { items: updatedItems },
      description: 'Festive celebration overlay, firelight particle effects, and cultural greetings roster',
      updated_at: new Date().toISOString(),
      updated_by: authorization.user.id,
    });

  if (updateError) {
    console.error('[Celebrations API] Database update failed:', updateError);
    return Response.json({ error: 'Database update failed.' }, { status: 500 });
  }

  await authorization.service.from('audit_logs').insert({
    actor_profile_id: authorization.user.id,
    action: auditAction,
    target_type: 'site_settings',
    target_id: 'festive_celebration',
    result: 'success',
    reason,
    details: {
      role_key: authorization.profile.role_key,
      ...auditDetails,
    },
    ...authorization.auditContext,
  });

  return Response.json({
    success: true,
    message: 'Celebrations schedule updated and auto-synced successfully.',
    items: updatedItems,
  });
}
