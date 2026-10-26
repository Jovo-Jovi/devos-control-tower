select cron.unschedule('tower-link-retention');
drop function if exists public.delete_link_request(uuid);
drop function if exists public.export_link_request(uuid);
drop function if exists public.purge_link_requests();
drop extension if exists pg_cron;
