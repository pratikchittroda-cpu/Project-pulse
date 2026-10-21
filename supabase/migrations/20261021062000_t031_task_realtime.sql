begin;

-- Board subscriptions consume row changes from the existing RLS-scoped tasks
-- table. Full identity keeps DELETE payloads tenant-addressable for cleanup.
alter table public.tasks replica identity full;

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_publication
    where pubname = 'supabase_realtime'
  ) then
    begin
      execute 'alter publication supabase_realtime add table public.tasks';
    exception when duplicate_object then
      null;
    end;
  end if;
end;
$$;

commit;
