create view public.usage_by_attempt
with (security_invoker = true)
as
select
  p.key as project_key,
  e.phase,
  e.task,
  r.run_key,
  r.created_at as run_created_at,
  eu.agent,
  eu.model,
  eu.account_alias,
  sum(eu.input) as input,
  sum(eu.output) as output,
  sum(eu.cache_read) as cache_read,
  sum(eu.cache_write) as cache_write,
  case
    when bool_and(eu.source = 'measured') then 'measured'
    else 'unavailable'
  end as source,
  (array_agg(e.status order by e.seq desc))[1] as status,
  (array_agg(e.at order by e.seq desc))[1] as at,
  (array_agg(e.origin order by e.seq desc))[1] as origin,
  (array_agg(e.received_at order by e.seq desc))[1] as received_at
from public.event_usage as eu
join public.events as e on e.id = eu.event_id
join public.runs as r on r.id = e.run_id
join public.projects as p on p.id = e.project_id
group by
  p.key,
  e.phase,
  e.task,
  r.run_key,
  r.created_at,
  eu.agent,
  eu.model,
  eu.account_alias;

revoke insert, update, delete, truncate on public.usage_by_attempt from anon, authenticated;
