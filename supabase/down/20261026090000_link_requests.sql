drop function if exists public.request_link(text, text, text, text, text);
drop function if exists public.approve_link_request(uuid);
drop function if exists public.decline_link_request(uuid);
drop table if exists public.link_audit;
drop table if exists public.link_requests;
