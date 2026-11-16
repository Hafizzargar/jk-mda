/**
 * Gemini Multi-Key Pool & Automatic Failover Engine
 * 
 * Supports:
 * - Load balancing across multiple Google AI Studio accounts / API keys.
 * - Automatic failover: if Key 1 hits HTTP 429 (quota or rate limit),
 *   it automatically marks Key 1 in temporary cooldown and seamlessly fails over to Key 2.
 * - Parses comma-separated keys (e.g. GEMINI_API_KEY="key1,key2")
 *   and individual env vars (GEMINI_API_KEY_1, GEMINI_API_KEY_2, etc.)
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';

export interface KeyHealth {
  key: string;
  masked: string;
  cooldownUntil: number; // timestamp ms
  failureCount: number;
  totalCalls: number;
}

let keyPool: KeyHealth[] = [];
let currentIndex = 0;

/**
 * Extracts and deduplicates all configured Gemini API keys
 */
export function getAvailableGeminiKeys(): string[] {
  const rawList: string[] = [];

  const addKeys = (val?: string) => {
    if (!val) return;
    const parts = val.split(/[,\s]+/).map((k) => k.trim()).filter(Boolean);
    rawList.push(...parts);
  };

  addKeys(process.env.GEMINI_API_KEY);
  addKeys(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
  addKeys(process.env.GEMINI_API_KEY_1);
  addKeys(process.env.GEMINI_API_KEY_2);
  addKeys(process.env.GEMINI_API_KEY_3);

  // Deduplicate while preserving order
  return Array.from(new Set(rawList));
}

function initKeyPool(): void {
  const keys = getAvailableGeminiKeys();
  if (keyPool.length === keys.length && keyPool.every((k, idx) => k.key === keys[idx])) {
    return;
  }

  keyPool = keys.map((key) => {
    const existing = keyPool.find((p) => p.key === key);
    return (
      existing || {
        key,
        masked: key.length > 8 ? `${key.slice(0, 6)}...${key.slice(-4)}` : '***',
        cooldownUntil: 0,
        failureCount: 0,
        totalCalls: 0,
      }
    );
  });
}

/**
 * Gets all keys currently healthy and ready for execution
 */
export function getHealthyKeys(): KeyHealth[] {
  initKeyPool();
  const now = Date.now();
  return keyPool.filter((k) => k.cooldownUntil <= now);
}

/**
 * Selects the next key using round-robin across healthy keys.
 * If all keys are in cooldown, falls back to the one with the earliest expiration.
 */
export function getNextGeminiKey(): string | null {
  initKeyPool();
  if (keyPool.length === 0) return null;

  const healthy = getHealthyKeys();
  if (healthy.length > 0) {
    const chosen = healthy[currentIndex % healthy.length];
    currentIndex = (currentIndex + 1) % healthy.length;
    chosen.totalCalls++;
    return chosen.key;
  }

  // All keys are in cooldown; select the one closest to recovery
  const sorted = [...keyPool].sort((a, b) => a.cooldownUntil - b.cooldownUntil);
  const earliest = sorted[0];
  earliest.totalCalls++;
  return earliest.key;
}

/**
 * Returns all keys in order of preference (healthy first, then cooling down)
 * for multi-key cascading fallback.
 */
export function getOrderedKeyCascade(): string[] {
  initKeyPool();
  const healthy = getHealthyKeys().map((k) => k.key);
  const cooling = keyPool
    .filter((k) => !healthy.includes(k.key))
    .sort((a, b) => a.cooldownUntil - b.cooldownUntil)
    .map((k) => k.key);
  return [...healthy, ...cooling];
}

/**
 * Marks a key as cooled down after encountering a 429 quota exhaustion or rate limit.
 */
export function markKeyCooldown(key: string, cooldownMinutes = 15): void {
  initKeyPool();
  const found = keyPool.find((k) => k.key === key);
  if (found) {
    found.cooldownUntil = Date.now() + cooldownMinutes * 60 * 1000;
    found.failureCount++;
    console.warn(
      `[GeminiKeyPool] ⚠️ Key ${found.masked} rate-limited. Pausing key for ${cooldownMinutes}m. Healthy keys remaining: ${getHealthyKeys().length}/${keyPool.length}`
    );
  }
}

/**
 * Marks a key as successful and clears any accumulated failure counts.
 */
export function markKeySuccess(key: string): void {
  initKeyPool();
  const found = keyPool.find((k) => k.key === key);
  if (found) {
    found.failureCount = 0;
  }
}

/**
 * Creates an AI SDK Google client configured with the specified key.
 */
export function getGoogleClient(apiKey?: string) {
  const selectedKey = apiKey || getNextGeminiKey() || undefined;
  return {
    google: createGoogleGenerativeAI({ apiKey: selectedKey }),
    apiKey: selectedKey,
  };
}
