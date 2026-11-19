/**
 * Gemini AI Circuit Breaker & Quota Protection Engine
 * 
 * Protects against quota exhaustion, 429 Too Many Requests, and resource exhaustion.
 * Enforces:
 * 1. Immediate circuit tripping on 429 / 503 quota exhaustion with 1-hour cooldown.
 * 2. State checkpointing in public.site_settings (key: 'gemini_circuit_breaker'):
 *    - Preserves pending_beat_id so discovery resumes seamlessly from the exact same beat.
 * 3. In-memory fast evaluation with database persistence.
 * 4. Automatic canary probing once cooldown expires:
 *    - If canary succeeds: circuit breaker auto-resets and normal flow resumes.
 *    - If canary fails with 429: circuit breaker extends cooldown by another 1 hour.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface GeminiCircuitBreakerState {
  is_paused: boolean;
  cooldown_until: string | null; // ISO 8601 timestamp
  failure_reason: string | null;
  pending_beat_id: string | null; // Exact beat ID to resume
  retry_count: number;
  last_failed_at: string | null;
  last_recovered_at: string | null;
}

export const DEFAULT_CIRCUIT_BREAKER_STATE: GeminiCircuitBreakerState = {
  is_paused: false,
  cooldown_until: null,
  failure_reason: null,
  pending_beat_id: null,
  retry_count: 0,
  last_failed_at: null,
  last_recovered_at: null,
};

// In-memory cache to prevent database hammering during high-frequency checks
let memoryState: GeminiCircuitBreakerState = { ...DEFAULT_CIRCUIT_BREAKER_STATE };
let lastStateFetchTime = 0;
const STATE_CACHE_TTL_MS = 10_000; // 10 seconds

/**
 * Retrieves the current circuit breaker state from database with in-memory caching.
 */
export async function getCircuitBreakerState(
  supabase?: SupabaseClient
): Promise<GeminiCircuitBreakerState> {
  const now = Date.now();
  if (now - lastStateFetchTime < STATE_CACHE_TTL_MS && memoryState.is_paused) {
    return memoryState;
  }

  if (!supabase) {
    return memoryState;
  }

  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'gemini_circuit_breaker')
      .maybeSingle();

    if (!error && data?.value && typeof data.value === 'object') {
      const val = data.value as Partial<GeminiCircuitBreakerState>;
      memoryState = {
        is_paused: Boolean(val.is_paused),
        cooldown_until: typeof val.cooldown_until === 'string' ? val.cooldown_until : null,
        failure_reason: typeof val.failure_reason === 'string' ? val.failure_reason : null,
        pending_beat_id: typeof val.pending_beat_id === 'string' ? val.pending_beat_id : null,
        retry_count: typeof val.retry_count === 'number' ? val.retry_count : 0,
        last_failed_at: typeof val.last_failed_at === 'string' ? val.last_failed_at : null,
        last_recovered_at: typeof val.last_recovered_at === 'string' ? val.last_recovered_at : null,
      };
      lastStateFetchTime = now;
      return memoryState;
    }
  } catch (err) {
    console.warn('[GeminiCircuitBreaker] Failed to read breaker state from DB, using fallback memory state:', err);
  }

  return memoryState;
}

/**
 * Checks whether Gemini is currently inside an active 1-hour cooldown.
 */
export async function isGeminiInCooldown(supabase?: SupabaseClient): Promise<{
  inCooldown: boolean;
  cooldownUntil: string | null;
  remainingMinutes: number;
  pendingBeatId: string | null;
  failureReason: string | null;
  retryCount: number;
}> {
  const state = await getCircuitBreakerState(supabase);

  if (!state.is_paused || !state.cooldown_until) {
    return {
      inCooldown: false,
      cooldownUntil: null,
      remainingMinutes: 0,
      pendingBeatId: state.pending_beat_id,
      failureReason: null,
      retryCount: state.retry_count,
    };
  }

  // Auto-heal if the breaker was tripped by legacy gemini-2.5-flash (which was capped at 20 requests/day)
  if (state.failure_reason && (state.failure_reason.includes('gemini-2.5-flash') || state.failure_reason.includes('limit: 20'))) {
    console.log('[GeminiCircuitBreaker] 🔄 Auto-resetting legacy gemini-2.5-flash quota lock to resume with gemini-2.0-flash (1,500 req/day).');
    if (supabase) {
      void resetCircuitBreaker(supabase);
    }
    return {
      inCooldown: false,
      cooldownUntil: null,
      remainingMinutes: 0,
      pendingBeatId: state.pending_beat_id,
      failureReason: null,
      retryCount: 0,
    };
  }

  const cooldownTime = new Date(state.cooldown_until).getTime();
  const now = Date.now();

  if (now < cooldownTime) {
    const remainingMs = cooldownTime - now;
    const remainingMinutes = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
    return {
      inCooldown: true,
      cooldownUntil: state.cooldown_until,
      remainingMinutes,
      pendingBeatId: state.pending_beat_id,
      failureReason: state.failure_reason,
      retryCount: state.retry_count,
    };
  }

  // Cooldown has expired! Ready for a canary probe to test if quota recovered.
  return {
    inCooldown: false,
    cooldownUntil: state.cooldown_until,
    remainingMinutes: 0,
    pendingBeatId: state.pending_beat_id,
    failureReason: state.failure_reason,
    retryCount: state.retry_count,
  };
}

/**
 * Trips the circuit breaker: pauses Gemini calls for 1 hour (or specified duration)
 * and preserves the pending beat ID so execution resumes from the exact same point.
 */
export async function tripCircuitBreaker(
  supabase: SupabaseClient,
  options?: {
    beatId?: string | null;
    reason?: string;
    cooldownHours?: number;
  }
): Promise<GeminiCircuitBreakerState> {
  const currentState = await getCircuitBreakerState(supabase);
  const cooldownHours = options?.cooldownHours ?? 1;
  const cooldownUntil = new Date(Date.now() + cooldownHours * 60 * 60 * 1000).toISOString();
  const pendingBeat = options?.beatId || currentState.pending_beat_id || null;
  const newRetryCount = (currentState.retry_count || 0) + 1;

  const newState: GeminiCircuitBreakerState = {
    is_paused: true,
    cooldown_until: cooldownUntil,
    failure_reason: options?.reason || 'HTTP 429 Quota Exhausted',
    pending_beat_id: pendingBeat,
    retry_count: newRetryCount,
    last_failed_at: new Date().toISOString(),
    last_recovered_at: currentState.last_recovered_at,
  };

  memoryState = { ...newState };
  lastStateFetchTime = Date.now();

  try {
    const { error } = await supabase.from('site_settings').upsert(
      {
        key: 'gemini_circuit_breaker',
        value: newState,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

    if (error) {
      console.error('[GeminiCircuitBreaker] Failed to save circuit breaker state to DB:', error.message);
    } else {
      console.warn(
        `[GeminiCircuitBreaker] ⚠️ Circuit breaker TRIPPED! Pausing Gemini calls for ${cooldownHours}h until ${cooldownUntil}. Preserving pending beat "${pendingBeat}" (Attempt ${newRetryCount}). Reason: ${newState.failure_reason}`
      );
    }
  } catch (err) {
    console.error('[GeminiCircuitBreaker] Exception updating breaker in DB:', err);
  }

  return newState;
}

/**
 * Resets the circuit breaker when Gemini successfully returns 200 OK.
 * Clears the pause state, resets retry count, and marks recovery time.
 */
export async function resetCircuitBreaker(supabase: SupabaseClient): Promise<void> {
  const currentState = await getCircuitBreakerState(supabase);
  if (!currentState.is_paused && !currentState.pending_beat_id && currentState.retry_count === 0) {
    return; // Already healthy
  }

  const newState: GeminiCircuitBreakerState = {
    is_paused: false,
    cooldown_until: null,
    failure_reason: null,
    pending_beat_id: null,
    retry_count: 0,
    last_failed_at: currentState.last_failed_at,
    last_recovered_at: new Date().toISOString(),
  };

  memoryState = { ...newState };
  lastStateFetchTime = Date.now();

  try {
    const { error } = await supabase.from('site_settings').upsert(
      {
        key: 'gemini_circuit_breaker',
        value: newState,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

    if (error) {
      console.warn('[GeminiCircuitBreaker] Failed to clear circuit breaker in DB:', error.message);
    } else {
      console.log('[GeminiCircuitBreaker] ✅ Quota recovered! Circuit breaker reset to healthy state. Resumed normal operations.');
    }
  } catch (err) {
    console.warn('[GeminiCircuitBreaker] Exception clearing breaker in DB:', err);
  }
}
