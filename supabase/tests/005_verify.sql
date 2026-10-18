begin;

select plan(11);

select is(
  (
    select p.prosecdef::text || ':' || array_to_string(p.proconfig, ',')
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'verify_reported_events'
  ),
  'false:search_path=""',
  'verify_reported_events is security invoker with an empty search_path'
);

select is(
  has_function_privilege('anon', 'public.verify_reported_events(uuid)', 'EXECUTE')::text
    || ':'
    || has_function_privilege('authenticated', 'public.verify_reported_events(uuid)', 'EXECUTE')::text
    || ':'
    || has_function_privilege('service_role', 'public.verify_reported_events(uuid)', 'EXECUTE')::text,
  'false:false:true',
  'verify_reported_events execute is service_role only'
);

insert into auth.users (instance_id, id, aud, role, email)
values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated',
  'authenticated',
  'owner@example.test'
);

insert into auth.identities (user_id, provider, provider_id, identity_data)
values (
  '11111111-1111-4111-8111-111111111111',
  'github',
  '424242',
  '{"sub":"424242"}'::jsonb
);

insert into public.owner_allowlist (github_id) values ('424242');

select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);

set local role authenticated;

select throws_ok(
  $$select public.verify_reported_events('00000000-0000-0000-0000-000000000000')$$,
  '42501',
  'permission denied for function verify_reported_events',
  'authenticated owner cannot execute verify_reported_events'
);

reset role;

delete from public.projects where key = 'PGVERIFY';

insert into public.projects (key, repo, owner_github_id)
values ('PGVERIFY', 'fixture-org/pgverify-repo', '424242');

set local role service_role;

insert into public.observations (project_id, sha, kind, context, state, at, payload_ref)
values (
  (select id from public.projects where key = 'PGVERIFY'),
  '1111111' || repeat('0', 33),
  'status',
  'devos/checks',
  'success',
  '2026-10-17T04:02:30Z',
  'pgverify-4'
);

select public.ingest_event(
  '{"v":1,"project":"PGVERIFY","run":"verify-4","seq":1,"phase":"P01","task":"T01","step":"checks","status":"pass","at":"2026-10-17T04:02:00Z","evidence":"@1111111"}'::jsonb,
  'ci'
);

select is(
  (
    select e.origin
    from public.events e
    join public.runs r on r.id = e.run_id
    join public.projects p on p.id = e.project_id
    where p.key = 'PGVERIFY'
      and r.run_key = 'verify-4'
      and e.seq = 1
  ),
  'verified',
  'ingest path verifies a checks pass matched by an earlier observation'
);

select public.ingest_event(
  '{"v":1,"project":"PGVERIFY","run":"verify-5","seq":1,"phase":"P01","task":"T01","step":"verdict","status":"fail","at":"2026-10-17T04:04:00Z","evidence":"@2222222"}'::jsonb,
  'ci'
);

insert into public.observations (project_id, sha, kind, context, state, at, payload_ref)
values (
  (select id from public.projects where key = 'PGVERIFY'),
  '2222222' || repeat('0', 33),
  'status',
  'devos/verdict',
  'error',
  '2026-10-17T04:04:30Z',
  'pgverify-5'
);

select is(
  public.verify_reported_events(
    (
      select r.id
      from public.runs r
      join public.projects p on p.id = r.project_id
      where p.key = 'PGVERIFY'
        and r.run_key = 'verify-5'
    )
  ),
  1,
  'webhook path verifies one reported verdict fail'
);

select is(
  (
    select e.origin
    from public.events e
    join public.runs r on r.id = e.run_id
    join public.projects p on p.id = e.project_id
    where p.key = 'PGVERIFY'
      and r.run_key = 'verify-5'
      and e.seq = 1
  ),
  'verified',
  'the verdict fail is verified after the observation'
);

insert into public.observations (project_id, sha, kind, context, state, at, payload_ref)
values (
  (select id from public.projects where key = 'PGVERIFY'),
  '3333333' || repeat('0', 33),
  'status',
  'devos/verdict',
  'failure',
  '2026-10-17T04:05:00Z',
  'pgverify-7'
);

select public.ingest_event(
  '{"v":1,"project":"PGVERIFY","run":"verify-7","seq":1,"phase":"P01","task":"T01","step":"verdict","status":"pass","at":"2026-10-17T04:05:00Z","evidence":"@3333333"}'::jsonb,
  'ci'
);

select is(
  (
    select e.origin
    from public.events e
    join public.runs r on r.id = e.run_id
    join public.projects p on p.id = e.project_id
    where p.key = 'PGVERIFY'
      and r.run_key = 'verify-7'
      and e.seq = 1
  ),
  'reported',
  'verdict pass stays reported when the observation is failure'
);

insert into public.observations (project_id, sha, kind, context, state, at, payload_ref)
values (
  (select id from public.projects where key = 'PGVERIFY'),
  '4444444' || repeat('0', 33),
  'status',
  'devos/build',
  'success',
  '2026-10-17T04:06:00Z',
  'pgverify-8'
);

select public.ingest_event(
  '{"v":1,"project":"PGVERIFY","run":"verify-8","seq":1,"phase":"P01","task":"T01","step":"build","status":"pass","at":"2026-10-17T04:06:00Z","evidence":"@4444444"}'::jsonb,
  'ci'
);

select is(
  (
    select e.origin
    from public.events e
    join public.runs r on r.id = e.run_id
    join public.projects p on p.id = e.project_id
    where p.key = 'PGVERIFY'
      and r.run_key = 'verify-8'
      and e.seq = 1
  ),
  'reported',
  'build pass stays reported'
);

insert into public.observations (project_id, sha, kind, context, state, at, payload_ref)
values (
  (select id from public.projects where key = 'PGVERIFY'),
  '5555555' || repeat('0', 33),
  'status',
  'devos/checks',
  'success',
  '2026-10-17T04:07:00Z',
  'pgverify-9'
);

select public.ingest_event(
  '{"v":1,"project":"PGVERIFY","run":"verify-9","seq":1,"phase":"P01","task":"T01","step":"checks","status":"pass","at":"2026-10-17T04:07:00Z","evidence":"@6666666"}'::jsonb,
  'ci'
);

select is(
  (
    select e.origin
    from public.events e
    join public.runs r on r.id = e.run_id
    join public.projects p on p.id = e.project_id
    where p.key = 'PGVERIFY'
      and r.run_key = 'verify-9'
      and e.seq = 1
  ),
  'reported',
  'checks pass stays reported when the evidence commit differs'
);

insert into public.observations (project_id, sha, kind, context, state, at, payload_ref)
values (
  (select id from public.projects where key = 'PGVERIFY'),
  '7777777' || repeat('0', 33),
  'status',
  'devos/gate',
  'success',
  '2026-10-17T04:08:00Z',
  'pgverify-10'
);

select public.ingest_event(
  '{"v":1,"project":"PGVERIFY","run":"verify-10","seq":1,"phase":"P01","task":"T01","step":"gate","status":"waiting","at":"2026-10-17T04:08:00Z","evidence":"@7777777"}'::jsonb,
  'ci'
);

select is(
  (
    select e.origin
    from public.events e
    join public.runs r on r.id = e.run_id
    join public.projects p on p.id = e.project_id
    where p.key = 'PGVERIFY'
      and r.run_key = 'verify-10'
      and e.seq = 1
  ),
  'reported',
  'gate waiting stays reported'
);

insert into public.observations (project_id, sha, kind, context, state, at, payload_ref)
values (
  (select id from public.projects where key = 'PGVERIFY'),
  '8888888' || repeat('0', 33),
  'status',
  'devos/checks',
  'success',
  '2026-10-17T04:09:00Z',
  'pgverify-11'
);

select public.ingest_event(
  '{"v":1,"project":"PGVERIFY","run":"verify-11","seq":1,"phase":"P01","task":"T01","step":"checks","status":"pass","at":"2026-10-17T04:09:00Z","evidence":"@8888888"}'::jsonb,
  'import'
);

select is(
  (
    select e.origin
    from public.events e
    join public.runs r on r.id = e.run_id
    join public.projects p on p.id = e.project_id
    where p.key = 'PGVERIFY'
      and r.run_key = 'verify-11'
      and e.seq = 1
  ),
  'imported',
  'an imported checks pass stays imported'
);

select * from finish();

rollback;
