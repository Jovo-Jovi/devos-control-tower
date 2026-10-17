begin;

select plan(14);

select ok(
  (
    select bool_and(c.relrowsecurity)
      and count(*) = 2
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('webhook_deliveries', 'observations')
  ),
  'RLS is enabled on webhook_deliveries and observations'
);

select ok(
  (
    select count(*) = 2
      and bool_and(
        cmd = 'SELECT'
        and roles::text = '{authenticated}'
        and coalesce(qual, '') like '%is_owner()%'
      )
    from pg_policies
    where schemaname = 'public'
      and tablename in ('webhook_deliveries', 'observations')
  ),
  'webhook policies are two SELECT policies to authenticated referencing is_owner()'
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
    cross join (values
      ('projects'),
      ('runs'),
      ('events'),
      ('event_usage'),
      ('event_rejections'),
      ('webhook_deliveries'),
      ('observations')
    ) as t(tbl)
    cross join (values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) as p(priv)
    where has_table_privilege(r.role, 'public.' || t.tbl, p.priv)
      and not (
        r.role = 'authenticated'
        and t.tbl = 'projects'
        and p.priv in ('INSERT', 'UPDATE')
      )
  ),
  0,
  'write privileges match the webhook grant'
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

-- The owner row is inserted before the 999 read, so that refusal is proven with an owner present.
insert into public.owner_allowlist (github_id) values ('424242');

insert into public.webhook_deliveries (delivery_id, event_name)
values ('fixture-delivery', 'status');

insert into public.observations (project_id, sha, kind, context, state, at, actor_login, payload_ref)
select
  p.id,
  '0123456789abcdef0123456789abcdef01234567',
  'status',
  'devos/checks',
  'success',
  '2026-10-17T04:00:00Z',
  'fixture-owner',
  'fixture-delivery'
from public.projects p
where p.key = 'FIXTURE';

set local role anon;

select is(
  (
    (select count(*) from public.webhook_deliveries)
    + (select count(*) from public.observations)
  )::integer,
  0,
  'anon reads 0 rows from both webhook tables'
);

reset role;

select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);

set local role authenticated;

select is(
  (
    (select count(*) from public.webhook_deliveries)
    + (select count(*) from public.observations)
  )::integer,
  0,
  'fixture 999 reads 0 rows from both webhook tables with an owner present'
);

reset role;

select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

set local role authenticated;

select is(
  (
    select d.event_name
    from public.webhook_deliveries d
    where d.delivery_id = 'fixture-delivery'
  ),
  'status',
  'fixture 424242 reads the FIXTURE delivery'
);

select is(
  (
    select o.kind || ':' || o.context || ':' || o.state || ':' || o.sha || ':' || o.payload_ref
    from public.observations o
    where o.payload_ref = 'fixture-delivery'
  ),
  'status:devos/checks:success:0123456789abcdef0123456789abcdef01234567:fixture-delivery',
  'fixture 424242 reads the FIXTURE observation'
);

select throws_ok(
  $$insert into public.observations (
      project_id, sha, kind, state, at, payload_ref
    ) values (
      '00000000-0000-0000-0000-000000000000',
      '0123456789abcdef0123456789abcdef01234567',
      'status',
      'success',
      '2026-10-17T00:00:00Z',
      'owner-insert'
    )$$,
  '42501',
  'permission denied for table observations',
  'authenticated owner cannot insert into observations'
);

select throws_ok(
  $$insert into public.webhook_deliveries (delivery_id, event_name) values ('owner-insert', 'status')$$,
  '42501',
  'permission denied for table webhook_deliveries',
  'authenticated owner cannot insert into webhook_deliveries'
);

reset role;

select throws_ok(
  $$insert into public.observations (project_id, sha, kind, state, at, payload_ref)
    select p.id, '0123456789abcdef0123456789abcdef01234567', 'ping', 'success', '2026-10-17T00:00:00Z', 'bad-kind'
    from public.projects p
    where p.key = 'FIXTURE'$$,
  '23514',
  'new row for relation "observations" violates check constraint "observations_kind_check"',
  'a kind outside the list is refused'
);

select throws_ok(
  $$insert into public.observations (project_id, sha, kind, state, at, payload_ref)
    select p.id, 'abc', 'status', 'success', '2026-10-17T00:00:00Z', 'bad-sha'
    from public.projects p
    where p.key = 'FIXTURE'$$,
  '23514',
  'new row for relation "observations" violates check constraint "observations_sha_check"',
  'a sha that is not 40 hex is refused'
);

select throws_ok(
  $$insert into public.webhook_deliveries (delivery_id, event_name) values ('fixture-delivery', 'status')$$,
  '23505',
  'duplicate key value violates unique constraint "webhook_deliveries_pkey"',
  'a repeated delivery_id is refused'
);

select * from finish();

rollback;
