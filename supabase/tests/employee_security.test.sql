begin;

create extension if not exists pgtap with schema extensions;
select extensions.no_plan();

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
  ('20000000-0000-0000-0000-000000000001', 'rbac-owner@test.invalid', 'RBAC Owner', 'owner', 'test fixture', 'sending'),
  ('20000000-0000-0000-0000-000000000002', 'rbac-superadmin@test.invalid', 'RBAC Superadmin', 'superadmin', 'test fixture', 'sending'),
  ('20000000-0000-0000-0000-000000000003', 'rbac-admin@test.invalid', 'RBAC Admin', 'admin', 'test fixture', 'sending'),
  ('20000000-0000-0000-0000-000000000004', 'rbac-editor@test.invalid', 'RBAC Editor', 'editor', 'test fixture', 'sending'),
  ('20000000-0000-0000-0000-000000000005', 'rbac-author@test.invalid', 'RBAC Author', 'author', 'test fixture', 'sending'),
  ('20000000-0000-0000-0000-000000000006', 'rbac-author-two@test.invalid', 'RBAC Author Two', 'author', 'test fixture', 'sending'),
  ('20000000-0000-0000-0000-000000000007', 'rbac-invite-accept@test.invalid', 'Invite Acceptance', 'author', 'test fixture', 'sending');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'rbac-owner@test.invalid', '', '{}'::jsonb, '{"employee_invite_id":"20000000-0000-0000-0000-000000000001"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'rbac-superadmin@test.invalid', '', '{}'::jsonb, '{"employee_invite_id":"20000000-0000-0000-0000-000000000002"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'rbac-admin@test.invalid', '', '{}'::jsonb, '{"employee_invite_id":"20000000-0000-0000-0000-000000000003"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'rbac-editor@test.invalid', '', '{}'::jsonb, '{"employee_invite_id":"20000000-0000-0000-0000-000000000004"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'rbac-author@test.invalid', '', '{}'::jsonb, '{"employee_invite_id":"20000000-0000-0000-0000-000000000005"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'rbac-author-two@test.invalid', '', '{}'::jsonb, '{"employee_invite_id":"20000000-0000-0000-0000-000000000006"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'rbac-invite-accept@test.invalid', '', '{}'::jsonb, '{"employee_invite_id":"20000000-0000-0000-0000-000000000007"}'::jsonb, now(), now());

update public.profiles set status = 'active' where id <> '10000000-0000-0000-0000-000000000007';

select pg_temp.assume_employee('10000000-0000-0000-0000-000000000005');
select extensions.throws_ok(
  $$ select public.request_employee_invite('higher-role@test.invalid', 'Higher Role', 'superadmin', 'Test role ceiling') $$,
  'P0001', 'You cannot request an employee above your role level', 'Author cannot request an above-rank invitation'
);

create temporary table security_test_articles (article_owner text primary key, id uuid not null);
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000003');
insert into security_test_articles (article_owner, id)
select 'owner', (public.create_article('Permission matrix test article', 'Test summary', 'Test body for publication authorization.', 'test-slug-' || floor(random() * 1000000)::text, null, 'Testing', null, null, null)).id;
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000006');
insert into security_test_articles (article_owner, id)
select 'superadmin', (public.create_article('Superadmin publication test article', 'Second test summary', 'Second test body for publication authorization.', 'test-slug-' || floor(random() * 1000000)::text, null, 'Testing', null, null, null)).id;

select pg_temp.assume_employee('10000000-0000-0000-0000-000000000003');
select extensions.throws_ok(
  format('select public.publish_article(%L)', (select id from security_test_articles order by id limit 1)),
  'P0001', 'Article publish permission required', 'Author cannot publish through the database RPC'
);

select extensions.is(
  (select array_agg(roles.role_key order by roles.hierarchy_rank desc) from public.role_permissions grants join public.roles roles using (role_key) where grants.permission_key = 'employee.role.change'),
  array['owner', 'superadmin', 'admin']::text[], 'Role-change permission matrix'
);
select extensions.is(
  (select array_agg(roles.role_key order by roles.hierarchy_rank desc) from public.role_permissions grants join public.roles roles using (role_key) where grants.permission_key = 'employee.disable'),
  array['owner', 'superadmin']::text[], 'Disable permission matrix'
);
select extensions.is(
  (select array_agg(roles.role_key order by roles.hierarchy_rank desc) from public.role_permissions grants join public.roles roles using (role_key) where grants.permission_key = 'employee.deletion.request'),
  array['owner', 'superadmin', 'admin']::text[], 'Deletion request permission matrix'
);
select extensions.is(
  (select array_agg(roles.role_key order by roles.hierarchy_rank desc) from public.role_permissions grants join public.roles roles using (role_key) where grants.permission_key = 'employee.deletion.resolve'),
  array['owner', 'superadmin']::text[], 'Deletion approval permission matrix'
);
select extensions.is(
  (select array_agg(roles.role_key order by roles.hierarchy_rank desc) from public.role_permissions grants join public.roles roles using (role_key) where grants.permission_key = 'article.publish'),
  array['owner', 'superadmin']::text[], 'Article publish permission matrix'
);

select pg_temp.assume_employee('10000000-0000-0000-0000-000000000001');
select extensions.throws_ok(
  $$ select public.change_employee_role('10000000-0000-0000-0000-000000000005', 'superadmin', 'Second Superadmin slot occupied') $$,
  'P0001', 'Only one Second Superadmin is allowed', 'Promotion to Superadmin is blocked while the slot is occupied'
);
select extensions.lives_ok(
  $$ select public.change_employee_role('10000000-0000-0000-0000-000000000002', 'admin', 'Free the single Superadmin slot') $$,
  'Owner can demote the existing Superadmin to free the slot'
);
select extensions.lives_ok(
  $$ select public.change_employee_role('10000000-0000-0000-0000-000000000005', 'superadmin', 'Owner bootstrap matrix test') $$,
  'Owner can promote a lower-ranked employee to Superadmin'
);
select extensions.throws_ok(
  $$ select public.change_employee_role('10000000-0000-0000-0000-000000000006', 'superadmin', 'Second Superadmin slot occupied again') $$,
  'P0001', 'Only one Second Superadmin is allowed', 'Only one Superadmin profile can exist at a time'
);
select extensions.lives_ok(
  $$ select public.change_employee_role('10000000-0000-0000-0000-000000000005', 'admin', 'Owner demotion matrix test') $$,
  'Owner can manage a Superadmin employee'
);
select extensions.lives_ok(
  $$ select public.change_employee_role('10000000-0000-0000-0000-000000000002', 'superadmin', 'Restore the fixture Superadmin') $$,
  'Owner can restore the single Superadmin'
);
select extensions.throws_ok(
  $$ select public.change_employee_role('10000000-0000-0000-0000-000000000001', 'author', 'Owner must remain protected') $$,
  'P0001', 'You cannot change this employee role', 'Owner cannot modify the Owner profile'
);
select extensions.throws_ok(
  $$ select public.change_employee_role('10000000-0000-0000-0000-000000000006', 'editor', repeat('x', 1001)) $$,
  'P0001', 'Reason is too long', 'Role changes reject reasons above 1000 characters'
);
select extensions.throws_ok(
  $$ select public.update_employee_basic('10000000-0000-0000-0000-000000000006', repeat('x', 121), 'Valid reason') $$,
  'P0001', 'Display name must be 1 to 120 characters', 'Basic updates reject display names above 120 characters'
);
select extensions.throws_ok(
  $$ select public.set_employee_status('10000000-0000-0000-0000-000000000006', 'disabled', repeat('x', 1001)) $$,
  'P0001', 'Reason is too long', 'Status changes reject reasons above 1000 characters'
);
select extensions.throws_ok(
  $$ select public.request_employee_invite('second-superadmin@test.invalid', 'Second Superadmin', 'superadmin', 'Slot test') $$,
  'P0001', 'Only one Second Superadmin is allowed', 'Invitation requests for Superadmin are blocked while the slot is occupied'
);
select extensions.throws_ok(
  $$ select public.update_employee_basic('10000000-0000-0000-0000-000000000001', 'Changed Owner', 'Should be denied') $$,
  'P0001', 'You cannot modify this employee', 'Owner cannot edit Owner basic details'
);

select pg_temp.assume_employee('10000000-0000-0000-0000-000000000002');
select extensions.throws_ok(
  $$ select public.change_employee_role('10000000-0000-0000-0000-000000000004', 'owner', 'Must not assign Owner') $$,
  'P0001', 'Owner cannot be assigned through employee management', 'Superadmin cannot assign Owner'
);
select extensions.throws_ok(
  $$ select public.update_employee_basic('10000000-0000-0000-0000-000000000001', 'Changed Owner', 'Should be denied') $$,
  'P0001', 'You cannot modify this employee', 'Superadmin cannot edit Owner basic details'
);
select extensions.throws_ok(
  $$ select public.change_employee_role('10000000-0000-0000-0000-000000000001', 'author', 'Must not modify Owner') $$,
  'P0001', 'You cannot change this employee role', 'Superadmin cannot change Owner role'
);
select extensions.throws_ok(
  $$ select public.set_employee_status('10000000-0000-0000-0000-000000000001', 'disabled', 'Must not disable Owner') $$,
  'P0001', 'You cannot change this employee status', 'Superadmin cannot disable Owner'
);
select extensions.throws_ok(
  $$ select public.request_employee_deletion('10000000-0000-0000-0000-000000000001', 'Must not delete Owner') $$,
  'P0001', 'This employee cannot be requested for deletion', 'Superadmin cannot request Owner deletion'
);
select extensions.lives_ok(
  $$ select public.update_employee_basic('10000000-0000-0000-0000-000000000003', 'Managed Admin', 'Superadmin basic employee management test') $$,
  'Superadmin can manage Admin and lower roles'
);

select pg_temp.assume_employee('10000000-0000-0000-0000-000000000003');
select extensions.throws_ok(
  $$ select public.change_employee_role('10000000-0000-0000-0000-000000000004', 'owner', 'Must not assign Owner') $$,
  'P0001', 'Owner cannot be assigned through employee management', 'Admin cannot assign Owner'
);
select extensions.throws_ok(
  $$ select public.update_employee_basic('10000000-0000-0000-0000-000000000001', 'Changed Owner', 'Should be denied') $$,
  'P0001', 'You cannot modify this employee', 'Admin cannot edit Owner basic details'
);
select extensions.throws_ok(
  $$ select public.change_employee_role('10000000-0000-0000-0000-000000000001', 'author', 'Must not modify Owner') $$,
  'P0001', 'You cannot change this employee role', 'Admin cannot change Owner role'
);
select extensions.lives_ok(
  $$ select public.change_employee_role('10000000-0000-0000-0000-000000000006', 'editor', 'Promote within ceiling') $$,
  'Admin can promote Author to Editor'
);
select extensions.throws_ok(
  $$ select public.set_employee_status('10000000-0000-0000-0000-000000000005', 'disabled', 'Admin lacks permission') $$,
  'P0001', 'Disable access is required', 'Admin cannot disable an employee'
);

select pg_temp.assume_employee('10000000-0000-0000-0000-000000000004');
select extensions.throws_ok(
  $$ select public.change_employee_role('10000000-0000-0000-0000-000000000006', 'author', 'Editor lacks permission') $$,
  'P0001', 'Role-change access is required', 'Editor cannot change employee roles'
);
select extensions.throws_ok(
  $$ select public.publish_article((select id from security_test_articles where article_owner = 'owner')) $$,
  'P0001', 'Article publish permission required', 'Editor cannot publish articles'
);

select pg_temp.assume_employee('10000000-0000-0000-0000-000000000003');
select extensions.lives_ok(
  $$ select public.change_employee_role('10000000-0000-0000-0000-000000000004', 'author', 'Admin manages Editor test') $$,
  'Admin can manage an Editor employee'
);
select extensions.throws_ok(
  $$ select public.publish_article((select id from security_test_articles where article_owner = 'owner')) $$,
  'P0001', 'Article publish permission required', 'Admin cannot publish articles'
);

select pg_temp.assume_employee('10000000-0000-0000-0000-000000000003');
select extensions.throws_ok(
  $$ select public.request_employee_invite('missing-reason@test.invalid', 'Missing Reason', 'author', '') $$,
  'P0001', 'A reason is required', 'Invitation request requires a reason'
);
select extensions.lives_ok(
  $$ select public.request_employee_invite('duplicate-request@test.invalid', 'Duplicate Request', 'author', 'First request') $$,
  'First pending request for an email is accepted'
);
select extensions.throws_ok(
  $$ select public.request_employee_invite('DUPLICATE-REQUEST@test.invalid', 'Duplicate Request', 'author', 'Second request') $$,
  '23505', null, 'Duplicate pending invitation requests are rejected case-insensitively'
);
select extensions.throws_ok(
  format('select public.reject_employee_invite_request(%L, %L)', (select id from public.employee_invite_requests where status = 'pending' order by created_at limit 1), repeat('x', 1001)),
  'P0001', 'Reason is too long', 'Rejections reject reasons above 1000 characters'
);
select extensions.throws_ok(
  $$ select public.request_employee_deletion('10000000-0000-0000-0000-000000000001', 'Protect Owner') $$,
  'P0001', 'This employee cannot be requested for deletion', 'Admin cannot request Owner deletion'
);
create temporary table security_test_deletion_requests (id uuid not null);
insert into security_test_deletion_requests (id)
select public.request_employee_deletion('10000000-0000-0000-0000-000000000005', 'Permission matrix deletion test');
select extensions.throws_ok(
  format('select public.resolve_employee_deletion(%L, %L, %L)', (select id from security_test_deletion_requests), 'approved', 'Admin cannot resolve'),
  'P0001', 'Deletion review access is required', 'Admin cannot approve a deletion request'
);

select pg_temp.assume_employee('10000000-0000-0000-0000-000000000001');
select extensions.lives_ok(
  format('select public.resolve_employee_deletion(%L, %L, %L)', (select id from security_test_deletion_requests), 'approved', 'Owner approval test'),
  'Owner can approve an Admin deletion request for a lower-ranked employee'
);
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000005');
select extensions.is(
  public.has_permission('employee.directory.read'), false,
  'A disabled employee has no permissions'
);

select pg_temp.assume_employee('10000000-0000-0000-0000-000000000001');
select extensions.throws_ok(
  format('update public.articles set status = %L where id = %L', 'published', (select id from security_test_articles where article_owner = 'owner')),
  'P0001',
  'Drafts can only transition to review.',
  'Direct article status writes remain blocked even for Owner'
);
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000003');
select extensions.lives_ok(
  format('select public.submit_article_for_review(%L)', (select id from security_test_articles where article_owner = 'owner')),
  'Author can submit their draft for review'
);
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000001');
select extensions.lives_ok(
  format('select public.publish_article(%L)', (select id from security_test_articles where article_owner = 'owner')),
  'Owner can publish through the authorized database operation'
);

select pg_temp.assume_employee('10000000-0000-0000-0000-000000000006');
select extensions.lives_ok(
  format('select public.submit_article_for_review(%L)', (select id from security_test_articles where article_owner = 'superadmin')),
  'Author can submit their draft for review'
);
select pg_temp.assume_employee('10000000-0000-0000-0000-000000000002');
select extensions.lives_ok(
  format('select public.publish_article(%L)', (select id from security_test_articles where article_owner = 'superadmin')),
  'Superadmin can publish through the authorized database operation'
);

select pg_temp.assume_employee('10000000-0000-0000-0000-000000000007');
select extensions.is(
  (select status from public.profiles where id = '10000000-0000-0000-0000-000000000007'),
  'invited', 'Unaccepted employee remains invited'
);
update auth.users set email_confirmed_at = now() where id = '10000000-0000-0000-0000-000000000007';
select extensions.is(
  (select status from public.profiles where id = '10000000-0000-0000-0000-000000000007'),
  'active', 'Accepted invitation activates the employee'
);
update auth.users set email_confirmed_at = email_confirmed_at where id = '10000000-0000-0000-0000-000000000007';
select extensions.is(
  (select status from public.employee_invites where auth_user_id = '10000000-0000-0000-0000-000000000007'),
  'accepted', 'Repeated confirmation leaves invitation accepted'
);

insert into public.employee_invites (id, email, display_name, role_key, reason, status)
values ('20000000-0000-0000-0000-000000000008', 'duplicate-invite@test.invalid', 'Duplicate Invite', 'author', 'duplicate test', 'sending');
select extensions.throws_ok(
  $$ insert into public.employee_invites (email, display_name, role_key, reason, status)
     values ('duplicate-invite@test.invalid', 'Duplicate Invite', 'author', 'second invite', 'sending') $$,
  '23505', null, 'A second pending invitation for the same email is rejected'
);

insert into public.employee_invites (id, email, display_name, role_key, reason, status, expires_at)
values ('20000000-0000-0000-0000-000000000009', 'expired-invite@test.invalid', 'Expired Invite', 'author', 'expiry test', 'sending', now() - interval '1 minute');
select extensions.throws_ok(
  $$ insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000098', 'authenticated', 'authenticated', 'expired-invite@test.invalid', '', '{}'::jsonb, '{"employee_invite_id":"20000000-0000-0000-0000-000000000009"}'::jsonb, now(), now()) $$,
  'P0001', 'Staff accounts must be provisioned through a server-issued invitation', 'An expired invitation cannot create an employee account'
);
select extensions.is(
  (select count(*)::integer from public.profiles where email = 'expired-invite@test.invalid'),
  0, 'Expired invite leaves no employee profile'
);

select extensions.throws_ok(
  $$ insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000099', 'authenticated', 'authenticated', 'uninvited@test.invalid', '', '{}'::jsonb, '{}'::jsonb, now(), now()) $$,
  'P0001', 'Staff accounts must be provisioned through a server-issued invitation', 'Uninvited Auth account creation is rejected'
);

select extensions.is(
  has_table_privilege('authenticated', 'public.role_permissions', 'select'),
  false, 'Authenticated users cannot read permission grants directly'
);
select extensions.is(
  has_table_privilege('authenticated', 'public.permissions', 'select'),
  false, 'Authenticated users cannot read the permission catalog directly'
);
select extensions.is(
  has_table_privilege('authenticated', 'public.profiles', 'update'),
  false, 'Authenticated users cannot directly update employee profiles'
);
select extensions.is(
  has_table_privilege('authenticated', 'public.profiles', 'insert'),
  false, 'Authenticated users cannot directly insert employee profiles'
);
select extensions.is(
  has_table_privilege('authenticated', 'public.audit_logs', 'insert'),
  false, 'Authenticated users cannot directly write audit events'
);

select * from extensions.finish();
rollback;
