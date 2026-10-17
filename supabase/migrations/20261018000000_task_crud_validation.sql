begin;

create function public.valid_task_labels(labels text[])
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select coalesce(array_ndims(labels), 1) = 1
    and cardinality(labels) <= 20
    and not exists (
      select 1 from unnest(labels) as item(label)
      where label is null
         or label <> btrim(label)
         or char_length(label) not between 1 and 40
    )
    and cardinality(labels) = (select count(distinct label) from unnest(labels) as item(label));
$$;

revoke execute on function public.valid_task_labels(text[]) from public, anon;
grant execute on function public.valid_task_labels(text[]) to authenticated, service_role;

alter table public.tasks
  add column labels text[] not null default '{}',
  add constraint tasks_labels_check check (public.valid_task_labels(labels)),
  add constraint tasks_finite_estimate_check
    check (estimate is null or (estimate >= 0 and estimate < 100000000)),
  add constraint tasks_finite_due_date_check
    check (due_date is null or isfinite(due_date));

alter table public.tasks alter column created_by set default auth.uid();

create function public.validate_task_assignee()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.assignee_id is not null and not exists (
    select 1
    from public.organization_memberships organization_member
    where organization_member.organization_id = new.organization_id
      and organization_member.user_id = new.assignee_id
      and (
        organization_member.role in ('owner', 'admin')
        or exists (
          select 1 from public.project_memberships project_member
          where project_member.organization_id = new.organization_id
            and project_member.project_id = new.project_id
            and project_member.user_id = new.assignee_id
        )
      )
  ) then
    raise exception using
      errcode = '23514',
      constraint = 'tasks_assignee_project_access',
      message = 'Choose an assignee who has access to this project';
  end if;
  return new;
end;
$$;

revoke execute on function public.validate_task_assignee() from public, anon, authenticated, service_role;

create trigger tasks_validate_assignee
  before insert or update of assignee_id, project_id, organization_id on public.tasks
  for each row execute function public.validate_task_assignee();

create function public.prevent_archived_project_task_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.projects project
    where project.id = new.project_id
      and project.organization_id = new.organization_id
      and project.archived_at is not null
  ) then
    raise exception using
      errcode = '55000',
      message = 'Archived projects are read-only';
  end if;
  return new;
end;
$$;

revoke execute on function public.prevent_archived_project_task_write() from public, anon, authenticated, service_role;

create trigger tasks_prevent_archived_project_write
  before insert or update on public.tasks
  for each row execute function public.prevent_archived_project_task_write();

commit;
