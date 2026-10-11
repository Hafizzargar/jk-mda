-- Test Suite: Phase 7 Database Architecture Schema & Security
-- Tests:
-- 1. Categories & Districts taxonomy and foreign keys
-- 2. Tags and article_tags composite uniqueness
-- 3. Media assets table constraints, draft approval workflow, and non-destructive retention
-- 4. Translation workflow: direct write lockdown, trigger MFA enforcement, RPC gate, attribution, and dual visibility
-- 5. Full-text search tsvector generation across English and Urdu Unicode scripts
--
-- Lifecycle Integrity:
-- All article test fixtures are generated via valid production RPC transitions:
-- create_article -> submit_article_for_review -> publish_article -> archive_article.

begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(26);

-- Helper functions for true role simulation
create or replace function pg_temp.assume_employee(p_user_id uuid, p_aal text default 'aal2')
returns void language plpgsql as $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', p_user_id::text,
    'role', 'authenticated',
    'aal', p_aal,
    'session_id', gen_random_uuid()::text
  )::text, true);
end;
$$;

create or replace function pg_temp.assume_anon()
returns void language plpgsql as $$
begin
  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
end;
$$;

create or replace function pg_temp.assume_admin()
returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function pg_temp.assume_admin_with_jwt(p_user_id uuid, p_aal text default 'aal1')
returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', p_user_id::text,
    'role', 'authenticated',
    'aal', p_aal,
    'session_id', gen_random_uuid()::text
  )::text, true);
end;
$$;

-----------------------------------------------------------------------------
-- Setup Test Users with Valid 32-Hex-Digit (36-char) UUIDs
-----------------------------------------------------------------------------
insert into public.employee_invites (id, email, display_name, role_key, reason, status)
values
  ('20000000-0000-0000-0000-000000000201', 'p7-editor1@test.invalid', 'Phase7 Editor One', 'editor', 'test fixture', 'sending'),
  ('20000000-0000-0000-0000-000000000202', 'p7-editor2@test.invalid', 'Phase7 Editor Two', 'editor', 'test fixture', 'sending'),
  ('20000000-0000-0000-0000-000000000203', 'p7-author@test.invalid', 'Phase7 Author', 'author', 'test fixture', 'sending')
on conflict do nothing;

insert into auth.users (id, aud, role, email, encrypted_password, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000201', 'authenticated', 'authenticated', 'p7-editor1@test.invalid', '', '{"employee_invite_id":"20000000-0000-0000-0000-000000000201"}', now(), now()),
  ('10000000-0000-0000-0000-000000000202', 'authenticated', 'authenticated', 'p7-editor2@test.invalid', '', '{"employee_invite_id":"20000000-0000-0000-0000-000000000202"}', now(), now()),
  ('10000000-0000-0000-0000-000000000203', 'authenticated', 'authenticated', 'p7-author@test.invalid', '', '{"employee_invite_id":"20000000-0000-0000-0000-000000000203"}', now(), now())
on conflict do nothing;

update public.profiles set role_key = 'editor', status = 'active' where id = '10000000-0000-0000-0000-000000000201';
update public.profiles set role_key = 'editor', status = 'active' where id = '10000000-0000-0000-0000-000000000202';
update public.profiles set role_key = 'author', status = 'active' where id = '10000000-0000-0000-0000-000000000203';

-----------------------------------------------------------------------------
-- Setup Production-Compliant Article Fixtures via Stored Procedures
-----------------------------------------------------------------------------
create temp table test_articles (
  name text primary key,
  id uuid not null
);
grant all on test_articles to public, authenticated, anon;

-- 1. Create Published Parent Article (author creates -> submits -> editor publishes with AAL2)
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000203', 'aal1');

insert into test_articles (name, id)
select 'published_parent', (public.create_article(
  'Dal Lake Conservation Drive',
  'Efforts underway to restore Dal Lake',
  'Full report on lake cleaning project in Srinagar...',
  'dal-lake-conservation-drive',
  'srinagar',
  'General',
  null, null, null
)).id;

select public.submit_article_for_review((select id from test_articles where name = 'published_parent'));

select pg_temp.assume_employee('10000000-0000-0000-0000-000000000201', 'aal2');
select public.publish_article((select id from test_articles where name = 'published_parent'));

-- 2. Create Draft Parent Article (author creates draft and leaves it in draft)
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000203', 'aal1');

insert into test_articles (name, id)
select 'draft_parent', (public.create_article(
  'Draft Article Title',
  'Draft excerpt',
  'Draft article content...',
  'draft-article-for-translation-test',
  'srinagar',
  'Local',
  null, null, null
)).id;

-- 3. Create Archived Parent Article (valid lifecycle: draft -> review -> published -> archived)
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000203', 'aal1');

insert into test_articles (name, id)
select 'archived_parent', (public.create_article(
  'Archived Article Title',
  'Archived excerpt',
  'Archived article content...',
  'archived-article-for-translation-test',
  'srinagar',
  'Economy',
  null, null, null
)).id;

select public.submit_article_for_review((select id from test_articles where name = 'archived_parent'));

select pg_temp.assume_employee('10000000-0000-0000-0000-000000000201', 'aal2');
select public.publish_article((select id from test_articles where name = 'archived_parent'));
select public.archive_article((select id from test_articles where name = 'archived_parent'));

-- Reset to clean admin state before assertions
select pg_temp.assume_admin();

-----------------------------------------------------------------------------
-- 1. Test Categories Seed & Lookup (Assertions 1-2)
-----------------------------------------------------------------------------
select extensions.is(
  (select count(*)::int from public.categories),
  9,
  'Assertion 1: All 9 categories seeded from taxonomy.ts exist'
);

select extensions.is(
  (select name_en from public.categories where slug = 'politics'),
  'Politics',
  'Assertion 2: Category politics correctly configured with display name'
);

-----------------------------------------------------------------------------
-- 2. Test Districts Seed & Division Constraints (Assertions 3-5)
-----------------------------------------------------------------------------
select extensions.is(
  (select count(*)::int from public.districts),
  20,
  'Assertion 3: All 20 Jammu & Kashmir districts seeded from taxonomy.ts exist'
);

select extensions.is(
  (select count(*)::int from public.districts where division = 'Kashmir'),
  10,
  'Assertion 4: Kashmir division has exactly 10 districts'
);

select extensions.is(
  (select count(*)::int from public.districts where division = 'Jammu'),
  10,
  'Assertion 5: Jammu division has exactly 10 districts'
);

-----------------------------------------------------------------------------
-- 3. Test Tags & Composite Uniqueness (Assertions 6-7)
-----------------------------------------------------------------------------
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000201', 'aal2');

insert into public.tags (slug, name_en, name_ur, name_hi)
values ('dal-lake', 'Dal Lake', 'ڈل جھیل', 'डल झील')
on conflict do nothing;

select extensions.ok(
  exists (select 1 from public.tags where slug = 'dal-lake'),
  'Assertion 6: Editor successfully created Dal Lake tag'
);

insert into public.article_tags (article_id, tag_id)
values (
  (select id from test_articles where name = 'published_parent'),
  (select id from public.tags where slug = 'dal-lake')
);

-- Verify duplicate tag insertion fails on composite primary key
select extensions.throws_ok(
  $$
    insert into public.article_tags (article_id, tag_id)
    values (
      (select id from test_articles where name = 'published_parent'),
      (select id from public.tags where slug = 'dal-lake')
    )
  $$,
  '23505',
  null,
  'Assertion 7: Duplicate tag assignment on (article_id, tag_id) is blocked by composite primary key'
);

-----------------------------------------------------------------------------
-- 4. Test Media Assets Catalog, Approval & Retention (Assertions 8-15)
-----------------------------------------------------------------------------
-- Author attempts to upload directly with status = 'published' -> must be blocked
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000203', 'aal1');

select extensions.throws_ok(
  $$
    insert into public.media_assets (
      storage_path, public_url, alt_text_en, mime_type, status, uploaded_by
    )
    values (
      '2026/10/unauthorized-pub.webp',
      'https://cdn.kjin.org/news-media/2026/10/unauthorized-pub.webp',
      'Unauthorized published image',
      'image/webp',
      'published',
      '10000000-0000-0000-0000-000000000203'
    )
  $$,
  '42501',
  null,
  'Assertion 8: Standard author cannot publish media assets directly (must upload as draft)'
);

-- Author uploads with status = 'draft' -> succeeds
select extensions.lives_ok(
  $$
    insert into public.media_assets (
      storage_path, public_url, alt_text_en, mime_type, status, uploaded_by
    )
    values (
      '2026/10/author-draft.webp',
      'https://cdn.kjin.org/news-media/2026/10/author-draft.webp',
      'Author draft image',
      'image/webp',
      'draft',
      '10000000-0000-0000-0000-000000000203'
    )
  $$,
  'Assertion 9: Standard author can upload draft media assets'
);

-- Editor uploads directly as published -> succeeds
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000201', 'aal2');

select extensions.lives_ok(
  $$
    insert into public.media_assets (
      storage_path, public_url, alt_text_en, alt_text_ur, alt_text_hi, credit, mime_type, status, uploaded_by
    )
    values (
      '2026/10/dal-lake.webp',
      'https://cdn.kjin.org/news-media/2026/10/dal-lake.webp',
      'Shikara on Dal Lake in Srinagar',
      'ڈل جھیل پر شکارا',
      'डल झील पर शिकारा',
      'KJIN Photo / Bilal Ahmad',
      'image/webp',
      'published',
      '10000000-0000-0000-0000-000000000201'
    )
  $$,
  'Assertion 10: Editor can create published media assets'
);

-- SVG MIME type is rejected by check constraint
select extensions.throws_ok(
  $$
    insert into public.media_assets (
      storage_path, public_url, alt_text_en, mime_type, status, uploaded_by
    )
    values (
      '2026/10/exploit.svg',
      'https://cdn.kjin.org/news-media/2026/10/exploit.svg',
      'SVG with script',
      'image/svg+xml',
      'draft',
      '10000000-0000-0000-0000-000000000201'
    )
  $$,
  '23514',
  null,
  'Assertion 11: SVG mime type is blocked by database check constraint'
);

-- Anonymous visibility: draft is hidden, published is visible
select pg_temp.assume_anon();

select extensions.is_empty(
  $$ select id from public.media_assets where storage_path = '2026/10/author-draft.webp' $$,
  'Assertion 12: Anonymous reader cannot see draft media assets'
);

select extensions.is(
  (select count(*)::int from public.media_assets where storage_path = '2026/10/dal-lake.webp'),
  1,
  'Assertion 13: Anonymous reader can see published media assets'
);

-- Retention & Non-Destructive Deprovisioning: Deleting uploader profile preserves media record with uploaded_by set to NULL
select pg_temp.assume_admin();

insert into public.employee_invites (id, email, display_name, role_key, reason, status)
values ('20000000-0000-0000-0000-000000000299', 'p7-retention@test.invalid', 'Phase7 Retention Author', 'author', 'retention test', 'sending')
on conflict do nothing;

insert into auth.users (id, aud, role, email, encrypted_password, raw_user_meta_data, created_at, updated_at)
values ('10000000-0000-0000-0000-000000000299', 'authenticated', 'authenticated', 'p7-retention@test.invalid', '', '{"employee_invite_id":"20000000-0000-0000-0000-000000000299"}', now(), now())
on conflict do nothing;

update public.profiles set role_key = 'author', status = 'active' where id = '10000000-0000-0000-0000-000000000299';

select pg_temp.assume_employee('10000000-0000-0000-0000-000000000299', 'aal1');
insert into public.media_assets (
  storage_path, public_url, alt_text_en, mime_type, status, uploaded_by
)
values (
  '2026/10/retention-photo.webp',
  'https://cdn.kjin.org/news-media/2026/10/retention-photo.webp',
  'Retention photojournalist photo',
  'image/webp',
  'draft',
  '10000000-0000-0000-0000-000000000299'
);

select pg_temp.assume_employee('10000000-0000-0000-0000-000000000201', 'aal2');
update public.media_assets
set status = 'published'
where storage_path = '2026/10/retention-photo.webp';

-- Delete author profile as admin
select pg_temp.assume_admin();
delete from auth.users where id = '10000000-0000-0000-0000-000000000299';

select extensions.is(
  (select json_build_object(
      'exists', count(*) > 0,
      'uploaded_by', (select uploaded_by from public.media_assets where storage_path = '2026/10/retention-photo.webp')
   )::text
   from public.media_assets
   where storage_path = '2026/10/retention-photo.webp'),
  json_build_object(
      'exists', true,
      'uploaded_by', null
  )::text,
  'Assertion 14: Deleting uploader profile preserves media record with uploaded_by set to NULL (ON DELETE SET NULL)'
);

-- Verify editor can still manage the retained media asset
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000201', 'aal2');
select extensions.lives_ok(
  $$
    update public.media_assets
    set credit = 'Preserved Historical Archive / KJIN'
    where storage_path = '2026/10/retention-photo.webp'
  $$,
  'Assertion 15: Editor can manage published media asset even after uploader profile is deleted'
);

-----------------------------------------------------------------------------
-- 5. Test Translation Workflow, MFA, Lockdown & Visibility (Assertions 16-24)
-----------------------------------------------------------------------------
-- 5a. Direct Client Mutation Lockdown
-- Authenticated user attempts direct SQL insert on article_translations -> rejected
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000201', 'aal1');

select extensions.throws_ok(
  $$
    insert into public.article_translations (article_id, language_code, title, content, status)
    values ((select id from test_articles where name = 'published_parent'), 'ur', 'Direct Title', 'Direct Content', 'published')
  $$,
  '42501',
  null,
  'Assertion 16: Direct client mutations on article_translations are rejected by revoked table privileges'
);

-- 5b. Direct Trigger MFA Enforcement (Defense-in-Depth)
-- Table-privileged context setting status = 'published' with AAL1 -> rejected by trigger
select pg_temp.assume_admin_with_jwt('10000000-0000-0000-0000-000000000201', 'aal1');

select extensions.throws_ok(
  $$
    insert into public.article_translations (
      article_id, language_code, title, excerpt, content, status
    )
    values (
      (select id from test_articles where name = 'published_parent'),
      'hi',
      'बायपास शीर्षक',
      'बायपास सारांश',
      'बायपास सामग्री...',
      'published'
    )
  $$,
  'MFA (AAL2) is strictly required to publish translations',
  'Assertion 17: Database trigger article_translations_enforce_integrity directly rejects publication when AAL is not aal2'
);

-- 5c. MFA Enforcement on Translation Publication via RPC
-- Editor attempts to publish translation with AAL1 -> must throw MFA error
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000201', 'aal1');

select extensions.throws_ok(
  $$
    select public.upsert_article_translation(
      (select id from test_articles where name = 'published_parent'),
      'ur',
      'ڈل جھیل کی بحالی مہم',
      'ڈل جھیل کی صفائی کا کام شروع',
      'تفصیلی رپورٹ...',
      'published',
      'ڈل جھیل کی بحالی',
      'سری نگر میں صفائی کی مہم'
    )
  $$,
  'MFA (AAL2) is strictly required to publish translations',
  'Assertion 18: Publishing translation with AAL1 is rejected with MFA required error via RPC'
);

-- Editor publishes translation with AAL2 -> succeeds
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000201', 'aal2');

select extensions.lives_ok(
  $$
    select public.upsert_article_translation(
      (select id from test_articles where name = 'published_parent'),
      'ur',
      'ڈل جھیل کی بحالی مہم',
      'ڈل جھیل کی صفائی کا کام شروع',
      'تفصیلی رپورٹ...',
      'published',
      'ڈل جھیل کی بحالی',
      'سری نگر میں صفائی کی مہم'
    )
  $$,
  'Assertion 19: Publishing translation with AAL2 succeeds via RPC'
);

-- Create Draft Hindi translation on Published parent
select public.upsert_article_translation(
  (select id from test_articles where name = 'published_parent'),
  'hi',
  'डल झील संरक्षण अभियान',
  'डल झील की सफाई का काम शुरू',
  'विस्तृत रिपोर्ट...',
  'draft'
);

-- Create Published Urdu translation on Draft parent
select public.upsert_article_translation(
  (select id from test_articles where name = 'draft_parent'),
  'ur',
  'مسودہ مضمون کا اردو ترجمہ',
  'مسودہ خلاصہ',
  'مسودہ مواد...',
  'published'
);

-- Create Published Urdu translation on Archived parent
select public.upsert_article_translation(
  (select id from test_articles where name = 'archived_parent'),
  'ur',
  'محفوظ شدہ مضمون کا ترجمہ',
  'خلاصہ',
  'مواد...',
  'published'
);

-- 5d. RLS Dual Visibility Gate Checks under true anon role
select pg_temp.assume_anon();

-- Draft Hindi translation on Published parent -> Hidden
select extensions.is_empty(
  $$
    select id from public.article_translations
    where article_id = (select id from test_articles where name = 'published_parent')
      and language_code = 'hi'
  $$,
  'Assertion 20: Anon reader cannot see draft translation even if parent article is published'
);

-- Published Urdu translation on Published parent -> Visible
select extensions.is(
  (select count(*)::int from public.article_translations
   where article_id = (select id from test_articles where name = 'published_parent')
     and language_code = 'ur'),
  1,
  'Assertion 21: Anon reader can see translation when BOTH parent article and translation are published'
);

-- Published translation on Draft parent -> Hidden
select extensions.is_empty(
  $$
    select id from public.article_translations
    where article_id = (select id from test_articles where name = 'draft_parent')
      and language_code = 'ur'
  $$,
  'Assertion 22: Anon reader cannot see published translation if parent article is draft'
);

-- Published translation on Archived parent -> Hidden
select extensions.is_empty(
  $$
    select id from public.article_translations
    where article_id = (select id from test_articles where name = 'archived_parent')
      and language_code = 'ur'
  $$,
  'Assertion 23: Anon reader cannot see published translation if parent article is archived'
);

-- 5e. Test Attribution Immutability and Last Edited By Tracking
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000202', 'aal2');

-- Editor Two updates the Urdu translation on Published parent
select public.upsert_article_translation(
  (select id from test_articles where name = 'published_parent'),
  'ur',
  'ڈل جھیل کی بحالی مہم - تازہ ترین',
  'ڈل جھیل کی صفائی کا کام جاری ہے',
  'تفصیلی رپورٹ جس میں مزید معلومات شامل کی گئی ہیں...',
  'published'
);

select extensions.is(
  (select json_build_object(
      'translator', translator_id,
      'last_editor', last_edited_by
   )::text
   from public.article_translations
   where article_id = (select id from test_articles where name = 'published_parent')
     and language_code = 'ur'),
  json_build_object(
      'translator', '10000000-0000-0000-0000-000000000201'::uuid,
      'last_editor', '10000000-0000-0000-0000-000000000202'::uuid
  )::text,
  'Assertion 24: Original translator_id is preserved while last_edited_by tracks latest editor'
);

-----------------------------------------------------------------------------
-- 6. Test Full-Text Search tsvector Generation (Assertions 25-26)
-----------------------------------------------------------------------------
select extensions.ok(
  (select tsv_search @@ to_tsquery('english', 'conservation')
   from public.articles
   where id = (select id from test_articles where name = 'published_parent')),
  'Assertion 25: Articles tsv_search matches English query with English stemmer'
);

select extensions.ok(
  (select tsv_search @@ to_tsquery('simple', 'ڈل')
   from public.article_translations
   where article_id = (select id from test_articles where name = 'published_parent')
     and language_code = 'ur'),
  'Assertion 26: Article translations tsv_search matches Urdu Unicode query with simple parser'
);

select * from extensions.finish();
rollback;
