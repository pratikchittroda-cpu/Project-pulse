begin;

create table public.task_saved_views (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  filters jsonb not null default '{}'::jsonb
    check (jsonb_typeof(filters) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_id, user_id, name),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade
);

create index task_saved_views_project_user_idx
  on public.task_saved_views (organization_id, project_id, user_id, name);

alter table public.task_saved_views enable row level security;

create policy task_saved_views_select on public.task_saved_views
  for select to authenticated
  using (
    user_id = auth.uid()
    and public.can_access_project(project_id, organization_id)
  );

create policy task_saved_views_insert on public.task_saved_views
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.can_access_project(project_id, organization_id)
  );

create policy task_saved_views_update on public.task_saved_views
  for update to authenticated
  using (
    user_id = auth.uid()
    and public.can_access_project(project_id, organization_id)
  )
  with check (
    user_id = auth.uid()
    and public.can_access_project(project_id, organization_id)
  );

create policy task_saved_views_delete on public.task_saved_views
  for delete to authenticated
  using (
    user_id = auth.uid()
    and public.can_access_project(project_id, organization_id)
  );

create trigger task_saved_views_set_updated_at
  before update on public.task_saved_views
  for each row execute function public.set_updated_at();

commit;
