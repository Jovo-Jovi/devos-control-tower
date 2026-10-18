create or replace function public.ingest_event(payload jsonb, src text)
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

drop function if exists public.verify_reported_events(uuid);
