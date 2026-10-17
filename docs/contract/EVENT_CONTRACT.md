# 06 — Event contract v1

One tiny event per workflow step, sent by the runner when the step ends. Reporting never blocks work.
This document is normative for `report.mjs` (sender), the Tower's `/api/ingest` (receiver), the local
runner (M2) and the import page (T06). Adopted by pilot ADR-004; authentication by pilot ADR-005.

## 1. Event

```json
{ "v": 1, "project": "PILOT", "run": "gha-18234567890-1", "seq": 7,
  "phase": "P07", "task": "T26", "step": "verdict", "status": "pass",
  "at": "2026-10-21T09:14:03.512Z", "evidence": "docs/reviews/T26-a1.md@9f3c2ab" }
```

| Field | Type | Rule |
|---|---|---|
| `v` | integer | always `1` for this contract |
| `project` | string | project key as registered in the Tower: `^[A-Z][A-Z0-9_-]{1,31}$` (`PILOT`, `TOWER`, `B2S`, `NEL`) |
| `run` | string | one run of one workflow or one local attempt: CI `gha-<GITHUB_RUN_ID>-<GITHUB_RUN_ATTEMPT>`; local `local-<ULID>`; import `import-<commit>` |
| `seq` | integer ≥ 1 | position of the event inside its run, assigned by the sender, strictly increasing, starting at 1 |
| `phase` | string or null | ledger phase (`P05`, `PM`); null when no phase applies |
| `task` | string or null | ledger task id `^[A-Z]{1,3}[0-9]{2,3}$` (`T26`, `PM01`, `TM01`, `E01`, `A01`); null for `deploy` and for runs without a task |
| `step` | enum | `intake` · `fence` · `build` · `checks` · `guards` · `evidence` · `review` · `verdict` · `gate` · `merge` · `deploy` |
| `status` | enum | `started` · `pass` · `fail` · `revise` · `waiting` · `skipped` |
| `at` | string | RFC 3339 UTC with `Z`, millisecond precision allowed; the moment the step ended (or began, for `started`) by the sender's clock — **display only, never used for ordering** |
| `evidence` | string or null | `path@commit` (a repository path that exists at that commit) or `@commit` (commit only); commit = 7–40 hex; null only when nothing has been committed yet |
| `usage` | array, **optional** | agent usage of the step that just ended — only on `build` and `review` events with status `pass`, `fail` or `waiting`; one entry per model actually used (§1.2); absent on every other event |

Body limit **2 048 bytes** of UTF-8 JSON. One event per request. No other field is accepted (`400`).

### 1.2 `usage` — agent usage of a build or review (optional, v1)

```json
"usage": [{ "agent": "reviewer", "tool": "claude-code", "model": "claude-opus-5-5",
            "account_alias": "claude-1", "input": 184203, "output": 9120,
            "cache_read": 1620044, "cache_write": 88010, "source": "measured" }]
```

| Field | Rule |
|---|---|
| `agent` | `builder` or `reviewer` — which role the invocation served (`build` events carry `builder` entries, `review` events `reviewer` entries) |
| `tool` | the CLI that ran: `cursor-agent`, `claude-code`; an interactive session (`cursor-ide`, `claude-code-interactive`) is always `unavailable` |
| `model` | the model id as the runner requested it (`grok-4.7-high`, `claude-opus-5-5`) or, when the tool reports per-model totals, the model id the tool reports |
| `account_alias` | `<tool>-<n>` from the runner's account switch (`cursor-1`, `claude-2`) — never an email or a login |
| `input`, `output`, `cache_read`, `cache_write` | integer token counts ≥ 0 as the tool reports them, or `null` for a field the tool does not expose. **Never estimated, never derived.** |
| `source` | `measured` — every number comes from the tool's own result output; `unavailable` — the tool exposed no usage (all four numbers `null`) |

Rules: one entry per model the tool reports (a review that fell back to a second model carries two
entries); an invocation that was parked on a usage limit and repeated on the other account carries one
entry per invocation that produced a result; no prompt text, no account email, no cost figure in v1
(subscription CLIs); the runner — never an agent — writes `usage` from the CLI's result file. The verified
result fields of each CLI are recorded in pilot ADR-004 §"Agent usage — verified fields". Every event with
`usage` stays ≤ 2 048 bytes (an entry is ≈ 170 bytes; four entries fit).

Set by the **server**, never by the sender: `received_at` (arrival time), `source` (`ci` when the request
was authenticated by OIDC, `local` by ingest key, `import` by the owner's upload), `origin` (`reported` for
ci and local, `imported` for import; `observed` rows come from the GitHub App, `verified` is derived — §7).

### 1.1 JSON Schema (draft 2020-12)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "devos-plan:seed/06-event-contract.md#v1",
  "title": "DEV_OS event v1",
  "type": "object",
  "additionalProperties": false,
  "required": ["v", "project", "run", "seq", "phase", "task", "step", "status", "at", "evidence"],
  "properties": {
    "v": { "const": 1 },
    "project": { "type": "string", "pattern": "^[A-Z][A-Z0-9_-]{1,31}$" },
    "run": { "type": "string",
             "pattern": "^(gha-[0-9]{1,20}-[0-9]{1,3}|local-[0-9A-HJKMNP-TV-Z]{26}|import-[0-9a-f]{7,40})$" },
    "seq": { "type": "integer", "minimum": 1, "maximum": 100000 },
    "phase": { "type": ["string", "null"], "pattern": "^[A-Z][A-Z0-9-]{0,15}$" },
    "task": { "type": ["string", "null"], "pattern": "^[A-Z]{1,3}[0-9]{2,3}$" },
    "step": { "enum": ["intake", "fence", "build", "checks", "guards", "evidence",
                       "review", "verdict", "gate", "merge", "deploy"] },
    "status": { "enum": ["started", "pass", "fail", "revise", "waiting", "skipped"] },
    "at": { "type": "string",
            "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]{1,3})?Z$" },
    "evidence": { "type": ["string", "null"], "maxLength": 200,
                  "pattern": "^([A-Za-z0-9][A-Za-z0-9._/-]{0,159})?@[0-9a-f]{7,40}$" },
    "usage": {
      "type": "array", "minItems": 1, "maxItems": 4,
      "items": {
        "type": "object", "additionalProperties": false,
        "required": ["agent", "tool", "model", "account_alias", "input", "output",
                     "cache_read", "cache_write", "source"],
        "properties": {
          "agent": { "enum": ["builder", "reviewer"] },
          "tool": { "type": "string", "pattern": "^[a-z][a-z0-9-]{1,31}$" },
          "model": { "type": "string", "pattern": "^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$" },
          "account_alias": { "type": "string", "pattern": "^[a-z][a-z0-9-]{0,31}$" },
          "input": { "type": ["integer", "null"], "minimum": 0 },
          "output": { "type": ["integer", "null"], "minimum": 0 },
          "cache_read": { "type": ["integer", "null"], "minimum": 0 },
          "cache_write": { "type": ["integer", "null"], "minimum": 0 },
          "source": { "enum": ["measured", "unavailable"] }
        }
      }
    }
  },
  "allOf": [
    { "if": { "required": ["usage"] },
      "then": { "properties": { "step": { "enum": ["build", "review"] },
                                "status": { "enum": ["pass", "fail", "waiting"] } } } }
  ]
}
```

The `allOf` rule makes `usage` legal only on `build` and `review` events that ended. A receiver that
cannot evaluate `if/then` enforces the same rule in code.

## 2. Steps and statuses

| Step | Meaning | Terminal statuses | `started` |
|---|---|---|---|
| `intake` | the reviewer's intake produced or reissued a fence | pass · fail · waiting · skipped | no |
| `fence` | the runner loaded and validated the fence for this attempt | pass · fail | no |
| `build` | the builder's attempt, committed and pushed by the runner | pass · fail · waiting | **yes** |
| `checks` | required checks (typecheck, lint, test, build, module checks) | pass · fail · skipped | no |
| `guards` | surface guards and repository guards | pass · fail | no |
| `evidence` | evidence pack: `evidence.md`, `ci-results.json`, screenshots, preview | pass · fail | no |
| `review` | the reviewer finished and the review file is committed | pass · fail · waiting | **yes** |
| `verdict` | PASS / FAIL recorded in the ledger; red overrides PASS (PR-08) | pass · fail · revise · waiting | no |
| `gate` | a human must act (named gate, risk 3, halt) or no gate applies | pass · waiting · skipped | no |
| `merge` | the task branch reached `main` and the ledger was ticked | pass · fail | no |
| `deploy` | production deploy through `devos-deploy` | pass · fail · waiting · skipped | **yes** |

Rules:
- Every step that ran emits **exactly one terminal event**. `started` is optional and only for `build`,
  `review` and `deploy`; it lets the Tower show "running since". A `started` without a terminal event is shown
  as running until the project's stale window passes, then as "unfinished".
- `revise` is used only by `verdict`: a FAIL whose classification includes `DESIGN REVISE` (M3). Before M3 no
  event carries `revise`.
- `waiting` means the step stopped for something outside the run: usage limit, human gate, missing setting,
  model unreachable (local, M2). Nothing is claimed done. The reason is not in the event; it is visible as
  observed labels (`devos:quota-wait`, `devos:human-gate`, `devos:halted`, setup issue) or in the local
  state file.
- `skipped` means the step was not applicable and nothing ran (`gate skipped` for a non-gated PASS that
  auto-merges; `deploy skipped` when deploy is disabled; `checks skipped` when the builder parked before any
  commit).
- `fail` is only for work that ran and failed. **Never** emit `pass` or `fail` for work that did not happen.

## 3. Mapping onto the pilot's `devos-cycle` (PM01)

| Workflow moment | Event | `evidence` |
|---|---|---|
| fence rendered (`render-prompt`) | `fence pass` / `fail` (fence missing or invalid, PR-09) | `docs/fences/<task>.md@<branch head>` |
| before "Builder — Cursor CLI" | `build started` | `@<branch head>` or null |
| after "Commit and push the builder's work" | `build pass` | `@<pushed sha>` |
| "Park (usage limit) or halt" | `build waiting` (limit) / `build fail` (builder error) | `@<head>` or null |
| "Guard — builder surface", "Guard — method files" fail | `guards fail` (job stops) | `@<pushed sha>` |
| after "Checks" (`run-checks`) | `checks pass` / `fail` from `ci-results.json` (required checks except `guards`); `guards pass` / `fail` from the `guards` check | `@<pushed sha>` |
| after preview, screenshots and "Review plan and evidence pack" | `evidence pass` / `fail` | `@<pushed sha>` |
| before "Reviewer — Claude Code" | `review started` | `@<pushed sha>` |
| after "Commit and push the review" | `review pass`; reviewer error → `review fail`; reviewer usage limit → `review waiting` | `docs/reviews/<task>-a<n>.md@<review sha>` |
| after "Verdict" and the `devos/verdict` status | `verdict pass` / `fail` / `revise`; action `setup_wait` → `verdict waiting` | same review file `@<review sha>` |
| "Act on the verdict": `merge` | `gate skipped`, then `merge pass` | `docs/PHASES.md@<merge sha>` |
| `human_gate`, `halt` | `gate waiting` | review file `@<review sha>` |
| `retry`, `quota_wait` | nothing further (already reported) | — |
| "Halt on a runner failure" | `<current step> fail` (step from `.devos/report-state.json`) | `@<head>` or null |
| end of the `cycle` job | `devos-flush` (§6) | — |

Not reported: the `resolve` job (settings check, heavy-run hold — visible as an observed `workflow_run` in
progress) and the `wait-and-resume` job (the `waiting` event was already emitted).

Companions (PM02): `devos-intake` → `intake pass | fail | waiting`; `devos-doctor` → `gate pass` when the
human has merged, `gate waiting` otherwise; `devos-advance` → `merge pass | fail`; `devos-deploy` → `deploy
started | pass | fail | waiting | skipped`; `devos-wait` / `devos-resume` → `<parked step> waiting` on each
re-check that still waits; `ci.yml` → `checks pass | fail`; `devos-setup` → nothing.

Local runner (M2): the same moments; `run = local-<ULID>`; the journal line is written **before** the send;
a model that cannot be reached → `<step> waiting` and stop.

## 4. Identity and sequencing

- `run` is created by the runner at the start of the job and kept in `.devos/report-state.json`
  `{ run, seq, step }`. `seq` increments per event; the state file lives in `.devos/` for the job's life.
- Different workflows on the same commit are different runs. A retry attempt of a GitHub run has a new
  `GITHUB_RUN_ATTEMPT` and therefore a new `run`.
- `seq` gaps are possible only when the journal was lost beyond the re-send window; the Tower shows a gap as
  "missing events" and never fills it.

## 5. Idempotency, ordering, time

- Unique key **(project, run, seq)**.
  - Same key, **identical body** → `200 { "stored": false, "duplicate": true }` — a success; the sender
    marks the line `sent`.
  - Same key, **different body** → `409 { "error": "duplicate_conflict" }` — nothing stored, one
    reason-only rejection row, **the first event wins**; the sender marks the line `sent-with-conflict`,
    logs it (`conflict: <run> seq <n>` in the step log and in `.devos/journal.jsonl`), and **never
    retries it**.
- Events are ordered by `seq` inside a run. Runs are ordered by the server's `runs.created_at` (the first
  arrival of any event of that run). Re-send happens **before** a run's own events (§6), so order is kept in
  the normal case; the Tower shows each run's `at` range and labels re-sent events.
- "Current status of a task·step" = the terminal event with the greatest (`runs.created_at`, `seq`) for that
  project, task and step.
- Freshness per project: **last activity** = max(`at`), **last contact** = max(`received_at`), shown
  separately. **Stale** when now − last contact > `stale_after_minutes` (default 1 440, per project). A
  **Tower-health banner** is shown when the Tower itself could not receive or render; it is never the
  project's label.

## 6. Reporting never blocks

Step shape in every workflow (the guard checks it when `tower.required` is true):

```yaml
- name: devos-report <step>
  if: always()
  continue-on-error: true
  timeout-minutes: 1
  run: node scripts/devos/report.mjs send --step <step> --status <status> [--evidence <path@sha>]
```

- `report.mjs` requests the OIDC token (CI) or reads the key (local), posts once with
  `AbortSignal.timeout(5000)`, and **exits 0 whatever happens**. Every event is appended to
  `.devos/journal.jsonl` first as `{ "event": {…}, "sent": false, "attempts": 0, "last_error": null,
  "queued_at": "<ts>" }`; the line's `sent` field then records the outcome: `true` on `200` (stored or
  duplicate), `"conflict"` on `409` (logged, never retried), `false` with `attempts` and `last_error` on any
  other answer, timeout or network error.
- `devos-flush` (last step of the job, same shape) re-posts every `sent: false` line in order, once each,
  within the step's minute; `200` → `sent: true`; `409` → `sent: "conflict"` and a log line; anything else
  → `attempts + 1`, still `false`. Lines marked `true` or `"conflict"` are never posted again.
- `.devos/` is uploaded as the run's artifact (already the case). PM02 adds: each reporting workflow uploads
  the journal as `devos-journal-<workflow>`; its **next run** (`actions: read`) downloads the latest one before
  its own work, re-posts only lines with `sent: false` whose run is within the **window of the last 3 runs
  or 7 days**, carries still-unsent lines into its own journal, and keeps every original `at`. Lines marked
  `true` or `"conflict"` are carried for the record but never re-posted. Older lines are dropped from the
  journal and the gap is shown by the Tower as observed/imported only.
- Local: `devos sync` is `flush` with the key; the next local run flushes first.
- A fork pull request has no OIDC token and CI has no key: its events stay in the journal and are never sent
  from CI; the Tower sees the run only as observed.
- Reporting adds at most ≈ 5 s per reporting point to a run (≈ 12 points → ≤ 1 min worst case); measured at
  CK1.

## 7. Origin: reported · observed · verified · imported

| Origin | Comes from | Stored as |
|---|---|---|
| **reported** | `/api/ingest` with OIDC (ci) or ingest key (local) | `events` row, `origin = reported`, `source = ci | local` |
| **observed** | GitHub App webhooks: `workflow_run`, `check_run`, `status`, `pull_request` (Tower ADR-003) | `observations` row |
| **verified** | derived, not stored by the sender: a reported `checks`, `verdict` or `gate` event whose `evidence` commit `c` has an observed commit status on `c` with context `devos/<step>` and matching state (`pass` ↔ `success`; `fail`, `revise` ↔ `failure` or `error`) | label computed when read (or materialised by the Tower) |
| **imported** | the owner's upload on `/projects/<key>/import` (T06) — the pilot's `PHASES.md`, reviews, reports and git history as events with `run = import-<commit>` | `events` row, `origin = imported`, `source = import` |

A reported completion without a matching observation is shown as **reported**, never as verified. Observed
facts without a report (a status the Tower never got an event for) are shown as **observed**. Every label
is shown with its age.

## 8. Transport and answers

`POST {TOWER_URL}/api/ingest` — production host only (Tower ADR-004); `Content-Type: application/json`;
`Authorization: Bearer <OIDC token | ingest key>`.

| Answer | Meaning | Sender's action |
|---|---|---|
| `200 { "stored": true, "duplicate": false }` | stored | `sent: true` |
| `200 { "stored": false, "duplicate": true }` | identical event already stored — a success | `sent: true` |
| `400 { "error": "schema" }` | body violates §1.1 | keep `false`; a bug in the sender, surfaced by `report.mjs --dry` tests |
| `401 { "error": <reason> }` | authentication failed: `no_token` · `bad_issuer` · `bad_audience` · `bad_signature` · `expired` · `repo_not_registered` · `owner_mismatch` · `owner_not_consented` (M5) · `key_invalid` · `key_revoked` · `key_project_mismatch` | keep `false`, retry at flush / next run; nothing stored server-side except a reason-only rejection row |
| `404` | not the production host | keep `false` (misconfigured `tower.url`) |
| `409 { "error": "duplicate_conflict" }` | same key, different body; the first event wins | `sent: "conflict"`, log it, **never retry** |
| `413 { "error": "too_large" }` | body > 2 048 bytes | keep `false`; sender bug |
| `429` / `5xx` / timeout / network error | Tower unavailable | keep `false`, retry at flush / next run |

The Tower logs rejections as `(received_at, reason)` only — no token, no claims, no body.

## 9. Versioning

`v = 1` is frozen by this document: the field set, enums, limits and key. Any change to a field, enum or
limit is `v = 2` with its own schema; additive fields are not slipped into v1 because the server rejects
unknown fields. The Tower accepts `v = 1` for its lifetime. A change of `TOWER_URL` (audience) is not a
contract change but is announced here in a change log line.

Change log: v1 — 2026-10-17, first version; same day, before any sender existed: optional `usage` on
`build`/`review` terminal events, `409 duplicate_conflict` handling (sent-with-conflict, never retried).
v1 is frozen at the B0 push of `devos-plan`.

## 10. Examples

Pass (verdict):
```json
{ "v": 1, "project": "PILOT", "run": "gha-18234567890-1", "seq": 9, "phase": "P07", "task": "T26",
  "step": "verdict", "status": "pass", "at": "2026-10-21T09:14:03.512Z",
  "evidence": "docs/reviews/T26-a1.md@9f3c2ab" }
```
Fail (checks, red check will override any PASS):
```json
{ "v": 1, "project": "PILOT", "run": "gha-18234570001-1", "seq": 4, "phase": "P07", "task": "T27",
  "step": "checks", "status": "fail", "at": "2026-10-22T07:02:41Z", "evidence": "@c01dbee" }
```
Revise (verdict, DESIGN REVISE — M3 onward):
```json
{ "v": 1, "project": "TOWER", "run": "gha-18300000123-1", "seq": 9, "phase": "P03", "task": "T09",
  "step": "verdict", "status": "revise", "at": "2026-11-04T15:40:12.004Z",
  "evidence": "docs/reviews/T09-a1.md@77ab190" }
```
Review ended with measured usage (Claude Code, one model):
```json
{ "v": 1, "project": "PILOT", "run": "gha-18234567890-1", "seq": 8, "phase": "P07", "task": "T26",
  "step": "review", "status": "pass", "at": "2026-10-21T09:13:58.120Z",
  "evidence": "docs/reviews/T26-a1.md@9f3c2ab",
  "usage": [{ "agent": "reviewer", "tool": "claude-code", "model": "claude-sonnet-5-5",
              "account_alias": "claude-1", "input": 184203, "output": 9120,
              "cache_read": 1620044, "cache_write": 88010, "source": "measured" }] }
```
Build ended, usage unavailable (Cursor CLI exposes no token counts):
```json
{ "v": 1, "project": "PILOT", "run": "gha-18234567890-1", "seq": 3, "phase": "P07", "task": "T26",
  "step": "build", "status": "pass", "at": "2026-10-21T08:52:30Z", "evidence": "@c01dbee",
  "usage": [{ "agent": "builder", "tool": "cursor-agent", "model": "grok-4.7-high",
              "account_alias": "cursor-1", "input": null, "output": null,
              "cache_read": null, "cache_write": null, "source": "unavailable" }] }
```
Waiting (build parked on a usage limit, nothing pushed yet):
```json
{ "v": 1, "project": "PILOT", "run": "gha-18234580002-1", "seq": 2, "phase": "PM", "task": "PM02",
  "step": "build", "status": "waiting", "at": "2026-10-23T11:30:00Z", "evidence": null }
```
Started (build) and skipped (gate for an auto-merged task):
```json
{ "v": 1, "project": "PILOT", "run": "gha-18234567890-1", "seq": 2, "phase": "P07", "task": "T26",
  "step": "build", "status": "started", "at": "2026-10-21T08:31:10Z", "evidence": "@4ccbef7" }
{ "v": 1, "project": "PILOT", "run": "gha-18234567890-1", "seq": 10, "phase": "P07", "task": "T26",
  "step": "gate", "status": "skipped", "at": "2026-10-21T09:14:05Z", "evidence": "docs/reviews/T26-a1.md@9f3c2ab" }
```
Imported (replayed history):
```json
{ "v": 1, "project": "PILOT", "run": "import-4ccbef7", "seq": 61, "phase": "P05", "task": "T14",
  "step": "verdict", "status": "pass", "at": "2026-10-12T18:22:09Z",
  "evidence": "docs/reviews/T14-a2.md@b7e1f00" }
```

## 11. Conformance checklist (used by the M1 fences)

Sender (`report.mjs`): builds only the ten fields plus `usage` where §1.2 allows it · validates against §1.1
before sending · ≤ 2 048 bytes · `seq` from `.devos/report-state.json` · OIDC audience = `tower.url` · 5 s
timeout · journal first, outcome recorded per line (`true` / `"conflict"` / `false`) · exit 0 always · `--dry`
prints the event and never a token · reads no secret · `flush` re-posts only `false` lines, in order ·
`usage` numbers copied from the CLI result file, never computed; `unavailable` when the tool exposes none.

Receiver (`/api/ingest`): production host only · body limit before parsing · schema check including the
`usage` rule · authentication per ADR-005 in the stated order · `source` and `origin` set server-side ·
insert `on conflict do nothing` on `(project_id, run_id, seq)` with body comparison for `200 duplicate` vs
`409` · `usage` entries stored in `event_usage` · reason-only rejection rows · answers exactly as §8.

Tower pages: order by `seq` and `runs.created_at`, never by `at` · last activity and last contact shown
separately · stale per project · health banner for the Tower's own failures · every label with its age ·
verified only by the §7 rule.
