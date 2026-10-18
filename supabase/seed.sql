-- Synthetic seed only. The owner allow-list stays empty: the single row is inserted
-- out of band, never from a file, an environment variable, or a secret.

insert into public.projects (key, repo, owner_github_id)
values ('FIXTURE', 'fixture-org/fixture-repo', '0');

select public.ingest_event(
  '{"v":1,"project":"FIXTURE","run":"gha-1-1","seq":1,"phase":"P01","task":"T02","step":"build","status":"started","at":"2026-10-17T00:00:00Z","evidence":null}'::jsonb,
  'ci'
);

select public.ingest_event(
  '{"v":1,"project":"FIXTURE","run":"gha-1-1","seq":2,"phase":"P01","task":"T02","step":"build","status":"pass","at":"2026-10-17T00:01:00Z","evidence":"@aabbccd","usage":[{"agent":"builder","tool":"cursor-agent","model":"grok-4.7-high","account_alias":"cursor-1","input":null,"output":null,"cache_read":null,"cache_write":null,"source":"unavailable"}]}'::jsonb,
  'ci'
);

select public.ingest_event(
  '{"v":1,"project":"FIXTURE","run":"gha-1-1","seq":3,"phase":"P01","task":"T02","step":"checks","status":"pass","at":"2026-10-17T00:02:00Z","evidence":"@aabbccd"}'::jsonb,
  'ci'
);

insert into public.projects (key, repo, owner_github_id)
values
  ('USAGE', 'fixture-org/usage-repo', '0'),
  ('QUIET', 'fixture-org/quiet-repo', '0');

select public.ingest_event(
  '{"v":1,"project":"USAGE","run":"gha-201-1","seq":1,"phase":"P01","task":"T01","step":"build","status":"started","at":"2026-10-17T01:00:00Z","evidence":"@aabbccd"}'::jsonb,
  'ci'
);

select public.ingest_event(
  '{"v":1,"project":"USAGE","run":"gha-201-1","seq":2,"phase":"P01","task":"T01","step":"build","status":"pass","at":"2026-10-17T01:01:00Z","evidence":"@aabbccd","usage":[{"agent":"builder","tool":"cursor-agent","model":"grok-4.7-high","account_alias":"cursor-1","input":null,"output":null,"cache_read":null,"cache_write":null,"source":"unavailable"}]}'::jsonb,
  'ci'
);

select public.ingest_event(
  '{"v":1,"project":"USAGE","run":"gha-201-1","seq":3,"phase":"P01","task":"T01","step":"review","status":"started","at":"2026-10-17T01:02:00Z","evidence":"@aabbccd"}'::jsonb,
  'ci'
);

select public.ingest_event(
  '{"v":1,"project":"USAGE","run":"gha-201-1","seq":4,"phase":"P01","task":"T01","step":"review","status":"pass","at":"2026-10-17T01:03:00Z","evidence":"@aabbccd","usage":[{"agent":"reviewer","tool":"claude-code","model":"claude-opus-5-5","account_alias":"claude-1","input":1000,"output":200,"cache_read":3000,"cache_write":400,"source":"measured"}]}'::jsonb,
  'ci'
);

select public.ingest_event(
  '{"v":1,"project":"USAGE","run":"gha-201-1","seq":5,"phase":"P01","task":"T01","step":"verdict","status":"fail","at":"2026-10-17T01:04:00Z","evidence":"@aabbccd"}'::jsonb,
  'ci'
);

select public.ingest_event(
  '{"v":1,"project":"USAGE","run":"gha-202-1","seq":1,"phase":"P01","task":"T01","step":"build","status":"pass","at":"2026-10-17T02:00:00Z","evidence":"@aabbccd","usage":[{"agent":"builder","tool":"cursor-agent","model":"grok-4.7-high","account_alias":"cursor-1","input":null,"output":null,"cache_read":null,"cache_write":null,"source":"unavailable"}]}'::jsonb,
  'ci'
);

select public.ingest_event(
  '{"v":1,"project":"USAGE","run":"gha-202-1","seq":2,"phase":"P01","task":"T01","step":"review","status":"pass","at":"2026-10-17T02:01:00Z","evidence":"@aabbccd","usage":[{"agent":"reviewer","tool":"claude-code","model":"claude-opus-5-5","account_alias":"claude-1","input":500,"output":100,"cache_read":0,"cache_write":0,"source":"measured"},{"agent":"reviewer","tool":"claude-code","model":"claude-sonnet-5-5","account_alias":"claude-2","input":50,"output":10,"cache_read":null,"cache_write":null,"source":"measured"}]}'::jsonb,
  'ci'
);

select public.ingest_event(
  '{"v":1,"project":"USAGE","run":"gha-202-1","seq":3,"phase":"P01","task":"T01","step":"verdict","status":"pass","at":"2026-10-17T02:02:00Z","evidence":"@aabbccd"}'::jsonb,
  'ci'
);

select public.ingest_event(
  '{"v":1,"project":"USAGE","run":"gha-203-1","seq":1,"phase":"P01","task":"T02","step":"build","status":"fail","at":"2026-10-17T03:00:00Z","evidence":"@aabbccd","usage":[{"agent":"builder","tool":"cursor-agent","model":"grok-4.7-high","account_alias":"cursor-2","input":null,"output":null,"cache_read":null,"cache_write":null,"source":"unavailable"}]}'::jsonb,
  'ci'
);

update public.events set received_at = received_at - interval '2 hours' where project_id = (select id from public.projects where key = 'USAGE');
