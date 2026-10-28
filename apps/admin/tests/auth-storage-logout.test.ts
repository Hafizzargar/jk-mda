import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearAuthStorage, PRESERVED_STORAGE_KEYS, isAuthStorageKey } from '../lib/auth-storage.ts';
import { POST as logoutPost } from '../app/api/auth/logout/route.ts';
import { GET as notifyLoginGet } from '../app/api/auth/notify-login/route.ts';
import { NextRequest } from 'next/server';

test('auth-storage: isAuthStorageKey identifies auth tokens and protects user preferences', () => {
  // Must preserve preferences
  assert.equal(isAuthStorageKey('kjin_admin_theme'), false);
  assert.equal(isAuthStorageKey('kjin_admin_sidebar_collapsed'), false);
  assert.equal(isAuthStorageKey('kjin_brand_config'), false);

  // Must identify auth keys
  assert.equal(isAuthStorageKey('sb-localhost-auth-token'), true);
  assert.equal(isAuthStorageKey('sb-127-auth-token.0'), true);
  assert.equal(isAuthStorageKey('supabase.auth.token'), true);
  assert.equal(isAuthStorageKey('oauth_code-verifier'), true);
  assert.equal(isAuthStorageKey('csrf_token'), true);
});

test('auth-storage: clearAuthStorage purges auth tokens and preserves UI preferences', () => {
  // Create mock storage objects
  const localStore = new Map<string, string>();
  const sessionStore = new Map<string, string>();

  const mockLocalStorage = {
    getItem: (k: string) => localStore.get(k) ?? null,
    setItem: (k: string, v: string) => localStore.set(k, v),
    removeItem: (k: string) => localStore.delete(k),
    clear: () => localStore.clear(),
    key: (i: number) => Array.from(localStore.keys())[i] ?? null,
    get length() {
      return localStore.size;
    },
  };

  const mockSessionStorage = {
    getItem: (k: string) => sessionStore.get(k) ?? null,
    setItem: (k: string, v: string) => sessionStore.set(k, v),
    removeItem: (k: string) => sessionStore.delete(k),
    clear: () => sessionStore.clear(),
    key: (i: number) => Array.from(sessionStore.keys())[i] ?? null,
    get length() {
      return sessionStore.size;
    },
  };

  // Populate mock data
  localStore.set('kjin_admin_theme', 'dark');
  localStore.set('kjin_admin_sidebar_collapsed', 'true');
  localStore.set('kjin_brand_config', '{"brand":{"siteName":"KJIN"}}');
  localStore.set('sb-127-auth-token', 'jwt.secret.token');
  localStore.set('sb-127-auth-token.0', 'chunk0');
  localStore.set('supabase.auth.token', 'refresh.token');

  sessionStore.set('sb-temp-auth', 'temp_session');
  sessionStore.set('oauth_verifier', 'verifier_secret');

  // Install onto global
  const origLocal = globalThis.localStorage;
  const origSession = globalThis.sessionStorage;
  const origWindow = globalThis.window;

  (globalThis as any).localStorage = mockLocalStorage;
  (globalThis as any).sessionStorage = mockSessionStorage;
  (globalThis as any).window = {};

  try {
    const { clearedLocal, clearedSession } = clearAuthStorage();

    // Verify preserved settings
    assert.equal(localStore.get('kjin_admin_theme'), 'dark');
    assert.equal(localStore.get('kjin_admin_sidebar_collapsed'), 'true');
    assert.equal(localStore.get('kjin_brand_config'), '{"brand":{"siteName":"KJIN"}}');

    // Verify wiped auth keys
    assert.equal(localStore.has('sb-127-auth-token'), false);
    assert.equal(localStore.has('sb-127-auth-token.0'), false);
    assert.equal(localStore.has('supabase.auth.token'), false);

    assert.equal(sessionStore.has('sb-temp-auth'), false);
    assert.equal(sessionStore.has('oauth_verifier'), false);

    assert.ok(clearedLocal.includes('sb-127-auth-token'));
    assert.ok(clearedSession.includes('oauth_verifier'));
  } finally {
    (globalThis as any).localStorage = origLocal;
    (globalThis as any).sessionStorage = origSession;
    (globalThis as any).window = origWindow;
  }
});

test('logout route: POST /api/auth/logout sets Max-Age=0 for server HttpOnly cookies', async () => {
  const req = new NextRequest('http://localhost:3001/api/auth/logout', {
    method: 'POST',
    headers: {
      cookie: 'sb-localhost-auth-token=active_jwt; kjin_admin_theme=dark',
    },
  });

  const res = await logoutPost(req);
  assert.equal(res.status, 200);

  const json = await res.json();
  assert.equal(json.success, true);

  // Check Set-Cookie headers on response
  const setCookieHeader = res.headers.get('set-cookie');
  assert.ok(setCookieHeader, 'Set-Cookie header must be present to clear server cookies');
  assert.ok(
    setCookieHeader.includes('Max-Age=0') || setCookieHeader.includes('max-age=0'),
    'Cookies must be expired with Max-Age=0'
  );
});

test('notify-login route: GET /api/auth/notify-login requires authentication', async () => {
  const req = new NextRequest('http://localhost:3001/api/auth/notify-login', {
    method: 'GET',
  });

  const res = await notifyLoginGet(req);
  assert.equal(res.status, 401);
  const json = await res.json();
  assert.equal(json.error, 'Authorization required');
});
