import { createClient } from '@supabase/supabase-js';
import { runYouTubeHourlySync } from './youtube-monitor';
import { runAutonomousNewsDiscovery, processPendingAutoPublishes, getCivicProblemsDailyStatus } from './autonomous-discovery';

let hasStarted = false;
let timerId: NodeJS.Timeout | null = null;

async function getSavedIntervalMinutes(service: any): Promise<{ intervalMinutes: number; enabled: boolean }> {
  try {
    const { data } = await service
      .from('site_settings')
      .select('value')
      .eq('key', 'newsroom_auto_pilot')
      .maybeSingle();

    if (data?.value) {
      const minutes = Number(data.value.interval_minutes);
      const enabled = data.value.auto_pilot_enabled !== false;
      if (!isNaN(minutes) && minutes > 0) {
        return { intervalMinutes: minutes, enabled };
      }
    }
  } catch (err) {
    // fallback
  }
  return { intervalMinutes: 30, enabled: true };
}

async function recordScanTimestamp(service: any, intervalMinutes: number) {
  try {
    const now = new Date();
    const nextScan = new Date(now.getTime() + intervalMinutes * 60 * 1000);
    const { data: existing } = await service
      .from('site_settings')
      .select('value')
      .eq('key', 'newsroom_auto_pilot')
      .maybeSingle();

    await service.from('site_settings').upsert({
      key: 'newsroom_auto_pilot',
      value: {
        ...(existing?.value || {}),
        last_scan_at: now.toISOString(),
        next_scan_at: nextScan.toISOString(),
        interval_minutes: intervalMinutes,
      },
      updated_at: now.toISOString(),
    });
  } catch (e) {
    console.warn('[AutoNewsWorker] Failed to record scan timestamp:', e);
  }
}

function scheduleNextRun(service: any, delayMs: number) {
  if (timerId) clearTimeout(timerId);

  timerId = setTimeout(async () => {
    try {
      const settings = await getSavedIntervalMinutes(service);
      if (settings.enabled) {
        console.log(`[AutoNewsWorker] Running autonomous news discovery & sync (interval: ${settings.intervalMinutes}m)...`);
        await recordScanTimestamp(service, settings.intervalMinutes);
        // 1. Run Grounded Google Search Discovery (deposits straight into Pending Approval)
        await runAutonomousNewsDiscovery(service).catch((err) =>
          console.error('[AutoNewsWorker] Autonomous news discovery error:', err)
        );
        // 2. Check if today's civic grievances slot is ready (max 2/day, 6h interval)
        const civicStatus = await getCivicProblemsDailyStatus(service).catch(() => null);
        if (civicStatus?.canDiscoverNow) {
          console.log(`[AutoNewsWorker] 🚨 Civic problem window open (today: ${civicStatus.currentToday}/2). Triggering ground report discovery...`);
          await runAutonomousNewsDiscovery(service, { topic: 'civic_problems' }).catch((err) =>
            console.error('[AutoNewsWorker] Civic problem discovery error:', err)
          );
        }
        // 3. Run Broadcast Surveillance (deposits into Pending Review)
        await runYouTubeHourlySync(service, { autoPublish: false }).catch((err) =>
          console.error('[AutoNewsWorker] Broadcast surveillance sync error:', err)
        );
        // 4. Process any pending auto-publishes whose 5-min grace window has completed
        await processPendingAutoPublishes(service).catch((err) =>
          console.error('[AutoNewsWorker] Auto-publish processor error:', err)
        );
      }
      const nextDelay = Math.max(60_000, settings.intervalMinutes * 60_000);
      scheduleNextRun(service, nextDelay);
    } catch (err) {
      console.error('[AutoNewsWorker] Periodic background worker error:', err);
      scheduleNextRun(service, 5 * 60_000);
    }
  }, delayMs);
}

export function initBackgroundNewsWorker() {
  if (hasStarted) return;
  hasStarted = true;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.log('[AutoNewsWorker] Background scheduler skipped (missing SUPABASE credentials).');
    return;
  }

  const service = createClient(url, key, { auth: { persistSession: false } });

  console.log('[AutoNewsWorker] Initialized autonomous news discovery & surveillance worker.');

  // Run initial discovery & sync shortly after boot (15 seconds)
  setTimeout(async () => {
    try {
      const settings = await getSavedIntervalMinutes(service);
      if (settings.enabled) {
        console.log(`[AutoNewsWorker] Running initial discovery & sync (interval: ${settings.intervalMinutes}m)...`);
        await recordScanTimestamp(service, settings.intervalMinutes);
        await runAutonomousNewsDiscovery(service).catch((err) =>
          console.error('[AutoNewsWorker] Initial news discovery error:', err)
        );
        const initCivic = await getCivicProblemsDailyStatus(service).catch(() => null);
        if (initCivic?.canDiscoverNow) {
          console.log(`[AutoNewsWorker] 🚨 Initial civic problem window open. Triggering ground report discovery...`);
          await runAutonomousNewsDiscovery(service, { topic: 'civic_problems' }).catch((err) =>
            console.error('[AutoNewsWorker] Initial civic discovery error:', err)
          );
        }
        await runYouTubeHourlySync(service, { autoPublish: false }).catch((err) =>
          console.error('[AutoNewsWorker] Initial broadcast sync error:', err)
        );
        await processPendingAutoPublishes(service).catch((err) =>
          console.error('[AutoNewsWorker] Initial auto-publish processor error:', err)
        );
      }
      const nextDelay = Math.max(60_000, settings.intervalMinutes * 60_000);
      scheduleNextRun(service, nextDelay);
    } catch (err) {
      console.error('[AutoNewsWorker] Initial background execution error:', err);
      scheduleNextRun(service, 5 * 60_000);
    }
  }, 15_000);
}
