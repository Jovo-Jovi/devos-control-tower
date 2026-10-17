# TOWER — Glossary

**Status:** SIGNED with the bootstrap commit (OD-01). Precedence 1, with `PRODUCT_BRIEF.md`.

## 1. Entities

| Entity | Meaning | Table |
|---|---|---|
| `Project` | One registered repository that reports to the Tower: key (`PILOT`, `TOWER`), repository `owner/name`, the owner's numeric GitHub id, its stale window | `projects` |
| `Run` | One execution that produced events: a GitHub Actions run (`gha-<run_id>-<attempt>`), a local runner run (`local-<ulid>`, M2) or an import (`import-<commit>`) | `runs` |
| `StepEvent` | One contract event: `{ v, project, run, seq, phase, task, step, status, at, evidence }` plus the server-set `received_at`, `origin`, `source` | `events` |
| `EventUsage` | One agent-usage entry attached to a `build` or `review` `StepEvent`: agent, tool, model, account alias, four token counts, `source` measured or unavailable | `event_usage` |
| `EventRejection` | The reason-only trace of a refused event: `received_at`, `reason`. Never the body, never a token | `event_rejections` |
| `WebhookDelivery` | One GitHub App delivery, by delivery id, kept for idempotency | `webhook_deliveries` |
| `Observation` | One fact the GitHub App reported about a commit or pull request: `workflow_run`, `check_run`, `status` (with its context, e.g. `devos/verdict`), `pull_request` | `observations` |
| `OwnerAllowlist` | The single row holding the owner's GitHub numeric id, inserted by the owner in the SQL editor; read only by `public.is_owner()` | `owner_allowlist` |
| `IngestKey` (M2) | A per-project write-only key, shown once, stored hashed, revocable | `ingest_keys` |

## 2. Terms

- **Step**: one of the eleven contract steps — intake · fence · build · checks · guards · evidence ·
  review · verdict · gate · merge · deploy.
- **Status**: one of six — started · pass · fail · revise · waiting · skipped. `started` means "running
  now" in Monitor.
- **Origin**: how the Tower knows a fact. **reported** — an authenticated event from the project's
  runner; **observed** — a GitHub App webhook or commit status; **verified** — a reported `checks`,
  `verdict` or `gate` result matched by an observed commit status with the same sha and context whose
  state agrees; **imported** — written by the history import. Every fact carries its origin and its age.
- **Last activity** vs **last contact**: `max(at)` of a project's events (what the project said happened)
  vs `max(received_at)` (when the Tower last heard from it). Shown as two values, never merged.
- **Fresh / stale**: a project with no contact for longer than its `stale_after_minutes` (default 1 440)
  is **stale**; the label shows the last-seen time. Stale is a statement about contact, not about failure.
- **Tower-health banner**: shown when the Tower's own database query fails at render time; no number is
  invented under it.
- **Coverage**: "X of Y attempts measured" — Y counts every `build`/`review` event that ended (pass,
  fail or waiting) for the agent, X those whose `usage` is `measured`.
- **Fence**, **Report**, **Verdict**, **Runner**: as in the pilot — `docs/fences/Tnn.md` written by the
  reviewer; `docs/reports/Tnn.md` by the builder (its `## Usage (generated — do not edit)` section by the
  runner); `docs/reviews/Tnn-aN.md` by the reviewer; the runner is `devos-cycle` on GitHub or
  `scripts/devos/loop.mjs` locally.

## 3. Forbidden bare nouns

These words are ambiguous. As a **bare** name of a type, interface, route segment or content field they
are a defect, and `guard:naming` fails the build.

```
event events item items data info user users log logs record records status
```

Qualified replacements:

- `event` → **`StepEvent`** (type), `stepEvents` (collection). A bare `Event` collides with the DOM type.
- `user` → **forbidden.** The Tower has an **owner** (`Owner`, `isOwner`) and **projects**; it holds no
  user accounts beyond the owner's Supabase Auth identity.
- `log` → **`WebhookDelivery`** or **`Observation`**; `record` → name the entity; `status` as a type name
  → **`StepStatus`** (the contract's six values) or **`CommitStatus`** (GitHub's observed state) — the
  contract *field* `status` inside `StepEvent` is a field, not a type, and is permitted.
- `item`, `info`, `data` → **forbidden.** Name the entity.

PascalCase entity names are permitted only as the exact names in §1 (plus the qualified type names above).
Route segments in use: `projects`, `new`, `usage`, `import`, `keys` (M2), `scope` (M5), `api`, `ingest`,
`github`, `webhook`, `reconcile` (M5), `sign-in` — none is a forbidden noun.
