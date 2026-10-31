create table public.project_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  action text not null check (action in ('deleted')),
  project_id uuid not null
);

alter table public.project_audit enable row level security;

create policy project_audit_owner_select on public.project_audit
  for select to authenticated
  using (public.is_owner());

revoke all on table public.project_audit from anon, authenticated;
grant select on table public.project_audit to authenticated;

create function public.delete_registered_project(p_key text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  v_project_id uuid;
begin
  select p.id
  into v_project_id
  from public.projects p
  where p.key = p_key
  for update;

  if not found then
    return pg_catalog.jsonb_build_object('result', 'not_found');
  end if;

  if exists (
    select 1
    from public.link_requests r
    where r.project_id = v_project_id
  ) then
    return pg_catalog.jsonb_build_object('result', 'linked');
  end if;

  delete from public.projects
  where id = v_project_id;

  insert into public.project_audit (action, project_id)
  values ('deleted', v_project_id);

  return pg_catalog.jsonb_build_object('result', 'deleted');
end;
$fn$;

revoke all on function public.delete_registered_project(text) from public, anon, authenticated;
grant execute on function public.delete_registered_project(text) to service_role;
