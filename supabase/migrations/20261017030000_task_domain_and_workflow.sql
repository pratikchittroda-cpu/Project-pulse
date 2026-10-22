begin;

create table public.project_task_sequences (
  project_id uuid primary key,
  organization_id uuid not null,
  next_task_number bigint not null default 1 check (next_task_number > 0),
  unique (project_id, organization_id),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade
);

create table public.project_workflow_statuses (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  status text not null check (status ~ '^[a-z][a-z0-9_]{1,39}$'),
  label text not null check (char_length(trim(label)) between 1 and 80),
  position integer not null check (position >= 0),
  is_terminal boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_id, status),
  unique (project_id, organization_id, status),
  unique (id, project_id, organization_id),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade
);

create index project_workflow_statuses_project_position_idx
  on public.project_workflow_statuses (project_id, position);

alter table public.project_task_sequences enable row level security;
alter table public.project_workflow_statuses enable row level security;

create policy project_workflow_statuses_select on public.project_workflow_statuses
  for select to authenticated
  using (public.can_access_project(project_id, organization_id));
create policy project_workflow_statuses_insert on public.project_workflow_statuses
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner', 'admin']));
create policy project_workflow_statuses_update on public.project_workflow_statuses
  for update to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin']))
  with check (public.has_org_role(organization_id, array['owner', 'admin']));
create policy project_workflow_statuses_delete on public.project_workflow_statuses
  for delete to authenticated
  using (public.has_org_role(organization_id, array['owner', 'admin']));

create trigger project_workflow_statuses_set_updated_at
  before update on public.project_workflow_statuses
  for each row execute function public.set_updated_at();

create or replace function public.seed_project_workflow_statuses(
  target_project_id uuid,
  target_organization_id uuid
)
returns void
language sql
security definer
set search_path = public, auth, extensions
as $$
  insert into public.project_workflow_statuses (
    organization_id,
    project_id,
    status,
    label,
    position,
    is_terminal
  )
  select
    target_organization_id,
    target_project_id,
    defaults.status,
    defaults.label,
    defaults.position,
    defaults.is_terminal
  from (values
    ('backlog', 'Backlog', 0, false),
    ('planned', 'Planned', 1, false),
    ('in_progress', 'In progress', 2, false),
    ('blocked', 'Blocked', 3, false),
    ('in_review', 'In review', 4, false),
    ('changes_requested', 'Changes requested', 5, false),
    ('ready_to_merge', 'Ready to merge', 6, false),
    ('completed', 'Completed', 7, true),
    ('canceled', 'Canceled', 8, true)
  ) as defaults(status, label, position, is_terminal)
  on conflict (project_id, status) do nothing;
$$;

create or replace function public.seed_project_task_metadata()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  insert into public.project_task_sequences (project_id, organization_id)
  values (new.id, new.organization_id)
  on conflict (project_id) do nothing;

  perform public.seed_project_workflow_statuses(new.id, new.organization_id);
  return new;
end;
$$;

create trigger projects_seed_task_metadata
  after insert on public.projects
  for each row execute function public.seed_project_task_metadata();

insert into public.project_task_sequences (project_id, organization_id, next_task_number)
select
  project.id,
  project.organization_id,
  coalesce(max(task.task_number), 0) + 1
from public.projects project
left join public.tasks task
  on task.project_id = project.id
 and task.organization_id = project.organization_id
group by project.id, project.organization_id
on conflict (project_id) do update
set next_task_number = greatest(
  public.project_task_sequences.next_task_number,
  excluded.next_task_number
);

insert into public.project_workflow_statuses (
  organization_id,
  project_id,
  status,
  label,
  position,
  is_terminal
)
select
  project.organization_id,
  project.id,
  defaults.status,
  defaults.label,
  defaults.position,
  defaults.is_terminal
from public.projects project
cross join (values
  ('backlog', 'Backlog', 0, false),
  ('planned', 'Planned', 1, false),
  ('in_progress', 'In progress', 2, false),
  ('blocked', 'Blocked', 3, false),
  ('in_review', 'In review', 4, false),
  ('changes_requested', 'Changes requested', 5, false),
  ('ready_to_merge', 'Ready to merge', 6, false),
  ('completed', 'Completed', 7, true),
  ('canceled', 'Canceled', 8, true)
) as defaults(status, label, position, is_terminal)
on conflict (project_id, status) do nothing;

alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks
  add constraint tasks_workflow_status_fkey
  foreign key (project_id, organization_id, status)
  references public.project_workflow_statuses(project_id, organization_id, status);

create or replace function public.reserve_task_number(
  target_project_id uuid,
  target_organization_id uuid,
  requested_task_number bigint default null
)
returns bigint
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  current_next_number bigint;
  assigned_task_number bigint;
begin
  if not exists (
    select 1
    from public.projects project
    where project.id = target_project_id
      and project.organization_id = target_organization_id
  ) then
    raise exception 'Project does not exist in the requested organization';
  end if;

  insert into public.project_task_sequences (project_id, organization_id)
  values (target_project_id, target_organization_id)
  on conflict (project_id) do nothing;

  select sequence.next_task_number
    into current_next_number
  from public.project_task_sequences sequence
  where sequence.project_id = target_project_id
    and sequence.organization_id = target_organization_id
  for update;

  if requested_task_number is null then
    if current_next_number = 9223372036854775807 then
      raise exception 'Task number limit reached for project';
    end if;
    assigned_task_number := current_next_number;
    update public.project_task_sequences sequence
    set next_task_number = current_next_number + 1
    where sequence.project_id = target_project_id
      and sequence.organization_id = target_organization_id;
  else
    if requested_task_number < 1 then
      raise exception 'Task number must be positive';
    end if;
    assigned_task_number := requested_task_number;
    if requested_task_number >= current_next_number then
      if requested_task_number = 9223372036854775807 then
        raise exception 'Task number limit reached for project';
      end if;
      update public.project_task_sequences sequence
      set next_task_number = requested_task_number + 1
      where sequence.project_id = target_project_id
        and sequence.organization_id = target_organization_id;
    end if;
  end if;

  return assigned_task_number;
end;
$$;

create or replace function public.assign_task_number()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  new.task_number := public.reserve_task_number(
    new.project_id,
    new.organization_id,
    new.task_number
  );
  return new;
end;
$$;

create or replace function public.prevent_task_identity_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.organization_id is distinct from old.organization_id
    or new.project_id is distinct from old.project_id
    or new.task_number is distinct from old.task_number then
    raise exception 'Task identity cannot change after creation';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_project_key_change_with_tasks()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.project_key is distinct from old.project_key
    and exists (
      select 1
      from public.tasks task
      where task.project_id = old.id
        and task.organization_id = old.organization_id
    ) then
    raise exception 'Project key cannot change after tasks are created';
  end if;
  return new;
end;
$$;

create trigger tasks_assign_task_number
  before insert on public.tasks
  for each row execute function public.assign_task_number();

create trigger tasks_prevent_identity_change
  before update on public.tasks
  for each row execute function public.prevent_task_identity_change();

create trigger projects_prevent_key_change_with_tasks
  before update on public.projects
  for each row execute function public.prevent_project_key_change_with_tasks();

revoke execute on function public.seed_project_workflow_statuses(uuid, uuid) from public, authenticated, service_role;
revoke execute on function public.seed_project_task_metadata() from public, authenticated, service_role;
revoke execute on function public.reserve_task_number(uuid, uuid, bigint) from public, authenticated, service_role;
revoke execute on function public.assign_task_number() from public, authenticated, service_role;
revoke execute on function public.prevent_task_identity_change() from public, authenticated, service_role;
revoke execute on function public.prevent_project_key_change_with_tasks() from public, authenticated, service_role;

commit;
