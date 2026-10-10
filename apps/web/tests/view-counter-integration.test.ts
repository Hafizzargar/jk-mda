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
  let testUserId: string;
  let authorClient: any;

  before(async () => {
    // 1. Create employee invitation to satisfy trigger requirements
    const inviteId = crypto.randomUUID();
    const email = `test-author-${Date.now()}@kjin.local`;
    
    const { error: inviteError } = await serviceClient.from('employee_invites').insert({
      id: inviteId,
      email: email,
      role_key: 'author',
      status: 'sending'
    });
    assert.ok(!inviteError, 'Failed to insert test invite: ' + inviteError?.message);

    // 2. Create user (trigger will consume the invite to provision the profile)
    const { data: userData, error: userError } = await serviceClient.auth.admin.createUser({
      email: email,
      password: 'password123',
      email_confirm: true,
      user_metadata: { employee_invite_id: inviteId, display_name: 'Test Author' }
    });
    assert.ok(userData.user, 'Failed to create test user: ' + userError?.message);
    testUserId = userData.user.id;

    // 3. Authenticate as the newly provisioned author
    const { data: sessionData, error: signInError } = await anonClient.auth.signInWithPassword({
      email: email,
      password: 'password123'
    });
    assert.ok(sessionData.session, 'Failed to sign in: ' + signInError?.message);
    
    authorClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${sessionData.session.access_token}` } }
    });

    // 4. Create the published test article using the CMS workflow
    const { data: a1, error: createPubError } = await authorClient.rpc('create_article', {
      p_title: 'Test Published',
      p_excerpt: 'Excerpt',
      p_content: 'Content',
      p_slug: 'test-published-' + Date.now()
    });
    assert.ok(a1, 'Failed to create published article draft: ' + createPubError?.message);
    testPublishedId = a1.id;

    // Transition state machine: draft -> review
    const { error: submitPubError } = await authorClient.rpc('submit_article_for_review', {
      p_article_id: testPublishedId
    });
    assert.ok(!submitPubError, 'Failed to submit published article for review: ' + submitPubError?.message);

    // Transition state machine: review -> published
    // Note: We bypass the publish RPC using service_role because the RPC strictly requires AAL2 (MFA), 
    // which cannot be easily automated in headless integration tests without TOTP libraries.
    const { error: publishError } = await serviceClient.from('articles')
      .update({ 
        status: 'published', 
        published_at: new Date().toISOString(), 
        published_by: testUserId 
      })
      .eq('id', testPublishedId);
    assert.ok(!publishError, 'Failed to publish article: ' + publishError?.message);

    // 5. Create the draft test article
    const { data: a2, error: createDraftError } = await authorClient.rpc('create_article', {
      p_title: 'Test Draft',
      p_excerpt: 'Excerpt',
      p_content: 'Content',
      p_slug: 'test-draft-' + Date.now()
    });
    assert.ok(a2, 'Failed to create draft article: ' + createDraftError?.message);
    testDraftId = a2.id;
  });

  after(async () => {
    // Cleanup
    if (testPublishedId) await serviceClient.from('articles').delete().eq('id', testPublishedId);
    if (testDraftId) await serviceClient.from('articles').delete().eq('id', testDraftId);
    if (testUserId) await serviceClient.auth.admin.deleteUser(testUserId);
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

  it('proves the global IP limit allows up to 30 distinct articles in 15 minutes, but rejects the 31st', async () => {
    const testIp = `10.1.1.${Date.now() % 255}`;
    
    // Create 31 published articles using the correct CMS workflow
    const bulkArticles = [];
    try {
      for (let i = 0; i < 31; i++) {
        const { data: a, error: createErr } = await authorClient.rpc('create_article', {
          p_title: `Bulk Test Article ${i}`,
          p_excerpt: 'Excerpt',
          p_content: 'Bulk test content',
          p_slug: `bulk-test-${Date.now()}-${i}`
        });
        assert.ok(!createErr, 'Failed to create bulk article: ' + createErr?.message);
        bulkArticles.push(a);
        
        const { error: submitErr } = await authorClient.rpc('submit_article_for_review', { p_article_id: a.id });
        assert.ok(!submitErr, 'Failed to submit bulk article: ' + submitErr?.message);
        
        const { error: pubErr } = await serviceClient.from('articles').update({
          status: 'published',
          published_at: new Date().toISOString(),
          published_by: testUserId
        }).eq('id', a.id);
        assert.ok(!pubErr, 'Failed to publish bulk article: ' + pubErr?.message);
      }
      
      // Attempt to view all 31 articles from the same IP
      for (let i = 0; i < 30; i++) {
        const { error: viewErr } = await serviceClient.rpc('increment_article_view_count', {
          p_article_id: bulkArticles[i].id,
          p_ip_address: testIp
        });
        assert.ok(!viewErr, 'Failed to increment view: ' + viewErr?.message);
      }
      
      // The 31st attempt should be rejected by the global IP limit (silently returns)
      await serviceClient.rpc('increment_article_view_count', {
        p_article_id: bulkArticles[30].id,
        p_ip_address: testIp
      });
      
      // Verify the log only has 30 entries for this IP
      const { data: loggedViews, error: logErr } = await serviceClient
        .from('article_views_log')
        .select('id')
        .eq('ip_address', testIp);
      assert.ok(!logErr, 'Failed to query view logs: ' + logErr?.message);
      assert.strictEqual(loggedViews?.length, 30, 'Exactly 30 distinct article views should be logged per IP in 15 minutes');
      
      // Verify the 31st article's view count remains 0
      const { data: lastArticle, error: lastArtErr } = await serviceClient
        .from('articles')
        .select('view_count')
        .eq('id', bulkArticles[30].id)
        .single();
      assert.ok(!lastArtErr, 'Failed to query last article: ' + lastArtErr?.message);
      assert.strictEqual(lastArticle?.view_count, 0, 'The 31st article view count must not increment');
    } finally {
      // Cleanup bulk articles
      if (bulkArticles.length > 0) {
        const idsToDelete = bulkArticles.map(a => a.id);
        await serviceClient.from('articles').delete().in('id', idsToDelete);
      }
    }
  });
});
