-- Test Suite: Phase 7 Database Architecture Schema & Security
-- Tests:
-- 1. Categories & Districts taxonomy and foreign keys
-- 2. Tags and article_tags composite uniqueness
-- 3. Media assets table constraints and permissions
-- 4. Translation workflow: independent publication and strict visibility gate
-- 5. Full-text search tsvector generated columns

begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(16);

-- Helper functions for role simulation
create or replace function pg_temp.assume_employee(p_user_id uuid, p_aal text default 'aal1')
returns void language plpgsql as $$
begin
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
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'anon')::text, true);
end;
$$;

-- Setup test users
insert into public.employee_invites (id, email, display_name, role_key, reason, status)
values
  ('20000000-0000-0000-0000-000000000201', 'p7-editor@test.invalid', 'Phase7 Editor', 'editor', 'test fixture', 'sending'),
  ('20000000-0000-0000-0000-000000000202', 'p7-author@test.invalid', 'Phase7 Author', 'author', 'test fixture', 'sending')
on conflict do nothing;

insert into auth.users (id, aud, role, email, encrypted_password, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000201', 'authenticated', 'authenticated', 'p7-editor@test.invalid', '', '{"employee_invite_id":"20000000-0000-0000-0000-000000000201"}', now(), now()),
  ('10000000-0000-0000-0000-000000000202', 'authenticated', 'authenticated', 'p7-author@test.invalid', '', '{"employee_invite_id":"20000000-0000-0000-0000-000000000202"}', now(), now())
on conflict do nothing;

update public.profiles set role_key = 'editor', status = 'active' where id = '10000000-0000-0000-0000-000000000201';
update public.profiles set role_key = 'author', status = 'active' where id = '10000000-0000-0000-0000-000000000202';

-----------------------------------------------------------------------------
-- 1. Test Categories Seed & Lookup
-----------------------------------------------------------------------------
select extensions.is(
  (select count(*)::int from public.categories),
  9,
  'All 9 categories seeded from taxonomy.ts exist'
);

select extensions.is(
  (select name_en from public.categories where slug = 'politics'),
  'Politics',
  'Category politics correctly configured'
);

-----------------------------------------------------------------------------
-- 2. Test Districts Seed & Division Constraints
-----------------------------------------------------------------------------
select extensions.is(
  (select count(*)::int from public.districts),
  20,
  'All 20 Jammu & Kashmir districts seeded from taxonomy.ts exist'
);

select extensions.is(
  (select count(*)::int from public.districts where division = 'Kashmir'),
  10,
  'Kashmir division has exactly 10 districts'
);

select extensions.is(
  (select count(*)::int from public.districts where division = 'Jammu'),
  10,
  'Jammu division has exactly 10 districts'
);

-----------------------------------------------------------------------------
-- 3. Test Tags & Composite Uniqueness
-----------------------------------------------------------------------------
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000201');

insert into public.tags (slug, name_en, name_ur, name_hi)
values ('dal-lake', 'Dal Lake', 'ڈل جھیل', 'डल झील')
on conflict do nothing;

select extensions.ok(
  exists (select 1 from public.tags where slug = 'dal-lake'),
  'Editor successfully created Dal Lake tag'
);

-- Create test article for tagging
insert into public.articles (id, title, excerpt, content, slug, category, status, author_id, author_display_name, published_at, published_by)
values (
  '30000000-0000-0000-0000-000000000001',
  'Dal Lake Conservation Drive',
  'Efforts underway to restore Dal Lake',
  'Full report on lake cleaning project...',
  'dal-lake-conservation-drive',
  'Environment',
  'published',
  '10000000-0000-0000-0000-0000000201',
  'Phase7 Editor',
  now(),
  '10000000-0000-0000-0000-0000000201'
) on conflict (id) do nothing;

insert into public.article_tags (article_id, tag_id)
values (
  '30000000-0000-0000-0000-000000000001',
  (select id from public.tags where slug = 'dal-lake')
);

-- Verify duplicate tag insertion fails
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
  'Duplicate tag assignment on (article_id, tag_id) is blocked by composite primary key'
);

-----------------------------------------------------------------------------
-- 4. Test Media Assets Catalog
-----------------------------------------------------------------------------
insert into public.media_assets (
  storage_path, public_url, alt_text_en, alt_text_ur, alt_text_hi, credit, mime_type, uploaded_by
)
values (
  '2026/10/dal-lake.webp',
  'https://cdn.kjin.org/news-media/2026/10/dal-lake.webp',
  'Shikara on Dal Lake in Srinagar',
  'ڈل جھیل پر شکارا',
  'डल झील पर शिकारा',
  'KJIN Photo / Bilal Ahmad',
  'image/webp',
  '10000000-0000-0000-0000-0000000201'
);

select extensions.ok(
  exists (select 1 from public.media_assets where storage_path = '2026/10/dal-lake.webp'),
  'Media asset created with localized alt text and credit'
);

-----------------------------------------------------------------------------
-- 5. Test Translation Workflow & Independent Visibility Gate
-----------------------------------------------------------------------------
-- Create Urdu translation in 'draft' status
select public.upsert_article_translation(
  '30000000-0000-0000-0000-000000000001',
  'ur',
  'ڈل جھیل کی بحالی مہم',
  'ڈل جھیل کی صفائی کا کام شروع',
  'تفصیلی رپورٹ...',
  'draft',
  'ڈل جھیل کی بحالی - کے جے آئی این',
  'سری نگر میں ڈل جھیل کی صفائی کی مہم'
);

-- Anon Reader should NOT see the draft translation even though parent article is published
select pg_temp.assume_anon();

select extensions.is_empty(
  $$
    select id from public.article_translations
    where article_id = '30000000-0000-0000-0000-000000000001'
      and language_code = 'ur'
  $$,
  'Anon reader cannot see an Urdu translation while it is still in draft'
);

-- Publish the Urdu translation
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000201');

select public.upsert_article_translation(
  '30000000-0000-0000-0000-000000000001',
  'ur',
  'ڈل جھیل کی بحالی مہم',
  'ڈل جھیل کی صفائی کا کام شروع',
  'تفصیلی رپورٹ...',
  'published',
  'ڈل جھیل کی بحالی - کے جے آئی این',
  'سری نگر میں ڈل جھیل کی صفائی کی مہم'
);

-- Now Anon Reader CAN see the published translation
select pg_temp.assume_anon();

select extensions.is(
  (select count(*)::int from public.article_translations
   where article_id = '30000000-0000-0000-0000-000000000001' and language_code = 'ur'),
  1,
  'Anon reader can see the Urdu translation once it is published'
);

-- If parent article is returned to draft, translation must disappear for anon
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000201');
update public.articles set status = 'draft' where id = '30000000-0000-0000-0000-000000000001';

select pg_temp.assume_anon();

select extensions.is_empty(
  $$
    select id from public.article_translations
    where article_id = '30000000-0000-0000-0000-000000000001'
      and language_code = 'ur'
  $$,
  'Anon reader cannot see translation if parent article status is not published'
);

-----------------------------------------------------------------------------
-- 6. Test Full-Text Search tsvector Generation
-----------------------------------------------------------------------------
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000201');
update public.articles set status = 'published' where id = '30000000-0000-0000-0000-000000000001';

select extensions.ok(
  (select tsv_search is not null from public.articles where id = '30000000-0000-0000-0000-000000000001'),
  'Articles tsv_search generated column is populated'
);

select extensions.ok(
  (select tsv_search @@ to_tsquery('english', 'conservation') from public.articles where id = '30000000-0000-0000-0000-000000000001'),
  'Articles tsv_search matches English query'
);

select extensions.ok(
  (select tsv_search is not null from public.article_translations where article_id = '30000000-0000-0000-0000-000000000001' and language_code = 'ur'),
  'Article translations tsv_search generated column is populated for Urdu text'
);

select extensions.ok(
  (select tsv_search @@ to_tsquery('simple', 'ڈل') from public.article_translations where article_id = '30000000-0000-0000-0000-000000000001' and language_code = 'ur'),
  'Article translations tsv_search matches Urdu Unicode query'
);

select * from extensions.finish();
rollback;
