-- Migration: Add article.archive permission
-- This ensures the archiving workflow matches the intended Admin+ access
-- without granting dangerous deletion permissions.

insert into public.permissions (permission_key, description)
values ('article.archive', 'Archive published or reviewed articles')
on conflict do nothing;

-- Grant to Owner and Superadmin (who implicitly get all via UI or rules, but we explicitly insert to be safe, 
-- or we can rely on their wildcard behavior if they have it, but for role_permissions, we insert explicit rows)
insert into public.role_permissions (role_key, permission_key)
values
  ('owner', 'article.archive'),
  ('superadmin', 'article.archive'),
  ('admin', 'article.archive')
on conflict do nothing;
