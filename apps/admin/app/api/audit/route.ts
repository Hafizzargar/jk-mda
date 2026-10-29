import { authenticateEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';

export async function GET(request: Request) {
  try {
    const authorization = await authenticateEmployeeRequest(request);
    if (!isEmployeeAuthorization(authorization)) {
      return authorization;
    }

    // Strictly restrict access to owner and superadmin
    const userRole = authorization.profile.role_key;
    if (!['owner', 'superadmin'].includes(userRole)) {
      return Response.json(
        { error: 'Only owners and superadmins are authorized to access activity and audit records.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30', 10)));
    const offset = (page - 1) * limit;

    const action = searchParams.get('action') || 'all';
    const roleFilter = searchParams.get('role') || 'all';
    const resultFilter = searchParams.get('result') || 'all';
    const targetType = searchParams.get('target_type') || 'all';
    const search = searchParams.get('search')?.trim().toLowerCase() || '';
    const recentOnly = searchParams.get('recentOnly') === 'true';

    const { service } = authorization;

    // 1. Fetch all profiles for in-memory join and lookup
    const { data: profiles } = await service
      .from('profiles')
      .select('id, email, display_name, role_key, status');

    const profileMap = new Map<string, { id: string; email: string; display_name: string; role_key: string }>();
    if (profiles) {
      for (const p of profiles) {
        profileMap.set(p.id, {
          id: p.id,
          email: p.email || 'unknown@kcpjln.org',
          display_name: p.display_name || 'Staff Member',
          role_key: p.role_key || 'employee',
        });
      }
    }

    // 2. Build audit query
    let query = service
      .from('audit_logs')
      .select('*', { count: 'exact' });

    if (action !== 'all') {
      if (action === 'articles') {
        query = query.like('action', 'article.%');
      } else if (action === 'employees') {
        query = query.like('action', 'employee.%');
      } else if (action === 'security') {
        query = query.or('action.like.auth.%,action.like.employee.mfa_%,action.eq.article.delete_attempt_blocked');
      } else {
        query = query.eq('action', action);
      }
    }

    if (targetType !== 'all') {
      query = query.eq('target_type', targetType);
    }

    if (resultFilter !== 'all') {
      query = query.eq('result', resultFilter);
    }

    // If filtering by actor role, filter by profile IDs that match that role
    if (roleFilter !== 'all') {
      const matchingProfileIds = Array.from(profileMap.values())
        .filter((p) => p.role_key.toLowerCase() === roleFilter.toLowerCase())
        .map((p) => p.id);

      if (matchingProfileIds.length > 0) {
        query = query.in('actor_profile_id', matchingProfileIds);
      } else {
        return Response.json({
          logs: [],
          totalCount: 0,
          page,
          limit,
          stats: {
            totalActions: 0,
            editsToday: 0,
            deletionsCount: 0,
            blockedAttemptsCount: 0,
            authorEditorActions: 0,
          },
        });
      }
    }

    // Order by latest first
    query = query.order('created_at', { ascending: false });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: logsData, count, error } = await query;

    if (error) {
      console.error('Failed to fetch audit logs:', error);
      return Response.json({ error: 'Failed to retrieve audit records' }, { status: 500 });
    }

    // Attach actor information
    const enrichedLogs = (logsData || []).map((log) => {
      const actor = log.actor_profile_id ? profileMap.get(log.actor_profile_id) : null;
      return {
        ...log,
        actor: actor || {
          id: log.actor_profile_id || 'system',
          display_name: 'Automated System / Service',
          email: 'system@kcpjln.org',
          role_key: 'system',
        },
      };
    });

    // Client-side text search across enriched fields (title, reason, actor name, email) if requested
    let finalLogs = enrichedLogs;
    if (search) {
      finalLogs = enrichedLogs.filter((log) => {
        const title = (log.details?.title || '').toLowerCase();
        const slug = (log.details?.slug || '').toLowerCase();
        const reason = (log.reason || '').toLowerCase();
        const actorName = (log.actor?.display_name || '').toLowerCase();
        const actorEmail = (log.actor?.email || '').toLowerCase();
        const actionStr = (log.action || '').toLowerCase();

        return (
          title.includes(search) ||
          slug.includes(search) ||
          reason.includes(search) ||
          actorName.includes(search) ||
          actorEmail.includes(search) ||
          actionStr.includes(search)
        );
      });
    }

    // If recentOnly (for notification bell), return compact summary
    if (recentOnly) {
      return Response.json({
        logs: finalLogs.slice(0, 10),
        totalCount: count ?? finalLogs.length,
      });
    }

    // Compute key statistics for dashboard cards
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const [
      { count: totalActions },
      { count: editsToday },
      { count: deletionsCount },
      { count: blockedAttemptsCount },
    ] = await Promise.all([
      service.from('audit_logs').select('id', { count: 'exact', head: true }),
      service.from('audit_logs').select('id', { count: 'exact', head: true }).gte('created_at', todayIso),
      service.from('audit_logs').select('id', { count: 'exact', head: true }).eq('action', 'article.deleted'),
      service.from('audit_logs').select('id', { count: 'exact', head: true }).eq('action', 'article.delete_attempt_blocked'),
    ]);

    // Count author & editor actions
    const authorEditorIds = Array.from(profileMap.values())
      .filter((p) => ['author', 'editor'].includes(p.role_key.toLowerCase()))
      .map((p) => p.id);

    let authorEditorCount = 0;
    if (authorEditorIds.length > 0) {
      const { count: aeCount } = await service
        .from('audit_logs')
        .select('id', { count: 'exact', head: true })
        .in('actor_profile_id', authorEditorIds);
      authorEditorCount = aeCount || 0;
    }

    return Response.json({
      logs: finalLogs,
      totalCount: count ?? finalLogs.length,
      page,
      limit,
      stats: {
        totalActions: totalActions || 0,
        editsToday: editsToday || 0,
        deletionsCount: deletionsCount || 0,
        blockedAttemptsCount: blockedAttemptsCount || 0,
        authorEditorActions: authorEditorCount,
      },
    });
  } catch (err: unknown) {
    console.error('Audit API error:', err);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
