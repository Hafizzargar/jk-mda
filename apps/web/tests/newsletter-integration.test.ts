import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
// @ts-expect-error Node.js test runner with custom ESM loader
import { POST } from '../app/api/newsletter/subscribe/route.ts';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

describe('P1: Newsletter Subscription Integration', { skip: !SERVICE_KEY }, () => {
  const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY);
  const testIp = '203.0.113.99';
  const testEmail = `test-newsletter-${Date.now()}@example.com`;

  const testIps = ['203.0.113.99', '203.0.113.100', '203.0.113.101'];
  const testEmails = [testEmail, `second-${testEmail}`, `third-${testEmail}`, `fourth-${testEmail}`];

  before(async () => {
    // Ensure clean state for test IP and email
    const { error: ipError } = await serviceClient.from('newsletter_ip_rate_limit').delete().in('ip_address', testIps);
    const { error: emailError } = await serviceClient.from('newsletter_subscribers').delete().in('email', testEmails);
    
    assert.ifError(ipError);
    assert.ifError(emailError);
  });

  after(async () => {
    // Cleanup
    const { error: ipError } = await serviceClient.from('newsletter_ip_rate_limit').delete().in('ip_address', testIps);
    const { error: emailError } = await serviceClient.from('newsletter_subscribers').delete().in('email', testEmails);
    
    assert.ifError(ipError);
    assert.ifError(emailError);
  });

  it('rejects oversized payloads to prevent buffering attacks', async () => {
    // Generate a payload larger than 2000 bytes
    const oversizedBody = JSON.stringify({ email: 'a'.repeat(2500) + '@example.com' });
    const req = new Request('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'x-vercel-forwarded-for': '203.0.113.100' },
      body: oversizedBody
    });
    
    const res = await POST(req);
    assert.strictEqual(res.status, 413);
    const data = await res.json();
    assert.strictEqual(data.error, 'Payload too large.');
  });

  it('rejects missing or invalid email', async () => {
    const req = new Request('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'x-vercel-forwarded-for': '203.0.113.100' },
      body: JSON.stringify({ email: 'not-an-email' })
    });
    
    const res = await POST(req);
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error, 'Invalid email format.');
  });

  it('accepts valid signup', async () => {
    const req = new Request('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'x-vercel-forwarded-for': '203.0.113.101' },
      body: JSON.stringify({ email: testEmail })
    });
    
    const res = await POST(req);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    
    // Verify in DB
    const { data: row } = await serviceClient
      .from('newsletter_subscribers')
      .select('*')
      .eq('email', testEmail)
      .single();
    
    assert.ok(row, 'Subscriber should be inserted');
    assert.strictEqual(row.unsubscribed_at, null);
  });

  it('allows second request under limit', async () => {
    const req = new Request('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'x-vercel-forwarded-for': '203.0.113.101' },
      body: JSON.stringify({ email: `second-${testEmail}` })
    });
    
    const res = await POST(req);
    assert.strictEqual(res.status, 200);
  });

  it('allows third request under limit', async () => {
    const req = new Request('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'x-vercel-forwarded-for': '203.0.113.101' },
      body: JSON.stringify({ email: `third-${testEmail}` })
    });
    
    const res = await POST(req);
    assert.strictEqual(res.status, 200);
  });

  it('blocks fourth request due to rate limit', async () => {
    const req = new Request('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'x-vercel-forwarded-for': '203.0.113.101' },
      body: JSON.stringify({ email: `fourth-${testEmail}` })
    });
    
    const res = await POST(req);
    assert.strictEqual(res.status, 429);
    const data = await res.json();
    assert.strictEqual(data.error, 'Too many requests. Please try again later.');
  });

  it('allows resubscription by clearing unsubscribed_at', async () => {
    // 1. Unsubscribe the test user directly
    await serviceClient
      .from('newsletter_subscribers')
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq('email', testEmail);

    // 2. Clear rate limit for the IP manually for this test
    await serviceClient.from('newsletter_ip_rate_limit').delete().eq('ip_address', testIp);

    // 3. Resubscribe
    const req = new Request('http://localhost/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'x-vercel-forwarded-for': testIp },
      body: JSON.stringify({ email: testEmail })
    });
    
    const res = await POST(req);
    assert.strictEqual(res.status, 200);

    // 4. Verify unsubscribed_at is null
    const { data: row } = await serviceClient
      .from('newsletter_subscribers')
      .select('*')
      .eq('email', testEmail)
      .single();
    
    assert.strictEqual(row.unsubscribed_at, null);
  });
});
