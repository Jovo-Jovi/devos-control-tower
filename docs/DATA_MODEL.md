# TOWER — Data model (backend module)

Precedence 3. The Supabase module is active from T01 (`docs/method/FULLSTACK_MODULE.md`; PR-17 to
PR-19). `guard:data` applies as copied from the pilot. Names are the contract's names
(`seed/06-event-contract.md`) wherever a column stores a contract field.

## 1. Principals

| Principal | How it reaches the database | What it may do |
|---|---|---|
| `anon` | the publishable key, from a browser or a signed-out server render | **nothing**: RLS denies every row; no table grants `anon` any write (`guard:data` rule 5); `owner_allowlist` grants it nothing at all |
| `authenticated` (the owner's session) | the publishable key with the session JWT | read every row where the policy `using (public.is_owner())` holds — i.e. everything, once `is_owner()` is true; writes only on `projects` (`/projects/new`) and `ingest_keys` (M2) through server actions |
| `authenticated` (anyone else) | same path, a GitHub identity not in the allow-list | **nothing**: `is_owner()` is false, every policy fails, and the app gate signs the session out with `403` |
| service role (`SUPABASE_SECRET_KEY`) | server-only modules under `src/lib/supabase/server/` (`guard:data` rule 6) | the machine routes' inserts: `events`, `event_usage`, `runs`, `event_rejections`, `webhook_deliveries`, `observations`; the import page's inserts |

The service-role key is read only in server-only modules and never through a `NEXT_PUBLIC_` name.
The browser never calls Supabase directly for anything but the Auth redirect flow.

## 2. Tables (all in `public`, all with RLS enabled)

### 2.1 `owner_allowlist` (`OwnerAllowlist`) — T01
`github_id text primary key`. Created **empty**. One row inserted by the owner in the SQL editor. RLS
enabled, **no policy**; `revoke all on table public.owner_allowlist from anon, authenticated`. Read only
inside `public.is_owner()`.

### 2.2 `projects` (`Project`) — T02
`id uuid pk default gen_random_uuid()` · `key text unique` (contract `project`, `^[A-Z][A-Z0-9_-]{1,31}$`,
checked) · `repo text unique` (`owner/name`) · `owner_github_id text not null` (numeric id as text; the
OIDC claim `repository_owner_id` must equal it) · `stale_after_minutes integer not null default 1440` ·
`created_at timestamptz not null default now()`.

### 2.3 `runs` (`Run`) — T02
`id uuid pk` · `project_id uuid references projects on delete cascade` · `run_key text` (contract `run`) ·
`source text check (source in ('ci','local','import'))` · `created_at timestamptz default now()` ·
unique `(project_id, run_key)`. Order of runs = `created_at`.

### 2.4 `events` (`StepEvent`) — T02
`id bigint generated always as identity pk` · `project_id` · `run_id uuid references runs on delete
cascade` · `seq integer not null check (seq >= 1)` · `v smallint not null check (v = 1)` · `phase text` ·
`task text` · `step text check (step in (<eleven>))` · `status text check (status in (<six>))` · `at
timestamptz not null` · `received_at timestamptz not null default now()` · `evidence text` · `origin text
check (origin in ('reported','observed','verified','imported'))` · `source text check (source in
('ci','local','import'))` · `body_hash bytea not null` (sha-256 of the canonical body, for the `200
duplicate` vs `409` decision) · **unique `(project_id, run_id, seq)`**. Append-only: no update or delete
policy exists for any API role; `origin` moves from `reported` to `verified` only by the server's
verification query, never by a client.

### 2.5 `event_usage` (`EventUsage`) — T02
`id bigint identity pk` · `event_id bigint references events on delete cascade` · `agent text check
(agent in ('builder','reviewer'))` · `tool text` · `model text` · `account_alias text` · `input integer` ·
`output integer` · `cache_read integer` · `cache_write integer` (each `null` or `>= 0`) · `source text
check (source in ('measured','unavailable'))` · `check (source <> 'unavailable' or (input is null and
output is null and cache_read is null and cache_write is null))`. One row per `usage` entry; written in
the same transaction as its event.

### 2.6 `event_rejections` (`EventRejection`) — T02
`received_at timestamptz default now()` · `reason text not null` — **two columns**, nothing else. Never
the body, never a claim, never a token or key.

### 2.7 `webhook_deliveries` (`WebhookDelivery`) — T03
`delivery_id text primary key` (GitHub `X-GitHub-Delivery`) · `event_name text` · `received_at`.

### 2.8 `observations` (`Observation`) — T03
`id bigint identity pk` · `project_id` · `sha text` · `kind text check (kind in
('workflow_run','check_run','status','pull_request'))` · `context text` (e.g. `devos/verdict`) · `state
text` · `at timestamptz` · `received_at` · `actor_login text` (only when the actor is the owner or a bot;
otherwise `null`) · `payload_ref text` (the delivery id). Unknown repositories store nothing (`202`).

### 2.9 `ingest_keys` (`IngestKey`) — M2 (plan label T08)
`id uuid pk` · `project_id` · `label text` · `key_hash bytea unique` · `created_at` · `revoked_at
timestamptz`. The key itself is shown once and never stored.

## 3. Privileges and RLS, per role

- Every table: `alter table … enable row level security`. `guard:data` rule 3; pgTAP asserts it.
- Every policy on every table except `owner_allowlist`: `for select using (public.is_owner())`; on
  `projects` and `ingest_keys` also `for insert/update with check (public.is_owner())`. No policy
  anywhere grants `anon` a row. No `delete` policy for any API role on `events`, `event_usage`,
  `runs`, `observations`, `webhook_deliveries`, `event_rejections`.
- `revoke insert, update, delete, truncate on all tables in schema public from anon` (rule 5).
- The machine routes write with the service role, which bypasses RLS by design; their authentication is
  the OIDC/key/HMAC check in code (`SECURITY_MODEL.md` §3), never a policy.

## 4. Functions

| Function | Purpose | Security |
|---|---|---|
| `public.is_owner() returns boolean` | the only identity check: `auth.identities` (`provider = 'github'`, `user_id = auth.uid()`) joined to `public.owner_allowlist` | `language sql`, `stable`, **`security definer`**, `set search_path = ''`, fully qualified names, `execute` granted to `authenticated` only (ADR-002). The **only** `security definer` function in the database — pgTAP asserts the count |
| `public.ingest_event(payload jsonb, src text) returns jsonb` (T02) | the atomic write: upsert `runs`, insert `events` with `body_hash`, insert `event_usage` rows, decide `stored` / `duplicate` / `conflict` (writing the rejection row for a conflict) — one transaction, because the route cannot open one through the JS client | `security invoker`; `execute` granted to `service_role` only; called by `/api/ingest` and the import action after authentication and schema validation |
| `public.verify_reported_events(run uuid)` (T07) | sets `origin = 'verified'` on reported `checks`/`verdict`/`gate` events whose `evidence` commit has an observation with context `devos/<step>` and a matching state | `security invoker`; called inside `ingest_event` for the event's run and after each observation insert |

## 5. Views

`public.usage_by_attempt` (T06): one row per `(project, phase, task, run, agent, model, account_alias)`
with the four sums, `source`, the event's `status` and `at`. `security_invoker = true` so RLS of the
underlying tables applies; `anon` sees no row.

## 6. Accounts (Supabase Auth, the `auth` schema)

The GitHub provider only. The owner's identity row in `auth.identities` carries `provider_id` = the
GitHub numeric id, written by Supabase on the server. Nothing in `public` refers to a person except
`owner_allowlist.github_id` and `observations.actor_login` (owner or bot). Email/password, magic links
and every other provider are disabled in the dashboard and asserted off in T01's review.

## 7. Clients and keys (`src/lib/supabase/`)

- `client.ts` (browser): publishable key only, used for the Auth redirect and nothing else.
- `server/session.ts`: server client with the session cookie; calls `select public.is_owner()` for the
  app gate.
- `server/admin.ts`: service-role client, imported only by `src/app/api/**/route.ts` and the import
  server action; `guard:data` rule 6 and `guard:surfaces` keep it server-only.

## 8. Generated types

`pnpm supabase gen types typescript --local > src/lib/supabase/database.types.ts` after every migration;
CI fails when the committed file differs (the pilot's `ci.yml` step).

## 9. Seeds and tests

`supabase/seed.sql` holds only synthetic rows (project `FIXTURE`, run `gha-1-1`, a few events; no real
id). pgTAP in `supabase/tests/`: RLS enabled on every table; every policy references
`public.is_owner()`; `anon` reads 0 rows from every table; `owner_allowlist` has no policy and no grant;
`is_owner()` is `security definer` with `proconfig = {search_path=}` and is the only such function; the
`event_usage` check constraint; the `events` unique key; `usage_by_attempt` returns 0 rows to `anon`.

## 10. Migrations (forward-only, expand-then-contract)

`supabase/migrations/<14-digit timestamp>_<snake_name>.sql`; a migration on `main` is never edited
(`guard:data` rules 1–2). T01: `owner_allowlist`, `is_owner()`. T02: `projects`, `runs`, `events`,
`event_usage`, `event_rejections`. T03: `webhook_deliveries`, `observations`. T06: `usage_by_attempt`.
T07: `verify_reported_events`. Each has a down file under `supabase/down/` for rollback (`M1.md` §10).
