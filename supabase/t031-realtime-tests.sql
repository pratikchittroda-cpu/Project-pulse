-- T031 database coverage. Publication and tenant boundary assertions only;
-- delivery/reconnect behavior is covered by injectable channel tests.
begin;

do $$
declare
  publication_has_tasks boolean;
  replica_identity "char";
begin
  select exists (
    select 1
    from pg_catalog.pg_publication publication
    join pg_catalog.pg_publication_rel relation
      on relation.prpubid = publication.oid
    join pg_catalog.pg_class table_row
      on table_row.oid = relation.prrelid
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = table_row.relnamespace
    where publication.pubname = 'supabase_realtime'
      and namespace_row.nspname = 'public'
      and table_row.relname = 'tasks'
  ) into publication_has_tasks;
  if not publication_has_tasks then
    raise exception 'tasks is not in the realtime publication';
  end if;

  select relreplident into replica_identity
  from pg_catalog.pg_class table_row
  join pg_catalog.pg_namespace namespace_row
    on namespace_row.oid = table_row.relnamespace
  where namespace_row.nspname = 'public'
    and table_row.relname = 'tasks';
  if replica_identity <> 'f' then
    raise exception 'tasks does not use full replica identity for delete payloads';
  end if;
end;
$$;

rollback;
