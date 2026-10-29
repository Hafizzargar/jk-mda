/**
 * Railway Hourly Scheduled Worker for KJIN YouTube News Monitoring
 * Executes every 60 minutes (Cron: 0 * * * *).
 *
 * Command: node --env-file=../../.env.local --experimental-strip-types scripts/youtube-worker.mts
 * Or via pnpm: pnpm --filter @kjin/admin run worker:youtube
 */

import { createClient } from '@supabase/supabase-js';
import { runYouTubeHourlySync } from '../lib/newsroom/youtube-monitor.ts';

async function main() {
  const startTime = new Date();
  console.log(`[YouTube Worker] Starting hourly sync at ${startTime.toISOString()} (UTC)`);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('[YouTube Worker] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const result = await runYouTubeHourlySync(service);

    const durationSeconds = ((Date.now() - startTime.getTime()) / 1000).toFixed(2);
    console.log(`[YouTube Worker] Completed in ${durationSeconds}s:`, JSON.stringify(result, null, 2));

    if (result.errors && result.errors.length > 0) {
      console.warn(`[YouTube Worker] Finished with ${result.errors.length} channel warnings.`);
    }

    process.exit(0);
  } catch (err) {
    console.error('[YouTube Worker] Fatal worker execution error:', err);
    process.exit(1);
  }
}

main();
