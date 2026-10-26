begin;

select plan(29);

select is(
  (
    select string_agg(
      p.proname || ':' || p.prosecdef::text || ':' || array_to_string(p.proconfig, ','),
      ' ' order by p.proname collate "C"
    )
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('delete_link_request', 'export_link_request', 'purge_link_requests')
  ),
  'delete_link_request:false:search_path="" export_link_request:false:search_path="" purge_link_requests:false:search_path=""',
  'the three protection functions are false:search_path=""'
);

select is(
  (case when has_function_privilege('anon', 'public.delete_link_request(uuid)', 'EXECUTE') then 't' else 'f' end)
    || '/'
    || (case when has_function_privilege('authenticated', 'public.delete_link_request(uuid)', 'EXECUTE') then 't' else 'f' end)
    || '/'
    || (case when has_function_privilege('service_role', 'public.delete_link_request(uuid)', 'EXECUTE') then 't' else 'f' end),
  'f/f/t',
  'delete_link_request execute is f/f/t'
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
  (case when has_function_privilege('anon', 'public.purge_link_requests()', 'EXECUTE') then 't' else 'f' end)
    || '/'
    || (case when has_function_privilege('authenticated', 'public.purge_link_requests()', 'EXECUTE') then 't' else 'f' end)
    || '/'
    || (case when has_function_privilege('service_role', 'public.purge_link_requests()', 'EXECUTE') then 't' else 'f' end),
  'f/f/t',
  'purge_link_requests execute is f/f/t'
);

insert into auth.users (instance_id, id, aud, role, email)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'owner@example.test'),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'other@example.test');

insert into auth.identities (user_id, provider, provider_id, identity_data)
values
  ('11111111-1111-4111-8111-111111111111', 'github', '424242', '{"sub":"424242"}'::jsonb),
  ('22222222-2222-4222-8222-222222222222', 'github', '999', '{"sub":"999"}'::jsonb);

insert into public.owner_allowlist (github_id) values ('424242');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

set local role authenticated;

select throws_ok(
  $$select public.delete_link_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  '42501',
  'permission denied for function delete_link_request',
  'authenticated cannot execute delete_link_request'
);

reset role;

set local role service_role;

do $setup$
begin
  perform public.request_link('fixture-dev/t15-export', '0', 'EXPORT-T15', '0.2.9', '0-draft-3');
  perform public.approve_link_request(r.id)
    from public.link_requests r
    where r.repository = 'fixture-dev/t15-export';
  perform public.ingest_event(
    '{"v":1,"project":"EXPORT-T15","run":"gha-15-1","seq":1,"phase":"P03","task":"T15","step":"build","status":"started","at":"2026-10-26T00:00:00Z","evidence":null}'::jsonb,
    'ci'
  );
  perform public.ingest_event(
    '{"v":1,"project":"EXPORT-T15","run":"gha-15-1","seq":2,"phase":"P03","task":"T15","step":"checks","status":"pass","at":"2026-10-26T00:01:00Z","evidence":"@aabbccd"}'::jsonb,
    'ci'
  );
  perform public.request_link('fixture-dev/t15-pend-ex', '0', 'PENDEX-T15', '0.2.9', '0-draft-3');
  perform public.request_link('fixture-dev/t15-pend-del', '0', 'PENDDEL-T15', '0.2.9', '0-draft-3');
end
$setup$;

create temp table t15_export_ids (request_id uuid, project_id uuid);

insert into t15_export_ids (request_id, project_id)
select r.id, r.project_id
from public.link_requests r
where r.repository = 'fixture-dev/t15-export';

create temp table t15_export_doc (doc jsonb);

insert into t15_export_doc (doc)
select public.export_link_request(request_id)
from t15_export_ids;

select is(
  (select doc->>'result' from t15_export_doc),
  'exported',
  'export result is exported'
);

select is(
  (select doc->'request'->>'repository' from t15_export_doc),
  'fixture-dev/t15-export',
  'export request.repository is the repository'
);

select is(
  (select doc->'project'->>'key' from t15_export_doc),
  'EXPORT-T15',
  'export project.key is the approved key'
);

select is(
  (
    select jsonb_array_length(doc->'step_events')::text
      || ':'
      || (doc->'step_events'->0->>'seq')
      || ':'
      || (doc->'step_events'->1->>'seq')
    from t15_export_doc
  ),
  '2:1:2',
  'step_events has 2 entries with seq 1 and 2'
);

select is(
  (
    select string_agg(k, ',' order by k collate "C")
    from t15_export_doc, lateral pg_catalog.jsonb_object_keys(doc->'request') as k
  ),
  'contract_version,decided_at,engine_version,first_requested_at,id,last_requested_at,owner_github_id,project_id,proposed_key,repository,state',
  'export request has every link_requests column'
);

select is(
  (
    select count(*)::integer
    from public.link_audit a
    where a.action = 'exported'
      and a.request_id = (select request_id from t15_export_ids)
  ),
  1,
  'export writes one audit exported row'
);

select is(
  (
    select (doc->>'result') || ':' || (doc->'project')::text || ':' || (doc->'step_events')::text
    from (
      select public.export_link_request(r.id) as doc
      from public.link_requests r
      where r.repository = 'fixture-dev/t15-pend-ex'
    ) s
  ),
  'exported:null:[]',
  'export of a pending request has a null project and empty step_events'
);

select is(
  public.delete_link_request((select request_id from t15_export_ids)),
  '{"result":"deleted","project_deleted":true}'::jsonb,
  'delete of the approved request deletes its project'
);

select is(
  (select count(*)::integer from public.link_requests where id = (select request_id from t15_export_ids)),
  0,
  'the approved request row is gone'
);

select is(
  (select count(*)::integer from public.projects where id = (select project_id from t15_export_ids)),
  0,
  'the approved project row is gone'
);

select is(
  (select count(*)::integer from public.events where project_id = (select project_id from t15_export_ids)),
  0,
  'the approved project events are gone'
);

select is(
  (
    select count(*)::integer
    from public.link_audit
    where action = 'deleted'
      and request_id = (select request_id from t15_export_ids)
  ),
  1,
  'delete writes one audit deleted row'
);

select is(
  (
    select public.delete_link_request(r.id)->>'project_deleted'
    from public.link_requests r
    where r.repository = 'fixture-dev/t15-pend-del'
  ),
  'false',
  'delete of a pending request does not delete a project'
);

select is(
  public.delete_link_request('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  '{"result":"not_found"}'::jsonb,
  'delete of an unknown request is not_found'
);

do $purge$
begin
  perform public.request_link('fixture-dev/t15-old-pend', '999', 'OLDPEND-T15', '0.2.9', '0-draft-3');
  perform public.request_link('fixture-dev/t15-old-decl', '999', 'OLDDECL-T15', '0.2.9', '0-draft-3');
  perform public.decline_link_request(r.id)
    from public.link_requests r
    where r.repository = 'fixture-dev/t15-old-decl';
  perform public.request_link('fixture-dev/t15-young', '999', 'YOUNG-T15', '0.2.9', '0-draft-3');

  perform public.request_link('fixture-dev/t15-old-disc', '999', 'OLDDISC-T15', '0.2.9', '0-draft-3');
  perform public.approve_link_request(r.id)
    from public.link_requests r
    where r.repository = 'fixture-dev/t15-old-disc';
  perform public.decline_link_request(r.id)
    from public.link_requests r
    where r.repository = 'fixture-dev/t15-old-disc';

  perform public.request_link('fixture-dev/t15-young-disc', '999', 'YOUNGDISC-T15', '0.2.9', '0-draft-3');
  perform public.approve_link_request(r.id)
    from public.link_requests r
    where r.repository = 'fixture-dev/t15-young-disc';
  perform public.decline_link_request(r.id)
    from public.link_requests r
    where r.repository = 'fixture-dev/t15-young-disc';

  update public.link_requests
  set last_requested_at = pg_catalog.now() - interval '181 days'
  where repository in ('fixture-dev/t15-old-pend', 'fixture-dev/t15-old-decl');

  update public.link_requests
  set last_requested_at = pg_catalog.now() - interval '179 days'
  where repository = 'fixture-dev/t15-young';

  update public.link_requests
  set decided_at = pg_catalog.now() - interval '366 days'
  where repository = 'fixture-dev/t15-old-disc';

  update public.link_requests
  set decided_at = pg_catalog.now() - interval '364 days'
  where repository = 'fixture-dev/t15-young-disc';
end
$purge$;

create temp table t15_purged_before as
select count(*)::integer as n
from public.link_audit
where action = 'purged';

select is(
  public.purge_link_requests(),
  3,
  'purge removes the three old requests'
);

select is(
  (
    select count(*)::integer
    from public.link_requests
    where repository in (
      'fixture-dev/t15-old-pend',
      'fixture-dev/t15-old-decl',
      'fixture-dev/t15-old-disc'
    )
  ),
  0,
  'the three old requests are gone'
);

select is(
  (select count(*)::integer from public.projects where key = 'OLDDISC-T15'),
  0,
  'the 366-day project is gone'
);

select is(
  (
    select state || ':' || (project_id is null)::text
    from public.link_requests
    where repository = 'fixture-dev/t15-young'
  ),
  'pending:true',
  'the 179-day request remains pending without a project'
);

select is(
  (
    select r.state || ':' || p.key
    from public.link_requests r
    join public.projects p on p.id = r.project_id
    where r.repository = 'fixture-dev/t15-young-disc'
  ),
  'declined:YOUNGDISC-T15',
  'the 364-day request and its project remain'
);

select is(
  (select count(*)::integer from public.link_audit where action = 'purged')
    - (select n from t15_purged_before),
  3,
  'purge writes 3 new audit purged rows'
);

reset role;

select is(
  (select jobname || ' ' || schedule || ' ' || command from cron.job where jobname = 'tower-link-retention'),
  'tower-link-retention 17 3 * * * select public.purge_link_requests()',
  'cron.job schedules tower-link-retention'
);

select is(
  (select count(*)::integer from cron.job),
  1,
  'cron.job has one row'
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

select * from finish();

rollback;
