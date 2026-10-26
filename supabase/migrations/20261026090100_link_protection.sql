create function public.delete_link_request(p_request uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_project_id uuid;
begin
  select r.project_id
  into v_project_id
  from public.link_requests r
  where r.id = p_request
  for update;

  if not found then
    return pg_catalog.jsonb_build_object('result', 'not_found');
  end if;

  delete from public.link_requests
  where id = p_request;

  if v_project_id is not null then
    delete from public.projects
    where id = v_project_id;
  end if;

  insert into public.link_audit (action, request_id)
  values ('deleted', p_request);

  return pg_catalog.jsonb_build_object(
    'result', 'deleted',
    'project_deleted', v_project_id is not null
  );
end;
$fn$;

revoke all on function public.delete_link_request(uuid) from public, anon, authenticated;
grant execute on function public.delete_link_request(uuid) to service_role;

create function public.export_link_request(p_request uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_request public.link_requests;
  v_project jsonb;
  v_events jsonb;
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
  end if;

  return pg_catalog.jsonb_build_object(
    'result', 'exported',
    'request', pg_catalog.to_jsonb(v_request),
    'project', v_project,
    'step_events', v_events
  );
end;
$fn$;

revoke all on function public.export_link_request(uuid) from public, anon, authenticated;
grant execute on function public.export_link_request(uuid) to service_role;

create function public.purge_link_requests()
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
    where id = v_id;

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
    where id = v_id;

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

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule('tower-link-retention', '17 3 * * *', 'select public.purge_link_requests()');
