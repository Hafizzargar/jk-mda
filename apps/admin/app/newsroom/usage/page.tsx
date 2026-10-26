'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/Button';

interface UsageSummary {
  recentCalls: number;
  maxCallsPerWindow: number;
  windowMinutes: number;
  model: string;
  freeTierStatus: string;
}

export default function AiUsagePage() {
  const router = useRouter();
  const [usage, setUsage] = useState<UsageSummary>({
    recentCalls: 0,
    maxCallsPerWindow: 30,
    windowMinutes: 15,
    model: 'gemini-2.5-flash',
    freeTierStatus: 'Active & Protected',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsage();
  }, []);

  async function loadUsage() {
    try {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push('/login');
        return;
      }

      // Count usage in the last 24 hours
      const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('ai_usage_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', fifteenMinAgo);

      setUsage((prev) => ({
        ...prev,
        recentCalls: count || 0,
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const percentageUsed = Math.min(
    Math.round((usage.recentCalls / usage.maxCallsPerWindow) * 100),
    100
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">
              AI Quota &amp; Rate Limiter Monitor
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Guarantees token conservation, prevents quota exhaustion, and monitors Gemini API health.
          </p>
        </div>

        <Button
          href="/newsroom"
          variant="secondary"
          size="sm"
          icon={<span>📡</span>}
        >
          Back to Monitor
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Active Model */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Active Model
          </p>
          <p className="mt-2 text-lg font-black text-slate-900 dark:text-white">
            {usage.model}
          </p>
          <span className="mt-1 inline-block rounded bg-cyan-100 px-2 py-0.5 text-[10px] font-bold text-cyan-900 dark:bg-cyan-950 dark:text-cyan-200">
            Google AI Studio
          </span>
        </div>

        {/* Card 2: 15-Minute Window Usage */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Current Window Calls
          </p>
          <p className="mt-2 text-lg font-black text-slate-900 dark:text-white">
            {loading ? '...' : `${usage.recentCalls} / ${usage.maxCallsPerWindow}`}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Limit: max 30 drafts per 15 minutes
          </p>
        </div>

        {/* Card 3: Quota Utilization */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Quota Headroom
          </p>
          <p className="mt-2 text-lg font-black text-emerald-600">
            {100 - percentageUsed}% Free
          </p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-1.5 rounded-full bg-emerald-500"
              style={{ width: `${percentageUsed}%` }}
            />
          </div>
        </div>

        {/* Card 4: Protection Status */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Database Rate Limiter
          </p>
          <p className="mt-2 text-lg font-black text-emerald-600">
            🛡️ Enforced (RPC)
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Advisory locked per user ID
          </p>
        </div>
      </div>

      {/* Architecture & Safeguards Breakdown */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
          Cost &amp; Token Safeguards Enforced in KJIN
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
            <p className="font-extrabold text-slate-900 dark:text-white text-sm">
              1. Zero AI Tokens on Ingestion
            </p>
            <p className="mt-1 text-slate-600 dark:text-slate-400 leading-relaxed">
              Feed collection, official portal checks, district classification, and deduplication are executed strictly with ordinary TypeScript algorithms.
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
            <p className="font-extrabold text-slate-900 dark:text-white text-sm">
              2. Human Approval Gate
            </p>
            <p className="mt-1 text-slate-600 dark:text-slate-400 leading-relaxed">
              Gemini is only invoked when an authorized editor clicks &quot;Approve for Gemini Draft&quot;. No bots automatically burn tokens on trending noise.
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
            <p className="font-extrabold text-slate-900 dark:text-white text-sm">
              3. Server-Side Key Security
            </p>
            <p className="mt-1 text-slate-600 dark:text-slate-400 leading-relaxed">
              The Gemini API key is maintained exclusively in server environment variables (<code className="font-mono">GOOGLE_GENERATIVE_AI_API_KEY</code>) and never exposed to the client.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
