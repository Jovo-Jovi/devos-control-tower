begin;

select plan(26);

select ok(
  (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'project_audit'
  ),
  'RLS is enabled on project_audit'
);

select is(
  (
    select count(*)::integer = 1
      and bool_and(policyname = 'project_audit_owner_select')
      and bool_and(cmd = 'SELECT')
      and bool_and(roles::text = '{authenticated}')
      and bool_and(qual like '%is_owner()%')
    from pg_policies
    where schemaname = 'public'
      and tablename = 'project_audit'
  ),
  true,
  'project_audit has exactly one owner select policy'
);

select is(
  (
    select count(*)::integer
    from (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) as p(priv)
    where has_table_privilege('anon', 'public.project_audit', p.priv)
  ),
  0,
  'anon has no privilege on project_audit'
);

select is(
  (
    select has_table_privilege('authenticated', 'public.project_audit', 'SELECT')
      and not has_table_privilege('authenticated', 'public.project_audit', 'INSERT')
      and not has_table_privilege('authenticated', 'public.project_audit', 'UPDATE')
      and not has_table_privilege('authenticated', 'public.project_audit', 'DELETE')
      and not has_table_privilege('authenticated', 'public.project_audit', 'TRUNCATE')
  ),
  true,
  'authenticated has SELECT and no write privilege on project_audit'
);

select is(
  (
    select string_agg(column_name, ',' order by ordinal_position)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'project_audit'
  ),
  'id,at,action,project_id',
  'project_audit columns are id, at, action, project_id'
);

select throws_ok(
  $$insert into public.project_audit (action, project_id)
    values ('purged', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  '23514',
  null,
  'an action other than deleted is refused'
);

select is(
  (
    select p.prosecdef::text || ':' || array_to_string(p.proconfig, ',')
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.oid = 'public.delete_registered_project(text)'::regprocedure
  ),
  'false:search_path=""',
  'delete_registered_project is false:search_path=""'
);

select is(
  (case when has_function_privilege('anon', 'public.delete_registered_project(text)', 'EXECUTE') then 't' else 'f' end)
    || '/'
    || (case when has_function_privilege('authenticated', 'public.delete_registered_project(text)', 'EXECUTE') then 't' else 'f' end)
    || '/'
    || (case when has_function_privilege('service_role', 'public.delete_registered_project(text)', 'EXECUTE') then 't' else 'f' end),
  'f/f/t',
  'delete_registered_project execute is f/f/t'
);

set local role authenticated;

select throws_ok(
  $$select public.delete_registered_project('T20-NONE')$$,
  '42501',
  null,
  'authenticated cannot execute delete_registered_project'
);

reset role;

insert into public.projects (key, repo, owner_github_id)
values
  ('T20-HAND', 'fixture-dev/t20-hand', '999'),
  ('T20-LINKED', 'fixture-dev/t20-linked', '999'),
  ('T20-DISC', 'fixture-dev/t20-disc', '999');

insert into public.runs (id, project_id, run_key, source)
select pg_catalog.gen_random_uuid(), p.id, 'gha-20-1', 'ci'
from public.projects p
where p.key = 'T20-HAND';

insert into public.events (
  project_id, run_id, seq, v, phase, task, step, status, at, evidence, origin, source, body_hash
)
select r.project_id, r.id, 1, 1, 'P04', 'T20', 'build', 'pass', '2026-10-31T00:00:00Z', null, 'reported', 'ci', '\x01'::bytea
from public.runs r
join public.projects p on p.id = r.project_id
where p.key = 'T20-HAND'
  and r.run_key = 'gha-20-1';

insert into public.event_usage (event_id, agent, tool, model, account_alias, source)
select e.id, 'builder', 'cursor-agent', 'grok-4.7-high', 'cursor-1', 'unavailable'
from public.events e
join public.projects p on p.id = e.project_id
where p.key = 'T20-HAND';

insert into public.observations (project_id, sha, kind, state, at, payload_ref)
select p.id, '0123456789abcdef0123456789abcdef01234567', 'status', 'success', '2026-10-31T00:00:00Z', 't20-hand-obs'
from public.projects p
where p.key = 'T20-HAND';

insert into public.link_requests (
  repository, owner_github_id, proposed_key, engine_version, contract_version, state, project_id, decided_at
)
select 'fixture-dev/t20-linked', '999', 'T20-LINKED', '0.2.9', '0-draft-3', 'approved', p.id, pg_catalog.now()
from public.projects p
where p.key = 'T20-LINKED';

insert into public.link_requests (
  repository, owner_github_id, proposed_key, engine_version, contract_version, state, project_id, decided_at
)
select 'fixture-dev/t20-disc', '999', 'T20-DISC', '0.2.9', '0-draft-3', 'declined', p.id, pg_catalog.now()
from public.projects p
where p.key = 'T20-DISC';

set local role service_role;

create temp table t20_hand as
select p.id as project_id, r.id as run_id, e.id as event_id
from public.projects p
join public.runs r on r.project_id = p.id
join public.events e on e.run_id = r.id
where p.key = 'T20-HAND'
  and r.run_key = 'gha-20-1';

create temp table t20_audit_before as
select count(*)::integer as n
from public.project_audit;

select is(
  public.delete_registered_project('T20-NONE'),
  '{"result":"not_found"}'::jsonb,
  'a missing key is not_found'
);

select is(
  (select count(*)::integer from public.project_audit),
  (select n from t20_audit_before),
  'not_found writes no project_audit row'
);

select is(
  public.delete_registered_project('T20-HAND'),
  '{"result":"deleted"}'::jsonb,
  'a hand-registered project is deleted'
);

select is(
  (select count(*)::integer from public.projects where key = 'T20-HAND'),
  0,
  'T20-HAND is gone'
);

select is(
  (
    select
      (select count(*)::integer from public.runs r join t20_hand h on r.id = h.run_id)
      + (select count(*)::integer from public.events e join t20_hand h on e.id = h.event_id)
      + (select count(*)::integer from public.event_usage u join t20_hand h on u.event_id = h.event_id)
      + (select count(*)::integer from public.observations o join t20_hand h on o.project_id = h.project_id)
  ),
  0,
  'T20-HAND runs, events, usage and observations are gone'
);

select is(
  (
    select (select count(*)::integer from public.project_audit) = (select n from t20_audit_before) + 1
      and (
        select count(*)::integer = 1 and bool_and(a.action = 'deleted')
        from public.project_audit a
        where a.project_id = (select h.project_id from t20_hand h)
      )
  ),
  true,
  'exactly one new project_audit row records T20-HAND as deleted'
);

create temp table t20_audit_after_hand as
select count(*)::integer as n
from public.project_audit;

select is(
  public.delete_registered_project('T20-LINKED'),
  '{"result":"linked"}'::jsonb,
  'an approved request answers linked'
);

select is(
  (
    select p.id is not null and r.state = 'approved' and r.project_id = p.id
    from public.projects p
    join public.link_requests r on r.repository = 'fixture-dev/t20-linked'
    where p.key = 'T20-LINKED'
  ),
  true,
  'T20-LINKED remains and its request stays approved'
);

select is(
  public.delete_registered_project('T20-DISC'),
  '{"result":"linked"}'::jsonb,
  'a declined request answers linked'
);

select is(
  (
    select p.id is not null and r.state = 'declined' and r.project_id = p.id
    from public.projects p
    join public.link_requests r on r.repository = 'fixture-dev/t20-disc'
    where p.key = 'T20-DISC'
  ),
  true,
  'T20-DISC remains and its request stays declined'
);

select is(
  (select count(*)::integer from public.project_audit),
  (select n from t20_audit_after_hand),
  'linked and disconnected calls wrote no project_audit row'
);

reset role;

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
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  ),
  1,
  'public has exactly one security definer function'
);

insert into public.projects (key, repo, owner_github_id)
values
  ('T20-OLD-A', 'fixture-dev/t20-old-a', '999'),
  ('T20-OLD-B', 'fixture-dev/t20-old-b', '999');

insert into public.link_requests (
  repository, owner_github_id, proposed_key, engine_version, contract_version, state, project_id, decided_at
)
select 'fixture-dev/t20-old-a', '999', 'T20-OLD-A', '0.2.9', '0-draft-3', 'declined', p.id, pg_catalog.now() - interval '400 days'
from public.projects p
where p.key = 'T20-OLD-A';

insert into public.link_requests (
  repository, owner_github_id, proposed_key, engine_version, contract_version, state, project_id, decided_at
)
select 'fixture-dev/t20-old-b', '999', 'T20-OLD-B', '0.2.9', '0-draft-3', 'declined', p.id, pg_catalog.now() - interval '400 days'
from public.projects p
where p.key = 'T20-OLD-B';

create function public.t20_refresh_sibling()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $t20$
begin
  update public.link_requests
  set decided_at = pg_catalog.now()
  where repository in ('fixture-dev/t20-old-a', 'fixture-dev/t20-old-b')
    and id is distinct from new.request_id;

  return new;
end;
$t20$;

create trigger t20_purge_recheck
after insert on public.link_audit
for each row
when (new.action = 'purged')
execute function public.t20_refresh_sibling();

set local role service_role;

create temp table t20_purged_before as
select count(*)::integer as n
from public.link_audit
where action = 'purged';

select is(
  public.purge_link_requests(),
  1,
  'purge removes only the disconnected request that still meets its condition'
);

select is(
  (
    select count(*)::integer = 1
      and bool_and(r.state = 'declined')
      and bool_and(r.project_id is not null)
    from public.link_requests r
    where r.repository in ('fixture-dev/t20-old-a', 'fixture-dev/t20-old-b')
  ),
  true,
  'exactly one old request remains, declined, with its project_id'
);

select is(
  (
    select count(*)::integer
    from public.projects
    where key in ('T20-OLD-A', 'T20-OLD-B')
  ),
  1,
  'exactly one of the two old projects remains'
);

select is(
  (select count(*)::integer from public.link_audit where action = 'purged')
    - (select n from t20_purged_before),
  1,
  'purged audit rows grew by exactly 1'
);

reset role;

drop trigger t20_purge_recheck on public.link_audit;
drop function public.t20_refresh_sibling();

select * from finish();

rollback;
