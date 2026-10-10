import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

describe('P0: Editorial Verification Workflow Integration', { skip: !SERVICE_KEY || !ANON_KEY }, () => {
  const anonClient = createClient(SUPABASE_URL, ANON_KEY);
  const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY);

  let authorId: string;
  let editorId: string;
  let superadminId: string;
  let authorClient: any;
  let editorClient: any;
  let superadminClient: any;
  let testArticleId: string;

  before(async () => {
    // 1. Create Author (Reporter)
    const authorInviteId = crypto.randomUUID();
    const authorEmail = `test-author-${Date.now()}@kjin.local`;
    await serviceClient.from('employee_invites').insert({
      id: authorInviteId, email: authorEmail, role_key: 'author', status: 'sending'
    });
    const { data: authorData, error: authorUserErr } = await serviceClient.auth.admin.createUser({
      email: authorEmail, password: 'password123', email_confirm: true,
      user_metadata: { employee_invite_id: authorInviteId, display_name: 'Test Author' }
    });
    assert.ok(authorData.user, 'Failed to create author user: ' + authorUserErr?.message);
    authorId = authorData.user.id;
    const { data: authorSession } = await anonClient.auth.signInWithPassword({
      email: authorEmail, password: 'password123'
    });
    authorClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${authorSession.session!.access_token}` } }
    });

    // 2. Create Editor
    const editorInviteId = crypto.randomUUID();
    const editorEmail = `test-editor-${Date.now()}@kjin.local`;
    await serviceClient.from('employee_invites').insert({
      id: editorInviteId, email: editorEmail, role_key: 'editor', status: 'sending'
    });
    const { data: editorData, error: editorUserErr } = await serviceClient.auth.admin.createUser({
      email: editorEmail, password: 'password123', email_confirm: true,
      user_metadata: { employee_invite_id: editorInviteId, display_name: 'Test Editor' }
    });
    assert.ok(editorData.user, 'Failed to create editor user: ' + editorUserErr?.message);
    editorId = editorData.user.id;
    const { data: editorSession } = await anonClient.auth.signInWithPassword({
      email: editorEmail, password: 'password123'
    });
    editorClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${editorSession.session!.access_token}` } },
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // 3. Create Superadmin
    const superadminInviteId = crypto.randomUUID();
    const superadminEmail = `test-superadmin-${Date.now()}@kjin.local`;
    await serviceClient.from('employee_invites').insert({
      id: superadminInviteId, email: superadminEmail, role_key: 'superadmin', status: 'sending'
    });
    const { data: superadminData, error: superadminUserErr } = await serviceClient.auth.admin.createUser({
      email: superadminEmail, password: 'password123', email_confirm: true,
      user_metadata: { employee_invite_id: superadminInviteId, display_name: 'Test Superadmin' }
    });
    assert.ok(superadminData.user, 'Failed to create superadmin user: ' + superadminUserErr?.message);
    superadminId = superadminData.user.id;
    const { data: superadminSession } = await anonClient.auth.signInWithPassword({
      email: superadminEmail, password: 'password123'
    });
    superadminClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${superadminSession.session!.access_token}` } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
  });

  after(async () => {
    if (testArticleId) await serviceClient.from('articles').delete().eq('id', testArticleId);
    if (authorId) await serviceClient.auth.admin.deleteUser(authorId);
    if (editorId) await serviceClient.auth.admin.deleteUser(editorId);
    if (superadminId) await serviceClient.auth.admin.deleteUser(superadminId);
  });

  it('allows author to create a draft', async () => {
    const { data: article, error } = await authorClient.rpc('create_article', {
      p_title: 'Draft by Author',
      p_excerpt: 'Excerpt',
      p_content: 'Content',
      p_slug: 'draft-by-author-' + Date.now()
    });
    assert.ok(!error, 'Author should be able to create a draft: ' + error?.message);
    assert.strictEqual(article.status, 'draft', 'New article must be a draft');
    testArticleId = article.id;
  });

  it('prevents author from publishing a draft directly', async () => {
    const { error } = await authorClient.rpc('publish_article', { p_article_id: testArticleId });
    assert.ok(error, 'Author should not be able to publish');
    assert.ok(error.message.includes('permission required'), 'Must fail with permission check');
  });

  it('allows author to submit draft for review', async () => {
    const { data: article, error } = await authorClient.rpc('submit_article_for_review', {
      p_article_id: testArticleId
    });
    assert.ok(!error, 'Author should be able to submit for review: ' + error?.message);
    assert.strictEqual(article.status, 'review', 'Article must be in review status');
  });

  it('allows editor to return article to draft', async () => {
    const { data: article, error } = await editorClient.rpc('return_article_to_draft', {
      p_article_id: testArticleId
    });
    assert.ok(!error, 'Editor should be able to return article to draft: ' + error?.message);
    assert.strictEqual(article.status, 'draft', 'Article must be returned to draft status');
  });

  it('prevents anonymous users from querying drafts', async () => {
    // Create a strict anonymous client with no persisted session
    const strictAnonClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    
    const { data: articles, error } = await strictAnonClient
      .from('articles')
      .select('id, title')
      .eq('id', testArticleId);
    
    assert.ok(!error, 'Query should not throw, just return empty due to RLS');
    assert.strictEqual(articles?.length, 0, 'Anonymous user must not see draft articles');
  });

  it('prevents editor from publishing (lacks permission)', async () => {
    // Editor needs to submit it back to review first because it's currently draft
    const { error: submitError } = await authorClient.rpc('submit_article_for_review', {
      p_article_id: testArticleId
    });
    assert.ok(!submitError, 'Author should be able to re-submit for review');

    // Editor tries to publish
    const { error: publishError } = await editorClient.rpc('publish_article', {
      p_article_id: testArticleId
    });
    assert.ok(publishError, 'Editor must fail to publish');
    assert.ok(publishError.message.includes('permission required'), 'Must fail with permission check');
  });

  it('requires AAL2 (MFA) for a superadmin to publish', async () => {
    // Superadmin tries to publish without AAL2
    const { error: publishError } = await superadminClient.rpc('publish_article', {
      p_article_id: testArticleId
    });
    assert.ok(publishError, 'Superadmin without AAL2 must fail to publish');
    assert.ok(publishError.message.includes('permission required'), 'Must fail with permission check due to missing AAL2');
  });
});
