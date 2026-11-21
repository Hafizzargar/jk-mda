import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isGeminiInCooldown,
  tripCircuitBreaker,
  resetCircuitBreaker,
  getCircuitBreakerState,
  DEFAULT_CIRCUIT_BREAKER_STATE,
} from '../lib/newsroom/gemini-circuit-breaker.ts';
import { runAutonomousNewsDiscovery } from '../lib/newsroom/autonomous-discovery.ts';

function createMockSupabase(initialSetting: any = null) {
  let storedSetting = initialSetting;

  return {
    from: (table: string) => {
      if (table === 'site_settings') {
        return {
          select: () => ({
            eq: (_col: string, val: string) => ({
              maybeSingle: async () => ({
                data: storedSetting ? { key: val, value: storedSetting } : null,
                error: null,
              }),
            }),
          }),
          upsert: async (payload: { key: string; value: any }) => {
            storedSetting = payload.value;
            return { error: null };
          },
        };
      }
      if (table === 'articles') {
        return {
          select: () => ({
            gte: () => ({
              limit: async () => ({ data: [], error: null }),
            }),
            order: () => ({
              range: async () => ({ data: [], count: 0, error: null }),
            }),
          }),
        };
      }
      return {
        select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      };
    },
    _getStoredSetting: () => storedSetting,
  } as any;
}

describe('P0: Gemini AI Circuit Breaker & 1-Hour Cooldown Architecture', () => {
  it('initial state is healthy and not in cooldown', async () => {
    const mockSupabase = createMockSupabase();
    await resetCircuitBreaker(mockSupabase);

    const check = await isGeminiInCooldown(mockSupabase);
    assert.strictEqual(check.inCooldown, false, 'Should not be in cooldown initially');
    assert.strictEqual(check.remainingMinutes, 0, 'Remaining minutes should be 0');
    assert.strictEqual(check.pendingBeatId, null, 'No pending beat initially');
  });

  it('tripCircuitBreaker pauses Gemini for 1 hour and checkpoints the current beat', async () => {
    const mockSupabase = createMockSupabase();
    
    // Trip breaker with Chenab Valley beat
    const tripped = await tripCircuitBreaker(mockSupabase, {
      beatId: 'chenab_valley',
      reason: 'HTTP 429 Quota Exhausted',
      cooldownHours: 1,
    });

    assert.strictEqual(tripped.is_paused, true, 'is_paused must be true');
    assert.strictEqual(tripped.pending_beat_id, 'chenab_valley', 'Pending beat must be checkpointed as chenab_valley');
    assert.strictEqual(tripped.retry_count, 1, 'Retry count must be 1 on first trip');
    assert.ok(tripped.cooldown_until, 'cooldown_until must be populated');

    // Verify cooldown is recognized
    const check = await isGeminiInCooldown(mockSupabase);
    assert.strictEqual(check.inCooldown, true, 'Must report inCooldown: true');
    assert.strictEqual(check.pendingBeatId, 'chenab_valley', 'Pending beat must match checkpoint');
    assert.ok(check.remainingMinutes > 50 && check.remainingMinutes <= 60, 'Remaining minutes should be ~60 mins');
  });

  it('does not clear cooldown when the failure reason mentions the retired Gemini model', async () => {
    const mockSupabase = createMockSupabase();

    await tripCircuitBreaker(mockSupabase, {
      beatId: 'chenab_valley',
      reason: 'HTTP 429 on model gemini-2.5-flash (Key 3/3)',
      cooldownHours: 1,
    });

    const check = await isGeminiInCooldown(mockSupabase);
    assert.strictEqual(check.inCooldown, true);
    assert.strictEqual(check.pendingBeatId, 'chenab_valley');
    await resetCircuitBreaker(mockSupabase);
  });

  it('subsequent trips increment retry count and advance cooldown by another 1 hour', async () => {
    const mockSupabase = createMockSupabase();

    await tripCircuitBreaker(mockSupabase, {
      beatId: 'chenab_valley',
      reason: 'HTTP 429 Quota Exhausted',
      cooldownHours: 1,
    });

    // Second consecutive failure on same beat
    const trippedAgain = await tripCircuitBreaker(mockSupabase, {
      beatId: 'chenab_valley',
      reason: 'HTTP 429 Quota Still Exhausted',
      cooldownHours: 1,
    });

    assert.strictEqual(trippedAgain.is_paused, true);
    assert.strictEqual(trippedAgain.retry_count, 2, 'Retry count must increment to 2');
    assert.strictEqual(trippedAgain.pending_beat_id, 'chenab_valley', 'Checkpoint beat must be preserved');
  });

  it('resets cleanly to healthy state when quota recovers', async () => {
    const mockSupabase = createMockSupabase();

    await resetCircuitBreaker(mockSupabase);

    const check = await isGeminiInCooldown(mockSupabase);
    assert.strictEqual(check.inCooldown, false);
    assert.strictEqual(check.pendingBeatId, null);
    assert.strictEqual(check.retryCount, 0);

    const state = await getCircuitBreakerState(mockSupabase);
    assert.strictEqual(state.is_paused, false);
    assert.ok(state.last_recovered_at, 'Recovery timestamp must be recorded');
  });

  it('runAutonomousNewsDiscovery skips API execution when circuit breaker is in cooldown', async () => {
    const mockSupabase = createMockSupabase();

    // Trip circuit breaker
    await tripCircuitBreaker(mockSupabase, {
      beatId: 'chenab_valley',
      reason: 'HTTP 429: Daily Quota Exhausted',
      cooldownHours: 1,
    });

    // Run discovery
    const result = await runAutonomousNewsDiscovery(mockSupabase);

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.skipped, true);
    assert.strictEqual(result.inCooldown, true);
    assert.strictEqual(result.beat, 'chenab_valley', 'Must return the checkpointed beat for transparency');
    assert.ok(result.reason?.includes('cooldown active'), 'Reason must explain cooldown');
  });

  it('once quota recovers, it resumes seamlessly from the exact same checkpointed beat', async () => {
    const mockSupabase = createMockSupabase();

    // 1. Trip breaker on 'pir_panjal' beat
    await tripCircuitBreaker(mockSupabase, {
      beatId: 'pir_panjal',
      reason: 'HTTP 429: Quota Exceeded',
      cooldownHours: 1,
    });

    // 2. Simulate cooldown period expiring (cooldown_until moved to the past)
    const expiredState = await getCircuitBreakerState(mockSupabase);
    expiredState.cooldown_until = new Date(Date.now() - 1000).toISOString();
    await mockSupabase.from('site_settings').upsert({
      key: 'gemini_circuit_breaker',
      value: expiredState,
    });

    // 3. Verify cooldown is no longer blocking, but pendingBeatId remains 'pir_panjal'
    const status = await isGeminiInCooldown(mockSupabase);
    assert.strictEqual(status.inCooldown, false, 'Cooldown should be expired');
    assert.strictEqual(status.pendingBeatId, 'pir_panjal', 'Checkpoint beat must be retained for resumption');

    // 4. Reset breaker when recovery succeeds
    await resetCircuitBreaker(mockSupabase);
    const recovered = await isGeminiInCooldown(mockSupabase);
    assert.strictEqual(recovered.inCooldown, false);
    assert.strictEqual(recovered.pendingBeatId, null, 'Pending beat cleared after successful recovery');
  });
});
