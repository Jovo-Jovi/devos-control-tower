begin;

select plan(39);

select is(
  (
    select string_agg(
      p.proname || ':' || p.prosecdef::text || ':' || array_to_string(p.proconfig, ','),
      ' ' order by p.proname collate "C"
    )
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'approve_link_request',
        'export_link_request',
        'purge_link_requests',
        'request_link'
      )
  ),
  'approve_link_request:false:search_path="" export_link_request:false:search_path="" purge_link_requests:false:search_path="" request_link:false:search_path=""',
  'the four safeguard functions are false:search_path=""'
);

select is(
  (case when has_function_privilege('anon', 'public.approve_link_request(uuid)', 'EXECUTE') then 't' else 'f' end)
    || '/'
    || (case when has_function_privilege('authenticated', 'public.approve_link_request(uuid)', 'EXECUTE') then 't' else 'f' end)
    || '/'
    || (case when has_function_privilege('service_role', 'public.approve_link_request(uuid)', 'EXECUTE') then 't' else 'f' end),
  'f/f/t',
  'approve_link_request execute is f/f/t'
);

select is(
  (case when has_function_privilege('anon', 'public.request_link(text,text,text,text,text)', 'EXECUTE') then 't' else 'f' end)
    || '/'
    || (case when has_function_privilege('authenticated', 'public.request_link(text,text,text,text,text)', 'EXECUTE') then 't' else 'f' end)
    || '/'
    || (case when has_function_privilege('service_role', 'public.request_link(text,text,text,text,text)', 'EXECUTE') then 't' else 'f' end),
  'f/f/t',
  'request_link execute is f/f/t'
);

select is(
  (case when has_function_privilege('anon', 'public.purge_link_requests()', 'EXECUTE') then 't' else 'f' end)
    || '/'
    || (case when has_function_privilege('authenticated', 'public.purge_link_requests()', 'EXECUTE') then 't' else 'f' end)
    || '/'
    || (case when has_function_privilege('service_role', 'public.purge_link_requests()', 'EXECUTE') then 't' else 'f' end),
  'f/f/t',
  'purge_link_requests execute is f/f/t'
);

select is(
  (case when has_function_privilege('anon', 'public.export_link_request(uuid)', 'EXECUTE') then 't' else 'f' end)
    || '/'
    || (case when has_function_privilege('authenticated', 'public.export_link_request(uuid)', 'EXECUTE') then 't' else 'f' end)
    || '/'
    || (case when has_function_privilege('service_role', 'public.export_link_request(uuid)', 'EXECUTE') then 't' else 'f' end),
  'f/f/t',
  'export_link_request execute is f/f/t'
);

select is(
  (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  ),
  1,
  'public has exactly one security definer function'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and cmd = 'DELETE'
  ),
  0,
  'no DELETE policy'
);

select is(
  (
    select (position('UNIQUE INDEX' in indexdef) > 0)
      and (position('WHERE (project_id IS NOT NULL)' in indexdef) > 0)
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'link_requests_project_id_key'
  ),
  true,
  'link_requests_project_id_key is a partial unique index'
);

select is(
  (
    select position(
      'pg_advisory_xact_lock' in pg_get_functiondef(
        'public.request_link(text,text,text,text,text)'::regprocedure
      )
    ) > 0
  ),
  true,
  'request_link takes pg_advisory_xact_lock'
);

set local role service_role;

insert into public.link_requests (
  repository,
  owner_github_id,
  proposed_key,
  engine_version,
  contract_version,
  last_requested_at
) values
  (
    'fixture-dev/t17-purge-a',
    '0',
    'PURGEA-T17',
    '0.2.9',
    '0-draft-3',
    pg_catalog.now() - interval '181 days'
  ),
  (
    'fixture-dev/t17-purge-b',
    '0',
    'PURGEB-T17',
    '0.2.9',
    '0-draft-3',
    pg_catalog.now() - interval '181 days'
  );

create temp table t17_purged_before as
select count(*)::integer as n
from public.link_audit
where action = 'purged';

reset role;

create function public.t17_approve_sibling()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $t17$
declare
  v_id uuid;
  v_key text;
  v_repo text;
  v_owner text;
  v_project uuid;
begin
  select r.id, r.proposed_key, r.repository, r.owner_github_id
  into v_id, v_key, v_repo, v_owner
  from public.link_requests r
  where r.repository in ('fixture-dev/t17-purge-a', 'fixture-dev/t17-purge-b')
    and r.id is distinct from new.request_id
    and r.state = 'pending'
  limit 1;

  if v_id is null then
    return new;
  end if;

  insert into public.projects (key, repo, owner_github_id)
  values (v_key, v_repo, v_owner)
  returning id into v_project;

  update public.link_requests
  set
    state = 'approved',
    decided_at = pg_catalog.now(),
    project_id = v_project
  where id = v_id;

  return new;
end;
$t17$;

create trigger t17_purge_recheck
after insert on public.link_audit
for each row
when (new.action = 'purged')
execute function public.t17_approve_sibling();

set local role service_role;

select is(
  public.purge_link_requests(),
  1,
  'purge removes only the request that still meets its condition'
);

select is(
  (
    select count(*)::integer
    from public.link_requests
    where repository in ('fixture-dev/t17-purge-a', 'fixture-dev/t17-purge-b')
  ),
  1,
  'purge keeps exactly one of the two requests'
);

select is(
  (
    select state || ':' || (project_id is not null)::text
    from public.link_requests
    where repository in ('fixture-dev/t17-purge-a', 'fixture-dev/t17-purge-b')
  ),
  'approved:true',
  'the request approved during the purge remains approved with its project'
);

select is(
  (
    select count(*)::integer
    from public.projects p
    join public.link_requests r on r.project_id = p.id
    where r.repository in ('fixture-dev/t17-purge-a', 'fixture-dev/t17-purge-b')
  ),
  1,
  'the approved request project remains'
);

select is(
  (select count(*)::integer from public.link_audit where action = 'purged')
    - (select n from t17_purged_before),
  1,
  'the skipped request gets no purged audit row'
);

reset role;

drop trigger t17_purge_recheck on public.link_audit;
drop function public.t17_approve_sibling();

set local role service_role;

do $req_a$
declare
  v_result jsonb;
begin
  v_result := public.request_link('fixture-dev/t17-req-a', '0', 'REQA-T17', '0.2.9', '0-draft-3');
  if v_result->>'result' is distinct from 'pending' then
    raise exception 'request A did not pend: %', v_result;
  end if;
end
$req_a$;

select is(
  public.approve_link_request((select id from public.link_requests where repository = 'fixture-dev/t17-req-a')),
  '{"result":"approved","key":"REQA-T17"}'::jsonb,
  'approving request A creates project REQA-T17'
);

do $req_b$
declare
  v_result jsonb;
begin
  v_result := public.request_link('fixture-dev/t17-req-b', '0', 'REQB-T17', '0.2.9', '0-draft-3');
  if v_result->>'result' is distinct from 'pending' then
    raise exception 'request B did not pend: %', v_result;
  end if;

  update public.projects
  set repo = 'fixture-dev/t17-req-b'
  where key = 'REQA-T17';
end
$req_b$;

create temp table t17_p_before as
select id, key, repo
from public.projects
where key = 'REQA-T17';

create temp table t17_b_audit as
select count(*)::integer as n
from public.link_audit a
join public.link_requests r on r.id = a.request_id
where r.repository = 'fixture-dev/t17-req-b';

select is(
  public.approve_link_request((select id from public.link_requests where repository = 'fixture-dev/t17-req-b')),
  '{"result":"project_linked"}'::jsonb,
  'approving a second request for a linked project is project_linked'
);

select is(
  (
    select state || ':' || (decided_at is null)::text || ':' || (project_id is null)::text
    from public.link_requests
    where repository = 'fixture-dev/t17-req-b'
  ),
  'pending:true:true',
  'project_linked leaves the request pending with no decision and no project'
);

select is(
  (
    select count(*)::integer
    from public.link_audit a
    join public.link_requests r on r.id = a.request_id
    where r.repository = 'fixture-dev/t17-req-b'
  ),
  (select n from t17_b_audit),
  'project_linked writes no audit row'
);

select is(
  (select p.key from public.projects p where p.id = (select id from t17_p_before)),
  (select key from t17_p_before),
  'project_linked leaves the project key unchanged'
);

select is(
  (select p.repo from public.projects p where p.id = (select id from t17_p_before)),
  (select repo from t17_p_before),
  'project_linked leaves the project repo unchanged'
);

select throws_ok(
  $upd$
    update public.link_requests
    set
      state = 'approved',
      decided_at = pg_catalog.now(),
      project_id = (
        select r.project_id
        from public.link_requests r
        where r.repository = 'fixture-dev/t17-req-a'
      )
    where repository = 'fixture-dev/t17-req-b'
  $upd$,
  '23505',
  null,
  'a second approved request for the same project is refused'
);

select throws_ok(
  $upd$
    update public.link_requests
    set
      state = 'approved',
      project_id = (
        select r.project_id
        from public.link_requests r
        where r.repository = 'fixture-dev/t17-req-a'
      )
    where repository = 'fixture-dev/t17-req-b'
  $upd$,
  '23514',
  null,
  'approving without decided_at fails the check before the unique index'
);

do $free$
declare
  v_result jsonb;
begin
  v_result := public.request_link('fixture-dev/t17-free', '0', 'FREEREQ-T17', '0.2.9', '0-draft-3');
  if v_result->>'result' is distinct from 'pending' then
    raise exception 'free request did not pend: %', v_result;
  end if;

  insert into public.projects (key, repo, owner_github_id)
  values ('FREE-T17', 'fixture-dev/t17-free', '0');
end
$free$;

select is(
  public.approve_link_request((select id from public.link_requests where repository = 'fixture-dev/t17-free')),
  '{"result":"approved","key":"FREE-T17"}'::jsonb,
  'a request for a project no request has is approved with that project key'
);

do $cap$
declare
  v_result jsonb;
  v_id uuid;
begin
  v_result := public.request_link('fixture-dev/t17-declined', '999', 'DECL-T17', '0.2.9', '0-draft-3');
  if v_result->>'result' is distinct from 'pending' then
    raise exception 'declined setup did not pend: %', v_result;
  end if;

  select r.id
  into v_id
  from public.link_requests r
  where r.repository = 'fixture-dev/t17-declined';

  v_result := public.decline_link_request(v_id);
  if v_result->>'result' is distinct from 'declined' then
    raise exception 'decline setup failed: %', v_result;
  end if;

  insert into public.projects (key, repo, owner_github_id)
  values ('LINKED-T17', 'fixture-dev/t17-already', '999');

  v_result := public.request_link('fixture-dev/t17-cap-1', '999', 'CAP1-T17', '0.2.9', '0-draft-3');
  if v_result->>'result' is distinct from 'pending' then
    raise exception 'cap 1 did not pend: %', v_result;
  end if;

  v_result := public.request_link('fixture-dev/t17-cap-2', '999', 'CAP2-T17', '0.2.9', '0-draft-3');
  if v_result->>'result' is distinct from 'pending' then
    raise exception 'cap 2 did not pend: %', v_result;
  end if;

  v_result := public.request_link('fixture-dev/t17-cap-3', '999', 'CAP3-T17', '0.2.9', '0-draft-3');
  if v_result->>'result' is distinct from 'pending' then
    raise exception 'cap 3 did not pend: %', v_result;
  end if;
end
$cap$;

create temp table t17_cap_before as
select
  (select count(*)::integer from public.link_requests) as requests,
  (select count(*)::integer from public.link_audit where action = 'requested') as requested;

select is(
  public.request_link('fixture-dev/t17-cap-4', '999', 'CAP4-T17', '0.2.9', '0-draft-3'),
  '{"result":"rate_limited"}'::jsonb,
  'a fourth pending request for one owner is rate_limited'
);

select is(
  (select count(*)::integer from public.link_requests),
  (select requests from t17_cap_before),
  'rate_limited leaves the link_requests count unchanged'
);

select is(
  (select count(*)::integer from public.link_audit where action = 'requested'),
  (select requested from t17_cap_before),
  'rate_limited leaves the requested audit count unchanged'
);

select is(
  public.request_link('fixture-dev/t17-cap-1', '999', 'CAP1-T17', '0.2.9', '0-draft-3'),
  '{"result":"pending"}'::jsonb,
  'a repeat of a pending request at the cap stays pending'
);

select is(
  public.request_link('fixture-dev/t17-declined', '999', 'DECL-T17', '0.2.9', '0-draft-3'),
  '{"result":"declined"}'::jsonb,
  'a repeat of a declined request at the cap stays declined'
);

select is(
  public.request_link('fixture-dev/t17-already', '999', 'ANYKEY-T17', '0.2.9', '0-draft-3'),
  '{"result":"linked","key":"LINKED-T17"}'::jsonb,
  'a repository that already has a project is linked with that key'
);

select is(
  (select count(*)::integer from public.link_requests),
  (select requests from t17_cap_before),
  'the exempt repeats create no request'
);

select is(
  public.request_link('fixture-dev/t17-owner0', '0', 'OWN0-T17', '0.2.9', '0-draft-3'),
  '{"result":"pending"}'::jsonb,
  'a new repository of owner 0 is pending'
);

do $export_setup$
declare
  v_id uuid;
  v_project uuid;
  v_result jsonb;
begin
  insert into public.link_requests (
    repository,
    owner_github_id,
    proposed_key,
    engine_version,
    contract_version
  ) values (
    'fixture-dev/t17-export',
    '999',
    'EXPRT-T17',
    '0.2.9',
    '0-draft-3'
  )
  returning id into v_id;

  v_result := public.approve_link_request(v_id);
  if v_result->>'result' is distinct from 'approved'
    or v_result->>'key' is distinct from 'EXPRT-T17'
  then
    raise exception 'export approve failed: %', v_result;
  end if;

  v_result := public.ingest_event(
    pg_catalog.jsonb_build_object(
      'v', 1,
      'project', 'EXPRT-T17',
      'run', 'gha-17-1',
      'seq', 1,
      'phase', 'P03',
      'task', 'T17',
      'step', 'build',
      'status', 'pass',
      'at', '2026-10-26T00:00:00Z',
      'evidence', '@aabbccd',
      'usage', pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'agent', 'builder',
          'tool', 'cursor-agent',
          'model', 'grok-4.7-high',
          'account_alias', 'cursor-1',
          'input', 10,
          'output', 4,
          'cache_read', 3,
          'cache_write', 2,
          'source', 'measured'
        )
      )
    ),
    'ci'
  );
  if v_result->>'result' is distinct from 'stored' then
    raise exception 'ingest failed: %', v_result;
  end if;

  select r.project_id
  into v_project
  from public.link_requests r
  where r.id = v_id;

  insert into public.observations (
    project_id,
    sha,
    kind,
    context,
    state,
    at,
    actor_login,
    payload_ref
  ) values (
    v_project,
    '0123456789abcdef0123456789abcdef01234567',
    'check_run',
    'devos/verdict',
    'success',
    '2026-10-26T00:02:00Z',
    null,
    't17-delivery'
  );
end
$export_setup$;

create temp table t17_export_doc as
select public.export_link_request(r.id) as doc
from public.link_requests r
where r.repository = 'fixture-dev/t17-export';

select is(
  (select doc->>'result' from t17_export_doc),
  'exported',
  'export result is exported'
);

select is(
  (
    select string_agg(k, ',' order by k collate "C")
    from t17_export_doc, lateral pg_catalog.jsonb_object_keys(doc) as k
  ),
  'event_usage,observations,project,request,result,step_events',
  'export top-level keys are the existing keys plus event_usage and observations'
);

select is(
  (
    select pg_catalog.jsonb_array_length(doc->'event_usage')::text
      || ':'
      || (
        select string_agg(k, ',' order by k collate "C")
        from t17_export_doc d,
          lateral pg_catalog.jsonb_object_keys(d.doc->'event_usage'->0) as k
      )
    from t17_export_doc
  ),
  '1:account_alias,agent,cache_read,cache_write,input,model,output,run,seq,source,tool',
  'event_usage has one entry with the usage columns'
);

select is(
  (
    select (doc->'event_usage'->0->>'run')
      || ':' || (doc->'event_usage'->0->>'seq')
      || ':' || (doc->'event_usage'->0->>'agent')
      || ':' || (doc->'event_usage'->0->>'tool')
      || ':' || (doc->'event_usage'->0->>'model')
      || ':' || (doc->'event_usage'->0->>'account_alias')
      || ':' || (doc->'event_usage'->0->>'input')
      || ':' || (doc->'event_usage'->0->>'output')
      || ':' || (doc->'event_usage'->0->>'cache_read')
      || ':' || (doc->'event_usage'->0->>'cache_write')
      || ':' || (doc->'event_usage'->0->>'source')
    from t17_export_doc
  ),
  'gha-17-1:1:builder:cursor-agent:grok-4.7-high:cursor-1:10:4:3:2:measured',
  'event_usage entry is the ingested usage row'
);

select is(
  (
    select pg_catalog.jsonb_array_length(doc->'observations')::text
      || ':'
      || (
        select string_agg(k, ',' order by k collate "C")
        from t17_export_doc d,
          lateral pg_catalog.jsonb_object_keys(d.doc->'observations'->0) as k
      )
    from t17_export_doc
  ),
  '1:actor_login,at,context,kind,payload_ref,received_at,sha,state',
  'observations has one entry with the observation columns'
);

select is(
  (
    select (doc->'observations'->0->>'sha')
      || ':' || (doc->'observations'->0->>'kind')
      || ':' || (doc->'observations'->0->>'context')
      || ':' || (doc->'observations'->0->>'state')
      || ':' || (doc->'observations'->0->>'payload_ref')
      || ':' || ((doc->'observations'->0->>'actor_login') is null)::text
    from t17_export_doc
  ),
  '0123456789abcdef0123456789abcdef01234567:check_run:devos/verdict:success:t17-delivery:true',
  'observations entry is the inserted observation'
);

select is(
  (
    select pg_catalog.jsonb_array_length(doc->'step_events')::text
      || ':' || (doc->'step_events'->0->>'step')
      || ':' || (doc->'step_events'->0->>'status')
      || ':' || (doc->'step_events'->0->>'run')
      || ':' || (doc->'step_events'->0->>'seq')
    from t17_export_doc
  ),
  '1:build:pass:gha-17-1:1',
  'step_events keeps the ingested event'
);

select is(
  (
    select (doc->'event_usage')::text || ':' || (doc->'observations')::text
    from (
      select public.export_link_request(r.id) as doc
      from public.link_requests r
      where r.repository = 'fixture-dev/t17-cap-1'
    ) s
  ),
  '[]:[]',
  'a pending request exports empty event_usage and observations'
);

select * from finish();

rollback;
