import { authenticateEmployeeRequest, isEmployeeAuthorization, requireRecentAuthentication } from '@/lib/employee-server';
import { TRUSTED_CORRESPONDENTS, getCorrespondentForArticle, type CorrespondentConfig } from '@/lib/correspondents';

const ALLOWED_ROLES = ['owner', 'superadmin', 'admin', 'editor'];

export async function GET(request: Request) {
  const authorization = await authenticateEmployeeRequest(request);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  // 1. Fetch configured correspondents from site_settings or fallback
  const { data: settingRow } = await authorization.service
    .from('site_settings')
    .select('value, updated_at')
    .eq('key', 'author_settings')
    .maybeSingle();

  const correspondents: CorrespondentConfig[] = Array.isArray(settingRow?.value?.correspondents) && settingRow.value.correspondents.length > 0
    ? settingRow.value.correspondents
    : TRUSTED_CORRESPONDENTS;

  // 2. Query live author counts from articles table
  const { data: articles, error: artErr } = await authorization.service
    .from('articles')
    .select('district, category, title, author_display_name');

  const counts: Record<string, number> = {};
  let totalArticles = 0;

  if (!artErr && articles) {
    totalArticles = articles.length;
    for (const a of articles) {
      let name = a.author_display_name || 'Unattributed';
      if (name === 'Hafeez Zargar' || name === 'Hafiz Zargar' || name.includes('Zargar') || name.startsWith('KJIN')) {
        name = getCorrespondentForArticle(a);
      }
      counts[name] = (counts[name] || 0) + 1;
    }
  }

  return Response.json({
    correspondents,
    counts,
    totalArticles,
    can_manage: ['owner', 'superadmin', 'admin'].includes(authorization.profile.role_key),
  });
}

export async function POST(request: Request) {
  const authorization = await authenticateEmployeeRequest(request);
  if (!isEmployeeAuthorization(authorization)) return authorization;

  if (!ALLOWED_ROLES.includes(authorization.profile.role_key)) {
    return Response.json({ error: 'Permission denied.' }, { status: 403 });
  }

  let body: {
    action?: 'save_roster' | 'rebalance' | 'rename_author';
    correspondents?: CorrespondentConfig[];
    targetAuthor?: string;
    newAuthor?: string;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  // Action 1: Save correspondent roster
  if (body.action === 'save_roster' && Array.isArray(body.correspondents)) {
    const validRoster = body.correspondents.filter(c => c && typeof c.name === 'string' && c.name.trim().length > 0);
    const { error: upsertErr } = await authorization.service
      .from('site_settings')
      .upsert({
        key: 'author_settings',
        value: { correspondents: validRoster },
        description: 'Verified newsroom correspondents and author bylines roster',
        updated_at: new Date().toISOString(),
        updated_by: authorization.user.id,
      }, { onConflict: 'key' });

    if (upsertErr) {
      return Response.json({ error: 'Failed to update author roster.' }, { status: 500 });
    }

    return Response.json({ success: true, correspondents: validRoster });
  }

  // Action 2: Rename an author across all articles
  if (body.action === 'rename_author') {
    const target = body.targetAuthor?.trim();
    const replacement = body.newAuthor?.trim();

    if (!target || !replacement) {
      return Response.json({ error: 'targetAuthor and newAuthor are required.' }, { status: 400 });
    }

    const { data: updated, error: renameErr } = await authorization.service
      .from('articles')
      .update({ author_display_name: replacement })
      .eq('author_display_name', target)
      .select('id');

    if (renameErr) {
      return Response.json({ error: 'Failed to rename author.' }, { status: 500 });
    }

    return Response.json({
      success: true,
      message: `Renamed '${target}' to '${replacement}' on ${updated?.length || 0} articles.`,
      updatedCount: updated?.length || 0,
    });
  }

  // Action 3: Rebalance / distribute articles from "Hafeez Zargar" to regional correspondents
  if (body.action === 'rebalance') {
    const { data: articles, error: fetchErr } = await authorization.service
      .from('articles')
      .select('id, title, category, district, author_display_name');

    if (fetchErr || !articles) {
      return Response.json({ error: 'Failed to fetch articles for rebalancing.' }, { status: 500 });
    }

    let reassignedCount = 0;

    for (const art of articles) {
      // Reassign articles attributed to Hafeez Zargar or generic desks
      const currentAuthor = art.author_display_name || '';
      const isTarget = currentAuthor === 'Hafeez Zargar' || currentAuthor === 'Hafiz Zargar' || currentAuthor.includes('Zargar') || currentAuthor === 'Unattributed' || currentAuthor.startsWith('KJIN');

      if (!isTarget) continue;

      const assignedAuthor = getCorrespondentForArticle(art);

      await authorization.service
        .from('articles')
        .update({ author_display_name: assignedAuthor })
        .eq('id', art.id);

      reassignedCount++;
    }

    return Response.json({
      success: true,
      message: `Reassigned ${reassignedCount} articles across regional correspondents.`,
      reassignedCount,
    });
  }

  return Response.json({ error: 'Unknown action.' }, { status: 400 });
}
