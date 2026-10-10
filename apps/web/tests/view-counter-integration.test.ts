import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

describe('P0: View Counter Security & Rate Limiting Integration', { skip: !SERVICE_KEY || !ANON_KEY }, () => {
  const anonClient = createClient(SUPABASE_URL, ANON_KEY);
  const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY);

  let testPublishedId: string;
  let testDraftId: string;

  before(async () => {
    // Setup test articles
    const { data: a1 } = await serviceClient.from('articles').insert({
      title: 'Test Published',
      slug: 'test-published-' + Date.now(),
      status: 'published',
      category: 'local',
      content: 'Test content',
      view_count: 0
    }).select('id').single();
    testPublishedId = a1?.id;

    const { data: a2 } = await serviceClient.from('articles').insert({
      title: 'Test Draft',
      slug: 'test-draft-' + Date.now(),
      status: 'draft',
      category: 'local',
      content: 'Test content',
      view_count: 0
    }).select('id').single();
    testDraftId = a2?.id;
  });

  after(async () => {
    // Cleanup
    if (testPublishedId) await serviceClient.from('articles').delete().eq('id', testPublishedId);
    if (testDraftId) await serviceClient.from('articles').delete().eq('id', testDraftId);
  });

  it('proves anonymous users cannot execute the view-count RPC directly', async () => {
    const { error } = await anonClient.rpc('increment_article_view_count', {
      p_article_id: testPublishedId,
      p_ip_address: '127.0.0.1'
    });
    
    assert.ok(error, 'Anonymous RPC call must fail');
    assert.ok(
      error.message.includes('permission denied') || error.code === '42501',
      'Must fail with permission denied'
    );
  });

  it('proves the trusted server can record views only for published articles', async () => {
    const testIp = `10.0.0.${Date.now() % 255}`;
    
    await serviceClient.rpc('increment_article_view_count', {
      p_article_id: testDraftId,
      p_ip_address: testIp
    });

    const { data: draft } = await serviceClient.from('articles').select('view_count').eq('id', testDraftId).single();
    assert.strictEqual(draft?.view_count, 0, 'View count must not increment for unpublished articles');
  });

  it('proves concurrent requests cannot exceed the intended limits (atomic rate limiting)', async () => {
    const testIp = `192.168.1.${Date.now() % 255}`;
    
    // Simulate 20 concurrent hits from the same IP to the same article
    // Due to the 24-hour deduplication and atomic locking, only exactly 1 should be recorded.
    const promises = Array.from({ length: 20 }).map(() => 
      serviceClient.rpc('increment_article_view_count', {
        p_article_id: testPublishedId,
        p_ip_address: testIp
      })
    );
    
    await Promise.all(promises);

    const { data: views } = await serviceClient.from('article_views_log')
      .select('id')
      .eq('article_id', testPublishedId)
      .eq('ip_address', testIp);

    assert.strictEqual(views?.length, 1, 'Concurrent requests from same IP for same article must atomically deduplicate to exactly 1 view');
    
    const { data: article } = await serviceClient.from('articles').select('view_count').eq('id', testPublishedId).single();
    assert.strictEqual(article?.view_count, 1, 'Total article views must strictly equal 1 after concurrent burst');
  });

  it('proves rate limits still work across separate server instances', async () => {
    const testIp = `172.16.0.${Date.now() % 255}`;
    
    // Simulate multiple server instances by firing concurrent DB requests.
    // Since the state is fully managed in the database (via pg_advisory_xact_lock),
    // it inherently scales across multiple process-level server instances without local cache bypasses.
    const clients = [
      createClient(SUPABASE_URL, SERVICE_KEY),
      createClient(SUPABASE_URL, SERVICE_KEY),
      createClient(SUPABASE_URL, SERVICE_KEY),
    ];
    
    const promises = clients.map(client => 
      client.rpc('increment_article_view_count', {
        p_article_id: testPublishedId,
        p_ip_address: testIp
      })
    );
    
    await Promise.all(promises);
    
    const { data: views } = await serviceClient.from('article_views_log')
      .select('id')
      .eq('article_id', testPublishedId)
      .eq('ip_address', testIp);

    assert.strictEqual(views?.length, 1, 'Separate DB connections must still enforce atomic rate limits (no split-brain)');
  });
});
