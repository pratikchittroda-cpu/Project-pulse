begin;

create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 120),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.user_profiles enable row level security;

create or replace function public.can_view_user_profile(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select auth.uid() = target_user_id
    or exists (
      select 1
      from public.organization_memberships viewer_membership
      join public.organization_memberships target_membership
        on target_membership.organization_id = viewer_membership.organization_id
      where viewer_membership.user_id = auth.uid()
        and target_membership.user_id = target_user_id
    );
$$;

create policy user_profiles_select on public.user_profiles
  for select to authenticated
  using (public.can_view_user_profile(user_id));

create or replace function public.profile_name_from_auth_user(source_user auth.users)
returns text
language sql
immutable
set search_path = public, auth
as $$
  select left(
    coalesce(
      nullif(trim(source_user.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(source_user.raw_user_meta_data ->> 'name'), ''),
      nullif(trim(source_user.raw_user_meta_data ->> 'user_name'), ''),
      nullif(trim(split_part(coalesce(source_user.email, ''), '@', 1)), ''),
      'ReleaseArc member'
    ),
    120
  );
$$;

create or replace function public.sync_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.user_profiles (user_id, display_name)
  values (new.id, public.profile_name_from_auth_user(new))
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists auth_user_profile_sync on auth.users;
create trigger auth_user_profile_sync
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function public.sync_user_profile();

insert into public.user_profiles (user_id, display_name)
select user_row.id, public.profile_name_from_auth_user(user_row)
from auth.users user_row
on conflict (user_id) do update
  set display_name = excluded.display_name,
      updated_at = timezone('utc', now());

create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

revoke execute on function public.can_view_user_profile(uuid) from public;
grant execute on function public.can_view_user_profile(uuid) to authenticated, service_role;

commit;
