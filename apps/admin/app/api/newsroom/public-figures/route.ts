import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';

export async function GET(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.create');
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    const { service } = auth;
    const { data, error } = await service
      .from('site_settings')
      .select('value, updated_at')
      .eq('key', 'newsroom_public_figures')
      .maybeSingle();

    if (error) {
      console.error('[PublicFiguresAPI] Fetch error:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      figures: Array.isArray(data?.value) ? data.value : [],
      updatedAt: data?.updated_at || null,
    });
  } catch (err: any) {
    console.error('[PublicFiguresAPI] Unexpected error:', err);
    return Response.json({ error: err.message || 'Failed to fetch public figures.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authorizeEmployeeRequest(request, 'article.create');
    if (!isEmployeeAuthorization(auth)) {
      return auth;
    }

    const { service, user } = auth;
    const body = await request.json();
    const { figures } = body;

    if (!Array.isArray(figures)) {
      return Response.json({ error: 'Payload must contain a "figures" array.' }, { status: 400 });
    }

    const { error: upsertErr } = await service.from('site_settings').upsert({
      key: 'newsroom_public_figures',
      description: 'Registry of prominent regional public figures and leaders monitored by Gemini AI for statement-driven news drafting',
      value: figures,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    });

    if (upsertErr) {
      console.error('[PublicFiguresAPI] Save error:', upsertErr);
      return Response.json({ error: upsertErr.message }, { status: 500 });
    }

    return Response.json({ success: true, count: figures.length });
  } catch (err: any) {
    console.error('[PublicFiguresAPI] Unexpected error:', err);
    return Response.json({ error: err.message || 'Failed to save public figures.' }, { status: 500 });
  }
}
