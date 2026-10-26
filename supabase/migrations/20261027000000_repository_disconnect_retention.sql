begin;

alter table public.delivery_objects
  alter column repository_id drop not null;

alter table public.delivery_objects
  drop constraint delivery_objects_repository_id_organization_id_fkey;

alter table public.delivery_objects
  add constraint delivery_objects_repository_id_organization_id_fkey
  foreign key (repository_id, organization_id)
  references public.repositories(id, organization_id)
  on delete set null;

comment on column public.delivery_objects.repository_id is
  'The connected repository that produced this delivery; null after a safe disconnect.';

commit;
