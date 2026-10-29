import { createClient } from '@supabase/supabase-js';
import { env } from '@kjin/config';
import { authorizeEmployeeRequest, isEmployeeAuthorization } from '@/lib/employee-server';
import { runYouTubeHourlySync } from '@/lib/newsroom/youtube-monitor';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecretHeader = request.headers.get('x-cron-secret');
    const expectedCronSecret = process.env.CRON_SECRET;

    let serviceClient;

    // Check if called via Railway / Cron secret
    if (expectedCronSecret && cronSecretHeader === expectedCronSecret) {
      const url = env.NEXT_PUBLIC_SUPABASE_URL;
      const key = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) {
        return Response.json({ error: 'Server configuration error.' }, { status: 500 });
      }
      serviceClient = createClient(url, key, {
        auth: { persistSession: false },
      });
    } else {
      // Otherwise verify staff session
      const auth = await authorizeEmployeeRequest(request, 'article.review');
      if (!isEmployeeAuthorization(auth)) {
        return auth;
      }
      serviceClient = auth.service;
    }

    const result = await runYouTubeHourlySync(serviceClient);
    return Response.json(result);
  } catch (err) {
    console.error('Error during YouTube sync route:', err);
    return Response.json(
      { error: err instanceof Error ? err.message : 'Sync execution failed.' },
      { status: 500 }
    );
  }
}
