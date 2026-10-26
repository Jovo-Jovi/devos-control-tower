# Request — issue #46: link requests from DEV_OS projects

## What was asked (the owner's words, from `.devos/request.md`)

> DEV_OS projects whose developer opted in will ask the Tower to link them. I approve each request once; the Tower
> then adds the project, and its cycle events (event contract v1) start to arrive.
>
> 1. A new machine route, POST /api/link, on the production host only, like /api/ingest. Authorization: Bearer <GitHub
>    OIDC token of the project's workflow>, verified exactly as /api/ingest does (verifyGithubOidc, audience =
>    TOWER_URL). The repository and its owner come from the token's claims (repository, repository_owner_id), never
>    from the body. The body is exactly { "v": 1, "key": "DEMO-SHOP", "engine": "0.2.9", "contract": "0-draft-3" }, at
>    most 1 KB: key matches ^[A-Z][A-Z0-9_-]{1,31}$; engine and contract are strings of at most 32 characters. Anything
>    else is 400 { "error": "schema" }. Answers: already a project row → 200 linked with its key; pending → 202 pending
>    (update last_requested_at, engine, contract); declined → 403 declined; a new repository → create a pending
>    request, 202; authentication fails → 401 { "error": <reason> }, the same reasons and reason-only rejection rows as
>    /api/ingest; unavailable: 429 or 5xx.
> 2. A table link_requests: repository, owner_github_id, proposed_key, engine_version, contract_version, state
>    (pending, approved, declined), first_requested_at, last_requested_at, decided_at. Unique on (repository,
>    owner_github_id). Owner-only under RLS, like every table.
> 3. A "Link requests" panel on the overview, for me only. It lists the pending requests with those fields. Approve:
>    create the projects row (key = the proposed key, or with -2, -3 … when that key is taken) and mark the request
>    approved. Decline: mark it declined, so the next /api/link answers 403. A linked project can be declined later:
>    its project row stays for the record and shows as disconnected.
> 4. docs/contract/ documents /api/link next to event contract v1.
>
> Not changing: /api/ingest and event contract v1. An approved repository's events are stored as today; any other
> repository keeps repo_not_registered.
>
> Why: the DEV_OS Engine is being released; a developer who opts in links their project by request, and nothing is
> registered until I approve it. This replaces the GitHub App registration planned as TR1. The Control Tower stays
> private and mine alone; engine users never get access to it, and the engine works the same whatever the link state.
>
> Judged done by: route tests for every answer (extra field 400, bad audience 401, 404 off the production host);
> approve with the proposed key and with -2; decline → 403; an approved repository's event stored, a pending one's
> rejected repo_not_registered; on production, POST /api/link with no token → 401 no_token (404 today); the panel
> visible only to the owner, signed in; no new public page. Size: feature (several tasks). Priority: next up.

No answers were added in the issue thread.

## What the repository shows

- `/api/ingest` (`src/lib/supabase/server/ingest.ts`) checks, in order: host, body size, schema, then the token, and
  it rejects with reason-only `event_rejections` rows. `verifyGithubOidc` (`src/lib/contract/oidc.ts`) returns
  `repository` and `repositoryOwnerId` from the claims. Because the body is read first, a `POST` without a token and
  without a body answers `400`, not `401`. `/api/link` therefore authenticates before it reads the body, so that the
  owner's production check (`401 no_token`) holds.
- `src/proxy.ts:46` passes `/api/ingest` and `/api/github/webhook` through untouched (no session, no CSP). `/api/link`
  needs the same line (T17).
- `projects.repo` is unique on its own (`20261017074305_ingest_schema.sql:4`). A repository registered under another
  owner id therefore cannot be approved a second time: the Tower answers `repo_taken`, and the request stays pending.
- `supabase/tests/002_ingest.sql` asserts 7 policies on the five ingest tables and no `DELETE` policy anywhere. To
  keep those proofs, every link write is a `service_role`-only function, reached by the owner's server actions after
  `requireOwner()`. That is the import action's pattern (`DATA_MODEL.md` §7).
- The `owner` zone was `"personal_data": false`. A developer's repository name (which carries their GitHub login),
  their owner id and their linked project's events are personal data of members of the public (Law 151 of 2020).
  PR-19 then requires the Personal-Data Protection gate and a private repository before the zone ships, and this
  repository is public (B0).

## What was decided (OD-12, DRAFT)

1. **The route** (OD-12 §2), with the request's answers, plus four precise readings:
   - authentication comes before the body;
   - `engine` and `contract` are 1–32 printable ASCII characters (`^[!-~]{1,32}$`), so that no control or direction
     character reaches the owner's panel;
   - an oversized body is `400 schema`, as the request says;
   - the 429 is a cap of 50 pending requests, so strangers' workflows cannot flood the panel.

   Every existing row's `last_requested_at` is updated, whatever its state, so that retention counts from the last
   request.
2. **The data** (OD-12 §3–§4, `DATA_MODEL.md` §2.10–§2.11, §4):
   - `link_requests`, with two columns more than asked: `id`, and `project_id`, the project an approval created.
   - `link_audit`, reason-only.
   - Six `security invoker` functions for `service_role` only.
   - Keys go `-2`, `-3`… cut to stay within 32 characters.
3. **`/api/ingest`** keeps its contract and answers. "Any other repository keeps repo_not_registered", together with
   "declined later … disconnected", is read as: a disconnected project's events are refused with the existing
   `401 repo_not_registered`. That is one condition inside the route (T17). The owner can change this reading before
   merging the intake PR.
4. **Protection** (OD-12 §6, `docs/PROTECTION_MODEL.md`):
   - the zone is marked `"personal_data": true`;
   - daily retention by `pg_cron`: 180 days after the last request for undecided or declined requests, and 365 days
     after the decline for a disconnected project;
   - Export and Delete for the owner in the panel;
   - an audit row per change;
   - the Law 151 obligations listed for the owner to confirm with counsel;
   - **the repository becomes private before T17 merges**, because T17's merge is the first deploy that accepts a
     link request.
5. **The panel** (OD-12 §7) lists the Pending, Linked by request and Declined groups, with Approve · Decline · Export
   · Delete. A disconnected project gets its own link state on the map, list, detail panel and project page. The
   Ingestion health rejection label covers both machine routes.
6. **Tasks:**
   - **T15**, data, two stages. Fence: `docs/fences/T15.md`.
   - **T16**, the panel.
   - **T17**, the route, the proxy line, the ingest refusal and `docs/contract/LINK_CONTRACT.md`.
   - **T18**, the disconnected state and the whole flow end to end, with gate **G-Link-Requests**.

   All four are risk 3: migrations, personal data on screen, a machine route and the boundary.

## What was left out, and why

- **Re-approving a declined request in place:** not asked. Delete, followed by a new request, gives the same result,
  with an audit trail.
- **Notifying the owner of a new request** (email, push): not asked, and it would add a third party.
- **The engine side** (opt-in, sender, the notice to developers): it belongs to `devos-engine`. Law 151's
  transparency obligation rests on it, and `PROTECTION_MODEL.md` §3 says so.
- **A change to event contract v1, or the GitHub App on linked repositories:** the request keeps both unchanged.
- **Changing the plan's TR1 row in `devos-plan`:** another repository. The owner updates `plan/ID-MAP.md`.
- **The exact Law 151 periods, controller registration and cross-border-transfer steps:** these are legal decisions
  for the owner and counsel. They are listed in `PROTECTION_MODEL.md` §10 and are to be confirmed before
  G-Link-Requests.
- **`docs/setup-items.json`:** not needed. There is no new secret or variable, and `pg_cron` is enabled by the
  migration. The repository's visibility is not a setting the setup check can read by name, so OD-12 §6 and the T17
  and T18 gates carry it.
