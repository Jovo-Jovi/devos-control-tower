begin;

select plan(13);

select ok(
  (
    select c.relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'owner_allowlist'
  ),
  'RLS is enabled on owner_allowlist'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename = 'owner_allowlist'
  ),
  0,
  'owner_allowlist has no policy'
);

select ok(
  (
    select bool_and(not has_table_privilege(role_name, 'public.owner_allowlist', privilege))
    from (values ('anon'), ('authenticated')) as roles(role_name)
    cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) as privileges(privilege)
    where role_name = 'anon'
  ),
  'anon has no privilege on owner_allowlist'
);

select ok(
  (
    select bool_and(not has_table_privilege(role_name, 'public.owner_allowlist', privilege))
    from (values ('anon'), ('authenticated')) as roles(role_name)
    cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) as privileges(privilege)
    where role_name = 'authenticated'
  ),
  'authenticated has no privilege on owner_allowlist'
);

select ok(
  (
    select p.prosecdef
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'is_owner'
  ),
  'is_owner is security definer'
);

select is(
  (
    select p.proconfig[1]
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'is_owner'
  ),
  'search_path=""',
  'is_owner sets search_path empty'
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

select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select is(public.is_owner(), false, 'allow-list empty: fixture 424242 is not the owner');

reset role;

insert into public.owner_allowlist (github_id) values ('424242');

set local role authenticated;

select is(public.is_owner(), true, 'allow-list contains 424242: fixture is the owner');

select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);

select is(public.is_owner(), false, 'fixture provider_id 999 is not the owner');

reset role;

select ok(
  not has_function_privilege('anon', 'public.is_owner()', 'EXECUTE'),
  'anon cannot execute is_owner'
);

select ok(
  has_function_privilege('authenticated', 'public.is_owner()', 'EXECUTE'),
  'authenticated can execute is_owner'
);

select is(
  (select count(*)::integer from public.owner_allowlist),
  1,
  'the fixture inserted exactly one allow-list row'
);

select * from finish();

rollback;
