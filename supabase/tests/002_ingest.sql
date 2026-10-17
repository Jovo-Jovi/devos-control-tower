begin;

select plan(26);

select ok(
  (
    select bool_and(c.relrowsecurity)
      and count(*) = 5
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('projects', 'runs', 'events', 'event_usage', 'event_rejections')
  ),
  'RLS is enabled on all five ingest tables'
);

select ok(
  (
    select count(*) = 7
      and bool_and(
        roles::text = '{authenticated}'
        and coalesce(qual, 'is_owner()') like '%is_owner()%'
        and coalesce(with_check, 'is_owner()') like '%is_owner()%'
        and (qual is not null or with_check is not null)
      )
    from pg_policies
    where schemaname = 'public'
      and tablename in ('projects', 'runs', 'events', 'event_usage', 'event_rejections')
  ),
  'every policy is to authenticated and references is_owner()'
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
    select count(*)::integer
    from (values ('anon'), ('authenticated')) as r(role)
    cross join (values ('projects'), ('runs'), ('events'), ('event_usage'), ('event_rejections')) as t(tbl)
    cross join (values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) as p(priv)
    where has_table_privilege(r.role, 'public.' || t.tbl, p.priv)
      and not (
        r.role = 'authenticated'
        and t.tbl = 'projects'
        and p.priv in ('INSERT', 'UPDATE')
      )
  ),
  0,
  'write privileges match the ingest grant'
);

select is(
  (
    select p.prosecdef::text || ':' || array_to_string(p.proconfig, ',')
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'ingest_event'
  ),
  'false:search_path=""',
  'ingest_event is security invoker with an empty search_path'
);

select is(
  has_function_privilege('anon', 'public.ingest_event(jsonb,text)', 'EXECUTE')::text
    || ':'
    || has_function_privilege('authenticated', 'public.ingest_event(jsonb,text)', 'EXECUTE')::text
    || ':'
    || has_function_privilege('service_role', 'public.ingest_event(jsonb,text)', 'EXECUTE')::text,
  'false:false:true',
  'ingest_event execute is service_role only'
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

insert into auth.users (instance_id, id, aud, role, email)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'owner@example.test'),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'other@example.test');

insert into auth.identities (user_id, provider, provider_id, identity_data)
values
  ('11111111-1111-4111-8111-111111111111', 'github', '424242', '{"sub":"424242"}'::jsonb),
  ('22222222-2222-4222-8222-222222222222', 'github', '999', '{"sub":"999"}'::jsonb);

set local role anon;

select is(
  (
    (select count(*) from public.projects)
    + (select count(*) from public.runs)
    + (select count(*) from public.events)
    + (select count(*) from public.event_usage)
    + (select count(*) from public.event_rejections)
  )::integer,
  0,
  'anon reads 0 rows from each of the five tables'
);

reset role;

select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);

set local role authenticated;

select is(
  (
    (select count(*) from public.projects)
    + (select count(*) from public.runs)
    + (select count(*) from public.events)
    + (select count(*) from public.event_usage)
    + (select count(*) from public.event_rejections)
  )::integer,
  0,
  'fixture 999 reads 0 rows from each of the five tables'
);

reset role;

insert into public.owner_allowlist (github_id) values ('424242');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

set local role authenticated;

select is(
  (
    select count(*)::integer
    from public.events e
    join public.projects p on p.id = e.project_id
    where p.key = 'FIXTURE'
  ),
  3,
  'fixture 424242 reads 3 FIXTURE events'
);

select throws_ok(
  $$insert into public.events (
      project_id, run_id, seq, v, step, status, at, origin, source, body_hash
    ) values (
      '00000000-0000-0000-0000-000000000000',
      '00000000-0000-0000-0000-000000000000',
      1, 1, 'build', 'pass', '2026-10-17T00:00:00Z', 'reported', 'ci', '\x00'
    )$$,
  '42501',
  'permission denied for table events',
  'authenticated owner cannot insert into events'
);

reset role;

delete from public.projects where key in ('PGTAP', 'RATE');
-- Unit tests leave reason rows behind. This transaction rolls back, so the delete
-- only clears them for the assertion that the conflict adds exactly one row.
delete from public.event_rejections;

insert into public.projects (key, repo, owner_github_id)
values
  ('PGTAP', 'fixture-org/pgtap-repo', '424242'),
  ('RATE', 'fixture-org/rate-repo', '424242');

set local role service_role;

select is(
  public.ingest_event(
    '{"v":1,"project":"PGTAP","run":"gha-9-1","seq":1,"phase":"P01","task":"T02","step":"build","status":"pass","at":"2026-10-17T01:00:00Z","evidence":"@aabbccd","usage":[{"agent":"builder","tool":"cursor-agent","model":"grok-4.7-high","account_alias":"cursor-1","input":1,"output":2,"cache_read":3,"cache_write":4,"source":"measured"}]}'::jsonb,
    'ci'
  )->>'result',
  'stored',
  'ingest_event stores the event'
);

select is(
  (
    select e.origin || ':' || e.source
    from public.events e
    join public.projects p on p.id = e.project_id
    join public.runs r on r.id = e.run_id
    where p.key = 'PGTAP'
      and r.run_key = 'gha-9-1'
      and e.seq = 1
  ),
  'reported:ci',
  'stored ci event is reported from ci'
);

select is(
  (
    select u.agent || ':' || u.tool || ':' || u.model || ':' || u.account_alias || ':'
      || u.input::text || ':' || u.output::text || ':' || u.cache_read::text || ':'
      || u.cache_write::text || ':' || u.source
    from public.event_usage u
    join public.events e on e.id = u.event_id
    join public.projects p on p.id = e.project_id
    where p.key = 'PGTAP'
  ),
  'builder:cursor-agent:grok-4.7-high:cursor-1:1:2:3:4:measured',
  'stored event has its usage row'
);

select is(
  public.ingest_event(
    '{"v":1,"project":"PGTAP","run":"gha-9-1","seq":1,"phase":"P01","task":"T02","step":"build","status":"pass","at":"2026-10-17T01:00:00Z","evidence":"@aabbccd","usage":[{"agent":"builder","tool":"cursor-agent","model":"grok-4.7-high","account_alias":"cursor-1","input":1,"output":2,"cache_read":3,"cache_write":4,"source":"measured"}]}'::jsonb,
    'ci'
  )->>'result',
  'duplicate',
  'the same body is a duplicate'
);

select is(
  (
    select count(*)::integer
    from public.events e
    join public.projects p on p.id = e.project_id
    join public.runs r on r.id = e.run_id
    where p.key = 'PGTAP'
      and r.run_key = 'gha-9-1'
      and e.seq = 1
  ),
  1,
  'duplicate does not store a second row'
);

select is(
  public.ingest_event(
    '{"v":1,"project":"PGTAP","run":"gha-9-1","seq":1,"phase":"P01","task":"T02","step":"build","status":"pass","at":"2026-10-17T01:00:01Z","evidence":"@bbccdde","usage":[{"agent":"builder","tool":"cursor-agent","model":"grok-4.7-high","account_alias":"cursor-1","input":1,"output":2,"cache_read":3,"cache_write":4,"source":"measured"}]}'::jsonb,
    'ci'
  )->>'result',
  'conflict',
  'a different body for the same key is a conflict'
);

select is(
  (select count(*)::integer from public.event_rejections where reason = 'duplicate_conflict'),
  1,
  'conflict stores one duplicate_conflict rejection'
);

select is(
  (
    select e.body_hash
    from public.events e
    join public.projects p on p.id = e.project_id
    join public.runs r on r.id = e.run_id
    where p.key = 'PGTAP'
      and r.run_key = 'gha-9-1'
      and e.seq = 1
  ),
  pg_catalog.sha256(pg_catalog.convert_to((
    '{"v":1,"project":"PGTAP","run":"gha-9-1","seq":1,"phase":"P01","task":"T02","step":"build","status":"pass","at":"2026-10-17T01:00:00Z","evidence":"@aabbccd","usage":[{"agent":"builder","tool":"cursor-agent","model":"grok-4.7-high","account_alias":"cursor-1","input":1,"output":2,"cache_read":3,"cache_write":4,"source":"measured"}]}'::jsonb
  )::text, 'UTF8')),
  'conflict leaves the first body hash unchanged'
);

select is(
  public.ingest_event(
    '{"v":1,"project":"PGTAP","run":"import-aabbccd","seq":1,"phase":"P01","task":"T02","step":"verdict","status":"pass","at":"2026-10-17T02:00:00Z","evidence":"@aabbccd"}'::jsonb,
    'import'
  )->>'result',
  'stored',
  'import is stored'
);

select is(
  (
    select e.origin
    from public.events e
    join public.runs r on r.id = e.run_id
    where r.run_key = 'import-aabbccd'
  ),
  'imported',
  'import origin is imported'
);

select is(
  (
    select count(*)::integer
    from generate_series(1, 60) as g(seq)
    cross join lateral (
      select public.ingest_event(
        pg_catalog.jsonb_build_object(
          'v', 1,
          'project', 'RATE',
          'run', 'gha-3-1',
          'seq', g.seq,
          'phase', 'P01',
          'task', 'T02',
          'step', 'checks',
          'status', 'pass',
          'at', '2026-10-17T03:00:00Z',
          'evidence', '@aabbccd'
        ),
        'ci'
      ) as result
    ) as stored
    where stored.result->>'result' = 'stored'
  ),
  60,
  'sixty ci events in a minute are stored'
);

select is(
  public.ingest_event(
    pg_catalog.jsonb_build_object(
      'v', 1,
      'project', 'RATE',
      'run', 'gha-3-1',
      'seq', 61,
      'phase', 'P01',
      'task', 'T02',
      'step', 'checks',
      'status', 'pass',
      'at', '2026-10-17T03:00:01Z',
      'evidence', '@aabbccd'
    ),
    'ci'
  )->>'result',
  'rate_limited',
  'the 61st ci event in a minute is rate limited'
);

select is(
  (
    select count(*)::integer
    from public.events e
    join public.projects p on p.id = e.project_id
    where p.key = 'RATE'
  ),
  60,
  'rate limit stores nothing'
);

reset role;

select throws_ok(
  $$insert into public.event_usage (
      event_id, agent, tool, model, account_alias, input, output, cache_read, cache_write, source
    )
    select e.id, 'builder', 'cursor-agent', 'grok-4.7-high', 'cursor-1', 1, null, null, null, 'unavailable'
    from public.events e
    join public.projects p on p.id = e.project_id
    join public.runs r on r.id = e.run_id
    where p.key = 'PGTAP'
      and r.run_key = 'gha-9-1'
      and e.seq = 1$$,
  '23514',
  'new row for relation "event_usage" violates check constraint "event_usage_check"',
  'unavailable usage with a number is refused'
);

select throws_ok(
  $$insert into public.event_rejections (reason) values ('not-a-reason')$$,
  '23514',
  'new row for relation "event_rejections" violates check constraint "event_rejections_reason_check"',
  'a reason outside the list is refused'
);

select * from finish();

rollback;
