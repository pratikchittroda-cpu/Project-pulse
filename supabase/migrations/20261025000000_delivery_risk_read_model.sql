begin;

create or replace function public.get_project_delivery_risks(
  target_organization_id uuid,
  target_project_id uuid
)
returns table (
  risk_count bigint,
  risks jsonb
)
language plpgsql
stable
security invoker
set search_path = public, auth, extensions
as $$
begin
  if not public.can_access_project(target_project_id, target_organization_id) then
    raise exception 'Project access is required';
  end if;

  return query
  with risk_rows as (
    select
      'blocked:' || task.id::text as risk_id,
      'high'::text as severity,
      'Blocked work needs attention'::text as title,
      format('Task %s: %s is explicitly marked blocked.', task.task_number, task.title) as reason,
      'Resolve the blocker or update the dependency before more work lands.'::text as next_move,
      task.id as task_id,
      task.task_number,
      0 as sort_rank
    from public.tasks task
    where task.organization_id = target_organization_id
      and task.project_id = target_project_id
      and task.archived_at is null
      and task.status = 'blocked'

    union all

    select
      'unassigned:' || task.id::text,
      case when task.priority = 'urgent' then 'high' else 'medium' end,
      'Priority work has no owner',
      format(
        'Task %s: %s is %s priority but has no assignee.',
        task.task_number,
        task.title,
        task.priority
      ),
      'Assign an owner or lower the priority until ownership is clear.',
      task.id,
      task.task_number,
      case when task.priority = 'urgent' then 1 else 2 end
    from public.tasks task
    where task.organization_id = target_organization_id
      and task.project_id = target_project_id
      and task.archived_at is null
      and task.priority in ('urgent', 'high')
      and task.assignee_id is null
      and task.status not in ('completed', 'canceled')

    union all

    select
      'stale-review:' || task.id::text,
      'medium',
      'Review may be slowing delivery',
      format(
        'Task %s: %s has been in review for at least 48 hours.',
        task.task_number,
        task.title
      ),
      'Assign a reviewer or record the decision that is keeping this work open.',
      task.id,
      task.task_number,
      3
    from public.tasks task
    where task.organization_id = target_organization_id
      and task.project_id = target_project_id
      and task.archived_at is null
      and task.status = 'in_review'
      and task.updated_at <= timezone('utc', now()) - interval '48 hours'
  )
  select
    count(*)::bigint,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', risk.risk_id,
          'next_move', risk.next_move,
          'reason', risk.reason,
          'severity', risk.severity,
          'task_id', risk.task_id,
          'task_number', risk.task_number,
          'title', risk.title
        )
        order by
          case when risk.severity = 'high' then 0 else 1 end,
          risk.sort_rank,
          risk.task_number
      ),
      '[]'::jsonb
    )
  from risk_rows risk;
end;
$$;

revoke execute on function public.get_project_delivery_risks(uuid, uuid) from public;
grant execute on function public.get_project_delivery_risks(uuid, uuid)
  to authenticated, service_role;

commit;
