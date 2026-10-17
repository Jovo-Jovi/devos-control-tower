# TOWER — Content model

Precedence 6. The Tower has **no editorial content**: no `content/` folder, no CMS, no synthetic client
text. What it renders is interface text from the catalogue and data from Postgres.

## 1. Files

| Path | Holds | Written by |
|---|---|---|
| `src/i18n/messages/en.json` | every interface string (labels, state texts, button names, legend) | the builder, under the fence |
| `supabase/seed.sql` | synthetic fixture rows for local and CI (`FIXTURE` project, run `gha-1-1`, events, one `event_usage` pair) | the builder (T02), extended by T06 |
| `tests/fixtures/*.json` | contract events and CLI result shapes used by unit and e2e tests | the builder |

Nothing else is content. `guard:naming` still reads `docs/GLOSSARY.md` §3 and scans `content/` (absent →
nothing to scan) and `src/` type names.

## 2. Fields rendered as data (never translated, never reworded)

Contract fields: `project`, `run`, `seq`, `phase`, `task`, `step`, `status`, `at`, `evidence`, `usage.*`.
Server fields: `received_at`, `origin`, `source`. GitHub fields: repository `owner/name`, sha, context,
state, login (owner or bot only). They are shown verbatim in `--font-mono` where they are identifiers.

## 3. Routes

| Route | Page | Task |
|---|---|---|
| `/sign-in` | sign-in (states: signed-out, denied, error) | T01 |
| `/` | portfolio | T04 |
| `/projects/new` | register a project | T04 |
| `/projects/[key]/usage` | usage view | T06 |
| `/projects/[key]` | project page | T07 |
| `/projects/[key]/import` | history import | T10 |
| `/api/projects` | read API (owner session) | T04 |
| `/api/ingest` | machine route, contract events | T02 |
| `/api/github/webhook` | machine route, App deliveries | T03 |
| `/projects/[key]/keys`, `/scope`, `/api/github/reconcile` | M2 / M5 | later |

`/` with no session → `302 /sign-in`. An unknown `[key]` → 404 page in the design's words.

## 4. Validation

Inbound events: the JSON Schema of `seed/06-event-contract.md` §1.1 compiled once at module load
(`src/lib/contract/schema.ts`, generated from the contract file in `devos-plan` and committed; a unit
test compares it with the pinned source). Forms: key pattern `^[A-Z][A-Z0-9_-]{1,31}$`, repository
`^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$`, stale window 1–100 000 minutes; errors in words beside the field.
Import file: JSON Lines, every line validated as an event before any insert; one invalid line → the whole
upload is refused with the line number.
