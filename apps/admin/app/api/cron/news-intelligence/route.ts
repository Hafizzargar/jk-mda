import { createClient } from '@supabase/supabase-js';
import { runAutonomousNewsDiscovery } from '@/lib/newsroom/autonomous-discovery';
import { runYouTubeHourlySync } from '@/lib/newsroom/youtube-monitor';

function verifyCronAuthorization(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  // If CRON_SECRET is not configured in environment, allow local/internal calls
  if (!cronSecret) return true;

  const authHeader = request.headers.get('Authorization');
  const cronHeader = request.headers.get('x-cron-secret');

  if (cronHeader === cronSecret) return true;
  if (authHeader && authHeader.replace(/^Bearer\s+/i, '').trim() === cronSecret) return true;

  return false;
}

export async function GET(request: Request) {
  return handleCronExecution(request);
}

export async function POST(request: Request) {
  return handleCronExecution(request);
}

async function handleCronExecution(request: Request) {
  try {
    if (!verifyCronAuthorization(request)) {
      return Response.json({ error: 'Unauthorized: Invalid cron secret.' }, { status: 401 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return Response.json({ error: 'Supabase credentials not configured in environment.' }, { status: 500 });
    }

    const service = createClient(url, key, { auth: { persistSession: false } });

    console.log('[RailwayScheduledWorker] Cron triggered: executing KJIN News Intelligence discovery cycle...');

    // 1. Autonomous Web Discovery (Google Search Grounding across beats, Chenab Valley prioritized)
    const discoveryResult = await runAutonomousNewsDiscovery(service);

    // 2. Broadcast Surveillance (YouTube public feeds & video search)
    const broadcastResult = await runYouTubeHourlySync(service, { autoPublish: false });

    return Response.json({
      success: true,
      timestamp: new Date().toISOString(),
      worker: 'Railway Scheduled Worker (60m cadence)',
      policy: '100% Pending Approval (Status: review)',
      discovery: discoveryResult,
      broadcastSurveillance: broadcastResult,
    });
  } catch (error: any) {
    console.error('[RailwayScheduledWorker] Cron execution failed:', error);
    return Response.json(
      {
        success: false,
        error: error.message || 'Cron execution failed.',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

