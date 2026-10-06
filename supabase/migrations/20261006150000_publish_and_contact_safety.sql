delete from public.role_permissions
where role_key in ('admin', 'editor')
  and permission_key = 'article.publish';

insert into public.role_permissions (role_key, permission_key)
values
  ('owner', 'article.publish'),
  ('superadmin', 'article.publish')
on conflict do nothing;
