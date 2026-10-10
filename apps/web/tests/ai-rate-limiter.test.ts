import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

describe('P0: AI Rate Limiter Security & Concurrency', { skip: !SERVICE_KEY || !ANON_KEY }, () => {
  const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY);
  const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  let authorId1: string;

  before(async () => {
    const authorEmail1 = `test-ai-rate-1-${Date.now()}@kjin.local`;

    // 1. Create an invite first to satisfy the trigger
    const { data: invite, error: inviteErr } = await serviceClient.from('employee_invites').insert({
      email: authorEmail1,
      role_key: 'author',
      status: 'sending'
    }).select('id').single();
    if (inviteErr) throw inviteErr;

    // 2. Create User 1
    const { data: authorData1, error: err1 } = await serviceClient.auth.admin.createUser({
      email: authorEmail1, password: 'password123', email_confirm: true,
      user_metadata: { employee_invite_id: invite.id }
    });
    if (err1) throw err1;
    authorId1 = authorData1.user!.id;
  });

  after(async () => {
    if (authorId1) await serviceClient.auth.admin.deleteUser(authorId1);
  });

  it('prevents anonymous users from calling check_ai_rate_limit', async () => {
    const { error } = await anonClient.rpc('check_ai_rate_limit', {
      p_user_id: authorId1,
      p_endpoint: 'test',
      p_max_requests: 10,
      p_window_interval: '1 hour'
    });
    assert.ok(error, 'Anonymous users must be blocked');
    assert.ok(error.message.includes('Could not find the function') || error.code === '42883' || error.message.includes('permission denied'), 'Should fail completely');
  });

  it('handles concurrent rate limit checks securely via service role', async () => {
    // Fire 15 requests concurrently, but max is 10.
    const concurrentRequests = 15;
    const maxRequests = 10;
    
    // Clear logs for this test
    await serviceClient.from('ai_usage_logs').delete().eq('user_id', authorId1);

    const promises = [];
    for (let i = 0; i < concurrentRequests; i++) {
      promises.push(
        serviceClient.rpc('check_ai_rate_limit', {
          p_user_id: authorId1,
          p_endpoint: 'concurrent_test',
          p_max_requests: maxRequests,
          p_window_interval: '1 hour'
        })
      );
    }
    
    const results = await Promise.all(promises);
    
    let allowedCount = 0;
    let rejectedCount = 0;
    
    for (const res of results) {
      if (res.error) throw res.error; // Should not throw generic errors
      if (res.data === true) allowedCount++;
      if (res.data === false) rejectedCount++;
    }
    
    assert.strictEqual(allowedCount, maxRequests, `Exactly ${maxRequests} requests should be allowed`);
    assert.strictEqual(rejectedCount, concurrentRequests - maxRequests, `Exactly ${concurrentRequests - maxRequests} requests should be rejected`);
    
    // Verify database only has maxRequests rows
    const { data: logs } = await serviceClient
      .from('ai_usage_logs')
      .select('id')
      .eq('user_id', authorId1)
      .eq('endpoint', 'concurrent_test');
      
    assert.strictEqual(logs?.length, maxRequests, 'Database should correctly count exactly the max requests limit despite concurrency race conditions');
  });
});
