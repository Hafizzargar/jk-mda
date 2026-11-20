#!/usr/bin/env node

/**
 * 24/7 Autonomous News Scheduler Daemon (KJCPL Newsroom)
 * 
 * Runs continuously in the background independent of any browser session or user login.
 * Uses SUPABASE_SERVICE_ROLE_KEY to interact directly with the backend.
 * 
 * Usage:
 *   node scripts/news-scheduler-daemon.mjs
 * Or with PM2:
 *   pm2 start scripts/news-scheduler-daemon.mjs --name kjin-news-scheduler
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

// Attempt to load .env.local or .env if present
const envFiles = [
  path.resolve(process.cwd(), 'apps/admin/.env.local'),
  path.resolve(process.cwd(), 'apps/admin/.env'),
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.env'),
];

for (const envFile of envFiles) {
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const adminUrl = process.env.ADMIN_URL || process.env.NEXT_PUBLIC_ADMIN_URL || 'https://jk-mda-admin.vercel.app';
const cronSecret = process.env.CRON_SECRET || '';

console.log('----------------------------------------------------');
console.log(' 🚀 KJCPL Autonomous Newsroom Background Daemon');
console.log('----------------------------------------------------');
console.log(` Target Admin Host : ${adminUrl}`);
console.log(` Supabase URL      : ${supabaseUrl || '(not configured)'}`);
console.log(` Service Role Key  : ${serviceKey ? '✓ Configured' : '✗ Missing'}`);
console.log(` Cron Secret       : ${cronSecret ? '✓ Configured' : '○ Unset (public / header auth)'}`);
console.log('----------------------------------------------------');

let isRunning = false;

async function executeScanCycle() {
  if (isRunning) {
    console.log(`[${new Date().toLocaleTimeString()}] Previous scan cycle still in progress. Skipping duplicate tick.`);
    return;
  }

  isRunning = true;
  const startTime = Date.now();
  console.log(`\n[${new Date().toISOString()}] ⚡ Triggering scheduled autonomous news discovery...`);

  try {
    const endpoint = `${adminUrl.replace(/\/$/, '')}/api/cron/news-intelligence`;
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'KJCPL-Background-Daemon/1.0',
    };
    if (cronSecret) {
      headers['x-cron-secret'] = cronSecret;
      headers['Authorization'] = `Bearer ${cronSecret}`;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
    });

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success) {
      console.log(`[${new Date().toISOString()}] ✅ Scan cycle completed in ${elapsed}s:`);
      if (data.discovery) {
        console.log(`   - Beat: ${data.discovery.beatId || 'All'}`);
        console.log(`   - Discovered Today: ${data.discovery.dailyStats?.totalDiscoveredToday ?? 0}`);
        console.log(`   - Regional Share: ${data.discovery.dailyStats?.regionalSharePercent ?? 0}%`);
        if (data.discovery.articleId) {
          console.log(`   - 📰 New Draft Created: Article #${data.discovery.articleId}`);
        } else if (data.discovery.reason) {
          console.log(`   - ℹ️ Discovery note: ${data.discovery.reason}`);
        }
      }
    } else {
      console.warn(`[${new Date().toISOString()}] ⚠️ Server responded with HTTP ${res.status}:`, data?.error || res.statusText);
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ❌ Network error pinging newsroom endpoint:`, err.message);
  } finally {
    isRunning = false;
  }
}

// Fetch dynamic cadence from site_settings or fallback to 3 minutes
async function getIntervalMinutes() {
  if (!supabaseUrl || !serviceKey) return 3;
  try {
    const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data } = await sb.from('site_settings').select('value').eq('key', 'newsroom_auto_pilot').maybeSingle();
    const mins = Number(data?.value?.interval_minutes);
    return mins > 0 ? mins : 3;
  } catch {
    return 3;
  }
}

async function main() {
  const initialInterval = await getIntervalMinutes();
  console.log(`⚙️ Starting daemon with ${initialInterval}-minute cadence.`);
  
  // Run immediate first cycle
  await executeScanCycle();

  // Schedule recurring loop
  let currentMinutes = initialInterval;
  let timer = setInterval(async () => {
    // Check if cadence was updated in settings
    const freshMinutes = await getIntervalMinutes();
    if (freshMinutes !== currentMinutes) {
      console.log(`🔄 Cadence updated from ${currentMinutes}m to ${freshMinutes}m. Rescheduling daemon timer.`);
      currentMinutes = freshMinutes;
      clearInterval(timer);
      timer = setInterval(executeScanCycle, currentMinutes * 60 * 1000);
    }
    await executeScanCycle();
  }, currentMinutes * 60 * 1000);
}

main().catch((err) => {
  console.error('Fatal daemon crash:', err);
  process.exit(1);
});
