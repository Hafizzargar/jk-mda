-- Test Suite: Phase 7 Database Architecture Schema & Security
-- Tests:
-- 1. Categories & Districts taxonomy and foreign keys
-- 2. Tags and article_tags composite uniqueness
-- 3. Media assets table constraints, approval status, and visibility
-- 4. Translation workflow: independent publication, dual visibility gate, attribution, and MFA
-- 5. Full-text search tsvector generation across English and Urdu Unicode scripts
--
-- Security Simulation:
-- Tests use SET LOCAL ROLE anon / authenticated to verify true RLS policy behavior.

begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(20);

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
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000201');

insert into public.tags (slug, name_en, name_ur, name_hi)
values ('dal-lake', 'Dal Lake', 'ڈل جھیل', 'डल झील')
on conflict do nothing;

select extensions.ok(
  exists (select 1 from public.tags where slug = 'dal-lake'),
  'Assertion 6: Editor successfully created Dal Lake tag'
);

-- Setup test article for tagging (Published)
select pg_temp.assume_admin();
insert into public.articles (id, title, excerpt, content, slug, category, status, author_id, author_display_name, published_at, published_by)
values (
  '30000000-0000-0000-0000-000000000001',
  'Dal Lake Conservation Drive',
  'Efforts underway to restore Dal Lake',
  'Full report on lake cleaning project in Srinagar...',
  'dal-lake-conservation-drive',
  'Environment',
  'published',
  '10000000-0000-0000-0000-000000000201',
  'Phase7 Editor One',
  now(),
  '10000000-0000-0000-0000-000000000201'
) on conflict (id) do nothing;

insert into public.article_tags (article_id, tag_id)
values (
  '30000000-0000-0000-0000-000000000001',
  (select id from public.tags where slug = 'dal-lake')
);

-- Verify duplicate tag insertion fails on composite primary key
select extensions.throws_ok(
  $$
    insert into public.article_tags (article_id, tag_id)
    values (
      '30000000-0000-0000-0000-000000000001',
      (select id from public.tags where slug = 'dal-lake')
    )
  $$,
  '23505',
  null,
  'Assertion 7: Duplicate tag assignment on (article_id, tag_id) is blocked by composite primary key'
);

-----------------------------------------------------------------------------
-- 4. Test Media Assets Catalog, Constraints & Visibility (Assertions 8-11)
-----------------------------------------------------------------------------
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000201');

-- Published image
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
);

select extensions.ok(
  exists (select 1 from public.media_assets where storage_path = '2026/10/dal-lake.webp'),
  'Assertion 8: Media asset created with localized alt text and credit'
);

-- Verify SVG is blocked by strict image mime_type constraint
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
      'published',
      '10000000-0000-0000-0000-000000000201'
    )
  $$,
  '23514',
  null,
  'Assertion 9: SVG mime type is blocked by database check constraint'
);

-- Draft image (embargoed)
insert into public.media_assets (
  storage_path, public_url, alt_text_en, mime_type, status, uploaded_by
)
values (
  '2026/10/embargoed-lake.webp',
  'https://cdn.kjin.org/news-media/2026/10/embargoed-lake.webp',
  'Embargoed image',
  'image/webp',
  'draft',
  '10000000-0000-0000-0000-000000000201'
);

-- Under real 'anon' role, draft image is hidden
select pg_temp.assume_anon();

select extensions.is_empty(
  $$ select id from public.media_assets where storage_path = '2026/10/embargoed-lake.webp' $$,
  'Assertion 10: Anonymous reader cannot see media assets with status draft'
);

-- Under uploader role, draft image IS visible
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000201');

select extensions.is(
  (select count(*)::int from public.media_assets where storage_path = '2026/10/embargoed-lake.webp'),
  1,
  'Assertion 11: Uploader can see their own draft media asset'
);

-----------------------------------------------------------------------------
-- 5. Test Translation Workflow, MFA, Attribution & Visibility (Assertions 12-18)
-----------------------------------------------------------------------------
-- Setup articles representing distinct valid lifecycle states
select pg_temp.assume_admin();

-- Article 2: Draft Parent Article
insert into public.articles (id, title, excerpt, content, slug, category, status, author_id, author_display_name)
values (
  '30000000-0000-0000-0000-000000000002',
  'Draft Article Title',
  'Draft excerpt',
  'Draft article content...',
  'draft-article-for-translation-test',
  'Local',
  'draft',
  '10000000-0000-0000-0000-000000000203',
  'Phase7 Author'
) on conflict (id) do nothing;

-- Article 3: Archived Parent Article (valid status machine: created as published then archived)
insert into public.articles (id, title, excerpt, content, slug, category, status, author_id, author_display_name, published_at, published_by, archived_at)
values (
  '30000000-0000-0000-0000-000000000003',
  'Archived Article Title',
  'Archived excerpt',
  'Archived article content...',
  'archived-article-for-translation-test',
  'Economy',
  'archived',
  '10000000-0000-0000-0000-000000000201',
  'Phase7 Editor One',
  now(),
  '10000000-0000-0000-0000-000000000201',
  now()
) on conflict (id) do nothing;

-- 5a. MFA Enforcement on Translation Publication
-- Editor attempts to publish translation with AAL1 -> must throw error
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000201', 'aal1');

select extensions.throws_ok(
  $$
    select public.upsert_article_translation(
      '30000000-0000-0000-0000-000000000001',
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
  'Assertion 12: Publishing translation with AAL1 is rejected with MFA required error'
);

-- Editor publishes translation with AAL2 -> succeeds
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000201', 'aal2');

select extensions.lives_ok(
  $$
    select public.upsert_article_translation(
      '30000000-0000-0000-0000-000000000001',
      'ur',
      'ڈل جھیل کی بحالی مہم',
      'ڈل جھیل کی صفائی کا کام شروع',
      'تفصیلی رپورٹ...',
      'published',
      'ڈل جھیل کی بحالی',
      'سری نگر میں صفائی کی مہم'
    )
  $$,
  'Assertion 13: Publishing translation with AAL2 succeeds'
);

-- Create Draft translation (Urdu) on Article 1 (Published parent)
select public.upsert_article_translation(
  '30000000-0000-0000-0000-000000000001',
  'hi',
  'डल झील संरक्षण अभियान',
  'डल झील की सफाई का काम शुरू',
  'विस्तृत रिपोर्ट...',
  'draft'
);

-- Create Published translation on Article 2 (Draft parent)
select public.upsert_article_translation(
  '30000000-0000-0000-0000-000000000002',
  'ur',
  'مسودہ مضمون کا اردو ترجمہ',
  'مسودہ خلاصہ',
  'مسودہ مواد...',
  'published'
);

-- Create Published translation on Article 3 (Archived parent)
select public.upsert_article_translation(
  '30000000-0000-0000-0000-000000000003',
  'ur',
  'محفوظ شدہ مضمون کا ترجمہ',
  'خلاصہ',
  'مواد...',
  'published'
);

-- 5b. RLS Dual Visibility Gate Checks under true anon role
select pg_temp.assume_anon();

-- Draft Hindi translation on Published parent -> Hidden
select extensions.is_empty(
  $$
    select id from public.article_translations
    where article_id = '30000000-0000-0000-0000-000000000001'
      and language_code = 'hi'
  $$,
  'Assertion 14: Anon reader cannot see draft translation even if parent article is published'
);

-- Published Urdu translation on Published parent -> Visible
select extensions.is(
  (select count(*)::int from public.article_translations
   where article_id = '30000000-0000-0000-0000-000000000001'
     and language_code = 'ur'),
  1,
  'Assertion 15: Anon reader can see translation when BOTH parent article and translation are published'
);

-- Published translation on Draft parent -> Hidden
select extensions.is_empty(
  $$
    select id from public.article_translations
    where article_id = '30000000-0000-0000-0000-000000000002'
      and language_code = 'ur'
  $$,
  'Assertion 16: Anon reader cannot see published translation if parent article is draft'
);

-- Published translation on Archived parent -> Hidden
select extensions.is_empty(
  $$
    select id from public.article_translations
    where article_id = '30000000-0000-0000-0000-000000000003'
      and language_code = 'ur'
  $$,
  'Assertion 17: Anon reader cannot see published translation if parent article is archived'
);

-- 5c. Test Attribution Immutability and Last Edited By Tracking
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000202', 'aal2');

-- Editor Two updates the Urdu translation on Article 1
select public.upsert_article_translation(
  '30000000-0000-0000-0000-000000000001',
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
   where article_id = '30000000-0000-0000-0000-000000000001' and language_code = 'ur'),
  json_build_object(
      'translator', '10000000-0000-0000-0000-000000000201'::uuid,
      'last_editor', '10000000-0000-0000-0000-000000000202'::uuid
  )::text,
  'Assertion 18: Original translator_id is preserved while last_edited_by tracks latest editor'
);

-----------------------------------------------------------------------------
-- 6. Test Full-Text Search tsvector Generation (Assertions 19-20)
-----------------------------------------------------------------------------
select extensions.ok(
  (select tsv_search @@ to_tsquery('english', 'conservation') from public.articles where id = '30000000-0000-0000-0000-000000000001'),
  'Assertion 19: Articles tsv_search matches English query with English stemmer'
);

select extensions.ok(
  (select tsv_search @@ to_tsquery('simple', 'ڈل') from public.article_translations where article_id = '30000000-0000-0000-0000-000000000001' and language_code = 'ur'),
  'Assertion 20: Article translations tsv_search matches Urdu Unicode query with simple parser'
);

select * from extensions.finish();
rollback;
