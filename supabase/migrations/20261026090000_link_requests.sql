create table public.link_requests (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  repository text not null check (repository ~ '^[A-Za-z0-9-]{1,39}/[A-Za-z0-9._-]{1,100}$'),
  owner_github_id text not null check (owner_github_id ~ '^[0-9]{1,20}$'),
  proposed_key text not null check (proposed_key ~ '^[A-Z][A-Z0-9_-]{1,31}$'),
  engine_version text not null check (engine_version ~ '^[!-~]{1,32}$'),
  contract_version text not null check (contract_version ~ '^[!-~]{1,32}$'),
  state text not null default 'pending' check (state in ('pending', 'approved', 'declined')),
  project_id uuid references public.projects (id) on delete set null,
  first_requested_at timestamptz not null default pg_catalog.now(),
  last_requested_at timestamptz not null default pg_catalog.now(),
  decided_at timestamptz,
  unique (repository, owner_github_id),
  check ((state = 'pending') = (decided_at is null)),
  check (state <> 'pending' or project_id is null),
  check (state <> 'approved' or project_id is not null)
);

create table public.link_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default pg_catalog.now(),
  action text not null check (action in ('requested', 'approved', 'declined', 'deleted', 'exported', 'purged')),
  request_id uuid not null
);

alter table public.link_requests enable row level security;
alter table public.link_audit enable row level security;

create policy link_requests_owner_select on public.link_requests
  for select to authenticated
  using (public.is_owner());

create policy link_audit_owner_select on public.link_audit
  for select to authenticated
  using (public.is_owner());

revoke all on public.link_requests, public.link_audit from anon, authenticated;
grant select on public.link_requests, public.link_audit to authenticated;

create function public.request_link(
  p_repository text,
  p_owner_github_id text,
  p_proposed_key text,
  p_engine_version text,
  p_contract_version text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_id uuid;
  v_state text;
  v_project_id uuid;
  v_key text;
  v_new_id uuid;
  v_pending integer;
begin
  if p_repository is null
    or p_owner_github_id is null
    or p_proposed_key is null
    or p_engine_version is null
    or p_contract_version is null
    or p_repository !~ '^[A-Za-z0-9-]{1,39}/[A-Za-z0-9._-]{1,100}$'
    or p_owner_github_id !~ '^[0-9]{1,20}$'
    or p_proposed_key !~ '^[A-Z][A-Z0-9_-]{1,31}$'
    or p_engine_version !~ '^[!-~]{1,32}$'
    or p_contract_version !~ '^[!-~]{1,32}$'
  then
    raise exception 'invalid link request argument' using errcode = '22023';
  end if;

  select r.id, r.state, r.project_id
  into v_id, v_state, v_project_id
  from public.link_requests r
  where r.repository = p_repository
    and r.owner_github_id = p_owner_github_id
  for update;

  if v_id is not null then
    update public.link_requests
    set
      last_requested_at = pg_catalog.now(),
      engine_version = p_engine_version,
      contract_version = p_contract_version
    where id = v_id;
  end if;

  if v_id is not null and v_state = 'declined' then
    return pg_catalog.jsonb_build_object('result', 'declined');
  end if;

  if v_id is not null and v_state = 'approved' then
    select p.key
    into v_key
    from public.projects p
    where p.id = v_project_id;
    return pg_catalog.jsonb_build_object('result', 'linked', 'key', v_key);
  end if;

  select p.key
  into v_key
  from public.projects p
  where p.repo = p_repository
    and p.owner_github_id = p_owner_github_id;

  if v_key is not null then
    return pg_catalog.jsonb_build_object('result', 'linked', 'key', v_key);
  end if;

  if v_id is not null and v_state = 'pending' then
    return pg_catalog.jsonb_build_object('result', 'pending');
  end if;

  select count(*)::integer
  into v_pending
  from public.link_requests
  where state = 'pending';

  if v_pending >= 50 then
    return pg_catalog.jsonb_build_object('result', 'rate_limited');
  end if;

  v_new_id := null;
  insert into public.link_requests (
    repository,
    owner_github_id,
    proposed_key,
    engine_version,
    contract_version
  ) values (
    p_repository,
    p_owner_github_id,
    p_proposed_key,
    p_engine_version,
    p_contract_version
  )
  on conflict (repository, owner_github_id) do nothing
  returning id into v_new_id;

  if v_new_id is not null then
    insert into public.link_audit (action, request_id)
    values ('requested', v_new_id);
  end if;

  return pg_catalog.jsonb_build_object('result', 'pending');
end;
$fn$;

revoke all on function public.request_link(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.request_link(text, text, text, text, text) to service_role;

create function public.approve_link_request(p_request uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_repository text;
  v_owner_github_id text;
  v_proposed_key text;
  v_state text;
  v_project_id uuid;
  v_owner text;
  v_key text;
  v_n integer;
begin
  select r.repository, r.owner_github_id, r.proposed_key, r.state
  into v_repository, v_owner_github_id, v_proposed_key, v_state
  from public.link_requests r
  where r.id = p_request
  for update;

  if v_repository is null then
    return pg_catalog.jsonb_build_object('result', 'not_found');
  end if;

  if v_state is distinct from 'pending' then
    return pg_catalog.jsonb_build_object('result', 'not_pending');
  end if;

  select p.id, p.owner_github_id, p.key
  into v_project_id, v_owner, v_key
  from public.projects p
  where p.repo = v_repository
  for update;

  if found then
    if v_owner is distinct from v_owner_github_id then
      return pg_catalog.jsonb_build_object('result', 'repo_taken');
    end if;
  else
    v_key := v_proposed_key;
    v_n := 2;
    while exists (select 1 from public.projects p where p.key = v_key) loop
      v_key := pg_catalog.left(v_proposed_key, 32 - pg_catalog.length('-' || v_n::text)) || '-' || v_n::text;
      v_n := v_n + 1;
    end loop;

    insert into public.projects (key, repo, owner_github_id)
    values (v_key, v_repository, v_owner_github_id)
    returning id into v_project_id;
  end if;

  update public.link_requests
  set
    state = 'approved',
    decided_at = pg_catalog.now(),
    project_id = v_project_id
  where id = p_request;

  insert into public.link_audit (action, request_id)
  values ('approved', p_request);

  return pg_catalog.jsonb_build_object('result', 'approved', 'key', v_key);
end;
$fn$;

revoke all on function public.approve_link_request(uuid) from public, anon, authenticated;
grant execute on function public.approve_link_request(uuid) to service_role;

create function public.decline_link_request(p_request uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_state text;
begin
  select r.state
  into v_state
  from public.link_requests r
  where r.id = p_request
  for update;

  if v_state is null then
    return pg_catalog.jsonb_build_object('result', 'not_found');
  end if;

  if v_state = 'declined' then
    return pg_catalog.jsonb_build_object('result', 'not_pending');
  end if;

  update public.link_requests
  set
    state = 'declined',
    decided_at = pg_catalog.now()
  where id = p_request;

  insert into public.link_audit (action, request_id)
  values ('declined', p_request);

  return pg_catalog.jsonb_build_object('result', 'declined');
end;
$fn$;

revoke all on function public.decline_link_request(uuid) from public, anon, authenticated;
grant execute on function public.decline_link_request(uuid) to service_role;
