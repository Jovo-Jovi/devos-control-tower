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
