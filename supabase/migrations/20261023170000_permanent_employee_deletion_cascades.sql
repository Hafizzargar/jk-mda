-- Migration: Permanent Employee Deletion Cascades & Safe Foreign Keys
-- Allows employees to be permanently deleted without foreign key constraint violations
-- Authored articles and revisions will retain their display names and content while author/publisher references set to NULL.

-- 1. Relax NOT NULL constraint on article_versions.edited_by
alter table public.article_versions alter column edited_by drop not null;

-- 2. Update foreign keys on articles and article_versions to ON DELETE SET NULL
alter table public.articles drop constraint if exists articles_published_by_fkey;
alter table public.articles add constraint articles_published_by_fkey
  foreign key (published_by) references public.profiles(id) on delete set null;

alter table public.articles drop constraint if exists articles_archived_by_fkey;
alter table public.articles add constraint articles_archived_by_fkey
  foreign key (archived_by) references public.profiles(id) on delete set null;

alter table public.article_versions drop constraint if exists article_versions_edited_by_fkey;
alter table public.article_versions add constraint article_versions_edited_by_fkey
  foreign key (edited_by) references public.profiles(id) on delete set null;

-- 3. Register employee.permanent_delete permission
insert into public.permissions (permission_key, description)
values ('employee.permanent_delete', 'Permanently delete employee account and purge from database')
on conflict (permission_key) do update set description = excluded.description;

insert into public.role_permissions (role_key, permission_key)
values 
  ('owner', 'employee.permanent_delete'),
  ('superadmin', 'employee.permanent_delete')
on conflict do nothing;
