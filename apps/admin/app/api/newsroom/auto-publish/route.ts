import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';
import {
  getAutoPublishConfig,
  executeAutoPublishArticle,
  cancelArticleAutoPublish,
  processPendingAutoPublishes,
} from '@/lib/newsroom/autonomous-discovery';

export async function GET(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.review');
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    // Proactively process any pending auto-publishes that reached their scheduled time
    await processPendingAutoPublishes(auth.service).catch(() => null);

    const config = await getAutoPublishConfig(auth.service);

    return Response.json({
      success: true,
      enabled: config.enabled,
      delay_minutes: config.delayMinutes,
      scheduled_queue: config.queue,
    });
  } catch (err: any) {
    return Response.json(
      { success: false, error: err.message || 'Failed to load auto-publish status.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.review');
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    const body = await request.json();
    const action = String(body.action || '').trim();
    const articleId = body.article_id ? String(body.article_id).trim() : null;

    if (action === 'toggle') {
      const enabled = Boolean(body.enabled);
      const { service, profile } = auth;

      const { data: existing } = await service
        .from('site_settings')
        .select('value')
        .eq('key', 'newsroom_auto_pilot')
        .maybeSingle();

      const mergedValue = {
        ...(existing?.value || {}),
        auto_publish_enabled: enabled,
        auto_publish_delay_minutes:
          body.delay_minutes !== undefined ? Math.max(1, Number(body.delay_minutes) || 5) : existing?.value?.auto_publish_delay_minutes ?? 5,
      };

      const { error } = await service.from('site_settings').upsert({
        key: 'newsroom_auto_pilot',
        value: mergedValue,
        description: 'Newsroom YouTube Autonomous Surveillance Auto-Pilot schedule configuration, beat quotas and auto-publish',
        updated_at: new Date().toISOString(),
        updated_by: profile.id,
      });

      if (error) throw error;

      return Response.json({
        success: true,
        enabled,
        delay_minutes: mergedValue.auto_publish_delay_minutes,
      });
    }

    if (action === 'publish_now') {
      if (!articleId) {
        return Response.json({ success: false, error: 'article_id is required' }, { status: 400 });
      }

      const res = await executeAutoPublishArticle(auth.service, articleId, auth.profile.id);
      return Response.json(res);
    }

    if (action === 'cancel') {
      if (!articleId) {
        return Response.json({ success: false, error: 'article_id is required' }, { status: 400 });
      }

      await cancelArticleAutoPublish(auth.service, articleId);
      return Response.json({ success: true, articleId, cancelled: true });
    }

    if (action === 'process') {
      const res = await processPendingAutoPublishes(auth.service);
      return Response.json({ success: true, ...res });
    }

    return Response.json({ success: false, error: `Unsupported action: ${action}` }, { status: 400 });
  } catch (err: any) {
    return Response.json(
      { success: false, error: err.message || 'Auto-publish action failure.' },
      { status: 500 }
    );
  }
}
