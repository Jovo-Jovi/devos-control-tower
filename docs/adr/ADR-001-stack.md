# ADR-001 — Stack: Next.js on Vercel, Postgres on Supabase

**Status:** Accepted, 2026-10-17 (decision 3). Lands in `devos-control-tower/docs/adr/` by T01.
**Source:** `devos-plan` @ `1a3c2a9` — `seed/00-SEED.md` (Control Tower), `seed/05-decisions.md` #3,
`plan/M0.md` §6 (capacity check), `plan/M1.md`.

## Context

The Control Tower is a separate private product — Discover · Monitor · Trace · Verify — with its own
repository and deployment, never a dependency for local work. Its model is relational: projects, runs and
events with a uniqueness rule `(project, run, seq)` for idempotency, ordered reads by `seq`, and a verification
join between reported events and observed commit statuses on the same commit and context. The pilot already
proves a Next.js application with the Supabase module (migrations, pgTAP, RLS, server-only secret key,
preview deployments on Vercel) under the automated method; the Tower is built with that method unchanged.

Firestore was considered and rejected: Trace/Verify needs joins and unique constraints across fields, which
Firestore gives only through client-side transactions and denormalisation; the pilot's Firestore module is a
server-read content store, not a ledger.

## Decision

- Repository `devos-control-tower`, created from the pilot's `AUTOMATION.md` §11 copy list (method files
  unchanged), built and reviewed through `devos-cycle` on GitHub.
- Next.js application deployed on Vercel as a private deployment (Deployment Protection — ADR-004).
- Postgres on Supabase, in its own Supabase project (second active project — M0 capacity check), with the
  pilot's Supabase module active: migrations under `supabase/migrations/`, pgTAP proofs, RLS on every table,
  the secret key only on the server (route handlers), the publishable key on the client.
- Supabase Auth for the owner's sign-in (ADR-002). No R2 or Firestore module in the Tower.
- Tables of v1: `projects`, `runs`, `events`, `event_rejections` (T02), `webhook_deliveries`, `observations`
  (T03), `ingest_keys` (M2 T08), `owner_allowlist` (T01); `repositories`, `integrations` (M5).

## Consequences

- The Tower needs a second Supabase project; if the free tier has no slot, the options in `plan/M0.md` §6 are
  decided by the owner before T01 — nothing is chosen silently.
- Free-tier pausing is shown as Tower health (last contact vs last activity, health banner), never as a
  project's fault.
- Every migration is a risk-3 deep-review path (`deep_paths`), as in the pilot.
- The Tower reports its own events from TM01, so from M1's end it observes itself.
- Moving off Vercel or Supabase later is a new ADR; the event contract (pilot ADR-004) does not change with it.
