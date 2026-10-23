-- Migration: Self-Profile Management & Author Name Synchronization
-- Allows any authenticated staff member (superadmin, owner, admin, editor, author)
-- to view their details, update their author display name, and synchronize author attribution.

-- 1. Update articles_enforce_integrity trigger to permit author display name synchronization when session bypass is active
create or replace function public.articles_enforce_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_uid uuid := (select auth.uid());
  actor_display_name text;
begin
  -- INSERT Rules
  if TG_OP = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'New articles must be created as drafts.';
    end if;
    
    if actor_uid is null then
      raise exception 'Authenticated employee is required';
    end if;
    
    new.author_id := actor_uid;
    select display_name into actor_display_name from public.profiles where id = actor_uid;
    
    if actor_display_name is null then
      raise exception 'Active profile is required for article creation';
    end if;
    
    new.author_display_name := actor_display_name;
  end if;

  -- UPDATE Rules
  if TG_OP = 'UPDATE' then
    -- Author attribution immutability (except when authorized author name synchronization is active)
    if new.author_id <> old.author_id then
      raise exception 'Cannot change article author_id.';
    end if;
    if new.author_display_name <> old.author_display_name 
       and current_setting('kjin.allow_author_name_sync', true) is distinct from 'on' then
      raise exception 'Cannot change article author_display_name directly.';
    end if;

    -- Slug immutability after publication
    if old.status in ('published', 'archived') and new.slug <> old.slug then
      raise exception 'Cannot change slug of published or archived articles.';
    end if;

    -- View count protection (only allowed if bypass setting is present)
    if new.view_count <> old.view_count and current_setting('kjin.allow_view_count_update', true) is distinct from 'on' then
      raise exception 'Cannot update view_count directly. Use the RPC incrementer.';
    end if;

    -- Status Transition State Machine
    if old.status <> new.status then
      if old.status = 'archived' and new.status not in ('published', 'review', 'draft') then
        raise exception 'Archived articles can only transition to published, review, or draft.';
      elsif old.status = 'draft' and new.status <> 'review' then
        raise exception 'Drafts can only transition to review.';
      elsif old.status = 'review' and new.status not in ('draft', 'published', 'archived') then
        raise exception 'Articles in review can only transition to draft, published, or archived.';
      elsif old.status = 'published' and new.status <> 'archived' then
        raise exception 'Published articles can only transition to archived.';
      end if;
    end if;
  end if;

  -- Metadata Consistency Invariants (runs on both INSERT and UPDATE)
  if new.status in ('draft', 'review') then
    new.published_at := null;
    new.published_by := null;
    new.archived_at := null;
    new.archive_reason := null;
    new.archived_by := null;
  elsif new.status = 'published' then
    if new.published_at is null or new.published_by is null then
      raise exception 'Published articles must have published_at and published_by set.';
    end if;
    new.archived_at := null;
    new.archive_reason := null;
    new.archived_by := null;
  elsif new.status = 'archived' then
    if new.archived_at is null then
      raise exception 'Archived articles must have archived_at set.';
    end if;
  end if;

  return new;
end;
$$;


-- 2. Create update_my_profile RPC
create or replace function public.update_my_profile(
  p_display_name text,
  p_update_articles boolean default true
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_uid uuid := (select auth.uid());
  profile_row public.profiles;
  cleaned_name text;
begin
  if actor_uid is null then 
    raise exception 'Authenticated employee required'; 
  end if;

  cleaned_name := trim(coalesce(p_display_name, ''));
  if length(cleaned_name) not between 1 and 120 then
    raise exception 'Display name must be 1 to 120 characters';
  end if;

  select * into profile_row from public.profiles where id = actor_uid and status = 'active';
  if not found then 
    raise exception 'Active profile not found'; 
  end if;

  -- Update own display name
  update public.profiles set
    display_name = cleaned_name,
    updated_at = now()
  where id = actor_uid
  returning * into profile_row;

  -- Synchronize author display name across authored articles if requested
  if p_update_articles then
    perform set_config('kjin.allow_author_name_sync', 'on', true);

    update public.articles set
      author_display_name = cleaned_name,
      updated_at = now()
    where author_id = actor_uid;
  end if;

  perform public.write_audit_event(
    actor_uid, 
    'employee.profile_updated', 
    'profile', 
    actor_uid, 
    'success', 
    'User updated own author display name', 
    jsonb_build_object('display_name', cleaned_name, 'articles_updated', p_update_articles)
  );

  return profile_row;
end;
$$;

revoke all on function public.update_my_profile(text, boolean) from public;
grant execute on function public.update_my_profile(text, boolean) to authenticated;
