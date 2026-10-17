create table public.webhook_deliveries (
  delivery_id text primary key,
  event_name text not null,
  received_at timestamptz not null default pg_catalog.now()
);

create table public.observations (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  sha text not null check (sha ~ '^[0-9a-f]{40}$'),
  kind text not null check (kind in ('workflow_run', 'check_run', 'status', 'pull_request')),
  context text,
  state text not null,
  at timestamptz not null,
  received_at timestamptz not null default pg_catalog.now(),
  actor_login text,
  payload_ref text not null
);

create index observations_project_id_sha_idx on public.observations (project_id, sha);

alter table public.webhook_deliveries enable row level security;
alter table public.observations enable row level security;

create policy webhook_deliveries_owner_select on public.webhook_deliveries
  for select to authenticated
  using (public.is_owner());

create policy observations_owner_select on public.observations
  for select to authenticated
  using (public.is_owner());

revoke insert, update, delete, truncate on public.webhook_deliveries, public.observations from anon, authenticated;
