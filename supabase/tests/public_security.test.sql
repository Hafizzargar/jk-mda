begin;
select plan(8);

create function pg_temp.assume_employee(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', p_user_id::text,
      'role', 'authenticated',
      'aal', 'aal2',
      'session_id', gen_random_uuid()::text
    )::text,
    true
  );
end;
$$;

insert into public.employee_invites (id, email, display_name, role_key, reason, status)
values
  ('20000000-0000-0000-0000-000000000001', 'owner@test.invalid', 'Owner', 'owner', 'test', 'sending'),
  ('20000000-0000-0000-0000-000000000005', 'author@test.invalid', 'Author', 'author', 'test', 'sending');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner@test.invalid', '', '{}'::jsonb, '{"employee_invite_id":"20000000-0000-0000-0000-000000000001"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'author@test.invalid', '', '{}'::jsonb, '{"employee_invite_id":"20000000-0000-0000-0000-000000000005"}'::jsonb, now(), now());

-- Accept invites and activate profiles
update public.employee_invites set status = 'accepted' where id in ('20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000005');
update public.profiles set status = 'active' where id in ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005');

-- Create articles
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000005');
create temporary table test_articles (name text, id uuid);

-- Draft
insert into test_articles (name, id) select 'draft', (public.create_article('Draft', 'exc', 'body', 'draft-art', null, 'General', null, null, null)).id;
-- Review
insert into test_articles (name, id) select 'review', (public.create_article('Review', 'exc', 'body', 'review-art', null, 'General', null, null, null)).id;
select public.submit_article_for_review((select id from test_articles where name = 'review'));
-- Published
insert into test_articles (name, id) select 'published', (public.create_article('Published', 'exc', 'body', 'pub-art', null, 'General', null, null, null)).id;
select public.submit_article_for_review((select id from test_articles where name = 'published'));
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000001');
select public.publish_article((select id from test_articles where name = 'published'));
-- Archived
insert into test_articles (name, id) select 'archived', (public.create_article('Archived', 'exc', 'body', 'arch-art', null, 'General', null, null, null)).id;
select public.submit_article_for_review((select id from test_articles where name = 'archived'));
select public.publish_article((select id from test_articles where name = 'archived'));
select public.archive_article((select id from test_articles where name = 'archived'));

grant select on test_articles to anon;

-- Switch to anon role
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

-- Test 1: anon -> published article ✅
select is(
  (select count(*)::int from public.articles where id = (select id from test_articles where name = 'published')),
  1,
  'Anon can read published articles'
);

-- Test 2: anon -> draft ❌
select is_empty(
  $$ select id from public.articles where id = (select id from test_articles where name = 'draft') $$,
  'Anon cannot read draft articles'
);

-- Test 3: anon -> review ❌
select is_empty(
  $$ select id from public.articles where id = (select id from test_articles where name = 'review') $$,
  'Anon cannot read review articles'
);

-- Test 4: anon -> archived ❌
select is_empty(
  $$ select id from public.articles where id = (select id from test_articles where name = 'archived') $$,
  'Anon cannot read archived articles'
);

-- Test 5: anon -> article_versions ❌
select is_empty(
  $$ select id from public.article_versions $$,
  'Anon cannot read article versions'
);

-- Test 6: anon -> employee/profile data ❌
select throws_ok(
  $$ select id from public.profiles $$,
  '42501',
  'permission denied for table profiles',
  'Anon cannot read employee profiles'
);

select throws_ok(
  $$ select * from public.role_permissions $$,
  '42501',
  'permission denied for table role_permissions',
  'Anon cannot read role permissions'
);

select throws_ok(
  $$ select id from public.audit_logs $$,
  '42501',
  'permission denied for table audit_logs',
  'Anon cannot read audit logs'
);

select * from finish();
rollback;
