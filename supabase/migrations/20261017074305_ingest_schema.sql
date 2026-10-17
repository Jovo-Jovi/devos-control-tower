create table public.projects (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  key text not null unique check (key ~ '^[A-Z][A-Z0-9_-]{1,31}$'),
  repo text not null unique,
  owner_github_id text not null check (owner_github_id ~ '^[0-9]+$'),
  stale_after_minutes integer not null default 1440 check (stale_after_minutes > 0),
  created_at timestamptz not null default pg_catalog.now()
);

create table public.runs (
  id uuid primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  run_key text not null,
  source text not null check (source in ('ci', 'local', 'import')),
  created_at timestamptz not null default pg_catalog.now(),
  unique (project_id, run_key)
);

create table public.events (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  run_id uuid not null references public.runs (id) on delete cascade,
  seq integer not null check (seq >= 1),
  v smallint not null check (v = 1),
  phase text,
  task text,
  step text not null check (step in (
    'intake', 'fence', 'build', 'checks', 'guards', 'evidence',
    'review', 'verdict', 'gate', 'merge', 'deploy'
  )),
  status text not null check (status in (
    'started', 'pass', 'fail', 'revise', 'waiting', 'skipped'
  )),
  at timestamptz not null,
  received_at timestamptz not null default pg_catalog.now(),
  evidence text,
  origin text not null check (origin in ('reported', 'observed', 'verified', 'imported')),
  source text not null check (source in ('ci', 'local', 'import')),
  body_hash bytea not null,
  unique (project_id, run_id, seq)
);

create index events_project_id_received_at_idx on public.events (project_id, received_at);

create table public.event_usage (
  id bigint generated always as identity primary key,
  event_id bigint not null references public.events (id) on delete cascade,
  agent text not null check (agent in ('builder', 'reviewer')),
  tool text not null,
  model text not null,
  account_alias text not null,
  input integer check (input is null or input >= 0),
  output integer check (output is null or output >= 0),
  cache_read integer check (cache_read is null or cache_read >= 0),
  cache_write integer check (cache_write is null or cache_write >= 0),
  source text not null check (source in ('measured', 'unavailable')),
  check (
    source <> 'unavailable'
    or (
      input is null
      and output is null
      and cache_read is null
      and cache_write is null
    )
  )
);

create table public.event_rejections (
  received_at timestamptz not null default pg_catalog.now(),
  reason text not null check (reason in (
    'no_token',
    'bad_issuer',
    'bad_audience',
    'bad_signature',
    'expired',
    'repo_not_registered',
    'owner_mismatch',
    'owner_not_consented',
    'key_invalid',
    'key_revoked',
    'key_project_mismatch',
    'duplicate_conflict'
  ))
);

alter table public.projects enable row level security;
alter table public.runs enable row level security;
alter table public.events enable row level security;
alter table public.event_usage enable row level security;
alter table public.event_rejections enable row level security;

create policy projects_owner_select on public.projects
  for select to authenticated
  using (public.is_owner());

create policy projects_owner_insert on public.projects
  for insert to authenticated
  with check (public.is_owner());

create policy projects_owner_update on public.projects
  for update to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create policy runs_owner_select on public.runs
  for select to authenticated
  using (public.is_owner());

create policy events_owner_select on public.events
  for select to authenticated
  using (public.is_owner());

create policy event_usage_owner_select on public.event_usage
  for select to authenticated
  using (public.is_owner());

create policy event_rejections_owner_select on public.event_rejections
  for select to authenticated
  using (public.is_owner());

revoke insert, update, delete, truncate on all tables in schema public from anon;
revoke insert, update, delete, truncate on public.runs, public.events, public.event_usage, public.event_rejections from authenticated;
revoke delete, truncate on public.projects from authenticated;

create function public.ingest_event(payload jsonb, src text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_project_id uuid;
  v_run_id uuid;
  v_event_id bigint;
  v_hash bytea;
  v_existing bytea;
begin
  if src is distinct from 'ci' and src is distinct from 'local' and src is distinct from 'import' then
    raise exception 'invalid source';
  end if;

  select p.id
  into v_project_id
  from public.projects p
  where p.key = payload->>'project';

  if v_project_id is null then
    raise exception 'unknown project';
  end if;

  if src = 'ci' or src = 'local' then
    if (
      select count(*)
      from public.events e
      where e.project_id = v_project_id
        and e.source <> 'import'
        and e.received_at > pg_catalog.now() - interval '1 minute'
    ) >= 60 then
      return pg_catalog.jsonb_build_object('result', 'rate_limited');
    end if;
  end if;

  insert into public.runs (id, project_id, run_key, source)
  values (pg_catalog.gen_random_uuid(), v_project_id, payload->>'run', src)
  on conflict (project_id, run_key) do update
  set source = excluded.source
  returning id into v_run_id;

  v_hash := pg_catalog.sha256(pg_catalog.convert_to(payload::text, 'UTF8'));
  v_event_id := null;

  insert into public.events (
    project_id,
    run_id,
    seq,
    v,
    phase,
    task,
    step,
    status,
    at,
    evidence,
    origin,
    source,
    body_hash
  ) values (
    v_project_id,
    v_run_id,
    (payload->>'seq')::integer,
    (payload->>'v')::smallint,
    payload->>'phase',
    payload->>'task',
    payload->>'step',
    payload->>'status',
    (payload->>'at')::timestamptz,
    payload->>'evidence',
    case when src = 'import' then 'imported' else 'reported' end,
    src,
    v_hash
  )
  on conflict (project_id, run_id, seq) do nothing
  returning id into v_event_id;

  if v_event_id is not null then
    if pg_catalog.jsonb_typeof(payload->'usage') = 'array' then
      insert into public.event_usage (
        event_id,
        agent,
        tool,
        model,
        account_alias,
        input,
        output,
        cache_read,
        cache_write,
        source
      )
      select
        v_event_id,
        entry->>'agent',
        entry->>'tool',
        entry->>'model',
        entry->>'account_alias',
        (entry->>'input')::integer,
        (entry->>'output')::integer,
        (entry->>'cache_read')::integer,
        (entry->>'cache_write')::integer,
        entry->>'source'
      from pg_catalog.jsonb_array_elements(payload->'usage') as entry;
    end if;
    return pg_catalog.jsonb_build_object('result', 'stored');
  end if;

  select e.body_hash
  into v_existing
  from public.events e
  where e.project_id = v_project_id
    and e.run_id = v_run_id
    and e.seq = (payload->>'seq')::integer;

  if v_existing = v_hash then
    return pg_catalog.jsonb_build_object('result', 'duplicate');
  end if;

  insert into public.event_rejections (reason) values ('duplicate_conflict');
  return pg_catalog.jsonb_build_object('result', 'conflict');
end;
$fn$;

revoke all on function public.ingest_event(jsonb, text) from public, anon, authenticated;
grant execute on function public.ingest_event(jsonb, text) to service_role;
