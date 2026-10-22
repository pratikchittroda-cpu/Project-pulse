-- Saved views are user-owned and project-scoped. Every assertion rolls back.
begin;

do $$
<<saved_view_test>>
declare
  organization_id uuid := extensions.gen_random_uuid();
  project_id uuid := extensions.gen_random_uuid();
  hidden_project_id uuid := extensions.gen_random_uuid();
  owner_id uuid := extensions.gen_random_uuid();
  viewer_id uuid := extensions.gen_random_uuid();
  owner_view public.task_saved_views;
  viewer_view public.task_saved_views;
  visible_count integer;
begin
  insert into auth.users (id, email)
  values
    (owner_id, owner_id || '@example.test'),
    (viewer_id, viewer_id || '@example.test');
  insert into public.organizations (id, name, slug)
  values (organization_id, 'Saved views test', 'saved-views-' || organization_id);
  insert into public.organization_memberships (organization_id, user_id, role)
  values
    (organization_id, owner_id, 'owner'),
    (organization_id, viewer_id, 'viewer');
  insert into public.projects (id, organization_id, name, project_key)
  values
    (project_id, organization_id, 'Shared project', 'SVWS'),
    (hidden_project_id, organization_id, 'Hidden project', 'SVWH');
  insert into public.project_memberships (organization_id, project_id, user_id, role)
  values (organization_id, project_id, viewer_id, 'viewer');

  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', owner_id, 'role', 'authenticated')::text,
    true
  );

  insert into public.task_saved_views (
    organization_id,
    project_id,
    user_id,
    name,
    filters
  )
  values (
    organization_id,
    project_id,
    owner_id,
    'Ready work',
    '{"q":"release","status":"ready_to_merge","priority":"high"}'::jsonb
  )
  returning * into owner_view;

  select * into owner_view
  from public.task_saved_views
  where id = owner_view.id;
  if owner_view.name <> 'Ready work'
    or owner_view.filters ->> 'status' <> 'ready_to_merge'
    or owner_view.filters ->> 'priority' <> 'high' then
    raise exception 'saved view readback lost its name or filters';
  end if;

  update public.task_saved_views
  set name = 'Release work',
      filters = owner_view.filters || '{"label":"release"}'::jsonb
  where id = owner_view.id;
  select * into owner_view
  from public.task_saved_views
  where id = owner_view.id;
  if owner_view.name <> 'Release work'
    or owner_view.filters ->> 'label' <> 'release' then
    raise exception 'saved view update did not read back';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', viewer_id, 'role', 'authenticated')::text,
    true
  );
  select count(*) into visible_count
  from public.task_saved_views saved_view
  where saved_view.project_id = saved_view_test.project_id;
  if visible_count <> 0 then
    raise exception 'saved view owner data leaked to another user';
  end if;

  insert into public.task_saved_views (
    organization_id,
    project_id,
    user_id,
    name,
    filters
  )
  values (
    organization_id,
    project_id,
    viewer_id,
    'My review queue',
    '{"status":"in_review"}'::jsonb
  )
  returning * into viewer_view;
  select * into viewer_view
  from public.task_saved_views
  where id = viewer_view.id;
  if viewer_view.name <> 'My review queue'
    or viewer_view.filters ->> 'status' <> 'in_review' then
    raise exception 'viewer saved view readback failed';
  end if;

  begin
    insert into public.task_saved_views (
      organization_id,
      project_id,
      user_id,
      name,
      filters
    )
    values (
      organization_id,
      hidden_project_id,
      viewer_id,
      'Hidden project view',
      '{}'::jsonb
    );
    raise exception 'viewer created a saved view in an inaccessible project';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.task_saved_views (
      organization_id,
      project_id,
      user_id,
      name,
      filters
    )
    values (
      organization_id,
      project_id,
      owner_id,
      'Spoofed owner view',
      '{}'::jsonb
    );
    raise exception 'viewer spoofed another user in a saved view';
  exception when insufficient_privilege then null;
  end;

  delete from public.task_saved_views where id = viewer_view.id;
  if exists (select 1 from public.task_saved_views where id = viewer_view.id) then
    raise exception 'saved view delete did not persist';
  end if;
end $$;

rollback;
