begin;

-- Detail and collaboration views use Realtime as a delivery accelerator. Full
-- replica identity keeps tenant/task scope available for DELETE payloads.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'task_events',
    'comments',
    'comment_mentions',
    'task_checklist_items',
    'attachments',
    'task_relations'
  ]
  loop
    execute format('alter table public.%I replica identity full', table_name);
  end loop;
end;
$$;

do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array[
      'task_events',
      'comments',
      'comment_mentions',
      'task_checklist_items',
      'attachments',
      'task_relations'
    ]
    loop
      begin
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      exception when duplicate_object then
        null;
      end;
    end loop;
  end if;
end;
$$;

commit;
