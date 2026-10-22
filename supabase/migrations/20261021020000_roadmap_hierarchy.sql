begin;

-- T025 keeps the existing hierarchy tables and tenant foreign keys from the
-- initial schema. Add the indexes and finite-date guard needed by roadmap reads.
create index if not exists tasks_project_epic_idx
  on public.tasks (organization_id, project_id, epic_id);
create index if not exists tasks_project_milestone_idx
  on public.tasks (organization_id, project_id, milestone_id);

alter table public.milestones
  add constraint milestones_finite_target_date_check
  check (target_date is null or isfinite(target_date));

-- Extend the existing atomic task mutation without changing its signature or
-- receipt semantics. Hierarchy links remain task history events in the same
-- transaction as the task write.
create or replace function public.mutate_task(
  target_organization_id uuid,
  target_project_id uuid,
  request_id uuid,
  action text,
  target_task_id uuid default null,
  task_values jsonb default '{}'::jsonb,
  expected_updated_at timestamptz default null,
  change_source text default 'internal',
  change_reason text default null,
  change_correlation_id text default null
)
returns public.tasks
language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  service_call boolean := coalesce(auth.role(), '') = 'service_role';
  receipt public.task_mutation_receipts;
  fingerprint jsonb;
  saved public.tasks;
  proposed public.tasks;
  old_context text := current_setting('projectpulse.task_change', true);
begin
  if not service_call and (auth.uid() is null
    or not public.is_org_member(target_organization_id)
    or not public.can_write_project(target_project_id, target_organization_id)) then
    raise exception using errcode = '42501', message = 'Project write access is required';
  end if;
  if not exists (select 1 from public.projects where id = target_project_id and organization_id = target_organization_id) then
    raise exception using errcode = '42501', message = 'Project is unavailable';
  end if;
  if request_id is null or action is null or action not in ('create', 'update', 'archive', 'restore')
    or (action = 'create' and target_task_id is not null)
    or (action <> 'create' and (target_task_id is null or expected_updated_at is null)) then
    raise exception using errcode = '22023', message = 'Invalid task mutation request';
  end if;
  if task_values is null or jsonb_typeof(task_values) <> 'object' then
    raise exception using errcode = '22023', message = 'Task values must be an object';
  end if;
  if exists (select 1 from jsonb_object_keys(task_values) as keys(key)
    where key <> all(array['title','description','status','priority','assignee_id','labels',
      'estimate','due_date','cycle_id','epic_id','milestone_id']))
    or (action in ('archive', 'restore') and task_values <> '{}'::jsonb) then
    raise exception using errcode = '22023', message = 'Unsupported task fields';
  end if;
  if change_source is null or change_source !~ '^[a-z][a-z0-9_.-]{0,39}$'
    or (service_call and nullif(trim(change_reason), '') is null) then
    raise exception using errcode = '22023', message = 'Automated changes require a source and reason';
  end if;
  if not service_call and change_source <> 'internal' then
    raise exception using errcode = '42501', message = 'Only trusted services may set automated change sources';
  end if;

  fingerprint := jsonb_build_object('action', action, 'taskId', target_task_id,
    'values', task_values, 'expectedUpdatedAt', expected_updated_at,
    'source', change_source, 'reason', change_reason, 'correlationId', change_correlation_id);
  insert into public.task_mutation_receipts as receipts
    (organization_id, project_id, request_id, actor_id, request)
  values (target_organization_id, target_project_id, request_id, auth.uid(), fingerprint)
  on conflict on constraint task_mutation_receipts_pkey do nothing
  returning * into receipt;
  if not found then
    select * into receipt from public.task_mutation_receipts r
    where r.organization_id = target_organization_id and r.request_id = mutate_task.request_id;
    if receipt.project_id is distinct from target_project_id
      or receipt.actor_id is distinct from auth.uid() or receipt.request is distinct from fingerprint then
      raise exception using errcode = '23505', message = 'Request ID already used for a different change';
    end if;
    return jsonb_populate_record(null::public.tasks, receipt.response);
  end if;

  perform set_config('projectpulse.task_change', jsonb_build_object('requestId', request_id,
    'source', change_source, 'reason', change_reason, 'correlationId', change_correlation_id)::text, true);
  if action = 'create' then
    proposed := jsonb_populate_record(null::public.tasks,
      '{"status":"backlog","priority":"medium","labels":[]}'::jsonb || task_values);
    insert into public.tasks (organization_id, project_id, title, description, status, priority,
      assignee_id, labels, estimate, due_date, cycle_id, epic_id, milestone_id, created_by)
    values (target_organization_id, target_project_id, proposed.title, proposed.description,
      proposed.status, proposed.priority, proposed.assignee_id, proposed.labels, proposed.estimate,
      proposed.due_date, proposed.cycle_id, proposed.epic_id, proposed.milestone_id, auth.uid())
    returning * into saved;
  else
    select * into saved from public.tasks t
    where t.id = target_task_id and t.project_id = target_project_id and t.organization_id = target_organization_id
    for update;
    if not found then
      raise exception using errcode = '42501', message = 'Task is unavailable';
    end if;
    if saved.updated_at is distinct from expected_updated_at then
      raise exception using errcode = '40001', message = 'Task changed. Reload before saving again';
    end if;
    if action = 'update' then
      proposed := jsonb_populate_record(saved, task_values);
      update public.tasks set title = proposed.title, description = proposed.description,
        status = proposed.status, priority = proposed.priority, assignee_id = proposed.assignee_id,
        labels = proposed.labels, estimate = proposed.estimate, due_date = proposed.due_date,
        cycle_id = proposed.cycle_id, epic_id = proposed.epic_id, milestone_id = proposed.milestone_id
      where id = target_task_id returning * into saved;
    else
      update public.tasks set archived_at = case when action = 'archive' then coalesce(archived_at, clock_timestamp()) end
      where id = target_task_id returning * into saved;
    end if;
  end if;
  perform set_config('projectpulse.task_change', coalesce(old_context, ''), true);
  update public.task_mutation_receipts r set response = to_jsonb(saved)
  where r.organization_id = target_organization_id and r.request_id = mutate_task.request_id;
  return saved;
end;
$$;

revoke execute on function public.mutate_task(uuid, uuid, uuid, text, uuid, jsonb, timestamptz, text, text, text)
  from public, anon;
grant execute on function public.mutate_task(uuid, uuid, uuid, text, uuid, jsonb, timestamptz, text, text, text)
  to authenticated, service_role;

commit;
