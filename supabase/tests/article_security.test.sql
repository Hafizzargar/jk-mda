begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

create or replace function pg_temp.assume_employee(p_user_id uuid, p_aal text default 'aal1')
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
      'aal', p_aal,
      'session_id', gen_random_uuid()::text
    )::text,
    true
  );
end;
$$;

create or replace function pg_temp.assume_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'anon')::text,
    true
  );
end;
$$;

insert into public.employee_invites (id, email, display_name, role_key, reason, status)
values
  ('20000000-0000-0000-0000-000000000100', 'article-superadmin@test.invalid', 'Article Superadmin', 'superadmin', 'test fixture', 'sending'),
  ('20000000-0000-0000-0000-000000000101', 'article-admin@test.invalid', 'Article Admin', 'admin', 'test fixture', 'sending'),
  ('20000000-0000-0000-0000-000000000102', 'article-editor@test.invalid', 'Article Editor', 'editor', 'test fixture', 'sending'),
  ('20000000-0000-0000-0000-000000000103', 'article-author1@test.invalid', 'Article Author 1', 'author', 'test fixture', 'sending'),
  ('20000000-0000-0000-0000-000000000104', 'article-author2@test.invalid', 'Article Author 2', 'author', 'test fixture', 'sending')
on conflict do nothing;

insert into auth.users (id, aud, role, email, encrypted_password, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000100', 'authenticated', 'authenticated', 'article-superadmin@test.invalid', '', '{"employee_invite_id":"20000000-0000-0000-0000-000000000100"}', now(), now()),
  ('10000000-0000-0000-0000-000000000101', 'authenticated', 'authenticated', 'article-admin@test.invalid', '', '{"employee_invite_id":"20000000-0000-0000-0000-000000000101"}', now(), now()),
  ('10000000-0000-0000-0000-000000000102', 'authenticated', 'authenticated', 'article-editor@test.invalid', '', '{"employee_invite_id":"20000000-0000-0000-0000-000000000102"}', now(), now()),
  ('10000000-0000-0000-0000-000000000103', 'authenticated', 'authenticated', 'article-author1@test.invalid', '', '{"employee_invite_id":"20000000-0000-0000-0000-000000000103"}', now(), now()),
  ('10000000-0000-0000-0000-000000000104', 'authenticated', 'authenticated', 'article-author2@test.invalid', '', '{"employee_invite_id":"20000000-0000-0000-0000-000000000104"}', now(), now())
on conflict do nothing;

update public.profiles set role_key = 'superadmin', status = 'active' where id = '10000000-0000-0000-0000-000000000100';
update public.profiles set role_key = 'admin', status = 'active' where id = '10000000-0000-0000-0000-000000000101';
update public.profiles set role_key = 'editor', status = 'active' where id = '10000000-0000-0000-0000-000000000102';
update public.profiles set role_key = 'author', status = 'active' where id = '10000000-0000-0000-0000-000000000103';
update public.profiles set role_key = 'author', status = 'active' where id = '10000000-0000-0000-0000-000000000104';

create temp table test_vars (
  k text primary key,
  v uuid
);
grant select on test_vars to public;

-----------------------------------------------------------------------------
-- 1. Unauthenticated creation is blocked
-----------------------------------------------------------------------------
select pg_temp.assume_anon();
select extensions.throws_ok(
  $$ select public.create_article('Anon title', 'excerpt', 'content', 'anon-slug', null, 'General', null, null, null) $$,
  'Authenticated employee required',
  'Unauthenticated users cannot create articles'
);

-----------------------------------------------------------------------------
-- 2. Author creates article -> allowed
-----------------------------------------------------------------------------
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000103');
insert into test_vars (k, v) select 'a1_id', (public.create_article('Author1 Title', 'excerpt', 'content', 'author1-slug', null, 'General', null, null, null)).id;
select extensions.ok((select v from test_vars where k = 'a1_id') is not null, 'Author1 successfully created an article');

-----------------------------------------------------------------------------
-- 3. Editor creates article -> allowed
-----------------------------------------------------------------------------
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000102');
insert into test_vars (k, v) select 'a_review', (public.create_article('Editor Title', 'excerpt', 'content', 'editor-slug', null, 'General', null, null, null)).id;
select extensions.ok((select v from test_vars where k = 'a_review') is not null, 'Editor successfully created an article');

-----------------------------------------------------------------------------
-- 4. Author edit own draft -> allowed
-----------------------------------------------------------------------------
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000103');
select extensions.lives_ok(
  $$ select public.update_article((select v from test_vars where k = 'a1_id'), 'Author1 Title Updated', 'excerpt', 'content', 'author1-slug', null, 'General', null, null, null) $$,
  'Author1 edited own draft'
);

-----------------------------------------------------------------------------
-- 5. Author edit another draft -> denied
-----------------------------------------------------------------------------
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000104');
select extensions.throws_ok(
  $$ select public.update_article((select v from test_vars where k = 'a1_id'), 'Author2 Title', 'excerpt', 'content', 'slug', null, 'General', null, null, null) $$,
  'Unauthorized to edit this article in its current state',
  'Author2 cannot edit Author1 draft'
);

-----------------------------------------------------------------------------
-- 6. Editor edit draft -> allowed
-----------------------------------------------------------------------------
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000102');
select extensions.lives_ok(
  $$ select public.update_article((select v from test_vars where k = 'a1_id'), 'Editor edit', 'excerpt', 'content', 'slug', null, 'General', null, null, null) $$,
  'Editor edited author draft'
);

-----------------------------------------------------------------------------
-- 7. Author submit own draft -> allowed
-----------------------------------------------------------------------------
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000103');
select extensions.lives_ok(
  $$ select public.submit_article_for_review((select v from test_vars where k = 'a1_id')) $$,
  'Author1 submitted own draft for review'
);

-----------------------------------------------------------------------------
-- 8. Author edit review -> denied
-----------------------------------------------------------------------------
select extensions.throws_ok(
  $$ select public.update_article((select v from test_vars where k = 'a1_id'), 'Author edit', 'excerpt', 'content', 'slug', null, 'General', null, null, null) $$,
  'Unauthorized to edit this article in its current state',
  'Author1 cannot edit after submission'
);

-----------------------------------------------------------------------------
-- 9. Author submit another draft -> denied
-----------------------------------------------------------------------------
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000103');
select extensions.throws_ok(
  $$ select public.submit_article_for_review((select v from test_vars where k = 'a_review')) $$,
  'Only the author can submit their draft for review',
  'Author1 cannot submit Editor draft'
);

-----------------------------------------------------------------------------
-- 10. Editor edit review -> allowed
-----------------------------------------------------------------------------
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000102');
select extensions.lives_ok(
  $$ select public.update_article((select v from test_vars where k = 'a1_id'), 'Editor Review Edit', 'excerpt', 'content', 'slug', null, 'General', null, null, null) $$,
  'Editor edited article in review'
);

-----------------------------------------------------------------------------
-- 11. Author return review -> denied
-----------------------------------------------------------------------------
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000103');
select extensions.throws_ok(
  $$ select public.return_article_to_draft((select v from test_vars where k = 'a1_id')) $$,
  'Article review permission required',
  'Author cannot return article to draft'
);

-----------------------------------------------------------------------------
-- 12. Editor return review -> allowed
-----------------------------------------------------------------------------
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000102');
select extensions.lives_ok(
  $$ select public.return_article_to_draft((select v from test_vars where k = 'a1_id')) $$,
  'Editor returned article to draft'
);
-- Submit again for publish test
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000103');
select public.submit_article_for_review((select v from test_vars where k = 'a1_id'));

-----------------------------------------------------------------------------
-- 13. Editor publish -> denied
-----------------------------------------------------------------------------
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000102');
select extensions.throws_ok(
  $$ select public.publish_article((select v from test_vars where k = 'a1_id')) $$,
  'Article publish permission required',
  'Editor cannot publish'
);

-----------------------------------------------------------------------------
-- 14. Superadmin publish without AAL2 -> denied
-----------------------------------------------------------------------------
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000100', 'aal1');
select extensions.throws_ok(
  $$ select public.publish_article((select v from test_vars where k = 'a1_id')) $$,
  'Article publish permission required',
  'Superadmin without AAL2 cannot publish'
);

-----------------------------------------------------------------------------
-- 15. Superadmin publish with AAL2 -> allowed
-----------------------------------------------------------------------------
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000100', 'aal2');
select extensions.lives_ok(
  $$ select public.publish_article((select v from test_vars where k = 'a1_id')) $$,
  'Superadmin with AAL2 published article'
);

-----------------------------------------------------------------------------
-- 16. Editor archive -> denied
-----------------------------------------------------------------------------
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000102');
select extensions.throws_ok(
  $$ select public.archive_article((select v from test_vars where k = 'a1_id')) $$,
  'Article archive permission required',
  'Editor cannot archive'
);

-----------------------------------------------------------------------------
-- 17. Admin archive without AAL2 -> denied
-----------------------------------------------------------------------------
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000101', 'aal1');
select extensions.throws_ok(
  $$ select public.archive_article((select v from test_vars where k = 'a1_id')) $$,
  'Article archive permission required',
  'Admin without AAL2 cannot archive'
);

-----------------------------------------------------------------------------
-- 18. Admin archive with AAL2 -> allowed
-----------------------------------------------------------------------------
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000101', 'aal2');
select extensions.lives_ok(
  $$ select public.archive_article((select v from test_vars where k = 'a1_id')) $$,
  'Admin with AAL2 archived article'
);

-----------------------------------------------------------------------------
-- 19. Direct INSERT/UPDATE/DELETE -> denied
-----------------------------------------------------------------------------
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000101', 'aal2');
set local role authenticated;
select extensions.throws_ok(
  $$ insert into public.articles (title, content, slug) values ('a', 'b', 'c') $$,
  'new row violates row-level security policy for table "articles"',
  'Direct INSERT is blocked'
);

select extensions.lives_ok(
  $$ update public.articles set title = 'x' where id = (select v from test_vars where k = 'a1_id') $$,
  'Direct UPDATE executes but modifies 0 rows due to RLS'
);

select extensions.lives_ok(
  $$ delete from public.articles where id = (select v from test_vars where k = 'a1_id') $$,
  'Direct DELETE executes but modifies 0 rows due to RLS'
);
reset role;

-----------------------------------------------------------------------------
-- 20. Anonymous SELECT (published allowed, draft denied)
-----------------------------------------------------------------------------
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000100', 'aal2');
insert into test_vars (k, v) select 'a_pub', (public.create_article('Pub', 'excerpt', 'content', 'pub-slug', null, 'General', null, null, null)).id;
select public.submit_article_for_review((select v from test_vars where k = 'a_pub'));
select public.publish_article((select v from test_vars where k = 'a_pub'));

select pg_temp.assume_anon();
set local role anon;
select extensions.ok((select count(*) from public.articles where id = (select v from test_vars where k = 'a_pub')) = 1, 'Anon can select published');
select extensions.ok((select count(*) from public.articles where id = (select v from test_vars where k = 'a_review')) = 0, 'Anon cannot select draft');
reset role;

select * from finish();
rollback;
