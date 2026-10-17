drop policy if exists observations_owner_select on public.observations;
drop policy if exists webhook_deliveries_owner_select on public.webhook_deliveries;
drop index if exists public.observations_project_id_sha_idx;
drop table if exists public.observations;
drop table if exists public.webhook_deliveries;
