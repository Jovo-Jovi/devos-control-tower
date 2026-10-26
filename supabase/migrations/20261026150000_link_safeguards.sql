create unique index link_requests_project_id_key on public.link_requests (project_id) where project_id is not null;

create or replace function public.purge_link_requests()
returns integer
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_id uuid;
  v_project_id uuid;
  v_removed integer := 0;
begin
  for v_id, v_project_id in
    select r.id, r.project_id
    from public.link_requests r
    where r.project_id is null
      and r.state in ('pending', 'declined')
      and r.last_requested_at < pg_catalog.now() - interval '180 days'
  loop
    delete from public.link_requests
    where id = v_id
      and project_id is null
      and state in ('pending', 'declined')
      and last_requested_at < pg_catalog.now() - interval '180 days';

    if not found then
      continue;
    end if;

    insert into public.link_audit (action, request_id)
    values ('purged', v_id);

    v_removed := v_removed + 1;
  end loop;

  for v_id, v_project_id in
    select r.id, r.project_id
    from public.link_requests r
    where r.state = 'declined'
      and r.project_id is not null
      and r.decided_at < pg_catalog.now() - interval '365 days'
  loop
    delete from public.link_requests
    where id = v_id
      and state = 'declined'
      and project_id is not null
      and decided_at < pg_catalog.now() - interval '365 days';

    if not found then
      continue;
    end if;

    delete from public.projects
    where id = v_project_id;

    insert into public.link_audit (action, request_id)
    values ('purged', v_id);

    v_removed := v_removed + 1;
  end loop;

  return v_removed;
end;
$fn$;

revoke all on function public.purge_link_requests() from public, anon, authenticated;
grant execute on function public.purge_link_requests() to service_role;

create or replace function public.approve_link_request(p_request uuid)
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

    if exists (
      select 1
      from public.link_requests existing
      where existing.project_id = v_project_id
    ) then
      return pg_catalog.jsonb_build_object('result', 'project_linked');
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

create or replace function public.request_link(
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

  perform pg_catalog.pg_advisory_xact_lock(461701);

  select count(*)::integer
  into v_pending
  from public.link_requests
  where state = 'pending';

  if v_pending >= 50 then
    return pg_catalog.jsonb_build_object('result', 'rate_limited');
  end if;

  select count(*)::integer
  into v_pending
  from public.link_requests
  where state = 'pending'
    and owner_github_id = p_owner_github_id;

  if v_pending >= 3 then
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

create or replace function public.export_link_request(p_request uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_request public.link_requests;
  v_project jsonb;
  v_events jsonb;
  v_usage jsonb;
  v_observations jsonb;
begin
  select r.*
  into v_request
  from public.link_requests r
  where r.id = p_request;

  if not found then
    return pg_catalog.jsonb_build_object('result', 'not_found');
  end if;

  insert into public.link_audit (action, request_id)
  values ('exported', p_request);

  if v_request.project_id is null then
    v_project := null;
    v_events := '[]'::jsonb;
    v_usage := '[]'::jsonb;
    v_observations := '[]'::jsonb;
  else
    select pg_catalog.jsonb_build_object(
      'key', p.key,
      'repo', p.repo,
      'owner_github_id', p.owner_github_id,
      'stale_after_minutes', p.stale_after_minutes,
      'created_at', p.created_at
    )
    into v_project
    from public.projects p
    where p.id = v_request.project_id;

    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'run', r.run_key,
          'seq', e.seq,
          'phase', e.phase,
          'task', e.task,
          'step', e.step,
          'status', e.status,
          'at', e.at,
          'received_at', e.received_at,
          'evidence', e.evidence,
          'origin', e.origin,
          'source', e.source
        )
        order by r.created_at, r.id, e.seq
      ),
      '[]'::jsonb
    )
    into v_events
    from public.events e
    join public.runs r on r.id = e.run_id
    where e.project_id = v_request.project_id;

    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'run', r.run_key,
          'seq', e.seq,
          'agent', u.agent,
          'tool', u.tool,
          'model', u.model,
          'account_alias', u.account_alias,
          'input', u.input,
          'output', u.output,
          'cache_read', u.cache_read,
          'cache_write', u.cache_write,
          'source', u.source
        )
        order by r.created_at, r.id, e.seq, u.id
      ),
      '[]'::jsonb
    )
    into v_usage
    from public.event_usage u
    join public.events e on e.id = u.event_id
    join public.runs r on r.id = e.run_id
    where e.project_id = v_request.project_id;

    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'sha', o.sha,
          'kind', o.kind,
          'context', o.context,
          'state', o.state,
          'at', o.at,
          'received_at', o.received_at,
          'actor_login', o.actor_login,
          'payload_ref', o.payload_ref
        )
        order by o.at, o.id
      ),
      '[]'::jsonb
    )
    into v_observations
    from public.observations o
    where o.project_id = v_request.project_id;
  end if;

  return pg_catalog.jsonb_build_object(
    'result', 'exported',
    'request', pg_catalog.to_jsonb(v_request),
    'project', v_project,
    'step_events', v_events,
    'event_usage', v_usage,
    'observations', v_observations
  );
end;
$fn$;

revoke all on function public.export_link_request(uuid) from public, anon, authenticated;
grant execute on function public.export_link_request(uuid) to service_role;
