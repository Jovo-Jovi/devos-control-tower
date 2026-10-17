create table public.owner_allowlist (github_id text primary key);
alter table public.owner_allowlist enable row level security;
revoke all on table public.owner_allowlist from anon, authenticated;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.identities i
    join public.owner_allowlist a on a.github_id = i.provider_id
    where i.user_id = auth.uid()
      and i.provider = 'github'
  );
$$;
revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;
