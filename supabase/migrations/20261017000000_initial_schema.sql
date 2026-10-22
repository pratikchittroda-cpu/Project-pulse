begin;

create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.organizations (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (slug)
);

create table public.organization_memberships (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, user_id),
  unique (id, organization_id)
);

create table public.teams (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  team_key text not null check (team_key ~ '^[A-Z][A-Z0-9_-]{1,19}$'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, team_key),
  unique (id, organization_id)
);

create table public.team_memberships (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  team_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (team_id, user_id),
  foreign key (team_id, organization_id)
    references public.teams(id, organization_id) on delete cascade
);

create table public.projects (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  project_key text not null check (project_key ~ '^[A-Z][A-Z0-9]{1,9}$'),
  description text,
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, project_key),
  unique (id, organization_id)
);

create table public.project_memberships (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member', 'viewer')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_id, user_id),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade
);

create table public.repositories (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  provider text not null default 'other' check (provider in ('github', 'gitlab', 'other')),
  name text not null check (char_length(trim(name)) between 1 and 200),
  url text not null check (url ~ '^https?://'),
  default_branch text not null default 'main',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_id, url),
  unique (id, organization_id),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade
);

create table public.integrations (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid,
  provider text not null check (provider in ('github', 'slack', 'teams', 'vscode')),
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'error')),
  external_account_id text,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (organization_id, provider, external_account_id),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade
);

create table public.cycles (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 160),
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'planned' check (status in ('planned', 'active', 'completed', 'canceled')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, project_id, organization_id),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade,
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create table public.initiatives (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 200),
  description text,
  status text not null default 'planned' check (status in ('planned', 'active', 'completed', 'canceled')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, organization_id)
);

create table public.epics (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  initiative_id uuid,
  title text not null check (char_length(trim(title)) between 1 and 240),
  description text,
  status text not null default 'planned' check (status in ('planned', 'active', 'completed', 'canceled')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, project_id, organization_id),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade,
  foreign key (initiative_id, organization_id)
    references public.initiatives(id, organization_id) on delete set null
);

create table public.milestones (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 200),
  target_date date,
  status text not null default 'planned' check (status in ('planned', 'active', 'completed', 'canceled')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, project_id, organization_id),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade
);

create table public.tasks (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  task_number bigint not null check (task_number > 0),
  title text not null check (char_length(trim(title)) between 1 and 240),
  description text,
  status text not null default 'backlog' check (status in ('backlog', 'planned', 'in_progress', 'blocked', 'in_review', 'changes_requested', 'ready_to_merge', 'completed', 'canceled')),
  priority text not null default 'medium' check (priority in ('urgent', 'high', 'medium', 'low')),
  assignee_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  cycle_id uuid,
  epic_id uuid,
  milestone_id uuid,
  estimate numeric(10, 2) check (estimate is null or estimate >= 0),
  due_date date,
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_id, task_number),
  unique (id, project_id, organization_id),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade,
  foreign key (cycle_id, project_id, organization_id)
    references public.cycles(id, project_id, organization_id) on delete set null,
  foreign key (epic_id, project_id, organization_id)
    references public.epics(id, project_id, organization_id) on delete set null,
  foreign key (milestone_id, project_id, organization_id)
    references public.milestones(id, project_id, organization_id) on delete set null
);

create table public.task_relations (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  task_id uuid not null,
  related_task_id uuid not null,
  relation_type text not null check (relation_type in ('blocks', 'blocked_by', 'duplicates', 'relates_to')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (task_id, related_task_id, relation_type),
  foreign key (project_id, organization_id)
    references public.projects(id, organization_id) on delete cascade,
  foreign key (task_id, project_id, organization_id)
    references public.tasks(id, project_id, organization_id) on delete cascade,
  foreign key (related_task_id, project_id, organization_id)
    references public.tasks(id, project_id, organization_id) on delete cascade,
  check (task_id <> related_task_id)
);

create table public.task_events (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  task_id uuid not null,
  event_type text not null check (event_type ~ '^[a-z0-9]+(?:[._][a-z0-9]+)+$'),
  actor_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (task_id, project_id, organization_id)
    references public.tasks(id, project_id, organization_id) on delete cascade
);

create table public.comments (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  task_id uuid not null,
  author_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(trim(body)) between 1 and 20000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, project_id, organization_id),
  foreign key (task_id, project_id, organization_id)
    references public.tasks(id, project_id, organization_id) on delete cascade
);

create table public.attachments (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null,
  task_id uuid,
  comment_id uuid,
  uploaded_by uuid references auth.users(id) on delete set null,
  storage_path text not null,
  file_name text not null,
  content_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (task_id, project_id, organization_id)
    references public.tasks(id, project_id, organization_id) on delete cascade,
  foreign key (comment_id, project_id, organization_id)
    references public.comments(id, project_id, organization_id) on delete cascade,
  check (task_id is not null or comment_id is not null)
);

create table public.webhook_events (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  repository_id uuid,
  provider text not null check (provider in ('github', 'gitlab', 'other')),
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz,
  processing_status text not null default 'received' check (processing_status in ('received', 'processing', 'processed', 'failed')),
  processing_error text,
  unique (provider, provider_event_id),
  foreign key (repository_id, organization_id)
    references public.repositories(id, organization_id) on delete set null
);

create table public.audit_records (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index organizations_slug_idx on public.organizations (slug);
create index organization_memberships_user_idx on public.organization_memberships (user_id);
create index teams_organization_idx on public.teams (organization_id);
create index team_memberships_user_idx on public.team_memberships (user_id);
create index projects_organization_idx on public.projects (organization_id);
create index project_memberships_user_idx on public.project_memberships (user_id);
create index repositories_project_idx on public.repositories (project_id);
create index integrations_organization_idx on public.integrations (organization_id, provider);
create index cycles_project_status_idx on public.cycles (project_id, status);
create index initiatives_organization_status_idx on public.initiatives (organization_id, status);
create index epics_project_status_idx on public.epics (project_id, status);
create index milestones_project_status_idx on public.milestones (project_id, status);
create index tasks_project_status_idx on public.tasks (project_id, status);
create index tasks_project_assignee_idx on public.tasks (project_id, assignee_id);
create index tasks_project_cycle_idx on public.tasks (project_id, cycle_id);
create index tasks_project_task_number_idx on public.tasks (project_id, task_number);
create index task_relations_related_task_idx on public.task_relations (related_task_id);
create index task_events_project_occurred_idx on public.task_events (project_id, occurred_at desc);
create index comments_task_created_idx on public.comments (task_id, created_at);
create index attachments_task_idx on public.attachments (task_id);
create index webhook_events_organization_received_idx on public.webhook_events (organization_id, received_at desc);
create index audit_records_organization_created_idx on public.audit_records (organization_id, created_at desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations',
    'organization_memberships',
    'teams',
    'team_memberships',
    'projects',
    'project_memberships',
    'repositories',
    'integrations',
    'cycles',
    'initiatives',
    'epics',
    'milestones',
    'tasks',
    'task_relations',
    'task_events',
    'comments',
    'attachments',
    'webhook_events',
    'audit_records'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations',
    'organization_memberships',
    'teams',
    'team_memberships',
    'projects',
    'project_memberships',
    'repositories',
    'integrations',
    'cycles',
    'initiatives',
    'epics',
    'milestones',
    'tasks',
    'comments',
    'webhook_events'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      table_name || '_set_updated_at',
      table_name
    );
  end loop;
end;
$$;

commit;
