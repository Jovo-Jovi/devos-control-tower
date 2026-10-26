begin;

select plan(63);

select ok(
  (
    select bool_and(c.relrowsecurity)
      and count(*) = 2
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('link_requests', 'link_audit')
  ),
  'RLS is enabled on link_requests and link_audit'
);

select is(
  (
    select string_agg(tablename || ':' || policyname || ':' || cmd || ':' || roles::text, ' ' order by tablename)
    from pg_policies
    where schemaname = 'public'
      and tablename in ('link_requests', 'link_audit')
  ),
  'link_audit:link_audit_owner_select:SELECT:{authenticated} link_requests:link_requests_owner_select:SELECT:{authenticated}',
  'exactly two link policies, each select to authenticated'
);

select ok(
  (
    select count(*) = 2
      and bool_and(qual like '%is_owner()%')
    from pg_policies
    where schemaname = 'public'
      and tablename in ('link_requests', 'link_audit')
  ),
  'each link policy qual contains is_owner()'
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
    select string_agg(
      p.proname || ':' || p.prosecdef::text || ':' || array_to_string(p.proconfig, ','),
      ' ' order by p.proname
    )
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('approve_link_request', 'decline_link_request', 'request_link')
  ),
  'approve_link_request:false:search_path="" decline_link_request:false:search_path="" request_link:false:search_path=""',
  'the three decision functions are false:search_path=""'
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
  (case when has_function_privilege('anon', 'public.approve_link_request(uuid)', 'EXECUTE') then 't' else 'f' end)
    || '/'
    || (case when has_function_privilege('authenticated', 'public.approve_link_request(uuid)', 'EXECUTE') then 't' else 'f' end)
    || '/'
    || (case when has_function_privilege('service_role', 'public.approve_link_request(uuid)', 'EXECUTE') then 't' else 'f' end),
  'f/f/t',
  'approve_link_request execute is f/f/t'
);

select is(
  (case when has_function_privilege('anon', 'public.decline_link_request(uuid)', 'EXECUTE') then 't' else 'f' end)
    || '/'
    || (case when has_function_privilege('authenticated', 'public.decline_link_request(uuid)', 'EXECUTE') then 't' else 'f' end)
    || '/'
    || (case when has_function_privilege('service_role', 'public.decline_link_request(uuid)', 'EXECUTE') then 't' else 'f' end),
  'f/f/t',
  'decline_link_request execute is f/f/t'
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

select throws_ok(
  'select * from public.link_requests',
  '42501',
  'permission denied for table link_requests',
  'anon cannot select link_requests'
);

select throws_ok(
  'select * from public.link_audit',
  '42501',
  'permission denied for table link_audit',
  'anon cannot select link_audit'
);

reset role;

select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);

set local role authenticated;

select is(
  (select count(*)::integer from public.link_requests),
  0,
  'fixture 999 reads 0 link_requests rows'
);

select is(
  (select count(*)::integer from public.link_audit),
  0,
  'fixture 999 reads 0 link_audit rows'
);

reset role;

insert into public.owner_allowlist (github_id) values ('424242');

select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

set local role authenticated;

select is(
  (select count(*)::integer from public.link_requests),
  2,
  'fixture 424242 reads the 2 seeded requests'
);

select throws_ok(
  $$insert into public.link_requests (repository, owner_github_id, proposed_key, engine_version, contract_version)
    values ('fixture-dev/t15-owner-write', '0', 'OWNER-WRITE', '0.2.9', '0-draft-3')$$,
  '42501',
  'permission denied for table link_requests',
  'the owner cannot insert link_requests'
);

select throws_ok(
  $$update public.link_requests set engine_version = '0.3.0' where repository = 'fixture-dev/demo-shop'$$,
  '42501',
  'permission denied for table link_requests',
  'the owner cannot update link_requests'
);

select throws_ok(
  $$delete from public.link_requests where repository = 'fixture-dev/demo-shop'$$,
  '42501',
  'permission denied for table link_requests',
  'the owner cannot delete link_requests'
);

select throws_ok(
  $$insert into public.link_audit (action, request_id)
    values ('requested', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,
  '42501',
  'permission denied for table link_audit',
  'the owner cannot insert link_audit'
);

select throws_ok(
  $$select public.request_link('fixture-dev/t15-a', '0', 'DEMO-T15', '0.2.9', '0-draft-3')$$,
  '42501',
  'permission denied for function request_link',
  'authenticated cannot execute request_link'
);

reset role;

set local role service_role;

select is(
  public.request_link('fixture-dev/t15-a', '0', 'DEMO-T15', '0.2.9', '0-draft-3'),
  '{"result":"pending"}'::jsonb,
  'a new repository is pending'
);

select is(
  (select count(*)::integer from public.link_requests),
  3,
  'a new repository adds one request row'
);

select is(
  (
    select count(*)::integer
    from public.link_audit a
    join public.link_requests r on r.id = a.request_id
    where r.repository = 'fixture-dev/t15-a'
      and a.action = 'requested'
  ),
  1,
  'a new repository writes one requested audit row'
);

select is(
  public.request_link('fixture-dev/t15-a', '0', 'OTHER-KEY', '0.3.0', '0-draft-3'),
  '{"result":"pending"}'::jsonb,
  'the same repository stays pending'
);

select is(
  (
    select engine_version || ':' || proposed_key
    from public.link_requests
    where repository = 'fixture-dev/t15-a'
  ),
  '0.3.0:DEMO-T15',
  'a repeat updates engine_version and keeps proposed_key'
);

select is(
  (select count(*)::integer from public.link_requests),
  3,
  'a repeat leaves the row count unchanged'
);

select is(
  (
    select count(*)::integer
    from public.link_audit a
    join public.link_requests r on r.id = a.request_id
    where r.repository = 'fixture-dev/t15-a'
      and a.action = 'requested'
  ),
  1,
  'a repeat does not write another requested audit row'
);

select throws_ok(
  $$select public.request_link('no-slash', '0', 'DEMO-T15', '0.2.9', '0-draft-3')$$,
  '22023',
  'invalid link request argument',
  'an invalid repository is refused'
);

select is(
  public.approve_link_request((select id from public.link_requests where repository = 'fixture-dev/t15-a')),
  '{"result":"approved","key":"DEMO-T15"}'::jsonb,
  'approving fixture-dev/t15-a returns approved with DEMO-T15'
);

select is(
  (
    select repo || ':' || owner_github_id
    from public.projects
    where key = 'DEMO-T15'
  ),
  'fixture-dev/t15-a:0',
  'the approved project has that repo and owner'
);

select is(
  (
    select count(*)::integer
    from public.link_audit a
    join public.link_requests r on r.id = a.request_id
    where r.repository = 'fixture-dev/t15-a'
      and a.action = 'approved'
  ),
  1,
  'approve writes one approved audit row'
);

select is(
  public.request_link('fixture-dev/t15-a', '0', 'OTHER-KEY', '0.3.0', '0-draft-3'),
  '{"result":"linked","key":"DEMO-T15"}'::jsonb,
  'request_link on the approved repository is linked'
);

select is(
  public.request_link('fixture-dev/t15-b', '0', 'DEMO-T15', '0.2.9', '0-draft-3')->>'result',
  'pending',
  'fixture-dev/t15-b is pending'
);

select is(
  public.approve_link_request((select id from public.link_requests where repository = 'fixture-dev/t15-b')),
  '{"result":"approved","key":"DEMO-T15-2"}'::jsonb,
  'the second DEMO-T15 is approved as DEMO-T15-2'
);

select is(
  public.request_link('fixture-dev/t15-c', '0', 'DEMO-T15', '0.2.9', '0-draft-3')->>'result',
  'pending',
  'fixture-dev/t15-c is pending'
);

select is(
  public.approve_link_request((select id from public.link_requests where repository = 'fixture-dev/t15-c')),
  '{"result":"approved","key":"DEMO-T15-3"}'::jsonb,
  'the third DEMO-T15 is approved as DEMO-T15-3'
);

select is(
  length('ABCDEFGHIJKLMNOPQRSTUVWXYZ123456'),
  32,
  'the long proposed key is 32 characters'
);

select is(
  public.request_link(
    'fixture-dev/t15-long',
    '0',
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
    '0.2.9',
    '0-draft-3'
  )->>'result',
  'pending',
  'the 32-character key request is pending'
);

select is(
  public.approve_link_request((select id from public.link_requests where repository = 'fixture-dev/t15-long'))->>'key',
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
  'the first 32-character key is stored as proposed'
);

select is(
  public.request_link(
    'fixture-dev/t15-long2',
    '0',
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
    '0.2.9',
    '0-draft-3'
  )->>'result',
  'pending',
  'the second 32-character key request is pending'
);

select is(
  public.approve_link_request((select id from public.link_requests where repository = 'fixture-dev/t15-long2')),
  '{"result":"approved","key":"ABCDEFGHIJKLMNOPQRSTUVWXYZ1234-2"}'::jsonb,
  'a taken 32-character proposed key becomes a 32-character key ending -2'
);

insert into public.projects (key, repo, owner_github_id)
values ('TAKEN-T15', 'fixture-dev/t15-taken', '111');

select is(
  public.request_link('fixture-dev/t15-taken', '0', 'TAKEN-REQ', '0.2.9', '0-draft-3'),
  '{"result":"pending"}'::jsonb,
  'a repository registered to another owner still creates a pending request'
);

select is(
  public.approve_link_request((select id from public.link_requests where repository = 'fixture-dev/t15-taken')),
  '{"result":"repo_taken"}'::jsonb,
  'approve of a repo with another owner is repo_taken'
);

select is(
  (select state from public.link_requests where repository = 'fixture-dev/t15-taken'),
  'pending',
  'repo_taken leaves the request pending'
);

select is(
  public.approve_link_request((select id from public.link_requests where repository = 'fixture-dev/t15-a')),
  '{"result":"not_pending"}'::jsonb,
  'approving again is not_pending'
);

select is(
  public.approve_link_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  '{"result":"not_found"}'::jsonb,
  'approve of an unknown request is not_found'
);

select is(
  public.decline_link_request('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  '{"result":"not_found"}'::jsonb,
  'decline of an unknown request is not_found'
);

select is(
  public.request_link('fixture-dev/t15-dec', '0', 'DEC-T15', '0.2.9', '0-draft-3')->>'result',
  'pending',
  'the request to decline is pending'
);

select is(
  public.decline_link_request((select id from public.link_requests where repository = 'fixture-dev/t15-dec')),
  '{"result":"declined"}'::jsonb,
  'declining a pending request is declined'
);

select is(
  (
    select state = 'declined' and decided_at is not null
    from public.link_requests
    where repository = 'fixture-dev/t15-dec'
  ),
  true,
  'decline sets state declined and decided_at'
);

select is(
  (
    select count(*)::integer
    from public.link_audit a
    join public.link_requests r on r.id = a.request_id
    where r.repository = 'fixture-dev/t15-dec'
      and a.action = 'declined'
  ),
  1,
  'declining a pending request writes one declined audit row'
);

select is(
  public.request_link('fixture-dev/t15-dec', '0', 'DEC-T15', '0.2.9', '0-draft-3'),
  '{"result":"declined"}'::jsonb,
  'request_link on a declined request is declined'
);

select is(
  public.decline_link_request((select id from public.link_requests where repository = 'fixture-dev/t15-b')),
  '{"result":"declined"}'::jsonb,
  'declining an approved request is declined'
);

select is(
  (
    select count(*)::integer
    from public.link_audit a
    join public.link_requests r on r.id = a.request_id
    where r.repository = 'fixture-dev/t15-b'
      and a.action = 'declined'
  ),
  1,
  'declining an approved request writes one declined audit row'
);

select is(
  (select count(*)::integer from public.projects where key = 'DEMO-T15-2'),
  1,
  'declining an approved request keeps the project row'
);

select is(
  (
    select r.project_id = p.id
    from public.link_requests r
    join public.projects p on p.key = 'DEMO-T15-2'
    where r.repository = 'fixture-dev/t15-b'
  ),
  true,
  'decline keeps project_id'
);

select is(
  public.request_link('fixture-dev/t15-b', '0', 'DEMO-T15', '0.2.9', '0-draft-3'),
  '{"result":"declined"}'::jsonb,
  'request_link on a disconnected request is declined'
);

select is(
  public.decline_link_request((select id from public.link_requests where repository = 'fixture-dev/t15-b')),
  '{"result":"not_pending"}'::jsonb,
  'declining a declined request is not_pending'
);

insert into public.link_requests (repository, owner_github_id, proposed_key, engine_version, contract_version)
select
  'fixture-dev/pad-' || g.n,
  '0',
  'PAD' || g.n,
  '0.2.9',
  '0-draft-3'
from generate_series(
  1,
  50 - (select count(*)::integer from public.link_requests where state = 'pending')
) as g(n);

select is(
  (select count(*)::integer from public.link_requests where state = 'pending'),
  50,
  'the fixture has 50 pending requests'
);

select is(
  public.request_link('fixture-dev/t15-rate', '0', 'RATE-T15', '0.2.9', '0-draft-3'),
  '{"result":"rate_limited"}'::jsonb,
  'a new repository at the cap is rate_limited'
);

select is(
  (select count(*)::integer from public.link_requests where state = 'pending'),
  50,
  'rate limit leaves the pending count at 50'
);

select throws_ok(
  $$insert into public.link_requests (
      repository, owner_github_id, proposed_key, engine_version, contract_version, state, decided_at
    ) values (
      'fixture-dev/t15-bad-pending', '0', 'BAD-PEND', '0.2.9', '0-draft-3', 'pending', '2026-10-20T00:00:00Z'
    )$$,
  '23514',
  null,
  'a pending row with a decided_at is refused'
);

select throws_ok(
  $$insert into public.link_requests (
      repository, owner_github_id, proposed_key, engine_version, contract_version, state, decided_at
    ) values (
      'fixture-dev/t15-bad-approved', '0', 'BAD-APPR', '0.2.9', '0-draft-3', 'approved', '2026-10-20T00:00:00Z'
    )$$,
  '23514',
  null,
  'an approved row without a project is refused'
);

select throws_ok(
  $$insert into public.link_requests (repository, owner_github_id, proposed_key, engine_version, contract_version)
    values ('no-slash', '0', 'NO-SLASH', '0.2.9', '0-draft-3')$$,
  '23514',
  null,
  'a repository without a slash is refused'
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

select * from finish();

rollback;
