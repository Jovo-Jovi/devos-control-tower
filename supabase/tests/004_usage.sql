begin;

select plan(8);

select ok(
  (
    select c.relkind = 'v'
      and 'security_invoker=true' = any (c.reloptions)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'usage_by_attempt'
  ),
  'usage_by_attempt is a security invoker view'
);

select is(
  (
    select count(*)::integer
    from (values ('anon'), ('authenticated')) as r(role)
    cross join (values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) as p(priv)
    where has_table_privilege(r.role, 'public.usage_by_attempt', p.priv)
  ),
  0,
  'anon and authenticated hold no write privilege on the view'
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

insert into public.projects (key, repo, owner_github_id)
values ('PGUSAGE', 'fixture-org/pgusage-repo', '424242');

set local role service_role;

select public.ingest_event(
  '{"v":1,"project":"PGUSAGE","run":"gha-7-1","seq":1,"phase":"P01","task":"T01","step":"build","status":"waiting","at":"2026-10-18T01:00:00Z","evidence":"@aabbccd","usage":[{"agent":"builder","tool":"cursor-agent","model":"grok-4.7-high","account_alias":"cursor-1","input":10,"output":1,"cache_read":0,"cache_write":0,"source":"measured"}]}'::jsonb,
  'ci'
);

select public.ingest_event(
  '{"v":1,"project":"PGUSAGE","run":"gha-7-1","seq":2,"phase":"P01","task":"T01","step":"build","status":"pass","at":"2026-10-18T01:01:00Z","evidence":"@aabbccd","usage":[{"agent":"builder","tool":"cursor-agent","model":"grok-4.7-high","account_alias":"cursor-1","input":5,"output":2,"cache_read":0,"cache_write":0,"source":"measured"}]}'::jsonb,
  'ci'
);

select public.ingest_event(
  '{"v":1,"project":"PGUSAGE","run":"gha-7-1","seq":3,"phase":"P01","task":"T01","step":"review","status":"waiting","at":"2026-10-18T01:02:00Z","evidence":"@aabbccd","usage":[{"agent":"reviewer","tool":"claude-code","model":"claude-opus-5-5","account_alias":"claude-1","input":7,"output":7,"cache_read":7,"cache_write":7,"source":"measured"}]}'::jsonb,
  'ci'
);

select public.ingest_event(
  '{"v":1,"project":"PGUSAGE","run":"gha-7-1","seq":4,"phase":"P01","task":"T01","step":"review","status":"pass","at":"2026-10-18T01:03:00Z","evidence":"@aabbccd","usage":[{"agent":"reviewer","tool":"claude-code","model":"claude-opus-5-5","account_alias":"claude-1","input":null,"output":null,"cache_read":null,"cache_write":null,"source":"unavailable"}]}'::jsonb,
  'ci'
);

select public.ingest_event(
  '{"v":1,"project":"PGUSAGE","run":"gha-8-1","seq":1,"phase":"P01","task":"T02","step":"build","status":"fail","at":"2026-10-18T02:00:00Z","evidence":"@aabbccd","usage":[{"agent":"builder","tool":"cursor-agent","model":"grok-4.7-high","account_alias":"cursor-2","input":null,"output":null,"cache_read":null,"cache_write":null,"source":"unavailable"}]}'::jsonb,
  'ci'
);

reset role;

set local role anon;

select is(
  (select count(*)::integer from public.usage_by_attempt),
  0,
  'anon reads 0 rows'
);

reset role;

select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);

set local role authenticated;

select is(
  (select count(*)::integer from public.usage_by_attempt),
  0,
  'identity 999 reads 0 rows'
);

reset role;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

set local role authenticated;

select is(
  (
    select count(*)::integer
    from public.usage_by_attempt
    where project_key = 'PGUSAGE'
  ),
  3,
  'the owner reads 3 PGUSAGE rows'
);

select is(
  (
    select input::text || ':' || output::text || ':' || cache_read::text || ':' || cache_write::text || ':' || source || ':' || status
    from public.usage_by_attempt
    where project_key = 'PGUSAGE'
      and run_key = 'gha-7-1'
      and agent = 'builder'
  ),
  '15:3:0:0:measured:pass',
  'the gha-7-1 builder row reads 15:3:0:0:measured:pass'
);

select ok(
  (
    select input is null
      and output is null
      and cache_read is null
      and cache_write is null
      and source = 'unavailable'
      and status = 'fail'
    from public.usage_by_attempt
    where project_key = 'PGUSAGE'
      and run_key = 'gha-8-1'
  ),
  'the gha-8-1 row has four nulls, unavailable and fail'
);

select is(
  (
    select source || ':' || status
    from public.usage_by_attempt
    where project_key = 'PGUSAGE'
      and run_key = 'gha-7-1'
      and agent = 'reviewer'
  ),
  'unavailable:pass',
  'the gha-7-1 reviewer row reads unavailable and pass'
);

select * from finish();

rollback;
